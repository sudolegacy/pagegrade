import type { Post } from '../index';

const body = `
An **AI visibility audit** answers one practical question: when a potential customer asks ChatGPT, Gemini, Copilot, Perplexity or Google's AI Mode about the problem you solve, can those assistants find you, understand you and trust you enough to recommend you?

You don't need an expensive tool to find out. This checklist takes about two hours the first time and covers everything a paid audit would look at. Work through it in order, because each part depends on the one before: an assistant cannot understand a page it cannot reach, and it will not recommend a business it does not understand.

<p class="callout"><strong>How to use this checklist:</strong> mark each item green (done), amber (partly done) or red (missing). Fix reds in Part 1 first; they can make you invisible no matter how good everything else is.</p>

## Part 1: Can AI assistants reach your site?

These are the technical gates. A single red here can hide your whole site from an assistant.

- [ ] **robots.txt allows the AI search crawlers.** Open yoursite.co.uk/robots.txt and check that OAI-SearchBot (ChatGPT search), Claude-SearchBot, PerplexityBot, Googlebot and Bingbot are not disallowed. Blocking training crawlers such as GPTBot or ClaudeBot is your choice and does not affect search visibility. OpenAI's [crawler documentation](https://developers.openai.com/api/docs/bots) explains the difference.
- [ ] **Your CDN, host or security plugin isn't blocking AI bots.** Check dashboards for settings such as "block AI crawlers" or "bot fight mode". These act before robots.txt and are easy to miss.
- [ ] **Key pages are indexed in Google.** Use the URL Inspection tool in [Google Search Console](https://search.google.com/search-console) on your homepage and main service pages.
- [ ] **Key pages are indexed in Bing.** Set up [Bing Webmaster Tools](https://www.bing.com/webmasters) (you can import from Search Console) and inspect the same URLs. Bing feeds Copilot and is part of the web data ChatGPT uses.
- [ ] **No accidental noindex or nosnippet.** View the page source and search for "noindex" and "nosnippet". Google requires a page to be indexed and snippet-eligible to appear in AI Overviews and AI Mode.
- [ ] **An XML sitemap is submitted** to both Google and Bing and lists your important pages.
- [ ] **Important content is in the HTML.** Several AI crawlers do not run JavaScript. Use "View source" (not "Inspect") and check that your headline, service descriptions and prices appear in the raw HTML.
- [ ] **Pages load quickly on mobile.** Slow pages are crawled less and convert worse. Aim for a good Core Web Vitals result in Search Console.

## Part 2: Can they understand what you do?

This is where most businesses lose out, and it is entirely within your control. An assistant can only repeat what your pages say clearly.

- [ ] **Your homepage headline states what you do.** Not a slogan: the offer. "Commercial cleaning for offices in Manchester" beats "Spaces that shine".
- [ ] **The audience is obvious.** Who is it for? Homeowners, landlords, startups, schools? Say so near the top.
- [ ] **Your location or service area is in the text.** Towns, regions or "UK-wide, online".
- [ ] **Each main service or product has its own page** with a descriptive title and heading.
- [ ] **Prices or price ranges are published** where your industry allows. Pages with numbers answer "how much" questions.
- [ ] **There is a clear About page** with real facts: founding year, team, registered company name and Companies House number, address, accreditations.
- [ ] **Business details match everywhere.** Name, address, phone and hours are identical on your site, Google Business Profile, Bing Places and directories.
- [ ] **Customer questions are answered directly.** Each key page answers its main questions with a short, direct answer first.
- [ ] **Credentials are written in text**, with numbers where they exist (for example Gas Safe, FCA, SRA, ICO registration).
- [ ] **Guides show an author and a "last updated" date**, and cite sources for facts and statistics.
- [ ] **Structured data, if used, matches the visible page.** Organization or LocalBusiness markup is optional, but it must never contradict the page.
- [ ] **Images have descriptive alt text**, and no essential information is only inside an image.

## Part 3: Do other sources vouch for you?

Assistants weigh what others say about you more heavily than what you say about yourself.

- [ ] **Recent reviews** on Google and on your industry's main platform, with replies from you.
- [ ] **Complete, consistent listings** on Bing Places, Apple Business Connect and the directories and trade bodies relevant to your sector.
- [ ] **Independent mentions:** press coverage, supplier or partner case studies, industry roundups, podcast appearances or useful forum answers.
- [ ] **Comparison visibility:** search for "best [your category] [your area]" and "[you] vs [competitor]". Note which articles rank and whether you are included.
- [ ] **No conflicting old information** on third-party sites: old addresses, discontinued services or a previous business name.

## Part 4: What do the assistants actually say?

Now test the outcome directly. Write 15 to 20 prompts across five types:

1. **Brand:** "What is [your business]?", "Is [your business] any good?"
2. **Category:** "Best [what you do] for [who you serve]"
3. **Local:** "[What you do] near [your town or neighbourhood]"
4. **Problem:** the question a customer asks before they know solutions like yours exist
5. **Comparison:** "[You] vs [main competitor]", "alternatives to [competitor]"

Run each prompt in ChatGPT, Gemini, Google AI Mode, Copilot and Perplexity, in a private or logged-out window. Run the most important ones twice, because answers vary from one run to the next. Record the results (the rows below are an example):

| Prompt | Assistant | Mentioned? | Position | Accurate? | Source cited | Competitors named |
| --- | --- | --- | --- | --- | --- | --- |
| "Best payroll software for UK charities" | ChatGPT | Yes | 4 of 6 | Price wrong | G2 review page | A, B, C |
| "Best payroll software for UK charities" | AI Mode | No | – | – | – | A, C, D |

Patterns matter more than any single answer. If competitors are always cited from the same comparison article, getting into that article is your next task. If you are mentioned but described wrongly, the cited source tells you what to fix.

## Part 5: Can you measure change over time?

- [ ] **Google Search Console** is set up. AI Overviews and AI Mode traffic is included in the Performance report under the "Web" search type.
- [ ] **Bing Webmaster Tools AI Performance** is checked monthly. It shows which of your pages are cited in Copilot and Bing's AI answers, and for which queries.
- [ ] **AI referrals are visible in analytics.** Check for traffic from chatgpt.com, perplexity.ai, gemini.google.com and copilot.microsoft.com.
- [ ] **Your prompt log is repeated monthly** with the same prompts, so you can compare like with like.
- [ ] **Enquiry forms ask "How did you hear about us?"** with an option for AI assistants. Many AI-influenced customers arrive later by searching your name directly.

## Scoring and what to fix first

Count your reds and ambers, then prioritise like this:

1. **Any red in Part 1.** Access problems can make every other effort pointless, and they're usually quick to fix.
2. **Reds in Part 2 on your homepage and top service pages.** Rewriting a headline and first paragraph takes an afternoon and helps both AI answers and conversions.
3. **Inaccuracies found in Part 4.** Trace each one to its source and correct it.
4. **Part 3 gaps.** Reviews and mentions take months; start a steady routine rather than a one-off push.

Repeat the full audit every quarter and the prompt test every month.

## Do you need an AI visibility tool?

A growing number of paid "AI visibility checkers" run large sets of prompts automatically and report your share of mentions against competitors. They can save time if you track many products or markets. Before paying, ask:

- **How many prompts, how often, and which assistants?** Small samples swing wildly.
- **Logged in or logged out, and from which country?** UK answers differ from US ones.
- **Can I see the raw answers and cited sources,** not just a score?
- **Does it tell me what to change?** A share-of-voice chart without causes is hard to act on.

For most small businesses, the free combination of Search Console, Bing Webmaster Tools and a monthly prompt log is enough to start.

## Where PageGrade helps

PageGrade doesn't monitor AI answers. It automates most of **Part 2** for any landing page: it loads your page on desktop and mobile like a real visitor and checks whether the offer is clear, the audience obvious, the proof credible, business details visible, the call to action specific, and the page fast. Each finding comes with highlighted evidence on your own screenshots and a fix, in priority order. Those are the reasons a page gets skipped by an assistant, and by people. Try it on your most important page; the first three reviews are free.

For background on how AI assistants choose sources, read [our guide to AI search visibility](/blog/ai-search-visibility-uk). If you serve customers locally, [our local SEO guide for AI search](/blog/local-seo-ai-search-uk) covers Google Business Profile, Bing Places and industry-specific steps.
`;

