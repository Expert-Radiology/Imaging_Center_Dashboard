import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

/**
 * The ClickUp token.
 *
 * Preferred: `CLICKUP_TOKEN_SECRET_URI` pointing at a Key Vault secret, read
 * with the site's managed identity — Static Web Apps app settings do not support
 * Key Vault references, so the fetch happens here instead. Falls back to a
 * `CLICKUP_TOKEN` app setting for local development.
 *
 * The token is a personal token today. Move it to a service account before
 * launch, or the dashboard breaks the day someone rotates theirs.
 */
let cached: { value: string; fetchedAt: number } | null = null;
const CACHE_MS = 30 * 60 * 1000;

export async function getClickUpToken(): Promise<string | null> {
  const secretUri = process.env.CLICKUP_TOKEN_SECRET_URI;

  if (!secretUri) return process.env.CLICKUP_TOKEN ?? null;

  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.value;

  const url = new URL(secretUri);
  const vaultUrl = `${url.protocol}//${url.host}`;
  const secretName = url.pathname.split('/').filter(Boolean)[1];
  if (!secretName) throw new Error(`CLICKUP_TOKEN_SECRET_URI is malformed: ${secretUri}`);

  const client = new SecretClient(vaultUrl, new DefaultAzureCredential());
  const secret = await client.getSecret(secretName);
  if (!secret.value) throw new Error(`Key Vault secret ${secretName} has no value`);

  cached = { value: secret.value, fetchedAt: Date.now() };
  return cached.value;
}
