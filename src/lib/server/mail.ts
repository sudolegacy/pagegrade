import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env';
import { BULK_MAX, PLANS, priceFor } from '../plans';

let transport: Transporter | null = null;
function getTransport(): Transporter | null {
  const smtp = env.smtp;
  if (!smtp) return null;
  transport ??= nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined });
  return transport;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Minimal, client-safe HTML email layout (tables + inline styles). */
function layout(opts: { heading: string; intro: string; items?: string[]; cta?: { label: string; url: string }; outro?: string }) {
  const button = opts.cta
    ? `<tr><td style="padding:8px 0 24px"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#0f7a45;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">${esc(opts.cta.label)}</a></td></tr>
       <tr><td style="font-size:13px;color:#6b7280;padding-bottom:16px">Or paste this link into your browser:<br><span style="color:#374151;word-break:break-all">${esc(opts.cta.url)}</span></td></tr>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f6f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f4;padding:32px 16px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
    <tr><td style="font-weight:700;font-size:16px;color:#0f7a45;padding-bottom:24px">PageGrade</td></tr>
    <tr><td style="font-weight:650;font-size:20px;color:#111827;padding-bottom:12px">${esc(opts.heading)}</td></tr>
    <tr><td style="font-size:15px;line-height:1.6;color:#374151;padding-bottom:20px">${esc(opts.intro)}</td></tr>
    ${opts.items?.length ? `<tr><td style="font-size:15px;line-height:1.6;color:#374151;padding-bottom:20px"><ul style="margin:0;padding-left:20px">${opts.items.map((i) => `<li style="margin-bottom:6px">${esc(i)}</li>`).join('')}</ul></td></tr>` : ''}
    ${button}
    ${opts.outro ? `<tr><td style="font-size:13px;line-height:1.6;color:#6b7280">${esc(opts.outro).replace(/\n/g, '<br>')}</td></tr>` : ''}
  </table>
  <p style="font-size:12px;color:#9ca3af;margin-top:16px">PageGrade LTD · <a href="mailto:${esc(env.supportEmail)}" style="color:#9ca3af">${esc(env.supportEmail)}</a></p>
  </td></tr></table></body></html>`;
}

export async function sendMail(to: string, subject: string, opts: Parameters<typeof layout>[0]) {
  const text = [opts.heading, '', opts.intro, ...(opts.items?.length ? ['', ...opts.items.map((i) => `- ${i}`)] : []), opts.cta ? `\n${opts.cta.label}: ${opts.cta.url}` : '', opts.outro ? `\n${opts.outro}` : '', '\n— PageGrade'].join('\n');
  const t = getTransport();
  if (!t) {
    // No SMTP configured (local development): log instead of sending.
    console.info(`[mail] (not sent, SMTP not configured) to=${to} subject="${subject}"${opts.cta ? ` link=${opts.cta.url}` : ''}`);
    return { sent: false };
  }
  await t.sendMail({ from: env.emailFrom, to, subject, text, html: layout(opts), replyTo: env.supportEmail });
  return { sent: true };
}

const greeting = (name: string) => { const first = name.trim().split(/\s+/)[0]; return first ? `Hi ${first},` : 'Hi,'; };
const signoff = () => (env.founderName ? `${env.founderName}, founder of PageGrade` : 'The PageGrade team');
/** Sign-off for the lifecycle emails: an optional last line, the founder's name, then how to stop them. */
const closing = (note?: string) => `${note ? `${note}\n` : ''}${signoff()}\n\nTo stop emails like this one, turn off email notifications in Settings.`;
const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const usd = (n: number) => `$${n.toFixed(2)}`;
const plural = (n: number, noun: string) => `${n.toLocaleString('en-GB')} ${noun}${n === 1 ? '' : 's'}`;

