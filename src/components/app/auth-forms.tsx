'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, Field, Input } from '@/components/ui/field';
import { api, ApiError } from '@/lib/api';

function useSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); } catch (e) {
      const err = e as ApiError;
      setError({ message: err.message, field: err.field });
      setLoading(false);
    }
  };
  return { loading, error, run, setError };
}

function PasswordInput({ id, autoComplete, value, onChange, invalid }: { id: string; autoComplete: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} required value={value} onChange={(e) => onChange(e.target.value)} invalid={invalid} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-zinc-400 hover:text-zinc-700" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[26px] font-semibold leading-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">{subtitle}</p>}
    </div>
  );
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { loading, error, run } = useSubmit();
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => { await api('/api/auth/login', { body: { email, password } }); router.replace(next); router.refresh(); }); };
  return (
    <>
      <Heading title="Log in to PageGrade" subtitle={<>New here? <Link href={`/signup${next !== '/app' ? `?next=${encodeURIComponent(next)}` : ''}`} className="link">Create a free account</Link></>} />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword} />
        </Field>
        <div className="flex justify-end -mt-1"><Link href="/forgot-password" className="text-[13px] font-medium text-zinc-600 hover:text-ink">Forgot password?</Link></div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Log in</Button>
      </form>
    </>
  );
}

export function SignupForm({ next, url }: { next: string; url?: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { loading, error, run } = useSubmit();
  const dest = url ? `/app/new?url=${encodeURIComponent(url)}` : next;
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => { await api('/api/auth/signup', { body: { name, email, password } }); router.replace(dest); router.refresh(); }); };
  return (
    <>
      <Heading title="Create your free account" subtitle="3 full reviews free. No card needed." />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && !error.field && <Alert tone="error">{error.message}</Alert>}
        <Field label="Name" htmlFor="name" optional>
          <Input id="name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Work email" htmlFor="email" error={error?.field === 'email' ? error.message : null}>
          <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} invalid={error?.field === 'email'} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters." error={error?.field === 'password' ? error.message : null}>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={setPassword} invalid={error?.field === 'password'} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Create account</Button>
        <p className="text-center text-[13px] leading-relaxed text-zinc-500">
          By creating an account you agree to our <Link href="/terms" className="underline underline-offset-2 hover:text-zinc-800">Terms</Link> and <Link href="/privacy" className="underline underline-offset-2 hover:text-zinc-800">Privacy Policy</Link>.
        </p>
      </form>
      <p className="mt-8 border-t border-zinc-200 pt-6 text-center text-[14px] text-zinc-600">Already have an account? <Link href="/login" className="link">Log in</Link></p>
    </>
  );
}

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { loading, error, run } = useSubmit();
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => { await api('/api/auth/forgot', { body: { email } }); setSent(true); }); };
  if (sent) return (
    <div>
      <div className="mb-5 grid size-11 place-items-center rounded-full bg-brand-50 text-brand-700"><MailCheck className="size-5" /></div>
      <Heading title="Check your inbox" subtitle={<>If an account exists for <strong className="font-medium text-ink">{email}</strong>, we have sent a link to reset your password. It expires in 1 hour.</>} />
      <Link href="/login" className="link text-[14px]">Back to log in</Link>
    </div>
  );
  return (
    <>
      <Heading title="Reset your password" subtitle="Enter the email you signed up with and we will send you a reset link." />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error.message}</Alert>}
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Send reset link</Button>
      </form>
      <p className="mt-6 text-center text-[14px] text-zinc-600"><Link href="/login" className="link">Back to log in</Link></p>
    </>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const { loading, error, run } = useSubmit();
  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => { await api('/api/auth/reset', { body: { token, password } }); router.replace('/app?reset=1'); router.refresh(); }); };
  if (!token) return (
    <>
      <Heading title="This link is incomplete" subtitle="Open the link from your email again, or request a new one." />
      <Link href="/forgot-password" className="link text-[14px]">Request a new link</Link>
    </>
  );
  return (
    <>
      <Heading title="Choose a new password" subtitle="You will be signed out everywhere else." />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && error.field !== 'password' && <Alert tone="error" action={error.message.includes('expired') ? <Link className="link text-[13px]" href="/forgot-password">New link</Link> : undefined}>{error.message}</Alert>}
        <Field label="New password" htmlFor="password" hint="At least 10 characters." error={error?.field === 'password' ? error.message : null}>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={setPassword} invalid={error?.field === 'password'} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>Save password and log in</Button>
      </form>
    </>
  );
}
