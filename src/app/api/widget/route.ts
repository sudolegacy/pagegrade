import { z } from 'zod';
import { handler, assertSameOrigin, readJson, json, HttpError } from '@/lib/server/http';
import { isAdmin, requireApiUser } from '@/lib/server/session';
import { updateWidget, widgetLimit } from '@/lib/server/widget';

export const dynamic = 'force-dynamic';

// Lengths, links and websites are checked, with friendlier messages, by updateWidget.
const patch = z.object({
  active: z.boolean().optional(),
  notify: z.boolean().optional(),
  headline: z.string().max(500).optional(),
  intro: z.string().max(1000).optional(),
  buttonLabel: z.string().max(200).optional(),
  ctaLabel: z.string().max(200).optional(),
  ctaUrl: z.string().max(1000).optional(),
  privacyUrl: z.string().max(1000).optional(),
  allowedHosts: z.string().max(2000).optional(),
});

/** Saves the account's lead-widget settings (Agency plan). */
export const PATCH = handler(async (req) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  if (!widgetLimit(user, { admin: isAdmin(user) })) throw new HttpError(402, 'The lead widget is part of the Agency plan.', 'widget_unavailable');
  const widget = updateWidget(user.id, patch.parse(await readJson(req)));
  return json({ widget });
});
