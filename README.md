# Imaging Center Onboarding — Pipeline Review

The weekly integration meeting's dashboard, live from ClickUp instead of hand-maintained.

Two views behind one toggle:

- **Executive Summary** — red/yellow/green by client, for Cristian Lorenzo, Dr. Avery Knapp and Adrian Greystoke.
- **Connection Matrix** — one row per connection, 17 columns, for the BD team and leadership. Link straight to it with `?view=matrix`.

Recreated from `design_handoff_onboarding_dashboard/` against Expert Radiology Design System v2.

---

## Shape

```
src/            React 19 + Vite + TypeScript. The two views, the design tokens, the data hook.
shared/         The payload contract and the status rules. Imported by both the app and the API.
api/            Node 20. server.ts serves the site and /api/dashboard; refresh-job.ts is the hourly poller.
infra/          Bicep: Container Apps, the refresh job, ACR, storage, Key Vault, RBAC.
Dockerfile      One image, two entrypoints.
```

The browser never calls ClickUp. An hourly job polls it, normalizes into one JSON payload, and
writes a blob; the web container reads that blob and serves it at `/api/dashboard`. The token
stays server-side, and a wall display plus three laptops cost one refresh between them rather
than 29 ClickUp requests each.

```
                    ┌──────────────────────────────┐
ClickUp ──hourly──▶ │ Container Apps job (cron)     │──▶ dashboard.json (Blob)
                    │ node dist/…/refresh-job.js    │──▶ weekly snapshot (Table)
                    └──────────────────────────────┘              │
                                                                  ▼
                    ┌──────────────────────────────┐     GET /api/dashboard
browser ──Entra──▶  │ Container App (min 0 replicas)│◀────────────┘
                    │ node dist/…/server.js         │
                    └──────────────────────────────┘
```

**Why the refresh is a separate job.** The web app scales to zero, so most of the day no process
of it is running. A timer inside the container would stop with the last replica. A Container Apps
job on a cron runs on its own schedule whether or not anyone is looking, which is exactly what a
Monday-morning dashboard needs.

Both run the **same image**, so the job can never normalize differently from what the site serves.

## Running it locally

```bash
npm install && npm run dev
```

That serves the UI on `http://localhost:5173` against the bundled snapshot in `src/data/seed.ts`.
`/api/dashboard` will 404 or 500, which is correct: the freshness strip says
"Bundled snapshot · live ClickUp refresh not yet wired" and the board still renders.

For the full stack, build the frontend once and run the API server; Vite proxies `/api` to it:

```bash
npm run build && (cd api && npm install && npm run build)
```

```bash
STATIC_ROOT=./dist PORT=8080 node api/dist/api/src/server.js
```

To run the refresh against real ClickUp, copy `api/.env.example`, fill in `CLICKUP_TOKEN` and the
storage account, then:

```bash
cd api && npm run build && node dist/api/src/refresh-job.js
```

It exits `0` when there is nothing to do, and `1` on failure — which is what makes Container Apps
mark the run failed and retry.

## Deploying to Azure

Azure Container Apps, scaled to zero: the site costs nothing while nobody is looking and wakes in
a couple of seconds on the first request. The hourly refresh runs as a Container Apps job, which
is unaffected by the app being asleep.

The template has a `deployWorkloads` flag so a brand-new resource group can be brought up in the
right order: registry, storage, vault and identity first, then the image, then the workloads that
consume them.

**1. Register two Entra apps.** One for GitHub to authenticate with (federated credentials, no
secret), one for people to sign in to the dashboard with. The sign-in app's redirect URI is
`https://<app-fqdn>/.auth/login/aad/callback`, and the FQDN only exists after step 3 — register with
a placeholder and update it afterwards.

**2. Bootstrap the infrastructure.**

```bash
az deployment group create --resource-group rg-imaging-center-dashboard --name bootstrap --template-file infra/main.bicep --parameters infra/main.parameters.json --parameters deployWorkloads=false aadClientId=<sign-in-app-id>
```

**3. Put both secrets in Key Vault.** They are deliberately not deployment parameters — see the
comment in `main.bicep`. Write them from a file with no trailing newline; a stray `\n` on the Entra
secret produces an "invalid client secret" that is genuinely unpleasant to diagnose.

```bash
printf '%s' '<clickup-token>' > /tmp/s && az keyvault secret set --vault-name <vault> --name clickup-token --file /tmp/s && rm -f /tmp/s
```

**4. Build the image**, then deploy the workloads.

```bash
az acr build --registry <registry> --image imaging-center-dashboard:latest --file Dockerfile .
```

```bash
az deployment group create --resource-group rg-imaging-center-dashboard --name main --template-file infra/main.bicep --parameters infra/main.parameters.json --parameters deployWorkloads=true aadClientId=<sign-in-app-id> imageTag=latest
```

**5. Point the redirect URI at the real FQDN**, which step 4 outputs as `appUrl`.

**6. Wire CI.** The workflow needs `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID`
as repository secrets, `AAD_CLIENT_ID` as a repository variable, and a `production` environment.
No secret values are passed to the deployment, so nothing else belongs in GitHub.

**7. Run the refresh once** rather than waiting for the top of the hour:

```bash
az containerapp job start --name caj-imgcenter-refresh --resource-group rg-imaging-center-dashboard
```

### What the deployment sets up

- **Hourly refresh** (`0 * * * *` UTC, change with the `refreshCron` parameter). Every run logs the
  connection count, whether it wrote a weekly snapshot, and the `Pending Contact?` coverage.
- **One weekly snapshot** to Table Storage. **Do not skip this** — "Last week" status, "new centers
  this week" and the "actually completed" throughput row cannot be computed from a live read, only
  from week-over-week diffs.
