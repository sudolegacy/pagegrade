import type { Post } from '../index';

const body = `
**AI search visibility** is how often, and how accurately, AI assistants such as ChatGPT, Gemini, Microsoft Copilot, Perplexity and Google's AI Overviews and AI Mode mention, cite or recommend your business when people ask them questions. It is not a separate ranking system you can buy your way into. It rests on the same foundations as good SEO, with a few differences that are worth getting right.

This guide explains how those assistants decide what to show, what UK businesses can control, what is a waste of time, and how to measure progress without paying for anything.

<p class="callout"><strong>The short version:</strong> make sure AI crawlers can reach your site, get indexed by both Google <em>and</em> Bing, say plainly on your pages what you do, who for and where, answer the questions customers really ask, and earn mentions and reviews on other sites. Nobody can guarantee you a citation, and anyone who promises one is guessing.</p>

## Why AI search matters for UK businesses now

AI answers are no longer a niche. Ofcom's [Online Nation 2025 report](https://www.ofcom.org.uk/siteassets/resources/documents/research-and-data/online-research/online-nation/2025/online-nations-report-2025.pdf) found that about 30% of Google searches in the UK now show an AI-generated overview, and 53% of UK adults say they frequently see AI summaries, often without having asked for one. The same report counted 1.8 billion UK visits to ChatGPT in the first eight months of 2025, up from 368 million in the same period of 2024.

Google launched AI Overviews in the UK in 2024 and rolled out AI Mode, its conversational search tab, to UK users on 28 July 2025. So a customer in Leeds asking "who can fix a leaking combi boiler today?" or a finance director in London asking "which payroll software suits a 40-person charity?" increasingly reads an AI-written answer before, or instead of, a list of links.

Two things follow from that:

1. **Being one of the businesses named in the answer matters more than being link number seven.** AI answers typically name a handful of options.
2. **Accuracy matters.** If an assistant describes you wrongly (old prices, wrong service area, a service you stopped offering), that is a lost customer you never see.

Classic Google search still matters enormously. Ofcom found that four in five UK online adults (82%) use Google Search, so this is about adding to good SEO, not replacing it.

## How AI assistants decide what to say

Every major assistant that answers questions about current businesses works in roughly the same two steps:

1. **Retrieve.** It searches an index of web pages (its own, a search engine's, or both) for pages relevant to the question, often running several related searches behind the scenes. Google calls this "query fan-out".
2. **Write.** A language model reads the retrieved pages and writes an answer, usually with links to some of the sources it used.

If your page is not retrieved, it cannot be cited, however good it is. If it is retrieved but unclear, the model may skip it or misdescribe you. That gives you three jobs: **be reachable, be understood, be trusted.**

Where each assistant gets its pages differs:

| Assistant | Where answers come from | What you can control |
| --- | --- | --- |
| Google AI Overviews and AI Mode | Google's normal search index and ranking systems | Your Google indexing, content quality, Google Business Profile |
| ChatGPT search | OpenAI's own crawler (OAI-SearchBot) plus third-party search partners | Allowing OAI-SearchBot, Bing indexing, mentions on other sites |
| Microsoft Copilot | Bing's index | Bing indexing via Bing Webmaster Tools, Bing Places |
| Claude | Anthropic's search crawler (Claude-SearchBot) and search partners | Allowing Claude-SearchBot |
| Perplexity | Its own crawler (PerplexityBot) plus other sources | Allowing PerplexityBot |

Google is explicit about its own products. Its [guidance for site owners](https://developers.google.com/search/docs/appearance/ai-features) says the usual SEO best practices still apply, and that there are no extra requirements or special optimisations needed to appear in AI Overviews or AI Mode. A page only has to be indexed and eligible to show a snippet.

## The five things that actually move AI visibility

### 1. Let AI search crawlers in

This is the most common silent failure we see. Many sites block AI crawlers without realising, through a security plugin, a hosting setting or a CDN rule added during the "block AI" panic of 2024–25.

The key distinction is between **training** crawlers and **search** crawlers. You can refuse to let your content train AI models and still appear in AI search answers:

- **OpenAI:** GPTBot collects training data; OAI-SearchBot builds ChatGPT's search index. OpenAI's [crawler documentation](https://developers.openai.com/api/docs/bots) states that sites which opt out of OAI-SearchBot will not be shown in ChatGPT search answers.
- **Anthropic:** ClaudeBot is for training; Claude-SearchBot is for search; Claude-User fetches a page when a user asks.
- **Google:** the Google-Extended token controls use of your content for training Gemini models and grounding in some of Google's other products. Google says it does not affect Google Search, including AI Overviews.

A robots.txt that blocks training but stays visible in AI search looks like this:

\`\`\`
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: *
Allow: /
Sitemap: https://www.example.co.uk/sitemap.xml
\`\`\`

Whether you block training is a business decision; there is no visibility benefit either way. Blocking the *search* crawlers, though, removes you from those assistants' answers. After checking robots.txt, check your firewall or CDN dashboard too: some block "AI bots" as a category at the network level, which robots.txt cannot override.

### 2. Get indexed by Bing, not just Google

Most UK businesses have set up Google Search Console and never touched Bing. That is a mistake now, because Bing's index feeds Microsoft Copilot and is widely reported to be one of the sources behind ChatGPT's web answers.

Setting up [Bing Webmaster Tools](https://www.bing.com/webmasters) takes about ten minutes: you can import your verified sites straight from Google Search Console. While you are there, submit your sitemap and check the indexing report. Bing also added an AI Performance report in 2026 that shows how often your pages are cited in Copilot and Bing's AI answers, and for which queries. It is currently the only first-party report of AI citations any major platform offers.

### 3. Say plainly what you do, who for and where

Language models are very good at reading, but they can only repeat what your pages actually say. Vague marketing copy gives them nothing to work with.

Compare two homepage headlines for the same Leeds accountancy firm:

- **Before:** "Numbers that work as hard as you do."
- **After:** "Accountants for Leeds contractors and small limited companies: fixed monthly fees from £95."

The first could describe any firm anywhere. The second answers who, what, where and roughly how much, which is exactly what an assistant needs to recommend the firm for "affordable accountant for contractors in Leeds".

Do this across the site:

- Put the plain description of your offer in the **headline and first paragraph**, not just in the footer or an image.
- Give each main service its **own page** with a clear title, rather than one page listing everything.
- State your **service area** in text (towns, postcode districts, "UK-wide", "online only").
- Publish **prices or price ranges** where you can. Answers to "how much does X cost" quote pages that give numbers.
- Keep **facts consistent** everywhere: business name, address, phone, opening hours, founding year, registration numbers.
- Put **important text in HTML**, not inside images, PDFs or JavaScript-only widgets. Several AI crawlers do not run JavaScript, so content that only appears after scripts load may be invisible to them.

This is the same clarity that makes human visitors convert, which is why it is the part of AI visibility we care about most at PageGrade.

### 4. Answer the questions customers actually ask

AI assistants are asked full questions, often with context: "I run a café in Bristol, what card machine has the lowest fees for under £5k a month?" Pages that answer specific questions directly, with specifics, are far more likely to be retrieved and quoted than pages that circle the topic.

Practical ways to do that:

- **Collect real questions** from your inbox, sales calls, reviews and the "People also ask" boxes in Google, and answer the best ones on the relevant service page or in a guide.
- **Lead with the answer.** Put a one- or two-sentence direct answer at the top of a section, then the detail.
- **Use specifics a model can quote:** prices, timescales, sizes, limits, named standards ("Gas Safe registered", "FCA authorised", "ICO registered").
- **Make honest comparisons.** "X vs Y" and "best X for Y" questions are among the most common prompts. A fair comparison that admits where an alternative is better is more credible, and more citable, than a one-sided one.
- **Show who wrote it and when.** A named author or team, a clear "last updated" date and links to sources help both readers and machines judge reliability.

### 5. Be talked about on other sites

When an assistant recommends businesses, it leans heavily on what *other* sources say: review sites, directories, local news, trade bodies, comparison articles and forum threads. Your own website saying you are the best counts for little.

For most UK small businesses that means:

- Steady, recent **reviews** on Google and on the review platforms your industry uses (Trustpilot, Checkatrade, Feefo, Tripadvisor and so on). Reply to them.
- Complete listings in the **directories and trade bodies** that matter for your sector.
- Genuine **mentions**: local press, supplier case studies, podcasts, "best of" roundups, answers in community forums.

One warning: since April 2025 the Digital Markets, Competition and Consumers Act has made it unlawful in the UK to buy, write or commission fake reviews, or to hide negative ones, and the Competition and Markets Authority can fine businesses directly. Don't take shortcuts here.

## What doesn't work (or isn't proven)

- **llms.txt files.** A proposed file that summarises your site for language models. Google has said it does not use llms.txt for Search or its AI features, and there is no solid evidence that any major assistant uses it to decide what to cite. It does no harm, but it is not a priority.
- **"AI schema."** There is no special structured data that unlocks AI answers. Normal structured data (Organization, LocalBusiness, Product, Article) can help machines understand a page, but Google's guidance is clear that it is not required, and it must match what is visible on the page.
- **Stuffing pages with prompts or keywords.** Writing "best plumber in Leeds" twenty times reads as spam to people and to search systems alike.
- **Mass-produced location pages.** Hundreds of near-identical "AI SEO in [town]" pages are classed as doorway pages under Google's spam policies. One good page per place you genuinely serve, with real local detail, works; templated clones do not. (Our [local SEO guide for AI search](/blog/local-seo-ai-search-uk) shows the difference.)
- **Paying for "guaranteed ChatGPT rankings".** AI answers vary between users, sessions and even repeated runs of the same question. No one can guarantee a placement.

## How to measure AI search visibility for free

There is no single dashboard yet, so combine four sources:

1. **Google Search Console.** Clicks and impressions from AI Overviews and AI Mode are included in the normal Performance report under the "Web" search type. You cannot separate them, but you can watch trends for the pages and queries you care about.
2. **Bing Webmaster Tools AI Performance.** Shows citations in Copilot and Bing's AI answers by page and by "grounding query".
3. **Referral traffic in your analytics.** Look for visits from chatgpt.com, perplexity.ai, gemini.google.com and copilot.microsoft.com. ChatGPT usually adds utm_source=chatgpt.com to the links it shows.
4. **A monthly prompt check.** Pick 10 to 20 questions a real customer would ask, run them in ChatGPT, Gemini, Google AI Mode, Copilot and Perplexity, and record whether you are mentioned, whether the description is accurate, and which competitors appear. Use a private or logged-out window, because answers are personalised.

A simple log is enough. The rows below are an example:

| Prompt | Assistant | Mentioned? | Accurate? | Competitors named | Date |
| --- | --- | --- | --- | --- | --- |
| "Best accountant for contractors in Leeds" | ChatGPT | Yes, 3rd of 5 | Fee out of date | Firm A, Firm B | 3 Nov |
| "Fixed-fee accountant Leeds small company" | AI Mode | No | – | Firm A, Firm C | 3 Nov |

Treat single results as anecdotes and look for movement over several months. For a structured version of this process, use our [AI visibility audit checklist](/blog/ai-visibility-audit).

## A 30-day plan for a small UK business

**Week 1: access.** Check robots.txt and your CDN or security settings for blocked AI search crawlers. Set up Bing Webmaster Tools and submit your sitemap. Confirm your key pages are indexed in both Google and Bing.

**Week 2: clarity.** Rewrite your homepage headline and first paragraph so they state what you do, for whom, where and (if you can) the price range. Make sure each core service has its own page. Move any important text out of images and PDFs.

**Week 3: answers.** Pull the 10 questions customers ask most often and answer them on the right pages, leading with a direct answer. Add a clear "last updated" date and an author or team name to guides.

**Week 4: reputation and baseline.** Ask your last 20 happy customers for a review, fix inconsistent business details in directories, and run your first prompt check so you have a baseline to compare against next month.

## Where PageGrade fits

PageGrade does not track AI citations. What it does is review a landing page the way a sharp first-time visitor would, and much of what it checks overlaps with what AI assistants need: whether the headline makes the offer clear, whether the audience is obvious, whether there is credible proof and visible business details, and whether the page loads fast on a phone. Fixing those helps people *and* machines understand you, and it is usually the quickest win available. You can [see a full sample report](/sample) to judge for yourself.
`;

