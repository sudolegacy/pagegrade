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
