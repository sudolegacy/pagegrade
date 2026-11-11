'use client';

/** Last-resort fallback when the root layout itself fails. Kept dependency-free on purpose. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', background: '#fbfbfa', color: '#18181b' }}>
        <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ maxWidth: 440, textAlign: 'center' }}>
            <h1 style={{ fontSize: 26, margin: '0 0 12px' }}>PageGrade is having a problem</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: '#52525b', margin: 0 }}>
              Please try again in a moment. If it keeps happening, email pagegrade1@gmail.com{error.digest ? ` and quote reference ${error.digest}` : ''}.
            </p>
            <button onClick={reset} style={{ marginTop: 24, height: 40, padding: '0 16px', borderRadius: 8, border: 0, background: '#0f7a45', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}
