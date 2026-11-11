import type { Post } from '../index';

const body = `
When someone in Headingley asks their phone "who's a good emergency plumber near me that's open now?", the answer increasingly comes from an AI assistant rather than a list of ten blue links. Google's AI Overviews and AI Mode, Gemini, ChatGPT and Microsoft Copilot all now answer local questions by naming a few businesses and explaining why.

**Local SEO for AI search** is the work of making sure your business is one of those names, and that what the assistant says about you is right. The good news for UK small businesses: it is mostly the same work as good local SEO, done more thoroughly and across more places than just Google.

This guide covers where local AI answers get their facts, the foundation every local business needs, and specific playbooks for trades, clinics, professional services and hospitality, because what makes an assistant recommend a dentist is very different from what makes it recommend a roofer.

## Where AI assistants get local business information

No assistant publishes its full recipe, but the main sources are well understood:

| Assistant | Main local sources | What to keep up to date |
| --- | --- | --- |
| Google AI Overviews, AI Mode, Gemini | Google Business Profile, Google Maps, Google's web index | Your Google Business Profile and website |
| ChatGPT | Web search results (Bing among its search partners), licensed and third-party place data, review sites, your website | Bing Places, major directories, reviews, your website |
| Microsoft Copilot | Bing's index and Bing Places | Bing Places and Bing Webmaster Tools |
| Siri and Apple Maps | Apple Business Connect and Apple's map data partners | Apple Business Connect |

Industry studies of ChatGPT's local answers suggest it draws on a mix of Bing data, place databases such as Foursquare, and review platforms, and that the mix changes over time. Because nobody outside OpenAI knows the exact weighting, the reliable strategy is the boring one: **be accurate and consistent everywhere**, so whichever source an assistant reads, it reads the same facts.

Google's own [guidance on AI features](https://developers.google.com/search/docs/appearance/ai-features) says there is no special requirement to appear in AI Overviews or AI Mode, but recommends keeping your Business Profile information current as part of normal good practice.

## The local foundation: six steps for every business

### 1. Complete your Google Business Profile properly

Your [Google Business Profile](https://www.google.com/business/) is the single most important local data source for Google's AI features. Most profiles we see are half-finished. Fill in:

- The **primary category** that best matches what you do (it carries most weight), plus relevant secondary categories.
- **Services** with short descriptions and prices where you can give them.
- **Service area** (for businesses that travel to customers) or a precise address (for those customers visit).
- **Opening hours**, including bank holidays and special hours over Christmas.
- **Attributes** such as wheelchair access, free Wi-Fi or "identifies as women-owned", which AI answers often pick up for filtered questions.
- **Photos** of your actual premises, team, vehicles and work.

### 2. Claim Bing Places and Apple Business Connect

Most UK businesses have never claimed [Bing Places](https://www.bingplaces.com/), even though Bing feeds Microsoft Copilot and is part of the web data ChatGPT searches. Bing Places lets you import your listing directly from Google Business Profile, so it takes minutes. Do the same with Apple Business Connect so Siri and Apple Maps have your correct details.

### 3. Make your name, address and phone identical everywhere

Assistants cross-check sources. If your website says "Unit 4, Mill Lane", Google says "4 Mill Ln" and an old directory still has your previous phone number, you give the model reasons to doubt or mix up the facts. Pick one exact format and use it on your website, Google, Bing, Apple, Facebook, Yell, your trade body listing and anywhere else you appear. If you are a limited company, make sure your trading name and registered company name are clearly connected on your website, ideally with your Companies House number.

### 4. Earn reviews steadily, and reply to them

Recent, specific reviews are one of the strongest signals for local recommendations, and AI answers often summarise what reviewers say ("customers mention fast call-outs and clear pricing"). Ask every satisfied customer, make it easy with a direct link, and reply to every review, including the bad ones, calmly and specifically.

Never buy reviews, write your own or offer incentives only for positive ones. Since April 2025 the Digital Markets, Competition and Consumers Act has banned fake reviews in the UK, and the Competition and Markets Authority can fine businesses directly.

### 5. Build a proper page for each place you really serve

This is where many businesses go wrong. Creating "Plumber Leeds", "Plumber Wakefield", "Plumber Bradford" pages that are identical except for the town name produces **doorway pages**, which Google's spam policies specifically target. AI assistants also gain nothing from them, because they say nothing new.

A location page earns its place when it contains things that are only true of that place:

- **Bad:** "We are the leading plumbers in Wakefield. Our Wakefield plumbers offer a fast Wakefield plumbing service."
- **Good:** "We cover Wakefield, Ossett and Horbury (WF1 to WF5) from our Dewsbury base, usually within 90 minutes for emergencies. Many homes in Wakefield's older terraces still have back boilers; we've removed more than 60 of them since 2022 and can quote for a full combi conversion. Recent jobs: a burst pipe in Sandal, a boiler swap in Outwood."

If you can't write at least a few paragraphs of genuinely local detail (jobs done, travel times, local housing stock, parking, landmarks, local regulations), you probably don't need a separate page for that town. List it on your main service area page instead.

### 6. Add LocalBusiness structured data that matches the page

[LocalBusiness](https://schema.org/LocalBusiness) markup (or a more specific type such as Plumber, Dentist or AccountingService) tells machines your name, address, phone, hours and area served in a standard format. It is not required for AI features and is not a ranking shortcut, but it removes ambiguity. The one rule: everything in the markup must also be visible on the page.

## Industry playbooks

The foundation is the same for everyone. What convinces an assistant to recommend you, and what customers ask, differs a lot by industry.

### Trades: plumbers, electricians, heating engineers and roofers

Typical questions: "emergency electrician open now in Leeds", "how much to replace a boiler in Manchester", "is [company] Gas Safe registered?"

- **Show your registrations in text**, with numbers: Gas Safe Register for gas work (it is a legal requirement), NICEIC or NAPIT for electrical work, TrustMark or competent person schemes for other work. Assistants are asked about these directly, and customers check.
- **List the areas you cover** by town and postcode district (for example LS6, LS16, WF17), and say honestly how quickly you can usually attend.
- **Publish your call-out fee and typical price ranges.** "Boiler replacement from £2,200 fitted, including a 10-year warranty" is quotable; "competitive prices" is not.
- **Say when you're open** and whether you take emergency calls out of hours, in your Google profile and on your site.
- **Keep trade directory profiles current**, such as Checkatrade, TrustATrader or MyBuilder, because review summaries from these sites are frequently used in answers.

### Dentists, clinics and other health practices

Typical questions: "dentist accepting new NHS patients in Bristol", "how much is Invisalign in Glasgow?", "private dentist open Saturdays near me".

- **State clearly whether you accept new NHS patients**, for adults and children, and update it when it changes. In many parts of the UK this is the first question people ask, and stale information sends them elsewhere.
- **Publish a private fee guide** with prices or ranges for common treatments.
- **Show professional registration**: the General Dental Council for dentists, plus a link to your latest Care Quality Commission inspection report if you are in England (or the equivalent regulator in Scotland, Wales or Northern Ireland).
- **Name your clinicians** with their qualifications and special interests. A page per clinician helps both patients and machines connect treatments to people.
- **Be careful with claims.** Health advertising is regulated; stick to factual descriptions of treatments and avoid promising outcomes.

### Accountants, solicitors and other professional services

Typical questions: "accountant for Making Tax Digital for sole traders in Leeds", "fixed-fee conveyancing solicitor Sheffield", "best accountant for contractors".

- **Make your specialism the headline.** "Accountants for landlords and sole traders" is far more recommendable than "Full-service accountancy". Assistants match specialists to specific questions.
- **Publish fixed fees** where possible. Solicitors are already required by the Solicitors Regulation Authority to publish prices for certain services, including residential conveyancing.
- **Show regulation and membership**: the SRA digital badge for solicitors, ICAEW, ACCA or AAT membership for accountants, and your professional indemnity insurance.
- **Write about timely changes your clients face.** Making Tax Digital for Income Tax began for sole traders and landlords with qualifying income over £50,000 from April 2026, and many people are asking assistants what it means for them. A clear, accurate page from a local firm is exactly what gets cited.

### Restaurants, cafés, pubs and hospitality

Typical questions: "dog-friendly pub with food near Ilkley", "vegan brunch in Leeds city centre", "restaurant with a private room for 20 in York".

- **Put your menu on your website as text**, not only as a PDF or a photo. Assistants answer dietary and price questions from menu text.
- **Spell out attributes** people filter by: dog-friendly, step-free access, high chairs, outdoor seating, private hire capacity, gluten-free options. Add them to your Google profile as well.
- **Keep hours and booking links current**, especially seasonal changes.
- **Show your Food Hygiene Rating.** Displaying it is mandatory in Wales and Northern Ireland and voluntary in England, but a good rating is a trust signal everywhere.
- **Encourage descriptive reviews.** "Great Sunday roast and they welcomed our dog" helps an assistant recommend you for exactly that question.

## How to check what AI assistants say about you

Once a month, run the questions your customers would ask, including your town or neighbourhood, in Google AI Mode, Gemini, ChatGPT and Copilot. Use a private browser window, and if possible test from your area, since local answers depend on location. Record whether you appear, whether the details are correct, and who else is recommended.

When an assistant gets something wrong, trace the error to its source. A wrong phone number usually comes from an outdated directory listing; old prices usually come from an old page on your site or a third-party article. Fix the source, then check again in a few weeks.

For the full process, including crawler access, indexing and a scoring sheet, use our [AI visibility audit checklist](/blog/ai-visibility-audit). For the wider picture beyond local search, read [our guide to AI search visibility](/blog/ai-search-visibility-uk).

## The page that has to convert

All of this gets someone to your website or your phone number. What happens next depends on your page: whether it immediately confirms you do the job, cover their area and can be trusted. A visitor sent by an AI answer has usually already compared you with two or three others, so a vague or slow page loses them fast. That is the part PageGrade checks: [see a sample report](/sample) to judge what it finds.
`;

