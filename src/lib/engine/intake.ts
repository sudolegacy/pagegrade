import { z } from 'zod';

import { PAGE_TYPES, GOALS, type PageType, type Goal } from './catalog';
export { PAGE_TYPES, GOALS, type PageType, type Goal };

export const intakeSchema = z.object({
  url: z.string().trim().min(3).max(2048),
  pageType: z.enum(Object.keys(PAGE_TYPES) as [PageType, ...PageType[]]),
  goal: z.enum(Object.keys(GOALS) as [Goal, ...Goal[]]),
  audience: z.string().trim().min(3, 'Describe who the page is for.').max(240),
  context: z.string().trim().max(1000).optional().default(''),
});
export type Intake = z.infer<typeof intakeSchema>;
