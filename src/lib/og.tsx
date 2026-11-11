import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

/** Shared 1200×630 social card (Open Graph / Twitter), rendered at build time. */
export const OG_SIZE = { width: 1200, height: 630 };

const font = (file: string) => readFile(path.join(process.cwd(), 'node_modules/geist/dist/fonts/geist-sans', file));

export async function socialCard({ eyebrow, title, footer }: { eyebrow: string; title: string; footer: string[] }) {
  const [medium, semibold] = await Promise.all([font('Geist-Medium.ttf'), font('Geist-SemiBold.ttf')]);
  const size = title.length > 60 ? 58 : 68;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', background: '#fbfbfa', fontFamily: 'Geist', color: '#18181b', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, background: '#0f7a45' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="52" height="52" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#0f7a45" />
            <path d="M16 7.5a8.5 8.5 0 1 1-8.5 8.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <path d="M12.2 16.3l2.6 2.6 5.2-5.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em' }}>PageGrade</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <span style={{ fontSize: 26, fontWeight: 500, color: '#0f7a45' }}>{eyebrow}</span>
          <span style={{ fontSize: size, fontWeight: 600, lineHeight: 1.08, letterSpacing: '-0.035em', maxWidth: 1000 }}>{title}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {footer.map((f) => (
            <span key={f} style={{ display: 'flex', fontSize: 21, fontWeight: 500, color: '#3f3f46', background: '#ffffff', border: '1.5px solid #e4e4e7', borderRadius: 10, padding: '8px 14px' }}>{f}</span>
          ))}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Geist', data: medium, weight: 500, style: 'normal' },
        { name: 'Geist', data: semibold, weight: 600, style: 'normal' },
      ],
    },
  );
}