export const post: Post = {
  slug: 'local-seo-ai-search-uk',
  status: 'published',
  seoTitle: 'Local SEO for AI Search: Get Recommended by ChatGPT (UK)',
  title: 'Local SEO for AI search: how UK businesses get recommended by ChatGPT, Gemini and Google',
  shortTitle: 'Local SEO for AI search',
  description: 'Local SEO for AI search: how UK businesses get recommended by ChatGPT, Gemini and Google AI, with Bing Places, reviews and industry playbooks.',
  excerpt: 'Where AI assistants get local business facts, the six-step foundation every UK business needs, and specific playbooks for trades, clinics, accountants, solicitors and hospitality.',
  published: '2026-11-06',
  author: 'pagegrade',
  category: 'local-seo',
  tags: ['Local SEO', 'AI search', 'ChatGPT', 'Google Business Profile', 'Bing Places', 'UK'],
  industries: ['Trades', 'Dentists and clinics', 'Accountants', 'Solicitors', 'Hospitality'],
  locations: ['United Kingdom', 'Leeds', 'West Yorkshire'],
  primaryKeyword: 'local SEO for AI search',
  secondaryKeywords: ['how to get recommended by ChatGPT', 'AI search for local businesses UK', 'Google Business Profile AI Overviews', 'Bing Places UK', 'local SEO Leeds', 'location pages doorway pages'],
  related: ['ai-search-visibility-uk', 'ai-visibility-audit'],
  faqs: [
    { q: 'Does ChatGPT use Google Business Profile?', a: 'Not directly as far as is publicly known. ChatGPT’s local answers appear to draw on web search results (with Bing among its search partners), place databases and review sites. That is why claiming Bing Places and keeping directory listings accurate matters alongside your Google profile.' },
    { q: 'Should I create a page for every town I cover?', a: 'Only for places where you can write genuinely local, useful detail: jobs done there, travel times, local housing or regulations. Near-identical pages that only swap the town name are doorway pages under Google’s spam policies and are unlikely to help in AI answers either.' },
    { q: 'How do I get more reviews without breaking the rules?', a: 'Ask every customer, send a direct link to your review page and reply to all reviews. Do not buy reviews, write your own or reward only positive ones: fake reviews have been unlawful in the UK since April 2025 under the Digital Markets, Competition and Consumers Act.' },
    { q: 'An AI assistant has my business details wrong. How do I fix it?', a: 'Find where the wrong detail comes from, usually an outdated directory listing, an old page on your site or your Bing or Apple listing, and correct it there. Then make sure the correct details are consistent on your website and Google Business Profile, and check again after a few weeks.' },
    { q: 'Is local structured data required for AI search?', a: 'No. Google says no special structured data is needed for AI Overviews or AI Mode. LocalBusiness markup can still help machines read your name, address, hours and service area without ambiguity, as long as it matches what is visible on the page.' },
  ],
  cta: {
    title: 'Does your page confirm you are the right choice?',
    body: 'Customers arriving from an AI answer have already shortlisted you. PageGrade checks whether your page makes your service, area, proof and next step obvious on desktop and mobile, with the evidence and fixes. Your first 3 reviews are free.',
    label: 'Review my page',
  },
  body,
};