export const mailer = {
  verify: (to: string, url: string) => sendMail(to, 'Confirm your email for PageGrade', {
    heading: 'Confirm your email', intro: 'Confirm your email address to start reviewing pages with PageGrade. This link expires in 24 hours.',
    cta: { label: 'Confirm email', url }, outro: "If you didn't create a PageGrade account, you can ignore this email.",
  }),
  reset: (to: string, url: string) => sendMail(to, 'Reset your PageGrade password', {
    heading: 'Reset your password', intro: 'Someone (hopefully you) asked to reset the password for this PageGrade account. This link expires in 1 hour and can be used once.',
    cta: { label: 'Choose a new password', url }, outro: "If you didn't ask for this, you can ignore this email; your password won't change.",
  }),
  reviewComplete: (to: string, opts: { url: string; score: number; grade: string; pageUrl: string }) => sendMail(to, `Your PageGrade review is ready: ${opts.score}/100`, {
    heading: `Your review is ready: ${opts.score}/100 (${opts.grade})`, intro: `We've finished reviewing ${opts.pageUrl}. Your report includes the prioritised fixes and the evidence behind every finding.`,
    cta: { label: 'Open the report', url: opts.url }, outro: 'You can turn off these emails in Settings.',
  }),
  reviewFailed: (to: string, opts: { url: string; pageUrl: string; reason: string }) => sendMail(to, 'We could not complete your PageGrade review', {
    heading: 'We could not complete your review', intro: `We couldn't review ${opts.pageUrl}: ${opts.reason} You have not been charged for this review.`,
    cta: { label: 'Try again', url: opts.url },
  }),
  monitorAlert: (to: string, opts: { url: string; pageUrl: string; label: string; competitor: boolean; changes: { title: string; detail: string }[] }) => sendMail(to, `${opts.competitor ? 'Competitor change' : 'Page alert'}: ${opts.label || opts.pageUrl}`, {
    heading: opts.competitor ? 'A competitor changed their page' : 'Something changed on your page',
    intro: `This week's check of ${opts.pageUrl} found:`,
    items: opts.changes.map((c) => `${c.title}. ${c.detail}`),
    cta: { label: 'See what changed', url: opts.url }, outro: 'You get these alerts for pages you monitor. You can turn them off in Settings.',
  }),
  /** Founder alert: someone signed up. Sent to FOUNDER_ALERT_EMAIL so every new user gets a personal hello (business plan: "personally contact new sign-ups"). */
  founderSignup: (to: string, opts: { email: string; name: string; referred: boolean; claimedGrades: number; adminUrl: string }) => sendMail(to, `New sign-up: ${opts.email}`, {
    heading: 'Someone just signed up',
    intro: `${opts.name ? `${opts.name} (${opts.email})` : opts.email} created a PageGrade account${opts.referred ? ' through a partner link' : ''}${opts.claimedGrades ? ` after ${opts.claimedGrades} free grade${opts.claimedGrades === 1 ? '' : 's'}` : ''}.`,
    items: ['Reply to them today from your own mailbox: ask what they were trying to do and offer to look at a page with them.', 'Agencies: offer the free prospect pack and a 15-minute call.'],
    cta: { label: 'Open the admin page', url: opts.adminUrl },
  }),
  /** Founder alert: an agency asked for a prospect pack or a call. The plan promises a pack within 24 hours. */
  founderLead: (to: string, opts: { kind: string; name: string; email: string; company: string; website: string; prospects: string[]; message: string; adminUrl: string }) => sendMail(to, `${opts.kind === 'pack' ? 'Pack request' : opts.kind === 'call' ? 'Call request' : 'New lead'}: ${opts.company || opts.email}`, {
    heading: opts.kind === 'pack' ? 'An agency wants a prospect pack' : opts.kind === 'call' ? 'Someone wants a call' : 'New lead',
    intro: `${opts.name || 'Someone'} at ${opts.company || 'an unnamed company'} (${opts.email}${opts.website ? `, ${opts.website}` : ''}) asked for ${opts.kind === 'pack' ? 'three branded audits' : opts.kind === 'call' ? 'a 15-minute call' : 'more information'}.${opts.message ? ` They wrote: "${opts.message}"` : ''}`,
    items: opts.prospects.length ? opts.prospects.map((p, i) => `Prospect ${i + 1}: ${p}`) : undefined,
    cta: { label: 'Open the lead in admin', url: opts.adminUrl },
    outro: 'Target: reply within 24 hours. Run the three pages through Bulk review in a client folder, download the branded PDFs and reply in the same thread.',
  }),
  welcome: (to: string, opts: { name: string; url: string; signature: string }) => sendMail(to, 'Welcome to PageGrade', {
    heading: `Welcome${opts.name ? `, ${opts.name.split(' ')[0]}` : ''}`,
    intro: 'Thanks for signing up. Your free plan includes 3 full reviews: the score, every issue with its fix, and rewritten headlines and buttons.',
    items: [
      'Start with the page that matters most, usually your homepage or main landing page.',
      'Fix the top three issues, then review the page again to check the score moved.',
      'Reply to this email if anything is unclear or looks wrong. Every reply is read.',
    ],
    cta: { label: 'Review a page', url: opts.url }, outro: opts.signature,
  }),
  /** Weekly founder email: the numbers the plan says to check every Monday, without opening the admin page. `failRate` is 0 to 1. */
  founderDigest: (to: string, o: {
    weekLabel: string; mrrGbp: number; paying: number; newUsers: number; grades: number; claimed: number; packRequests: number; openLeads: number;
    cancellations: number; spendUsd: number; peakDayUsd?: number; budgetUsd: number; failRate: number; adminUrl: string;
  }) => sendMail(to, `PageGrade week: ${gbp(o.mrrGbp)} MRR · ${o.paying} paying · ${plural(o.newUsers, 'sign-up')}`, {
    heading: `Your PageGrade ${o.weekLabel}`,
    intro: 'The numbers from the last seven days, so you can check them against the plan without opening the admin page.',
    items: [
      `MRR: ${gbp(o.mrrGbp)} from ${plural(o.paying, 'paying customer')}`,
      `Sign-ups: ${plural(o.newUsers, 'new account')}`,
      `Free grader: ${plural(o.grades, 'grade')}, ${o.claimed} claimed by a new account`,
      `Pack requests: ${o.packRequests} this week, ${plural(o.openLeads, 'lead')} still open`,
      `Cancellations: ${o.cancellations} (cancelled, or set to cancel at the end of the period)`,
      `AI spend: ${usd(o.spendUsd)} this week${o.peakDayUsd != null ? `, busiest day ${usd(o.peakDayUsd)} against the ${usd(o.budgetUsd)} daily cap` : ` (daily cap ${usd(o.budgetUsd)})`}`,
      `Failed reviews: ${Math.round(o.failRate * 100)}% of those finished`,
    ],
    cta: { label: 'Open the admin page', url: o.adminUrl },
    outro: 'Plan targets: 5%+ of agencies ask for a pack, under 2% opt out, under 3% bounce, under 4% of customers cancel a month, and AI spend stays under the cap.',
  }),
  /** Day 2 to 7 after sign-up, no full review yet. */
  lifecycleFirstReview: (to: string, o: { name: string; url: string }) => sendMail(to, 'Ready for your first PageGrade review?', {
    heading: 'Ready for your first review?',
    intro: `${greeting(o.name)} you signed up for PageGrade a few days ago but haven't run a full review yet. It takes a few minutes, and you'll get an email when it's done.`,
    items: [
      'Start with the page that matters most: usually your homepage, or the page your ads or emails send people to.',
      'Say who the page is for and what you want visitors to do. The more specific you are, the more specific the fixes.',
      "Reply to this email with the link to your page and I'll tell you the first change I'd make.",
    ],
    cta: { label: 'Review a page', url: o.url },
    outro: closing(),
  }),
  /** All free reviews used and still on Free. */
  lifecycleFreeUsed: (to: string, o: { name: string; url: string }) => sendMail(to, `You've used your ${PLANS.free.reviews} free PageGrade reviews`, {
    heading: `You've used your ${PLANS.free.reviews} free reviews`,
    intro: `${greeting(o.name)} that's all of your free reviews. To check that your changes worked, you can keep reviewing on a paid plan:`,
    items: [
      `Starter, ${gbp(PLANS.starter.priceGbp)} a month: ${PLANS.starter.reviews} reviews a month and a weekly check on ${plural(PLANS.starter.limits.monitors, 'page')}, with an alert if something changes.`,
      `Pro, ${gbp(PLANS.pro.priceGbp)} a month: ${PLANS.pro.reviews} reviews a month, weekly checks on ${PLANS.pro.limits.monitors} pages (competitors too), PDF reports and priority in the queue.`,
      `Pay yearly and you get two months free: ${gbp(priceFor(PLANS.starter, 'year'))} for Starter, ${gbp(priceFor(PLANS.pro, 'year'))} for Pro.`,
    ],
    cta: { label: 'See the plans', url: o.url },
    outro: closing("Not sure which plan fits? Reply and tell me what you're working on."),
  }),
  /** The day after upgrading to Agency: the three things that make it stick, and the onboarding call. */
  lifecycleAgencyOnboarding: (to: string, o: { name: string; url: string; bookingUrl?: string }) => sendMail(to, 'Getting set up on PageGrade Agency', {
    heading: `Welcome to the Agency plan${o.name.trim() ? `, ${o.name.trim().split(/\s+/)[0]}` : ''}`,
    intro: 'Thanks for upgrading. Agencies that get the most from PageGrade do these three things in their first week, and each takes a few minutes:',
    items: [
      'Add your logo and name in Settings, so reports and PDFs carry your brand instead of ours.',
      `Create a client folder, then bulk review up to ${BULK_MAX} of that client's pages in one go.`,
      "Set up weekly checks for the pages of your five most important clients. You'll get an email when a score drops, a page goes down or a competitor changes.",
    ],
    cta: { label: 'Set up your branding', url: o.url },
    outro: closing(o.bookingUrl
      ? `I do a free 15-minute onboarding call with every Agency customer, and we can set all of this up together. Book a time: ${o.bookingUrl} or just reply to this email.`
      : "I do a free 15-minute onboarding call with every Agency customer, and we can set all of this up together. Reply to this email and I'll find a time."),
  }),
  /** One question, a week and about a month after sign-up, for paying customers. */
  lifecycleCheckIn: (to: string, o: { name: string; url: string; day: number }) => sendMail(to, o.day < 14 ? 'How is your first week with PageGrade?' : 'One question about PageGrade', {
    heading: o.day < 14 ? 'How is PageGrade going?' : 'How is PageGrade working for you?',
    intro: o.day < 14
      ? `${greeting(o.name)} you've had PageGrade for about a week. What's working well so far, and what's missing? Reply with one thing and I'll read it myself.`
      : `${greeting(o.name)} you've had PageGrade for nearly a month. If you could change one thing about it, what would it be? A line or two is plenty, and I read every reply.`,
    cta: { label: 'Open PageGrade', url: o.url },
    outro: closing(),
  }),
};
