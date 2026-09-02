import type { IncomingMessage } from 'node:http';

/**
 * Domain enforcement for Google sign-in.
 *
 * Container Apps' built-in auth proves that whoever is calling holds a valid
 * Google account. It does NOT prove which organisation they belong to: Google's
 * `hd` parameter on the authorisation request is a UI hint the client controls,
 * not a constraint the platform enforces. Without the check below, any Gmail
 * address in the world reaches this dashboard.
 *
 * The authoritative facts arrive as claims in `X-MS-CLIENT-PRINCIPAL`, which the
 * auth sidecar sets on every request and overwrites if a caller tries to supply
 * their own. We require a verified email inside the allowed domain.
 */

interface PrincipalClaim {
  typ: string;
  val: string;
}

interface ClientPrincipal {
  auth_typ?: string;
  claims?: PrincipalClaim[];
}

/** EasyAuth normalises some claims to SOAP-style URIs; accept either spelling. */
const EMAIL_CLAIMS = [
  'email',
  'preferred_username',
  'upn',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
];

const HOSTED_DOMAIN_CLAIMS = ['hd', 'http://schemas.google.com/hd'];

export interface Identity {
  email: string;
  hostedDomain: string | null;
  emailVerified: boolean | null;
  provider: string | null;
}

function decodePrincipal(header: string | undefined): ClientPrincipal | null {
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as ClientPrincipal;
  } catch {
    return null;
  }
}

function claim(principal: ClientPrincipal, names: string[]): string | null {
  for (const name of names) {
    const found = principal.claims?.find((c) => c.typ?.toLowerCase() === name.toLowerCase());
    if (found?.val) return found.val;
  }
  return null;
}

function headerValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function readIdentity(request: IncomingMessage): Identity | null {
  const principal = decodePrincipal(headerValue(request, 'x-ms-client-principal'));

  const email =
    (principal && claim(principal, EMAIL_CLAIMS)) ??
    headerValue(request, 'x-ms-client-principal-name') ??
    null;

  if (!email) return null;

  const verified = principal ? claim(principal, ['email_verified']) : null;

  return {
    email: email.toLowerCase(),
    hostedDomain: principal ? claim(principal, HOSTED_DOMAIN_CLAIMS) : null,
    // Absent is not the same as false — Entra does not send this claim at all.
    emailVerified: verified === null ? null : verified.toLowerCase() === 'true',
    provider: headerValue(request, 'x-ms-client-principal-idp') ?? principal?.auth_typ ?? null,
  };
}

export type AccessDecision =
  | { allowed: true; identity: Identity }
  | { allowed: false; reason: string; status: 401 | 403 };

/**
 * Fails closed. With a domain configured, a request with no identity is
 * rejected rather than served — if the auth sidecar is ever misconfigured, the
 * failure mode must be "nobody gets in", not "everybody does".
 */
export function checkAccess(request: IncomingMessage, allowedDomain: string | null): AccessDecision {
  const identity = readIdentity(request);

  if (!allowedDomain) {
    return identity
      ? { allowed: true, identity }
      : { allowed: true, identity: { email: '', hostedDomain: null, emailVerified: null, provider: null } };
  }

  if (!identity) {
    return { allowed: false, status: 401, reason: 'no authenticated identity on the request' };
  }

  if (identity.emailVerified === false) {
    return { allowed: false, status: 403, reason: 'email address is not verified' };
  }

  const domain = allowedDomain.toLowerCase();
  const emailDomain = identity.email.split('@')[1] ?? '';

  // For a Google Workspace account `hd` is the organisation Google itself
  // asserts, so when it is present it must agree.
  if (identity.hostedDomain && identity.hostedDomain.toLowerCase() !== domain) {
    return { allowed: false, status: 403, reason: `account belongs to ${identity.hostedDomain}` };
  }

  if (emailDomain !== domain) {
    return { allowed: false, status: 403, reason: `${identity.email} is outside ${domain}` };
  }

  return { allowed: true, identity };
}
