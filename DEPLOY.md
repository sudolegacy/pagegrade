# PageGrade deployment and handover

## Current state

The web app, review engine, worker, billing integration, admin dashboard, legal pages and deployment configuration are implemented. Local tests covered 95 unit tests, 19 browser smoke tests, a real review/report/share journey and a Stripe test-mode checkout. A clean production-only install started the web server and worker successfully under Node 24. The production dependency audit reported zero known vulnerabilities at the time of checking. Desktop and mobile pages were visually checked. These are limited tests, not a production reliability guarantee.

A live deployment, Docker image build, live Stripe payments and delivery through a real production SMTP account have not been validated. A domain, live credentials, company details, independent backups and production monitoring are still needed. Do not accept customer payments before completing the launch checks below.

## Secrets and configuration

Copy `.env.example` locally; never commit it with real values. In Railway, enter secrets as service variables, not in source control. Rotate any old keys that were exposed in the original archive (including OpenAI and Stripe live keys); do not reuse them. The old archive's database is not migrated.

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Full canonical HTTPS origin, no trailing slash. Required both while building and at runtime. Changes require a rebuild. |
| `OPENAI_API_KEY` | Required for review analysis. The account must have access to the selected models. |
| `AI_MODEL_EVAL`, `AI_MODEL_WRITE` | Defaults are `gpt-6-luna` and `gpt-6.1-terra`. Confirm these model IDs are available to your account; the OpenAI endpoint is used. `AI_MODEL_WRITE=none` disables the separate writing call. |
| `AI_EVAL_RUNS`, `AI_EVAL_REASONING` | Evaluation runs default to 3 (1–5); reasoning defaults to `low`. |
| `AI_DAILY_BUDGET_USD` | Estimated, soft daily guard (default 25); not a provider spending cap. Set provider-side billing limits and alerts. Costs of failed jobs/retries and unknown models can be omitted; concurrent work can overshoot. Built-in model prices may become stale. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Matching-mode Stripe secret and webhook signing secret. Needed for paid billing and webhooks. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | SMTP service credentials; 587 with STARTTLS is typical, 465 uses secure TLS. Use a provider-approved sender. |
| `EMAIL_FROM`, `SUPPORT_EMAIL` | Sender and contact email; defaults to PageGrade / pagegrade1@gmail.com. |
| `REQUIRE_EMAIL_VERIFICATION` | Set `true` after SMTP works. Without SMTP, password reset and verification emails are not sent; local-only logs contain links. |
| `ADMIN_EMAILS` | Comma-separated email addresses of existing accounts allowed to access `/admin`. |
| `COMPANY_NUMBER`, `COMPANY_ADDRESS` | UK company number and registered office address, displayed on the site; set at build time. Confirm legal requirements before launch. |
| `DATA_DIR` | Persistent storage directory; `/data` in Docker. Contains the database, screenshots and backups. |
| `CHROMIUM_PATH` | Chromium executable; `/usr/local/bin/chromium` in Docker. |
| `WORKER_CONCURRENCY` | 1–4; default 1. Increase only after measuring memory/CPU usage. |
| `REVIEW_TIMEOUT_MS`, `SHUTDOWN_GRACE_MS` | Defaults 540000 and 25000 milliseconds. |
| `TRUST_PROXY_HOPS` | Number of trusted proxies at the right of `X-Forwarded-For` (default 1). Verify against the actual proxy chain; use 0 without a trusted proxy. Misconfiguration can compromise rate limiting. |
| `PERFORMANCE_AUDIT`, `PAGESPEED_API_KEY` | Set audit to `off` to disable; optional PageSpeed API key. |
| `RUN_WORKER` | Defaults to enabled; do not set to `false` unless a separate worker is running. |

The app uses random, hashed database session tokens; `SESSION_SECRET` is not used.

## Stripe setup

Work in test mode first. Install development dependencies locally with `npm ci`; the deployment container deliberately omits the TypeScript runner. With `STRIPE_SECRET_KEY` and `APP_URL` set in a private `.env.local`, run:

```sh
npx tsx --env-file=.env.local scripts/setup-stripe.ts
```

Alternatively, after exporting the same variables into your shell, use `npm run stripe:setup` or `npm run stripe:setup -- --webhook`. This creates or updates the monthly GBP prices and updates the **default Stripe customer portal configuration**. It changes the selected Stripe account; review its existing portal settings first, especially if the account is shared with another product. For an HTTPS deployment, append `--webhook` to create or update the `/api/stripe/webhook` endpoint and its events. Save the new endpoint's signing secret securely as `STRIPE_WEBHOOK_SECRET`; for an existing endpoint retrieve its signing secret in Stripe. For local development use Stripe CLI webhook forwarding instead. Repeat in live mode only when ready; test and live products, secrets and webhooks are separate. Set the Stripe customer-facing business name to PageGrade in the Stripe dashboard.

## Deploy on Railway

