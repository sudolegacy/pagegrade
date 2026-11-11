import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env';

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
    ${opts.outro ? `<tr><td style="font-size:13px;line-height:1.6;color:#6b7280">${esc(opts.outro)}</td></tr>` : ''}
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
};
