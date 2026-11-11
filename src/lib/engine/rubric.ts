import type { PageType } from './intake';

export const ENGINE_VERSION = '2.0.0';

export type CategoryId = 'clarity' | 'cta' | 'trust' | 'design' | 'persuasion' | 'mobile' | 'technical';
/** ai = judged from screenshots + page facts; dom = measured; hybrid = AI judgement bounded by measured facts; lighthouse = lab audit. */
export type CriterionSource = 'ai' | 'dom' | 'hybrid' | 'lighthouse';

export type Criterion = {
  id: string;
  category: CategoryId;
  label: string;
  /** Short question shown in the report and given to the evaluator. */
  question: string;
  weight: number;
  source: CriterionSource;
  /** Rating anchors 0..4 (only needed for AI-judged criteria). */
  anchors?: [string, string, string, string, string];
  /** Why this matters, shown in the report. */
  why: string;
};

export const CATEGORIES: Record<CategoryId, { label: string; weight: number; blurb: string }> = {
  clarity: { label: 'Clarity', weight: 0.24, blurb: 'Can a visitor tell what you offer, for whom, and why it matters within a few seconds?' },
  cta: { label: 'Calls to action', weight: 0.2, blurb: 'Is the next step obvious, specific and easy to take?' },
  trust: { label: 'Trust & proof', weight: 0.16, blurb: 'Does the page give visitors evidence that it is safe and worth it?' },
  design: { label: 'Design & hierarchy', weight: 0.14, blurb: 'Does the layout guide the eye and read comfortably?' },
  persuasion: { label: 'Persuasion', weight: 0.12, blurb: 'Does the page build desire and answer objections?' },
  mobile: { label: 'Mobile experience', weight: 0.08, blurb: 'Does the page work on a phone, where most visitors arrive?' },
  technical: { label: 'Speed & technical', weight: 0.06, blurb: 'Is the page fast, accessible and discoverable?' },
};

