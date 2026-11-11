# PageGrade

PageGrade reviews landing pages and provides a prioritised report with evidence, scoring, suggested copy and desktop/mobile screenshots. The application comprises a Next.js web server, a separate review worker and SQLite on persistent storage. It uses OpenAI for AI analysis, Stripe for subscriptions and SMTP for email; Supabase is not required.

## Plans

| Plan | Price | Reviews | Queue | Also includes |
| --- | --- | --- | --- | --- |
| Free | £0 | 3 lifetime | Standard | – |
| Starter | £9/month or £90/year | 10/month | Standard | 1 weekly monitor |
| Pro | £29/month or £290/year | 40/month | Priority | 5 monitors, PDF reports |
| Agency | £99/month or £990/year | 200/month | Priority | 50 monitors, PDF reports, branded and white-label reports, client folders, bulk reviews |

Every plan receives the full report. Failed reviews do not consume an allowance. Anyone can also use the free grader at `/grade` without an account; signing up unlocks the fixes.

## Growth features (v2.1)

Free grader, weekly monitoring with email alerts, agency tools (client folders, bulk reviews, branded and white-label PDF reports), AI search readiness checks, yearly plans, a partner programme, user feedback and an admin growth view. See GROWTH.md for the 90-day plan and DEPLOY.md for the extra setup.

## Get started locally

1. Install Node.js 22 or later, npm and Chromium. From the project directory, run `npm ci`.
2. Copy `.env.example` to `.env.local`, set `OPENAI_API_KEY`, select models available to your API account and set `CHROMIUM_PATH` to the installed browser. Set `REQUIRE_EMAIL_VERIFICATION=false` for a local run without SMTP. Never commit `.env.local`.
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
