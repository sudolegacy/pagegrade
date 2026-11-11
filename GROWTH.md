# Growing PageGrade to £10k a month

This is a working plan, not a promise. Revenue depends on launching, selling and keeping customers, and code can't do those on its own. The prices, limits and partner terms below are defaults. Confirm them before you go live.

## The maths

At the old prices (£9 / £19 / £49) the average customer paid about £20, so £10k a month needed about 500 customers. With the new prices and a focus on agencies, this example mix gets there with about 270:

| Plan | Customers | Monthly |
| --- | --- | --- |
| Agency (£99) | 60 | £5,940 |
| Pro (£29) | 110 | £3,190 |
| Starter (£9) | 100 | £900 |
| **Total** | **270** | **£10,030** |

Keeping customers matters as much as getting them. If 8% of 270 customers cancel each month, you need about 22 new ones every month just to stay level. Monitoring and the agency tools are there to keep that number down.

The first milestones are 10 paying customers, then 50. They show whether people will pay at all.

## What v2.1 adds

| Feature | Where | Why |
| --- | --- | --- |
| Free grader, no sign-up | `/grade` | Brings in new users. Visitors get a score in about a minute, then sign up to see the fixes. Results can be shared. |
| Weekly monitoring with email alerts | App → Monitoring | Gives customers a reason to keep paying. Pages are re-checked weekly, with an email when something important changes, such as the score dropping by 5 points or more. Competitor pages can be monitored too. |
| Client folders and bulk reviews | App → Clients, Bulk review (Agency) | Agencies review many client pages every month. |
| Branded and white-label reports, PDF download | Settings → Branded reports; Download PDF on a review | Agencies can send reports to clients under their own name. |
| AI search readiness | Every report, "AI search" section | Gives the blog's AI-visibility readers something real: crawler access, indexing, content that works without JavaScript, and structured data. It does **not** track whether ChatGPT or Gemini mention a business. |
| Yearly plans and new prices | Pricing, Billing | Pro is £29 and Agency £99. Yearly plans cost the same as 10 months. |
| "Email the fixes" | Any finished review | Turns a review into an email with the 3 biggest problems and a share link. |
| Partner programme | `/partners`, App → Refer and earn | Partners earn 30% of payments for 12 months on customers they refer. |
| Feedback | Overview card, Stripe cancellation reasons, Admin → What users say | Lets you hear from every user without a call each time. |

## The next 90 days

### Weeks 1–2: launch properly

- Deploy to Railway (see DEPLOY.md). Run `npm run stripe:setup` with live keys and switch email to live SMTP.
- Finish the real review test. Then, logged out, run a free grade; logged in, download a PDF, upload a logo and add a monitor.
- Set `FOUNDER_NAME` so emails come from a person.

### Weeks 2–12: sell by hand, every weekday

1. List 20 targets, such as agencies' own sites, local businesses running Google Ads, or new SaaS launches on Product Hunt.
2. Paste them into Bulk review. Your admin account has every feature.
3. Open each finished review and click **Email the fixes**. Rewrite the first line so it's clearly personal, then send the email from your own mailbox.
4. Follow up once after 4–5 days, then stop.
5. Track sent, replied, signed up and paid in a spreadsheet. The goal is 10 paying customers by day 90.

Stay within the law. In the UK, PECR allows marketing emails to limited companies and LLPs without prior consent, as long as you say who you are and offer an easy way to opt out. Sole traders and some partnerships need consent first. UK GDPR still applies to named people's work addresses. Read the ICO's guidance on business-to-business marketing before you start, check the rules for other countries, and honour every opt-out.

### Talk to every user

The overview card asks new users why they signed up, and Stripe's billing portal asks people why they cancel. Both answers show on the admin page. Also email every new paying customer and ask for 15 minutes:

1. What were you trying to do when you found PageGrade?
2. What did you do before? What did it cost you?
3. What did you change after reading the report?
4. What would make PageGrade something you'd keep paying for, not just nice to have?
5. Who else do you know with the same problem?

### Keep writing

Publish one strong article a week, each ending with a link to the free grader at `/grade`. Search traffic takes 6–12 months to build, so keep going even when the numbers look small.

### Around week 6: Product Hunt

Launch the free grader, not the paid app. Prepare a 30-second demo video, 5 screenshots, a first comment explaining why you built it, and 20 people ready to try it on the day.

## From £1k to £10k a month

- **Agencies first.** Offer each agency that replies a free month of Agency in return for a call and a testimonial.
- **Partners.** Invite every agency customer to the partner programme. The white-label PDF is what they'll send to clients.
- **Yearly plans.** Mention yearly billing at checkout and in emails to customers. Fewer yearly customers cancel.
- **Listings.** Product Hunt and software directories such as G2, Capterra, SaaSHub and AlternativeTo. A Webflow app, Framer plugin or Shopify app is a separate project, because each needs its own app and review process. Build one only once customers ask for it.
- **AI mention tracking.** If the AI-visibility articles bring visitors who sign up, consider a paid add-on that asks AI assistants about a business and records whether they mention it. It needs paid access to each assistant, and the results need careful wording because the answers change from one run to the next.

## Running the partner programme

The defaults are 30% of payments (excluding VAT) for 12 months, a 30-day hold, and payouts by bank transfer from £50. Change them with `REFERRAL_PERCENT`, `REFERRAL_MONTHS` and `REFERRAL_PAYOUT_MIN_GBP`. The `/partners` page shows the new values automatically. If you change the hold period or the 60-day sign-up window, update that page's terms by hand.

To pay a partner, open Admin → Partners, send the bank transfer, then click **Mark paid**. Keep records for your accountant.

## Numbers to check every week

The admin page shows free grades and how many were claimed, paying customers and monthly revenue, active monitors, referred sign-ups and feedback. Note them in a spreadsheet every week. Three ratios matter most: free grades that turn into sign-ups, sign-ups that turn into paying customers, and the share of customers who cancel each month.
