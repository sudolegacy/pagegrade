import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/site/legal-page';
import { LEGAL_UPDATED, companyLine } from '@/lib/legal';
import { PLANS } from '@/lib/plans';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Terms of service', description: 'The terms that apply when you use PageGrade.', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  const email = <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>;
  return (
    <LegalPage title="Terms of service" updated={LEGAL_UPDATED} current="/terms"
      intro={<p>These terms are an agreement between you and {companyLine()} (&ldquo;PageGrade&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using PageGrade you accept them. If you use PageGrade for a business, you confirm you can accept these terms on its behalf.</p>}>
      <h2>1. What PageGrade does</h2>
      <p>PageGrade reviews web pages you submit. It loads each page in an automated browser, measures it, uses AI models to assess parts of it against a published set of criteria, and produces a report with a score, findings and suggestions.</p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must give a valid email address and keep your password secure. You are responsible for activity on your account.</li>
        <li>You must be 18 or over to use PageGrade.</li>
        <li>Tell us straight away at {email} if you think someone else has accessed your account.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You may only submit pages that are publicly available and that you are entitled to have reviewed, such as your own pages, your clients&rsquo; pages or competitors&rsquo; public pages for research. You must not:</p>
      <ul>
        <li>use PageGrade to attack, overload, probe or gain unauthorised access to any website or system;</li>
        <li>try to get around plan limits, rate limits or security measures, or access other users&rsquo; data;</li>
        <li>submit content or use the service in a way that is unlawful, infringes anyone&rsquo;s rights or would harm PageGrade or others;</li>
        <li>resell or provide access to the service itself to third parties. Sharing reports with your clients and colleagues is fine.</li>
      </ul>
      <p>We may suspend or close accounts that break these rules. Where reasonable, we will tell you first and give you a chance to put things right.</p>

      <h2>4. Reports and AI</h2>
      <p>Reports are produced automatically by software and AI models. We work hard to make them accurate and we test them regularly, but they can contain mistakes and they reflect the page at the moment it was captured. Reports are general guidance, not professional, legal or accessibility compliance advice, and we do not promise any particular result, such as a higher conversion rate. You are responsible for deciding which changes to make to your pages.</p>

      <h2>5. Plans, payment and cancellation</h2>
      <ul>
        <li>The Free plan includes {PLANS.free.reviews} reviews in total. Paid plans are monthly subscriptions that include a set number of reviews per billing period, as shown on our <Link href="/pricing">pricing page</Link>.</li>
        <li>Subscriptions are billed in advance in pounds sterling through Stripe and renew automatically each month until you cancel.</li>
        <li>A review is counted when it completes. Reviews that fail are not counted. Unused reviews do not carry over to the next period.</li>
        <li>You can change plan or cancel at any time from the billing page. If you cancel, your plan continues until the end of the period you have paid for and you will not be charged again. Upgrades take effect immediately and the price difference is prorated.</li>
        <li>We may change our prices. We will tell you at least 30 days before a change affects your subscription, so you can cancel first if you wish.</li>
      </ul>

      <h2>6. If you are a consumer</h2>
      <p>If you use PageGrade for purposes outside your trade or business, you have a legal right to cancel a new paid subscription within 14 days of buying it. To do so, email {email}. If you have used reviews during that time, we may deduct a proportionate amount for the service already provided from your refund. Nothing in these terms affects your other statutory rights.</p>

      <h2>7. Your content and our service</h2>
      <p>You keep all rights in the information you give us. You allow us to use it, and to capture the pages you submit, only to provide and improve the service as described in our <Link href="/privacy">privacy policy</Link>. You may use, copy and share the reports you generate for your own purposes and for your clients. Everything else about PageGrade, including the software, design, criteria and branding, belongs to us.</p>
      <p>If you turn on a shared link for a report, anyone with the link can view it until you turn the link off. You are responsible for who you share it with.</p>

      <h2>8. Availability and changes</h2>
      <p>We aim to keep PageGrade available and working well, but we cannot promise it will always be uninterrupted or error-free. Some websites block automated browsers, so we cannot guarantee that every page can be reviewed. We may change, add or remove features. If we make a change that significantly reduces what you have paid for, you may cancel and we will refund the unused part of your current period.</p>

      <h2>9. Our liability</h2>
      <p>Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot be limited by law.</p>
      <p><strong>If you use PageGrade for business,</strong> we are not liable for loss of profits, revenue, business, goodwill or data, or for any indirect or consequential loss, and our total liability to you in any 12-month period is limited to the amount you paid us in that period.</p>
      <p><strong>If you are a consumer,</strong> we are responsible for loss you suffer that is a foreseeable result of our breach of these terms or our negligence. PageGrade is intended for business use, so we are not responsible for any loss of business or profit.</p>

      <h2>10. Ending this agreement</h2>
      <p>You can stop using PageGrade and delete your account at any time from Settings. We may end this agreement or suspend your account if you seriously or repeatedly break these terms. If we close the service entirely, we will give you at least 30 days&rsquo; notice and refund any unused part of a paid period.</p>

      <h2>11. Changes to these terms</h2>
      <p>We may update these terms. If a change is significant, we will tell you by email or in the app at least 30 days before it takes effect. If you do not agree, you can cancel before then.</p>

      <h2>12. Law and disputes</h2>
      <p>These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction. If you are a consumer living in Scotland or Northern Ireland, you may also bring proceedings in your local courts. If you have a complaint, please email {email} first; most problems can be solved quickly that way.</p>
    </LegalPage>
  );
}
