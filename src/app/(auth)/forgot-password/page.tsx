import type { Metadata } from 'next';
import { ForgotForm } from '@/components/app/auth-forms';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } };
export default function ForgotPage() { return <ForgotForm />; }
