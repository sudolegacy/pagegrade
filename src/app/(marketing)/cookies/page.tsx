import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/site/legal-page';
import { LEGAL_UPDATED } from '@/lib/legal';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'Cookie policy', description: 'PageGrade uses a single, strictly necessary cookie to keep you signed in.', alternates: { canonical: '/cookies' } };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie policy" updated={LEGAL_UPDATED} current="/cookies"
      intro={<p>The short version: PageGrade sets one cookie, only when you sign in, and only so that you stay signed in. There are no analytics, advertising or tracking cookies, which is why we do not show a cookie banner.</p>}>
      <h2>The cookie we use</h2>
      <div className="overflow-x-auto">
        <table>
          <thead><tr><th>Name</th><th>Purpose</th><th>Duration</th></tr></thead>
          <tbody>
            <tr><td><code>pg_session</code> (named <code>__Host-pg_session</code> on secure connections)</td><td>Keeps you signed in to your account. It holds a random token and nothing else; it cannot be read by scripts on the page.</td><td>30 days, or until you log out</td></tr>
          </tbody>
        </table>
      </div>
      <p>This cookie is strictly necessary to provide the service you ask for, so under the Privacy and Electronic Communications Regulations it does not need your consent. You can block or delete cookies in your browser settings, but you will not be able to sign in without it.</p>

      <h2>Payments</h2>
      <p>When you upgrade or manage your plan, you are taken to pages run by Stripe. Stripe sets its own cookies there, for example to prevent fraud. Those cookies are covered by <a href="https://stripe.com/cookies-policy/legal" rel="noopener noreferrer">Stripe&rsquo;s cookie policy</a>.</p>

      <h2>Pages we review</h2>
      <p>When PageGrade reviews a page, it loads that page in an isolated, automated browser on our servers. Any cookies that page sets stay in that browser and are discarded when the review finishes. They are never placed on your device.</p>

      <h2>Questions</h2>
      <p>See our <Link href="/privacy">privacy policy</Link> for how we handle personal data, or email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.</p>
    </LegalPage>
  );
}