- **Both secrets in Key Vault**, referenced by versionless URI: the job reads the ClickUp token
  through the managed identity, and the app reads its Entra secret the same way. Rotating either
  takes effect without redeploying, and a redeploy can never overwrite a rotated value with a
  stale parameter.
- **Storage with shared-key access disabled** and no public blob access; both containers reach it
  by RBAC on that same identity.
- **Entra ID on every request** except `/healthz`, via the platform's built-in auth. This is
  internal pipeline data with customer names, IT contacts and ticket numbers.

### Cadence, and what the page says about it

The freshness strip measures age from **when ClickUp was read**, never from when the browser last
fetched. Green up to 75 minutes, amber past that, red past three hours — one missed run is worth
noticing, three is a fault. The browser re-polls every 10 minutes so a wall display picks up a new
payload shortly after it lands, and skips polling entirely while the tab is hidden.

If a refresh fails, the previous payload stays in blob storage and keeps being served with its real
timestamp. The board ages visibly rather than going blank or, worse, looking fresh.

---

## Before this is genuinely live

**Four of the seventeen matrix columns have no ClickUp field behind them.** The code is already
written for them — `PENDING_FIELD_NAMES` in `api/src/clickup/fields.ts` resolves them *by name* at
refresh time, so the moment someone creates them on list `901316440634` the dashboard starts
reading them and the "no ClickUp source" callout stops rendering. No code change, no redeploy.

| Column | Needs to become |
|---|---|
| HL7 VPN status | Dropdown: Not started / Requested / Tunnel up / Validated / n/a |
| HL7 testing done | Dropdown: Not started / In progress / Passed / n/a |
| Facility vs. Station split | Two checkboxes named "Facility built" and "Station built" |
| Estimated deployment date | Date field |

Until then those columns render as gaps, and the est-deploy column falls back to the proposed
sequence in `api/src/content/editorial.json` with every date marked `*`.

**Two existing fields are unreliable:**

- `Pending Contact?` is empty on all 21 in-flight centers. The Blockers panel is only as good as
  this field; the amber callout above it reports the coverage honestly and disappears when it is full.
- **Subtask completion lags reality.** Parkwood is the canonical case. The dashboard surfaces
  staleness (`findStalest` in `buildPayload.ts`) rather than papering over it, but it will still
  understate progress until owners close subtasks.

**Verify the milestone matchers.** `MILESTONE_MATCHERS` maps subtask names to the five milestone
columns by keyword, because subtask naming is not consistent. A keyword that never matches renders
an open circle forever, which is indistinguishable from real "not done" data. The refresh logs a
warning for any center whose subtasks matched nothing — read them after the first run:

```bash
az containerapp job logs show --name caj-imgcenter-refresh --resource-group rg-imaging-center-dashboard --container refresh
```

**Drop in Montserrat.** `public/fonts/montserrat/` is empty; see the README there. Column widths
are already exact (measured at 199/77/83/67/35/61/55/59/51/55/51/55/43/83/163/305/63 against the
handoff's recorded 198…303/63), but row heights only reach the 33px spec with the real font —
the fallback stack is wider and wraps some cells to two lines.

## Design decisions worth not undoing

- **Gaps render as gaps.** `—`, `Not set`, `n/a`. Never a zero, never "Unknown", never a hidden
  column. Exposing that the pipeline data is incomplete is part of the dashboard's job.
- **A measured zero and an unmeasurable week are different facts.** The throughput row renders
  `0` at full opacity and `—` dim, and they are not interchangeable.
- **Red is reserved** for primary CTAs and the Flagship tag. Warnings are amber. `#d92b3a` appears
  only as the Critical status, which is a severity scale, not a warning affordance.
- **A failed refresh never blanks the board.** The last good payload stays up, visibly timestamped,
  with the failure named in the freshness strip. Age is measured from the ClickUp read, not from
  the browser's fetch — otherwise polling a three-hour-old payload would report "updated just now".
- **Held rows are quieted by row background, not by dimming type.** An earlier draft dropped them
  to ~1.9:1 contrast, which is unacceptable on a block leadership makes keep-or-close decisions
  about. Nothing goes below ~0.45 alpha at these sizes.
- **The in-progress glyph is an SVG.** U+25D2 has no glyph in Montserrat and falls back to a colour
  emoji font, which ignores the authored amber; the design system forbids emoji outright.
- **The view toggle resolves `state ?? url ?? fallback`.** The prototype resolved `prop ?? state`,
  and because the prop always had a default, clicking did nothing.
- **Dates and weeks are computed in `America/Puerto_Rico`**, not viewer-local. Technosoft partners
  in Pakistan would otherwise see the week roll over a day early.

## Editorial content

`api/src/content/editorial.json` holds what no ClickUp field can decide: the team card, the
"Needs a Decision" cards, the per-connection next action, blockers with no task behind them, and
the proposed go-live sequence. Edit and redeploy. Anything not listed renders as a gap — a
connection with no next action shows an em dash rather than invented copy.

Rule-flagged decision candidates (critical status, 90+ days, unassigned, urgent-while-held) are
appended automatically with **no next step written**, and say so.

## Still open with Cristian

1. Add the four missing ClickUp fields — the critical path.
2. Who populates `Pending Contact?` weekly?
3. Confirm the six-week go-live sequence so "expected" becomes a real baseline.
4. One row per center, or one per connection path? The data model already allows N connections per
   center; the UI renders one row each today.
5. Confirm the status thresholds in `shared/status.ts` — they were inferred from the design, not specified.
6. Who can see it — tenant-wide or a named group? Determines the Entra ID configuration.
7. The seven on-hold centers need a hold reason and review date, or should be closed. MRI Associates
   and TGH are tagged urgent while parked, which is contradictory.
