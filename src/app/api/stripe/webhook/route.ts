import type { NextRequest } from 'next/server';
import { handleWebhook } from '@/lib/server/billing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const { status, body } = await handleWebhook(raw, req.headers.get('stripe-signature'));
  return new Response(body, { status });
}
