/** Page types and goals (no dependencies, safe for client bundles). */
export const PAGE_TYPES = {
  saas: 'SaaS or software product',
  service: 'Service, agency or consultancy',
  ecommerce: 'E-commerce product or store',
  leadgen: 'Lead generation or campaign page',
  event: 'Event or webinar registration',
  other: 'Other business page',
} as const;
export type PageType = keyof typeof PAGE_TYPES;

export const GOALS = {
  demo: { label: 'Book a demo or call', pattern: 'demo|book|schedule|talk to|call|meeting|consult|get started' },
  trial: { label: 'Start a free trial', pattern: 'trial|try|start|get started|free' },
  signup: { label: 'Create an account', pattern: 'sign ?up|create|join|register|get started|start|try' },
  purchase: { label: 'Buy a product', pattern: 'buy|add to (cart|bag|basket)|shop|order|checkout|purchase|get (it|yours|one)|pre-?order' },
  lead: { label: 'Capture a lead or enquiry', pattern: 'get|download|request|quote|contact|free|guide|access|claim|enquire|inquire' },
  register: { label: 'Register for an event', pattern: 'register|reserve|rsvp|save (my|your) (seat|spot)|book|sign ?up|ticket' },
  subscribe: { label: 'Subscribe', pattern: 'subscribe|join|sign ?up|get updates' },
  contact: { label: 'Contact sales', pattern: 'contact|talk|sales|demo|quote|call|get in touch|enquire|inquire|book' },
} as const;
export type Goal = keyof typeof GOALS;

/** Number of rubric checks (kept here so client copy stays dependency-free; a unit test keeps it in sync with rubric.ts). */
export const CHECK_COUNT = 36;
export const CATEGORY_COUNT = 7;
