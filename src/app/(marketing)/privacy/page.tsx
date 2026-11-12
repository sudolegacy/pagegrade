import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/site/legal-page';
import { LEGAL_UPDATED, companyLine } from '@/lib/legal';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy policy', description: 'How PageGrade collects, uses and protects personal data.', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  const email = <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>;
  return (
    <LegalPage title="Privacy policy" updated={LEGAL_UPDATED} current="/privacy"
      intro={<p>This policy explains what personal data PageGrade collects, why, who we share it with and the choices you have. We have written it to be read, not skimmed past.</p>}>
      <h2>Who we are</h2>
      <p>PageGrade is run by {companyLine()} (&ldquo;PageGrade&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). We are the controller of the personal data described here. You can contact us about anything in this policy at {email}.</p>

      <h2>What we collect</h2>
      <h3>When you create an account</h3>
      <p>Your email address and password. We never store your password itself, only a salted, one-way hash of it (scrypt). We also record when your account was created, whether you have verified your email address and your notification preference.</p>
      <h3>When you request a review</h3>
      <p>The address of the page, the page type and goal you choose, and any description of your audience and other context you type in. To produce the review we load the page in an automated browser and keep screenshots of it, the text and layout information we measure from it, and the report we generate.</p>
      <p>The pages you submit should be public. If a page shows personal data (for example names in testimonials), it may appear in the screenshots and captured text. We use it only to produce your review.</p>
      <h3>When you pay</h3>
      <p>Payments are handled by Stripe. We do not see or store your full card details. We keep your Stripe customer reference, your plan, its status and renewal date.</p>
      <h3>When you ask for a prospect pack or a call</h3>
      <p>Your name, work email address, agency name and website, the public page addresses you ask us to review, and anything you write in the message box. We use them to prepare and send your pack, to reply to you about it and, if you become a customer, to set up your account. We keep them for up to 12 months after our last contact, or until you ask us to delete them.</p>
      <h3>When you use a website check on another business&rsquo;s site</h3>
      <p>Some PageGrade customers put our website check (the &ldquo;lead widget&rdquo;) on their own website. If you use one, we collect the page address you enter, the goal you choose, your name and email address, and the address of the page the check sits on. We run the check, show you the result, and pass your details and the full report to that business, which may contact you about it. For these details that business is the controller and we process them on its behalf: its privacy policy, linked under the form where it has given us one, explains how it uses them. To have your details deleted, ask that business, or email us and we will pass your request on.</p>
      <h3>When you use the site</h3>
      <p>A session cookie that keeps you signed in (see our <Link href="/cookies">cookie policy</Link>), the browser type of each signed-in session, and IP addresses used briefly to limit repeated sign-in attempts and other abuse. Our hosting provider also keeps server logs, which include IP addresses, for a limited period. We do not use analytics, advertising or tracking cookies.</p>

      <h2>How we use it and our lawful bases</h2>
      <ul>
        <li><strong>To provide the service you signed up for</strong> (contract): running reviews, showing your reports, managing your plan and sending the emails the service needs, such as email verification, password resets and review-ready notifications (which you can turn off in Settings).</li>
        <li><strong>To help you get value from PageGrade</strong> (legitimate interests): a few short emails after you sign up or upgrade, for example a reminder to run your first review, what the paid plans add once your free reviews are used, and a check-in to ask how it is going. Each is sent at most once, and the Settings email toggle turns them all off.</li>
        <li><strong>To keep PageGrade secure and working</strong> (legitimate interests): preventing abuse and fraud, rate limiting, fixing problems and keeping backups.</li>
        <li><strong>To meet legal obligations</strong> (legal obligation): for example keeping records of payments for tax purposes.</li>
      </ul>
      <p>We do not sell your personal data, and we do not use it for advertising.</p>

      <h2>Who we share it with</h2>
      <p>We use a small number of service providers who process data on our behalf under contracts that require them to protect it:</p>
      <ul>
        <li><strong>OpenAI</strong> analyses the screenshots and page text of the pages you submit, together with the page type, goal and audience details you provide, to produce the AI-judged parts of your review. OpenAI states that data sent through its API is not used to train its models by default.</li>
        <li><strong>Stripe</strong> processes payments and manages subscriptions.</li>
        <li><strong>Our email delivery provider</strong> sends account and notification emails.</li>
        <li><strong>Railway</strong> hosts the servers that run PageGrade and store its data and backups.</li>
        <li><strong>Google</strong>, if we use the PageSpeed Insights service for a speed test, receives the public address of the page being tested.</li>
      </ul>
      <p>Some of these providers are based in, or process data in, the United States or other countries outside the UK. Where personal data leaves the UK, we rely on safeguards recognised under UK data protection law, such as UK adequacy regulations or the International Data Transfer Addendum to the EU Standard Contractual Clauses.</p>
      <p>We may also disclose data if the law requires it, or to protect our rights or the safety of others.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li><strong>Reviews</strong> are kept until you delete them or your account. When you delete a review we remove its report and screenshots immediately, and keep only the page address, date and outcome so that plan allowances work correctly.</li>
        <li><strong>Your account</strong> is kept until you delete it from Settings. Deleting it removes your account, sessions and all of your reviews, and cancels any subscription.</li>
        <li><strong>Details given through a lead widget</strong> are kept until the business that runs the widget deletes them, or deletes its account.</li>
        <li><strong>Backups</strong> of our database are kept for up to 7 days, so deleted data disappears from backups within a week.</li>
        <li><strong>A temporary analysis cache</strong>, used so an unchanged page is not analysed twice, is deleted after at most 14 days.</li>
        <li><strong>Payment records</strong> are kept by Stripe and by us for as long as tax law requires (normally six years).</li>
      </ul>

      <h2>Your rights</h2>
      <p>Under UK data protection law you can ask us for a copy of your personal data, ask us to correct or delete it, ask us to restrict or stop processing it, object to processing based on legitimate interests, and ask for data you gave us in a portable format. Most of this you can do yourself in the app: you can delete reviews and your whole account at any time. For anything else, email {email}. We will reply within one month.</p>
      <p>If you are unhappy with how we handle your data, please tell us first so we can put it right. You also have the right to complain to the Information Commissioner&rsquo;s Office (ICO) at <a href="https://ico.org.uk/make-a-complaint/" rel="noopener noreferrer">ico.org.uk</a> or on 0303 123 1113.</p>

      <h2>Security</h2>
      <p>Connections to PageGrade are encrypted, passwords are hashed, sign-in attempts are rate limited and access to our systems is restricted. Shared report links are long, random and can be turned off at any time. No system is perfectly secure, so if you think your account has been compromised, change your password and contact us.</p>

      <h2>Children</h2>
      <p>PageGrade is a business tool and is not intended for anyone under 18.</p>

      <h2>Changes to this policy</h2>
      <p>If we make significant changes we will tell you by email or in the app before they take effect. The date at the top shows when this policy was last updated.</p>
    </LegalPage>
  );
}