1. Put this code in a private Git repository; ensure no `.env.local`, old archive, test database or other secrets are committed. Create a Railway project from that repository and deploy using the included Dockerfile.
2. Select an EU West region if available and appropriate for your data obligations. Use **one replica**: the SQLite database and worker run on one persistent volume; this design is not suitable for multi-replica deployment.
3. Add a persistent Railway volume mounted at `/data`. Set `DATA_DIR=/data`. Do not delete or replace the volume when redeploying; that would lose the database and review files.
4. Add the variables above, including a fresh AI key, working SMTP, admin email and Stripe test keys. Set `APP_URL` to the actual HTTPS Railway/custom domain **before the build**, and supply `COMPANY_NUMBER`, `COMPANY_ADDRESS` and `SUPPORT_EMAIL` as build-visible variables. The Dockerfile declares these build arguments. Do not put secrets in Docker build arguments. If using a temporary Railway domain first, redeploy/rebuild when switching to the final domain.
5. The included `railway.json` configures `/api/health` and one replica. Check build and startup logs, confirm the worker heartbeat and backup in `/admin`, and check that `/api/health` returns 200. The health check alone does not establish worker or AI availability.
6. Attach the purchased domain in Railway, configure DNS as Railway instructs and wait for HTTPS. Rebuild with the final `APP_URL`; check canonical links, verification/reset emails and Stripe return URLs.
7. Run Stripe setup locally against test mode for this HTTPS origin, set the webhook secret in Railway, redeploy and test signup, verification, review, share, upgrade, change/cancel and webhook synchronisation. Then configure the separate live Stripe account/keys and webhook when ready; test a controlled live payment and refund if appropriate.
8. Enable scheduled Railway volume backups under the service Backups tab and test a restore. Also arrange independent encrypted off-site backups of the entire volume (including database backups and screenshots): Railway notes that wiping a volume deletes its backups, and restores remain in the same project and environment. Set up alerts for failures and stale worker heartbeat. Confirm company details, privacy/terms and ICO data-protection fee or exemption with the appropriate adviser before launch.

## Backup and restore

The worker uses SQLite's online backup API approximately daily and retains the newest seven database copies in `/data/backups`. These are on the same volume as production data; volume loss destroys both. A complete recovery needs the database **and** `/data/reviews` assets. Arrange independent encrypted backups with retention and access controls. Prefer consistent volume snapshots or the SQLite-generated database backup; do not copy an active SQLite database alone while WAL writes are in progress. To restore, stop both server and worker, restore the chosen database backup as `pagegrade.db` and the corresponding review assets, remove any stale `pagegrade.db-wal` and `pagegrade.db-shm` only while stopped, restart, and verify login, reports, billing reconciliation and worker health. Practise on an isolated copy first.

## v2.1 growth features

- **Stripe.** Prices changed (Pro £29, Agency £99) and yearly plans were added. Run `npm run stripe:setup` again, first with test keys and then with live keys. It creates the new monthly and yearly prices and moves the lookup keys to them. Existing subscribers stay on the price they signed up at, and PageGrade still recognises those older prices.
- **PDF reports.** The web process renders PDFs with the same Chromium the worker uses (already in the Docker image), by opening its own print page at `INTERNAL_APP_URL`. The default, `http://127.0.0.1:$PORT`, works on Railway; only set it if your host needs a different address. At most two PDFs render at once.
- **Brand logos** are stored in `DATA_DIR/brands` on the persistent volume. The database backup does not include them.
- **Free grader limits.** `FREE_GRADER_PER_IP` (default 3 a day per visitor) and `FREE_GRADER_DAILY_LIMIT` (default 150 a day in total) cap AI spend at roughly $3 a day.
- **Monitoring** runs in the worker. Every 10 minutes it queues the weekly re-checks that are due. Each check is a full review and costs about the same.
- **Partner programme.** `REFERRAL_PERCENT`, `REFERRAL_MONTHS` and `REFERRAL_PAYOUT_MIN_GBP` (defaults 30, 12 and 50). Payouts are manual: Admin → Partners, pay by bank transfer, then Mark paid.

## Known limits

- Docker/Railway and production email have not been tested in this environment; the live service must be validated after configuration.
- Local production tests use Node 24; the Dockerfile targets Node 22 and installs Playwright Chromium at build time. Validate the actual image, platform region, mounted volume permissions and outbound connectivity.
- Cost tracking is estimated and incomplete for failed/retried calls and unrecognised models. AI model availability/pricing may change.
- The benchmark is a small sample, not proof of universal scoring accuracy, throughput, security or uptime.
- Security includes URL/network filtering, sessions, rate limiting and headers, but it has not had an independent penetration test or legal review. Chromium runs with its sandbox disabled for capture/audits; this increases exposure when visiting untrusted pages. Isolate the container, keep browser packages patched and obtain a security review before public launch.

## Platform references

- [Railway Docker build variables](https://docs.railway.com/guides/build-time-vs-runtime-secrets)
- [Railway volume backups and restore](https://docs.railway.com/volumes/backups)
