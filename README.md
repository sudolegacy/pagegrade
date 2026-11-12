# PageGrade

PageGrade reviews landing pages and provides a prioritised report with evidence, scoring, suggested copy and desktop/mobile screenshots. The application comprises a Next.js web server, a separate review worker and SQLite on persistent storage. It uses OpenAI for AI analysis, Stripe for subscriptions and SMTP for email; Supabase is not required.

## Plans

| Plan | Price | Reviews | Queue | Also includes |
| --- | --- | --- | --- | --- |
| Free | £0 | 3 lifetime | Standard | – |
| Starter | £9/month or £90/year | 10/month | Standard | 1 weekly monitor |
| Pro | £29/month or £290/year | 40/month | Priority | 5 monitors, PDF reports |
| Agency | £99/month or £990/year | 200/month | Priority | 50 monitors, PDF reports, branded and white-label reports, client folders, bulk reviews, lead widget (100 visitor checks/month) |

Every plan receives the full report. Failed reviews do not consume an allowance. Anyone can also use the free grader at `/grade` without an account; signing up unlocks the fixes.

## Growth features (v2.1)

Free grader, weekly monitoring with email alerts, agency tools (client folders, bulk reviews, branded and white-label PDF reports), AI search readiness checks, yearly plans, a partner programme, user feedback and an admin growth view. See GROWTH.md for the 90-day plan and DEPLOY.md for the extra setup.

## Lead widget (v2.3)

Agency customers can put a free website check on their own site (App → **Lead widget**). Visitors enter their page and email, see a score and the three biggest problems in the agency's logo and colours, and the agency gets an email per lead with the full report. Install is two lines (`<div data-pagegrade-widget="w_…">` plus `/embed.js`) or an iframe. The page at `/embed/<id>` is self-contained HTML with its own nonce-based CSP whose `frame-ancestors` lists only the sites the agency allows. Checks run as reviews with origin `widget`: they jump the queue (a visitor is waiting), never use the review allowance, have their own monthly allowance (`WIDGET_AUDITS` in `src/lib/plans.ts`), are limited to 3 per visitor per day per widget and 5 running per agency, and stay out of History, Pages and Compare. Leads can be marked, exported as CSV and deleted together with their report.

## Launch release (v2.2): the business plan inside the product

- **Admin → Business plan** (`/admin/plan`): the complete business and marketing plan (goal, customers, offer, pricing terms, budget, unit economics, projections, dated MRR checkpoints, sales workflow, outreach templates, compliance rules, marketing calendar, retention playbook, roadmap, routines, risks) shown next to the live numbers from the database, a launch checklist computed from your configuration, and the lead pipeline.
- **`/agencies`**: the landing page for the plan's main offer, three free branded audits of prospects an agency wants to win, with a pack-request form. Requests become leads and email you.
- **Founder emails**: a sign-up alert for every new account, a lead alert for every pack request and a weekly digest (`FOUNDER_ALERT_EMAIL`).
- **Lifecycle emails**: first-review nudge, free-reviews-used upgrade note, Agency onboarding and day 7 / day 25 check-ins, each sent once per user by the worker.
- **CSV export** of review results from History and client folders.
- **Prospect packs in one click**: on a lead, **Build pack** creates a client folder branded with the agency's name, queues the audits, tracks progress with PDF links and drafts the reply. Client folders can carry their own name, colour and logo, used on that folder's shared reports and PDFs.
- **Weekly check-in**: log the Outreach Autopilot's numbers each Monday and the plan page shows pack-request, opt-out and bounce rates against the plan's targets, with a week-by-week history filled by automatic metric snapshots.
- **AI budget that protects customers**: at the daily budget, free usage pauses; paying customers continue up to a hard cap (`AI_DAILY_HARD_CAP_USD`, default three times the budget).
- **Agency onboarding checklist** on the overview (branding, client folder, bulk review, five weekly checks) and a guide, *How to win new clients by sending free landing page audits*.
- `outreach/`: the free Outreach Autopilot (Google Sheets + Apps Script) that finds emails, sends, follows up and stops on reply. `docs/business-plan-v2.pdf`: the written plan this release implements.

## Repository layout

The Next.js app lives at the repository root (`src/`, `public/`, `tests/`, `bench/`, `scripts/`); `outreach/` holds the sales kit and `docs/` the plan. `.github/workflows/ci.yml` runs the type check, unit tests and build on every pull request.