export const post: Post = {
  slug: 'ai-visibility-audit',
  status: 'published',
  seoTitle: 'AI Visibility Audit: Free 30-Point Checklist (2026)',
  title: 'AI visibility audit: a free checklist to see if ChatGPT and Google’s AI can find and recommend you',
  shortTitle: 'AI visibility audit checklist',
  description: 'A free AI visibility audit: check crawler access, indexing, page clarity and reviews, then test what ChatGPT, Gemini and Copilot say about you.',
  excerpt: 'A practical two-hour audit in five parts: crawler access, page clarity, reputation, real prompt tests and measurement, with a scoring system that tells you what to fix first.',
  published: '2026-11-06',
  author: 'pagegrade',
  category: 'ai-search',
  tags: ['AI search', 'Audit', 'Checklist', 'ChatGPT', 'Bing Webmaster Tools', 'Google Search Console'],
  locations: ['United Kingdom'],
  primaryKeyword: 'AI visibility audit',
  secondaryKeywords: ['AI visibility checker', 'check AI search visibility', 'ChatGPT visibility check', 'AI SEO audit', 'AI search audit checklist'],
  related: ['ai-search-visibility-uk', 'local-seo-ai-search-uk'],
  faqs: [
    { q: 'What is an AI visibility audit?', a: 'A structured check of whether AI assistants such as ChatGPT, Gemini, Copilot, Perplexity and Google AI Mode can reach your website, understand what you offer, find independent sources that vouch for you, and actually mention you when customers ask relevant questions.' },
    { q: 'How do I check if ChatGPT can see my website?', a: 'Check that your robots.txt does not block OAI-SearchBot and that your CDN or security settings are not blocking AI bots, confirm your pages are indexed in Bing, then ask ChatGPT questions your customers would ask and see whether your site is cited.' },
    { q: 'Are AI visibility checker tools worth paying for?', a: 'They can save time if you track many products or markets, because they run prompts at scale. Check how many prompts they run, from which country, and whether you can see raw answers and sources. Many small businesses can start with free tools and a monthly prompt log.' },
    { q: 'How often should I run an AI visibility audit?', a: 'Run the full checklist every quarter and repeat your prompt tests monthly with the same prompts, so you can compare like with like. Re-check access immediately after any website, hosting or security change.' },
    { q: 'Does PageGrade check AI visibility?', a: 'PageGrade does not monitor AI answers. It automates the on-page clarity and trust part of the audit: whether a landing page makes the offer, audience, proof, business details and next step clear, with evidence and prioritised fixes.' },
  ],
  cta: {
    title: 'Automate Part 2 of this audit',
    body: 'PageGrade checks whether your page makes the offer, audience, proof and next step clear on desktop and mobile, then shows the evidence on your screenshots with fixes in priority order. Your first 3 reviews are free.',
    label: 'Audit my page',
  },
  body,
};
