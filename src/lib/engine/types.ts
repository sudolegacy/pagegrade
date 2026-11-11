export type Box = { x: number; y: number; w: number; h: number };
export type TextBlock = { t: string; tag: string; b: Box; fs: number; fw: number };
export type Cta = {
  text: string; href: string; tag: string; buttonLike: boolean; inNav: boolean; inFooter: boolean; aboveFold: boolean;
  b: Box; fs: number; textContrast: number | null; shapeContrast: number | null; goalMatch: boolean; vague: boolean;
};
export type FormInfo = {
  b: Box; fields: number; required: number; labelled: number; placeholderOnly: number; types: string[];
  submitText: string; isSearch: boolean; emailOnly: boolean; aboveFold: boolean; inFooter: boolean;
};

/** Measured facts extracted from the rendered DOM (see capture/extract.ts). */
export type PageFacts = {
  url: string; title: string; lang: string;
  meta: { description: string; robots: string; viewport: string; ogTitle: string; ogImage: string; canonical: boolean; jsonLdTypes: string[] };
  doc: { width: number; height: number; viewportW: number; viewportH: number; overflowX: boolean };
  headings: { level: number; text: string; y: number; fs: number }[];
  h1Count: number;
  hero: { headline: { text: string; fs: number; b: Box; tag: string; split?: boolean } | null; subheadline: { text: string; fs: number; b: Box } | null; aboveFoldText: string };
  ctas: Cta[]; primaryCta: Cta | null; heroCtaCount: number; buttonCtaCount: number;
  nav: { links: number; hasCta: boolean };
  forms: FormInfo[];
  trust: {
    testimonials: { text: string; author: string; hasPhoto: boolean; b: Box }[];
    logos: { count: number; y: number | null; heading: string };
    ratings: string[]; reviewPlatforms: string[]; stats: string[]; badges: string[]; guarantees: string[];
    contact: { email: boolean; phone: boolean; contactLink: boolean; about: boolean };
    legal: { privacy: boolean; terms: boolean };
    caseStudies: boolean;
  };
  pricing: { present: boolean; samples: string[]; link: boolean };
  faq: { present: boolean; items: number };
  content: { words: number; sentences: number; flesch: number | null; avgSentence: number | null; paragraphs: number; longParagraphs: number; you: number; we: number };
  outline: { y: number; h: number; heading: string; text: string; tag: string }[];
  design: { fonts: string[]; bodyFont: number | null; lineLength: number | null; smallText: number; contrastIssues: { text: string; ratio: number; b: Box }[]; contrastChecked: number };
  media: { images: number; imagesNoAlt: number; videos: number; iframes: string[]; carousels: number };
  a11y: { buttonsNoName: number; linksNoText: number; inputsNoLabel: number; headingSkips: number };
  quality: { brokenImages: number; unloadedImages: number; placeholders: string[]; stillHidden: number };
  blocks: TextBlock[];
};

export type Layer = { id: number; onTop: boolean; kind: 'cookie' | 'chat' | 'header' | 'bottom-bar' | 'widget' | 'age-gate' | 'region' | 'popup-offer' | 'modal' | 'other'; position: string; cover: number; top: number; height: number; width: number; text: string; hasEmail: boolean; hasButton: boolean };

export type CaptureIssue = { code: string; severity: 'info' | 'warning' | 'error'; message: string };

export type ProfileCapture = {
  profile: 'desktop' | 'mobile';
  viewport: { width: number; height: number; dpr: number };
  finalUrl: string;
  status: number | null;
  facts: PageFacts;
  layers: Layer[];
  consent: { found: boolean; method: string | null };
  overlaysDismissed: { kind: string; method: string; text: string }[];
  removedFixed: { text: string; top: number; height: number; width: number }[];
  scroll: { steps: number; startHeight: number; finalHeight: number; growthEvents: number; reachedEnd: boolean; truncated: boolean };
  revealed: number;
  unlockedScroll: boolean;
  capturedHeight: number;
  /** Files written for this profile (relative to the review's storage dir). */
  files: { firstImpression: string; hero: string; full: string; tiles: { file: string; y: number; h: number }[] };
  timings: Record<string, number>;
  blankBands: { y0: number; y1: number; suspicious: boolean }[];
  metrics: { ttfb: number | null; lcp: number | null; cls: number | null; load: number | null };
  attempt: number;
};

export type CaptureResult = {
  requestedUrl: string;
  finalUrl: string;
  redirected: boolean;
  status: 'complete' | 'partial' | 'blocked' | 'failed';
  completeness: number;
  issues: CaptureIssue[];
  desktop: ProfileCapture | null;
  mobile: ProfileCapture | null;
  network: { requests: number; blocked: string[]; bytes: number; budgetExceeded: boolean };
  contentHash: string;
  durationMs: number;
};