export const CRITERIA: Criterion[] = [
  // ---------------- Clarity ----------------
  { id: 'clarity.offer', category: 'clarity', label: 'Clear offer', weight: 3, source: 'ai',
    question: 'Within five seconds of seeing the first screen, can a visitor tell exactly what is being offered?',
    why: 'Visitors decide in seconds whether a page is relevant. If they cannot tell what you sell, they leave before reading anything else.',
    anchors: [
      'Impossible to tell what is offered from the first screen (abstract slogan, no headline, or the hero is about something else).',
      'Only a vague category can be guessed (e.g. "solutions", "innovation") and it takes reading body copy to find out.',
      'The general category is clear but the specific product/service is generic or needs a second look.',
      'Clear what is offered, but one detail (what it is, or how it is delivered) still needs inferring.',
      'Instantly specific: the first screen states exactly what the product/service is in plain words.',
    ] },
  { id: 'clarity.outcome', category: 'clarity', label: 'Outcome-focused headline', weight: 2, source: 'ai',
    question: 'Does the headline communicate a concrete benefit or outcome for the visitor, not just a name or a feature?',
    why: 'People buy outcomes. A headline that names the result the visitor wants earns the next few seconds of attention.',
    anchors: [
      'No benefit at all: company name, a greeting ("Welcome"), or an empty slogan.',
      'Generic benefit that any competitor could claim ("grow your business", "the best solution").',
      'A relevant benefit, but abstract or unquantified.',
      'A specific, relevant outcome for the target visitor.',
      'A specific, vivid outcome with a concrete detail (number, timeframe or before/after) that is credible.',
    ] },
  { id: 'clarity.audience', category: 'clarity', label: 'Clear audience', weight: 1.5, source: 'ai',
    question: 'Is it obvious who the page is for, so the right visitor feels "this is for me"?',
    why: 'When the right visitor sees themselves in the copy, relevance and conversion rise; vague pages speak to no one.',
    anchors: [
      'No indication of who it is for.',
      'Audience only implied by industry jargon or buried in body copy.',
      'A broad audience is clear (e.g. "businesses"), but not specific enough to feel targeted.',
      'The audience is clear near the top (role, company type or situation).',
      'The audience is explicit in the hero and the copy speaks to their specific situation.',
    ] },
  { id: 'clarity.support', category: 'clarity', label: 'Supporting subheadline', weight: 1.5, source: 'ai',
    question: 'Does the supporting copy under the headline explain how it works or what the visitor gets, in one or two scannable lines?',
    why: 'The subheadline turns curiosity into understanding. It should explain the "how" or the "what" that the headline cannot.',
    anchors: [
      'No supporting copy near the headline, or it is unrelated.',
      'Supporting copy exists but is fluff or repeats the headline.',
      'Adds some information but is long, dense or vague.',
      'Clearly explains what the visitor gets or how it works.',
      'Concise and specific: what it is, how it works and a key differentiator, easily scanned.',
    ] },
  { id: 'clarity.headline_present', category: 'clarity', label: 'Prominent headline', weight: 1, source: 'dom',
    question: 'Is there a large, clearly dominant headline in the first screen?',
    why: 'A dominant headline anchors the page; without one the eye has nowhere obvious to start.' },

  // ---------------- CTA ----------------
  { id: 'cta.primary_above_fold', category: 'cta', label: 'Primary action above the fold', weight: 3, source: 'dom',
    question: 'Is a call to action for the main goal visible in the first screen on desktop?',
    why: 'Visitors who are ready to act should never have to hunt for the next step.' },
  { id: 'cta.copy', category: 'cta', label: 'Specific CTA copy', weight: 1.5, source: 'ai',
    question: 'Does the main button say what happens next or what the visitor gets ("Start my free trial") rather than a generic word ("Submit", "Learn more")?',
    why: 'Specific, value-led button copy reduces uncertainty about what happens after the click.',
    anchors: [
      'No CTA, or the only actions are generic ("Submit", "Click here", "Go").',
      'Generic but understandable ("Learn more", "Contact us", "Sign up").',
      'Indicates the action but not the value ("Get started", "Book now").',
      'Specific action tied to the goal ("Start free trial", "Book a demo").',
      'Specific action plus value or low commitment ("Start my free 14-day trial", "Get my free quote in 2 minutes").',
    ] },
  { id: 'cta.prominence', category: 'cta', label: 'Visually prominent CTA', weight: 2, source: 'hybrid',
    question: 'Is the primary CTA the most visually prominent interactive element (contrast, size, whitespace)?',
    why: 'The primary action should be the easiest thing on the page to see and click.',
    anchors: [
      'No visible CTA, or it blends into the page (text link, same colour as surroundings).',
      'A button exists but is low-contrast, small or visually outranked by other elements.',
      'Visible button with adequate contrast but competing with similar-looking elements.',
      'Clearly stands out with strong contrast and size.',
      'Unmissable: highest-contrast element, generous size and whitespace, clear visual priority.',
    ] },
  { id: 'cta.focus', category: 'cta', label: 'Focused next step', weight: 1.5, source: 'hybrid',
    question: 'Is there one clear primary action, or do several equally weighted actions compete?',
    why: 'Every extra choice of equal weight splits attention. One primary action (plus at most one secondary) converts best.',
    anchors: [
      'Many competing actions of equal weight (several buttons, banners and links fight for attention).',
      'Three or more equally prominent actions in the hero.',
      'A primary action exists, but secondary actions or navigation pull attention away.',
      'One clear primary action with a visually subordinate secondary option.',
      'One unmistakable primary action, consistently repeated, with distractions minimised.',
    ] },
  { id: 'cta.repetition', category: 'cta', label: 'CTA repeated down the page', weight: 1, source: 'dom',
    question: 'On longer pages, is the main action repeated after key sections so visitors can act when convinced?',
    why: 'Visitors are convinced at different points; long pages need the next step available where they decide.' },
  { id: 'cta.friction', category: 'cta', label: 'Low-friction conversion', weight: 1.5, source: 'hybrid',
    question: 'Is taking the action easy (short forms, no surprises) and is the commitment reduced near the CTA ("no card required", "cancel anytime")?',
    why: 'Each extra field and unknown step costs conversions. Friction reducers next to the button reassure hesitant visitors.',
    anchors: [
      'Taking the action is hard: very long or confusing form, or required steps are unclear.',
      'Noticeable friction (many required fields, or unclear what happens after clicking) and nothing reduces the perceived risk.',
      'Reasonable effort, but no reassurance near the CTA.',
      'Low effort and at least one friction reducer near the CTA.',
      'Effortless: minimal fields or one click, clear next step, and strong reassurance right by the CTA.',
    ] },

  // ---------------- Trust ----------------
  { id: 'trust.social_proof', category: 'trust', label: 'Social proof', weight: 2.5, source: 'hybrid',
    question: 'Does the page show evidence that others use and value it (testimonials, customer logos, ratings, case studies, usage numbers)?',
    why: 'Most visitors look for proof that people like them have succeeded before taking a risk.',
    anchors: [
      'No social proof at all.',
      'A single weak signal (one anonymous quote, or a vague claim like "trusted by many").',
      'Some proof (a few testimonials or a logo row) but limited in quantity or variety.',
      'Solid proof from several sources (testimonials and logos, ratings or numbers).',
      'Abundant, varied, specific proof (named testimonials, recognisable logos, ratings, case studies with results).',
    ] },
  { id: 'trust.proof_quality', category: 'trust', label: 'Credible, specific proof', weight: 1.5, source: 'ai',
    question: 'Is the proof credible: attributed to real people or companies, specific about results, and relevant to the audience?',
    why: 'Anonymous or generic praise is easy to fake and is discounted by visitors; specific, attributed results persuade.',
    anchors: [
      'No proof, or proof that looks fake or irrelevant.',
      'Anonymous or generic praise ("Great service!" — J.).',
      'Attributed proof but vague, without results or context.',
      'Attributed proof (name, role or company, often a photo) with some specific detail.',
      'Highly credible: named people and companies, specific measurable results, relevant to the target audience.',
    ] },
  { id: 'trust.proof_placement', category: 'trust', label: 'Proof near decisions', weight: 1, source: 'hybrid',
    question: 'Does proof appear early (near the hero) and close to the main CTAs, where visitors decide?',
    why: 'Proof works best at the moment of doubt: right under the headline and next to the call to action.',
    anchors: [
      'No proof, or only at the very bottom of the page.',
      'Proof only appears far below the first screen.',
      'Some proof in the first two screens, but not near the CTAs.',
      'Proof near the top and near at least one CTA.',
      'Proof reinforces every key decision point, including directly under the hero.',
    ] },
  { id: 'trust.risk_reversal', category: 'trust', label: 'Risk reversal & transparency', weight: 1, source: 'hybrid',
    question: 'Are risks reduced with guarantees, free trials, clear pricing, refunds or cancellation terms?',
    why: 'Removing the fear of a bad decision (cost, lock-in, wasted time) lets hesitant visitors say yes.',
    anchors: [
      'No reassurance; costs, commitments or what happens next are unclear.',
      'A vague reassurance with no details.',
      'One concrete reducer (e.g. free trial, or visible pricing).',
      'Several concrete reducers (pricing plus guarantee or trial, cancellation terms).',
      'Comprehensive and prominent risk reversal with clear terms right where visitors decide.',
    ] },
  { id: 'trust.legitimacy', category: 'trust', label: 'Business legitimacy', weight: 1, source: 'dom',
    question: 'Can visitors find who is behind the page: contact details, an about page, privacy policy and terms?',
    why: 'Contact details and legal pages are basic signals that a real, accountable business is behind the page.' },

  // ---------------- Design ----------------
  { id: 'design.hierarchy', category: 'design', label: 'Visual hierarchy', weight: 2, source: 'ai',
    question: 'Does the layout guide the eye from headline to supporting copy to CTA, with clear sizes, contrast and spacing?',
    why: 'Good hierarchy makes the page understandable at a glance and leads visitors toward the action.',
    anchors: [
      'No discernible hierarchy: cluttered, everything competes, the eye has no starting point.',
      'Weak hierarchy: several elements fight for attention and the reading order is unclear.',
      'Mostly clear, with some clutter or competing elements.',
      'Clear hierarchy with a natural reading path to the CTA.',
      'Excellent hierarchy: deliberate sizes, contrast and whitespace make the path to action effortless.',
    ] },
  { id: 'design.scannability', category: 'design', label: 'Scannable sections', weight: 1.5, source: 'hybrid',
    question: 'Can a visitor skim the page via clear section headings, short paragraphs, lists and visuals?',
    why: 'Most visitors skim. Pages built from clear, headed sections get read; walls of text get skipped.',
    anchors: [
      'Walls of text or a confusing structure with no clear sections.',
      'Some structure, but long dense paragraphs dominate.',
      'Reasonably scannable with some dense areas.',
      'Clear sections with descriptive headings and short paragraphs.',
      'Highly scannable: every section has a clear purpose, a descriptive heading and concise, visual content.',
    ] },
  { id: 'design.readability', category: 'design', label: 'Comfortable reading', weight: 1, source: 'dom',
    question: 'Is body text comfortably sized, high-contrast and set in reasonable line lengths?',
    why: 'Small, low-contrast or very wide text is tiring to read and silently loses visitors.' },
  { id: 'design.polish', category: 'design', label: 'Professional polish', weight: 1.5, source: 'hybrid',
    question: 'Does the page look professional and consistent, without broken images, placeholder text, misalignment or dated styling?',
    why: 'Visitors judge credibility by appearance within milliseconds; visible errors undermine trust in the offer.',
    anchors: [
      'Visibly broken: placeholder text, broken images, overlapping elements or severely dated design.',
      'Amateurish or inconsistent: clashing styles, poor alignment, low-quality imagery.',
      'Acceptable but generic or with a few inconsistencies.',
      'Professional and consistent with minor issues.',
      'Polished and distinctive: consistent spacing, typography and imagery throughout.',
    ] },
  { id: 'design.stability', category: 'design', label: 'Stable, unobstructed view', weight: 1, source: 'dom',
    question: 'Does the page stay stable while loading and avoid pop-ups that cover the content on arrival?',
    why: 'Layout shifts cause mis-clicks and entry pop-ups block the very message visitors came to read.' },

  // ---------------- Persuasion ----------------
  { id: 'persuasion.benefits', category: 'persuasion', label: 'Benefits over features', weight: 1.5, source: 'ai',
    question: 'Does the copy explain what features mean for the visitor (benefits), not just list what the product has?',
    why: 'Features tell; benefits sell. Visitors need to see how each capability improves their situation.',
    anchors: [
      'No explanation of value; little or no descriptive content.',
      'A list of features or services with no benefits.',
      'Some benefits, mixed with feature lists.',
      'Mostly benefit-led copy tied to visitor outcomes.',
      'Consistently benefit-led, specific and tied to the audience\'s goals, with features as supporting proof.',
    ] },
  { id: 'persuasion.product_visual', category: 'persuasion', label: 'Shows the product or result', weight: 1.5, source: 'ai',
    question: 'Do visuals show the actual product, service in action or the result, rather than generic stock imagery?',
    why: 'Real product imagery makes the offer tangible; generic stock photos add nothing and can reduce trust.',
    anchors: [
      'No relevant visuals, or imagery is unrelated or broken.',
      'Generic stock imagery or decorative graphics only.',
      'Some relevant visuals but small, unclear or below the fold.',
      'Clear, relevant visuals of the product/service near the top.',
      'Compelling visuals of the real product or outcome that explain the offer on their own.',
    ] },
  { id: 'persuasion.objections', category: 'persuasion', label: 'Answers objections', weight: 1, source: 'hybrid',
    question: 'Does the page address the obvious doubts (price, effort, fit, risk, how it works), for example with an FAQ or comparison?',
    why: 'Unanswered questions become reasons to leave. Answering them on the page keeps visitors moving toward the CTA.',
    anchors: [
      'No objections addressed.',
      'One or two concerns touched on indirectly.',
      'Some common objections answered (e.g. a short FAQ).',
      'Most obvious objections answered clearly (pricing, how it works, fit, risk).',
      'Thoroughly anticipates and answers objections at the right moments in the page.',
    ] },
  { id: 'persuasion.differentiation', category: 'persuasion', label: 'Clear differentiation', weight: 1, source: 'ai',
    question: 'Does the page make clear why to choose this over alternatives (including doing nothing)?',
    why: 'If the offer looks interchangeable, visitors compare on price or leave to keep researching.',
    anchors: [
      'Nothing distinguishes it from alternatives.',
      'Generic claims of superiority ("the best", "high quality") with no substance.',
      'One plausible differentiator, not emphasised.',
      'A clear, specific reason to choose it, made visible.',
      'A compelling, specific and proven unique value proposition woven through the page.',
    ] },
  { id: 'persuasion.readability', category: 'persuasion', label: 'Plain, visitor-focused copy', weight: 1, source: 'dom',
    question: 'Is the copy plain and easy to read, written to the visitor ("you") rather than about the company ("we")?',
    why: 'Plain language widens your audience; visitor-focused copy keeps it about their problem, not your company.' },

  // ---------------- Mobile ----------------
  { id: 'mobile.viewport', category: 'mobile', label: 'Mobile-ready layout', weight: 2, source: 'dom',
    question: 'Does the page adapt to a phone screen without sideways scrolling or zooming?',
    why: 'Over half of web traffic comes from phones. A page that does not fit the screen is unusable for those visitors.' },
  { id: 'mobile.cta', category: 'mobile', label: 'CTA on the first mobile screen', weight: 1.5, source: 'dom',
    question: 'Is the main action visible on the first screen of a phone?',
    why: 'On a phone the first screen is small; if the action is not visible, many visitors never scroll to it.' },
  { id: 'mobile.headline', category: 'mobile', label: 'Headline on the first mobile screen', weight: 1, source: 'dom',
    question: 'Is the headline visible and readable on the first mobile screen?',
    why: 'Heavy headers, banners or images can push the message off the first mobile screen.' },
  { id: 'mobile.tap_targets', category: 'mobile', label: 'Tap-friendly buttons', weight: 1, source: 'dom',
    question: 'Are buttons large enough to tap comfortably (at least 44px tall)?',
    why: 'Small tap targets cause mis-taps and frustration, especially on the primary action.' },
  { id: 'mobile.text', category: 'mobile', label: 'Readable mobile text', weight: 1, source: 'dom',
    question: 'Is body text at least 16px on mobile so it can be read without zooming?',
    why: 'Text below 16px on a phone forces zooming, which most visitors will not do.' },
  { id: 'mobile.layout', category: 'mobile', label: 'Mobile visual quality', weight: 1.5, source: 'hybrid',
    question: 'Does the mobile layout look intentional: no cramped, clipped or overlapping content, and a clear first screen?',
    why: 'Desktop layouts squeezed onto phones often hide the message or the action behind clutter.',
    anchors: [
      'Broken on mobile: overlapping, clipped or unusable content.',
      'Cramped or cluttered; the first screen is mostly navigation, banners or imagery.',
      'Works, but with noticeable compromises (long scroll before the value, awkward spacing).',
      'Clean mobile layout with a clear first screen.',
      'Designed for mobile: clear message, visible action and comfortable spacing on the first screen.',
    ] },

  // ---------------- Technical ----------------
  { id: 'tech.performance', category: 'technical', label: 'Mobile performance score', weight: 1.5, source: 'lighthouse',
    question: 'How does the page score on a Lighthouse mobile performance audit?',
    why: 'Slow pages lose visitors before they see anything, and slower pages convert worse.' },
  { id: 'tech.lcp', category: 'technical', label: 'Largest content loads fast', weight: 1, source: 'lighthouse',
    question: 'How quickly does the main content appear on a typical mobile connection (Largest Contentful Paint)?',
    why: "Largest Contentful Paint is when visitors first see the page's main content; Google recommends 2.5 seconds or less." },
  { id: 'tech.accessibility', category: 'technical', label: 'Accessibility', weight: 1, source: 'lighthouse',
    question: 'Does the page pass automated accessibility checks (contrast, labels, alt text, names)?',
    why: 'Accessible pages work for more people, including the estimated 1 in 6 people worldwide living with a significant disability (WHO), and tend to be clearer for everyone.' },
  { id: 'tech.seo', category: 'technical', label: 'Search & sharing basics', weight: 1, source: 'dom',
    question: 'Are the title, meta description, headings, language and social sharing tags in place?',
    why: 'These basics decide how the page appears in Google results and when shared, which affects who clicks through.' },
];