export const post: Post = {
  slug: 'ai-search-visibility-uk',
  status: 'published',
  seoTitle: 'AI Search Visibility: Get Found in ChatGPT & Google AI (UK)',
  title: 'AI search visibility: how to get your business found in ChatGPT, Gemini and Google’s AI answers',
  shortTitle: 'AI search visibility guide',
  description: 'AI search visibility explained: how ChatGPT, Copilot and Google’s AI Overviews choose which businesses to mention, and five ways UK firms can get found.',
  excerpt: 'How ChatGPT, Gemini, Copilot and Google’s AI Overviews decide which businesses to mention, the five things that actually move AI visibility, and how to measure it for free.',
  published: '2026-11-06',
  author: 'pagegrade',
  category: 'ai-search',
  tags: ['AI search', 'ChatGPT', 'Google AI Overviews', 'AI Mode', 'Bing', 'Generative engine optimisation', 'UK'],
  locations: ['United Kingdom'],
  primaryKeyword: 'AI search visibility',
  secondaryKeywords: ['how to rank in ChatGPT', 'AI SEO UK', 'generative engine optimisation', 'get cited in Google AI Overviews', 'AI visibility for small businesses', 'OAI-SearchBot robots.txt'],
  featured: true,
  related: ['ai-visibility-audit', 'local-seo-ai-search-uk'],
  faqs: [
    { q: 'What is AI search visibility?', a: 'AI search visibility is how often and how accurately AI assistants such as ChatGPT, Gemini, Copilot, Perplexity and Google’s AI Overviews mention, cite or recommend your business when people ask them questions. It depends on the assistant being able to find your pages, understand what you offer and trust what other sources say about you.' },
    { q: 'Is AI search optimisation different from SEO?', a: 'Mostly no. Google says normal SEO best practices apply to AI Overviews and AI Mode, with no special requirements. The differences are practical: allowing AI search crawlers such as OAI-SearchBot, being indexed in Bing as well as Google, writing pages that answer specific questions clearly, and earning mentions on other sites.' },
    { q: 'Can I pay to appear in ChatGPT answers?', a: 'You cannot buy a place in ChatGPT’s organic answers, and answers vary between users and sessions, so no agency can guarantee one. Be wary of anyone selling guaranteed AI rankings.' },
    { q: 'Will blocking GPTBot remove me from ChatGPT?', a: 'No. GPTBot is OpenAI’s training crawler. ChatGPT search uses OAI-SearchBot, which you can allow separately. OpenAI says sites that block OAI-SearchBot will not appear in ChatGPT search answers.' },
    { q: 'Do I need an llms.txt file?', a: 'It is not a priority. Google has said it does not use llms.txt for Search or its AI features, and there is no solid evidence that major assistants use it to decide what to cite. Fix crawler access, indexing and page clarity first.' },
    { q: 'How long does it take to improve AI visibility?', a: 'Technical fixes such as unblocking a crawler can take effect within days, since OpenAI says robots.txt changes for search take around 24 hours. Content and reputation improvements usually take several months to show up consistently, so measure monthly rather than daily.' },
  ],
  cta: {
    title: 'Is your page clear enough to be recommended?',
    body: 'PageGrade checks whether your landing page says plainly what you do, who it is for and why to trust you, the same things AI assistants and customers look for. It shows the evidence on your own screenshots, with fixes in priority order. Your first 3 reviews are free.',
    label: 'Review my page',
  },
  body,
};
