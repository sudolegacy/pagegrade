# PageGrade v2 — reconstruction checklist

Business: PageGrade LTD · pagegrade1@gmail.com. Fresh SQLite database; old test users are not migrated.

## Phases 1–5 — Rebuild
- [x] Audit and architecture: single Next.js app, review worker, persistent SQLite, Stripe and SMTP.
- [x] Engine: guarded capture, desktop/mobile screenshots, page extraction, optional performance audit, rubric, AI analysis, evidence validation, scoring, caching and benchmark fixtures.
- [x] App: migrations, authentication, queue and worker, usage allowances, Stripe billing, admin, account settings, report and sharing.
- [x] Marketing: landing, pricing, sample report, articles, legal pages, metadata and sitemap.

## Phases 6–8 — Integration and tests
- [x] Unit tests, smoke tests, full AI review/share journey, Stripe test checkout and desktop/mobile visual QA.
- [x] Dockerfile, Railway configuration, health endpoint, automatic on-volume SQLite backups and security headers.
- [ ] Build and validate Docker/Railway in a real deployment environment; check production SMTP, persistent volume, worker monitoring and off-site restore.
- [ ] Configure domain, production credentials, live Stripe and company details; perform launch checks and legal/privacy review.

## Phase 9 — Handover
- [x] README, environment example and deployment guide.
- [ ] Complete the external setup and production validation listed in DEPLOY.md.

Benchmark: 9 pages × 2 runs; score spread max 2 and mean 1.3 points, median 46s, max 114s; estimated mean AI cost $0.0192. Small sample, not a service guarantee.

## v2.1 — growth release

- [x] Free grader without sign-up, with shareable results and sign-up to unlock the fixes.
- [x] Weekly monitoring with email alerts, for your own and competitor pages.
- [x] Agency tools: client folders, bulk reviews, branded and white-label reports, PDF download.
- [x] AI search readiness checks in every report.
- [x] New prices (Pro £29, Agency £99) and yearly plans.
- [x] Partner programme, sign-up and cancellation feedback, admin growth view.
- [x] Type check of the new code and a database smoke test in the build sandbox (no internet, so no npm install).
- [ ] On a machine with internet: `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run build`.
- [ ] Re-run `npm run stripe:setup` (test, then live) and test a monthly and a yearly checkout.
- [ ] On Railway: run a free grade while logged out, download a PDF, upload a logo and add a monitor.
- [ ] Confirm the default prices and partner terms before going live.

## v2.2 — launch release (business plan in the product)

- [x] Admin → Business plan: the full plan with live scoreboard, dated MRR checkpoints, launch checklist, lead pipeline, outreach templates and routines.
- [x] `/agencies` landing page with the three-free-audits offer and a pack-request form that records leads and alerts the founder.
- [x] Founder alerts on sign-up and pack request; weekly founder digest from the worker.
- [x] Lifecycle emails (first review, free reviews used, Agency onboarding, day 7 and day 25 check-ins), once per user.
- [x] CSV export of review results; stale pricing FAQ fixed; founding-price terms on the pricing page.
- [x] `.env.example` uses the plan's launch safeguards (`AI_DAILY_BUDGET_USD=1`, `FREE_GRADER_DAILY_LIMIT=20`); CI workflow added.
- [x] Outreach Autopilot kit committed under `outreach/`; business plan PDF under `docs/`.
- [x] Build pack from a lead (client folder + queued audits + progress + reply draft); client-folder branding on shared reports and PDFs.
- [x] Weekly check-in form and metric history on the plan page; scoreboard rates against the plan's targets.
- [x] AI budget pauses free usage first; paying customers continue to `AI_DAILY_HARD_CAP_USD`.
- [x] Agency onboarding checklist on the overview; guide for agencies; cookie policy lists every cookie.
- [ ] Set `FOUNDER_ALERT_EMAIL`, `NEXT_PUBLIC_BOOKING_URL` and the rest of the launch checklist in Admin → Business plan until every item is green.
- [ ] Update `/terms` before advertising the Agency money-back promise anywhere.

## v2.3 — lead widget (Agency)

- [x] Lead widget: settings, install snippet, live preview and leads inbox (App → Lead widget); embeddable check at `/embed/<id>` with `/embed.js`.
- [x] Widget checks: own monthly allowance, per-visitor and per-agency limits, front of the queue, kept out of History/Pages/Compare, one email per lead.
- [x] Leads: status, CSV export, delete with report; privacy policy, terms and cookie policy describe the widget.
- [x] Unit tests for the widget, its routes and the embed page's escaping and CSP.
- [ ] After deploying: install the widget on a real agency test page on another domain, run a check end to end with a live AI key, and confirm the lead email arrives.
- [ ] Have the privacy policy, terms and cookie policy changes reviewed with the rest of the legal pages.
