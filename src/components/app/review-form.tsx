'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Globe } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Alert, Field, Input, Select, Textarea } from '@/components/ui/field';
import { GOALS, PAGE_TYPES } from '@/lib/engine/catalog';
import { api, type ApiError } from '@/lib/api';

export type ReviewDefaults = { url?: string; pageType?: string; goal?: string; audience?: string; context?: string };

const AUDIENCE_EXAMPLES: Record<string, string> = {
  saas: 'e.g. Finance teams at UK companies with 50–500 staff',
  service: 'e.g. Small business owners who need a new website',
  ecommerce: 'e.g. Runners looking for their first pair of trail shoes',
  leadgen: 'e.g. Homeowners in Manchester considering solar panels',
  event: 'e.g. Marketing managers who want to learn about SEO',
  other: 'e.g. Parents looking for after-school tutoring',
};

export function ReviewForm({ defaults, remaining, unlimited, blocked }: { defaults: ReviewDefaults; remaining: number | null; unlimited: boolean; blocked?: 'unverified' | null }) {
  const router = useRouter();
  const [url, setUrl] = useState(defaults.url ?? '');
  const [pageType, setPageType] = useState(defaults.pageType && defaults.pageType in PAGE_TYPES ? defaults.pageType : 'saas');
  const [goal, setGoal] = useState(defaults.goal && defaults.goal in GOALS ? defaults.goal : 'signup');
  const [audience, setAudience] = useState(defaults.audience ?? '');
  const [context, setContext] = useState(defaults.context ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const { id } = await api<{ id: string }>('/api/reviews', { body: { url, pageType, goal, audience, context } });
      router.push(`/app/reviews/${id}`);
    } catch (err) {
      setError(err as ApiError);
      setLoading(false);
    }
  };

  const outOfReviews = !unlimited && remaining === 0;
  return (
    <form onSubmit={submit} className="card divide-y divide-zinc-100" noValidate>
      <div className="space-y-5 p-5 sm:p-7">
        {error && !error.field && (
          <Alert tone="error" action={
            error.code === 'out_of_reviews' ? <ButtonLink href="/app/billing" size="sm">See plans</ButtonLink>
              : error.code === 'review_in_progress' && error.data?.reviewId ? <ButtonLink href={`/app/reviews/${String(error.data.reviewId)}`} size="sm" variant="secondary">View progress</ButtonLink>
                : undefined
          }>{error.message}</Alert>
        )}
        {blocked === 'unverified' && <Alert tone="warning" title="Confirm your email first">Open the link we emailed you, then come back here. You can resend it from the banner above.</Alert>}
        <Field label="Page URL" htmlFor="url" error={error?.field === 'url' ? error.message : null} hint="The exact page visitors land on, e.g. from an ad or email. It must be publicly reachable.">
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <Input id="url" name="url" inputMode="url" autoComplete="url" placeholder="yourcompany.com/landing-page" required autoFocus={!defaults.url} value={url} onChange={(e) => setUrl(e.target.value)} invalid={error?.field === 'url'} className="pl-9" />
          </div>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="What kind of page is it?" htmlFor="pageType">
            <Select id="pageType" value={pageType} onChange={(e) => setPageType(e.target.value)}>
              {Object.entries(PAGE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="What should visitors do?" htmlFor="goal">
            <Select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)}>
              {Object.entries(GOALS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Who is the page for?" htmlFor="audience" error={error?.field === 'audience' ? error.message : null} hint="Be specific. We judge relevance and clarity for this audience.">
          <Input id="audience" name="audience" required maxLength={240} placeholder={AUDIENCE_EXAMPLES[pageType]} value={audience} onChange={(e) => setAudience(e.target.value)} invalid={error?.field === 'audience'} />
        </Field>
        <Field label="Anything else we should know?" htmlFor="context" optional hint="Where the traffic comes from, what you have tried, or what worries you about the page.">
          <Textarea id="context" name="context" maxLength={1000} rows={3} placeholder="e.g. Traffic comes from Google Ads for 'payroll software for small business'. Sign-ups dropped after our redesign." value={context} onChange={(e) => setContext(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-3 bg-zinc-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <p className="text-[13px] leading-relaxed text-zinc-500">
          {unlimited ? 'Admin account: reviews are not limited.' : outOfReviews ? <>You have no reviews left. <Link href="/app/billing" className="link">Choose a plan</Link> to continue.</> : <>Uses 1 of your {remaining} remaining review{remaining === 1 ? '' : 's'}, and only if it completes.</>}
        </p>
        <Button type="submit" size="lg" loading={loading} disabled={outOfReviews || blocked === 'unverified'}>Start review<ArrowRight className="size-4" aria-hidden /></Button>
      </div>
    </form>
  );
}