## Get started locally

1. Install Node.js 22 or later, npm and Chromium. From the project directory, run `npm ci`.
2. Copy `.env.example` to `.env.local`, set `OPENAI_API_KEY`, select models available to your API account and set `CHROMIUM_PATH` to the installed browser. Set `REQUIRE_EMAIL_VERIFICATION=false` for a local run without SMTP. Add your own email to `ADMIN_EMAILS` to open `/admin` and `/admin/plan`. Never commit `.env.local`.
3. Run the web app with `npm run dev`, and in another terminal run `npx tsx --env-file=.env.local src/worker/main.ts`. Visit http://localhost:3000. Next.js reads `.env.local` for the web app; the worker command loads it explicitly.
4. For a production-style local run, run `npm run build`, then `node --env-file=.env.local scripts/start.mjs` to start both web and worker.

A working OpenAI API key and access to the configured models are required to produce reviews. Without SMTP, email is not sent and message links are logged; this is for local development only. Without Stripe keys and setup, paid checkout is unavailable. See `DEPLOY.md` before launch.

## Tests and benchmarks

- `npm run typecheck` — TypeScript checks.
- `npm test` — unit tests.
- `npm run test:e2e` — browser smoke tests against the running app or an automatically started production build. Set `CHROMIUM_PATH` if required. Use a fresh `DATA_DIR` for repeated runs because sign-up is rate limited; test data must never be production data.
- `E2E_FULL=1 npm run test:e2e` — adds a real AI review and a Stripe test-mode checkout. This incurs API costs, requires a configured OpenAI key, configured Stripe test products and a running worker; do not point it at live Stripe or production data. `E2E_BASE_URL` can target a separately running test server. `E2E_REVIEW_URL` overrides the public test page.
- `npm run bench` — benchmark with `.env.local`; this incurs AI costs and accesses public sites. Fixtures are in `bench/fixtures`; the published run is in `bench/results`.

The published run used nine pages (four fixtures and five public sites), twice each: maximum score spread 2 points, mean spread 1.3; median 46 seconds and maximum 114 seconds. The approximately $0.0192 average AI cost is an estimate based on the code's model prices, not an invoice or a guarantee. The sample is small; results do not establish reliability on every site.

## Architecture and operations

- `src/lib/engine`: page capture, deterministic checks, AI evaluation and evidence validation, scoring and report generation.
- `src/app`: marketing pages, application, API and admin interface.
- `src/lib/server`: authentication, SQLite, billing, email and maintenance.
- `src/worker`: persistent queue processing, backups and periodic maintenance.
- `scripts/start.mjs`: starts the web app and worker; restarts a failed worker.
- `Dockerfile` and `railway.json`: single-instance deployment. SQLite and generated review assets must live on a persistent volume.

The worker keeps seven daily SQLite backups on the same volume; this is not an off-site backup and does not back up review images. Independently back up the complete volume and test restores. The health endpoint checks database access and reports worker heartbeat, but does not fail if the worker is stale: monitor the heartbeat separately. The daily AI budget uses estimated recorded successful-review costs and is not a hard spending limit: retries, failed reviews, active jobs, price changes and unlisted models can cause undercounting. Configure billing limits and alerts with the AI provider.

## Deployment and handover

See `DEPLOY.md` for variables, Railway steps, launch checks, limitations and recovery notes. See `CHECKLIST.md` for the project status.

## Blog and SEO content

Articles live in `src/content/blog/posts/<slug>.ts` and are registered in `src/content/blog/index.ts`. Each post has a slug, `status` (`draft` posts show only in `npm run dev`), SEO title, H1, meta description, excerpt, dates, author, category, tags, optional industries and locations, primary and secondary keywords, FAQs, a call to action and a Markdown body.

To publish a new article:

1. Copy an existing file in `src/content/blog/posts/`, change the slug and content, and import it in `ALL_POSTS` in `src/content/blog/index.ts`.
2. Set `status: 'published'` and rebuild. The article page, category page, sitemap, RSS feed (`/blog/rss.xml`), structured data (BlogPosting, BreadcrumbList, FAQPage) and social card are generated automatically.
3. If you retire or rename a URL, add a permanent redirect in `next.config.mjs`.

Categories appear (and are indexed) only once they contain a post. Do not mass-produce near-identical location or industry pages: write one page per place or industry only when it has genuinely specific content.