export const CRITERIA_BY_ID = Object.fromEntries(CRITERIA.map((c) => [c.id, c])) as Record<string, Criterion>;
export const AI_CRITERIA = CRITERIA.filter((c) => c.source === 'ai' || c.source === 'hybrid');

/** Page-type adjustments: category weight deltas (renormalised) and criterion weight multipliers. */
const TYPE_ADJUST: Record<PageType, { categories?: Partial<Record<CategoryId, number>>; criteria?: Record<string, number> }> = {
  saas: { criteria: { 'persuasion.product_visual': 1.3, 'trust.risk_reversal': 1.2 } },
  service: { criteria: { 'trust.proof_quality': 1.3, 'clarity.audience': 1.2, 'persuasion.product_visual': 0.7 } },
  ecommerce: { categories: { trust: 0.03, persuasion: 0.02, clarity: -0.03, technical: 0.01, design: -0.03 }, criteria: { 'persuasion.product_visual': 1.6, 'trust.risk_reversal': 1.5, 'clarity.audience': 0.7, 'cta.repetition': 0.7 } },
  leadgen: { categories: { cta: 0.04, design: -0.02, technical: -0.02 }, criteria: { 'cta.friction': 1.6, 'persuasion.differentiation': 0.8 } },
  event: { criteria: { 'trust.risk_reversal': 0.6, 'persuasion.objections': 1.3, 'clarity.outcome': 1.2 } },
  other: {},
};

export function categoryWeights(pageType: PageType): Record<CategoryId, number> {
  const adj = TYPE_ADJUST[pageType]?.categories ?? {};
  const raw = Object.fromEntries((Object.keys(CATEGORIES) as CategoryId[]).map((id) => [id, Math.max(0.01, CATEGORIES[id].weight + (adj[id] ?? 0))])) as Record<CategoryId, number>;
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / total])) as Record<CategoryId, number>;
}

export function criterionWeight(id: string, pageType: PageType): number {
  const base = CRITERIA_BY_ID[id]?.weight ?? 1;
  return base * (TYPE_ADJUST[pageType]?.criteria?.[id] ?? 1);
}

/** Hard ceilings for fundamental failures: no amount of polish compensates for these. */
export const CAPS = [
  { id: 'unclear-offer', label: 'The offer is not clear', max: 55, criterion: 'clarity.offer' },
  { id: 'no-cta', label: 'There is no clear call to action', max: 45, criterion: 'cta.primary_above_fold' },
  { id: 'no-proof', label: 'There is no social proof', max: 82, criterion: 'trust.social_proof' },
  { id: 'broken-mobile', label: 'The page does not work on mobile', max: 70, criterion: 'mobile.viewport' },
] as const;

export function gradeFor(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
