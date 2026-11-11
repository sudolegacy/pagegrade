import type { Box, Cta, PageFacts, ProfileCapture } from './types';

export type Loc = { profile: 'desktop' | 'mobile'; box: Box };
/** A measured (deterministic) rating for a DOM criterion. rating null = not applicable / not measurable. */
export type Measured = { rating: number | null; evidence: string; location?: Loc };
/** Bounds the AI rating of a hybrid criterion must respect, derived from measured facts. */
export type Bound = { min?: number; max?: number; reason: string };

const clamp = (n: number, lo = 0, hi = 4) => Math.max(lo, Math.min(hi, n));
const q = (s: string, n = 90) => `“${s.length > n ? `${s.slice(0, n - 1)}…` : s}”`;
const px = (n: number) => `${Math.round(n)}px`;

function conversionForms(f: PageFacts) {
  return f.forms.filter((x) => !x.isSearch && !(x.inFooter && x.emailOnly));
}

export function proofSignals(f: PageFacts) {
  const t = f.trust;
  const kinds = {
    testimonials: t.testimonials.length,
    logos: t.logos.count >= 4 ? t.logos.count : 0,
    ratings: t.ratings.length,
    platforms: t.reviewPlatforms.length,
    stats: t.stats.length,
    caseStudies: t.caseStudies ? 1 : 0,
  };
  const types = Object.values(kinds).filter((n) => n > 0).length;
  const firstY = Math.min(
    ...t.testimonials.map((x) => x.b.y),
    t.logos.count >= 4 && t.logos.y != null ? t.logos.y : Infinity,
    Infinity,
  );
  return { kinds, types, total: Object.values(kinds).reduce((a, b) => a + b, 0), firstY };
}

/** Goal-matching CTAs (or conversion forms) below the first screen, de-duplicated by position. */
function repeatedCtas(f: PageFacts) {
  const vh = f.doc.viewportH;
  const primaryText = f.primaryCta?.text.toLowerCase();
  const ys: number[] = [];
  const candidates: { y: number; box: Box }[] = [
    ...f.ctas.filter((c) => c.buttonLike && !c.inNav && !c.inFooter && c.b.y > vh && (c.goalMatch || c.text.toLowerCase() === primaryText)).map((c) => ({ y: c.b.y, box: c.b })),
    ...conversionForms(f).filter((x) => x.b.y > vh).map((x) => ({ y: x.b.y, box: x.b })),
  ].sort((a, b) => a.y - b.y);
  const kept: { y: number; box: Box }[] = [];
  for (const c of candidates) if (!ys.some((y) => Math.abs(y - c.y) < 500)) { ys.push(c.y); kept.push(c); }
  return kept;
}

export function measure(desktop: ProfileCapture, mobile: ProfileCapture | null, opts: { goalLabel: string; goalPattern: string; cls: number | null; lighthouse: { performance: number | null; accessibility: number | null; lcpMs: number | null } | null }): Record<string, Measured> {
  const f = desktop.facts;
  const vh = f.doc.viewportH;
  const out: Record<string, Measured> = {};

  // ---- clarity.headline_present
  {
    const h = f.hero.headline;
    if (!h) out['clarity.headline_present'] = { rating: 0, evidence: 'No headline-sized text was found in the first screen.' };
    else {
      let r = h.fs >= 36 ? 4 : h.fs >= 28 ? 3 : h.fs >= 22 ? 2 : 1;
      if (h.b.y > vh * 0.9) r = Math.min(r, 1);
      if (f.design.bodyFont && h.fs < f.design.bodyFont * 1.5) r = Math.min(r, 2);
      out['clarity.headline_present'] = {
        rating: r,
        evidence: h.b.y > vh * 0.9
          ? `The most prominent text, ${q(h.text)}, starts below the first screen.`
          : `The dominant text in the first screen is ${q(h.text)} at ${px(h.fs)}${r <= 2 ? ', which is small for a headline' : ''}.`,
        location: { profile: 'desktop', box: h.b },
      };
    }
  }

  // ---- cta.primary_above_fold
  {
    const p = f.primaryCta;
    const form = conversionForms(f).find((x) => x.aboveFold);
    const anyGoal = f.ctas.some((c) => c.buttonLike && !c.inFooter && c.goalMatch) || conversionForms(f).length > 0;
    let m: Measured;
    if (p && !p.inNav && p.goalMatch) m = { rating: 4, evidence: `${q(p.text, 60)} is visible as a button in the first screen.`, location: { profile: 'desktop', box: p.b } };
    else if (form) m = { rating: form.submitText && new RegExp(opts.goalPattern, 'i').test(form.submitText) ? 4 : 3, evidence: `A ${form.fields}-field form${form.submitText ? ` with a ${q(form.submitText, 40)} button` : ''} is visible in the first screen.`, location: { profile: 'desktop', box: form.b } };
    else if (p && !p.inNav) m = { rating: 3, evidence: `The most prominent button in the first screen is ${q(p.text, 60)}, which does not obviously match the goal (${opts.goalLabel.toLowerCase()}).`, location: { profile: 'desktop', box: p.b } };
    else if (p && p.inNav) m = { rating: 2, evidence: `The only action in the first screen is ${q(p.text, 60)} in the navigation bar; the hero itself has no call to action.`, location: { profile: 'desktop', box: p.b } };
    else if (anyGoal) m = { rating: 1, evidence: 'No call to action is visible in the first screen; visitors must scroll to find one.' };
    else m = { rating: 0, evidence: 'No call-to-action button or conversion form was found anywhere on the page.' };
    out['cta.primary_above_fold'] = m;
  }

  // ---- cta.repetition
  {
    const screens = f.doc.height / vh;
    const reps = repeatedCtas(f);
    if (screens < 2.5) out['cta.repetition'] = { rating: null, evidence: 'The page is short enough that one call to action is sufficient.' };
    else if (!f.primaryCta && !f.ctas.some((c) => c.buttonLike && c.goalMatch)) out['cta.repetition'] = { rating: 0, evidence: 'There is no call to action to repeat.' };
    else {
      const r = reps.length >= 2 ? 4 : reps.length === 1 ? (screens > 6 ? 2 : 3) : f.nav.hasCta ? 2 : 1;
      out['cta.repetition'] = {
        rating: r,
        evidence: reps.length
          ? `The main action appears ${reps.length} more time${reps.length > 1 ? 's' : ''} further down this ${Math.round(screens)}-screen page.`
          : `On this ${Math.round(screens)}-screen page the main action is not repeated below the first screen${f.nav.hasCta ? ' (only the navigation button remains)' : ''}.`,
        location: reps[0] ? { profile: 'desktop', box: reps[0].box } : undefined,
      };
    }
  }

  // ---- trust.legitimacy
  {
    const c = f.trust.contact;
    const items: [string, boolean][] = [['contact details', c.email || c.phone || c.contactLink], ['privacy policy', f.trust.legal.privacy], ['terms', f.trust.legal.terms], ['about/company page', c.about]];
    const found = items.filter((i) => i[1]).map((i) => i[0]);
    const missing = items.filter((i) => !i[1]).map((i) => i[0]);
    out['trust.legitimacy'] = { rating: found.length, evidence: missing.length ? `Found: ${found.join(', ') || 'none'}. Missing: ${missing.join(', ')}.` : 'Contact details, about page, privacy policy and terms are all linked.' };
  }

  // ---- design.readability
  {
    let r = 4;
    const notes: string[] = [];
    const bf = f.design.bodyFont;
    if (bf != null) {
      if (bf < 13) { r -= 2; notes.push(`body text is ${px(bf)}`); } else if (bf < 15) { r -= 1; notes.push(`body text is ${px(bf)} (16px is recommended)`); }
    }
    if (f.design.lineLength && f.design.lineLength > 100) { r -= 1; notes.push(`lines run to about ${f.design.lineLength} characters (50–90 reads best)`); }
    // Repeated labels (e.g. "Succeeded" in a product mock-up) count once; clear
    // failures (<3:1) weigh more than near misses just under 4.5:1.
    const unique = new Map<string, number>();
    for (const c of f.design.contrastIssues) unique.set(c.text.toLowerCase(), Math.min(unique.get(c.text.toLowerCase()) ?? 99, c.ratio));
    const uniqueCount = unique.size;
    const severe = [...unique.values()].filter((v) => v < 3).length;
    const share = f.design.contrastChecked ? uniqueCount / f.design.contrastChecked : 0;
    const contrastNote = `${uniqueCount} distinct text element${uniqueCount === 1 ? '' : 's'} fail WCAG contrast${severe ? ` (${severe} below 3:1)` : ''}`;
    if (severe >= 5 || uniqueCount >= 15 || share > 0.15) { r -= 2; notes.push(contrastNote); }
    else if (severe >= 2 || uniqueCount >= 6 || share > 0.06) { r -= 1; notes.push(contrastNote); }
    if (f.design.smallText > 12) { r -= 1; notes.push(`${f.design.smallText} passages of text are smaller than 12px`); }
    const worst = [...f.design.contrastIssues].sort((a, b) => a.ratio - b.ratio)[0];
    out['design.readability'] = {
      rating: clamp(r),
      evidence: notes.length ? `${notes.join('; ').replace(/^./, (m) => m.toUpperCase())}.${worst ? ` Lowest contrast: ${q(worst.text, 50)} at ${worst.ratio}:1.` : ''}` : `Body text is ${bf ? px(bf) : 'a comfortable size'} with good contrast and comfortable line lengths.`,
      location: worst ? { profile: 'desktop', box: worst.b } : undefined,
    };
  }

  // ---- design.stability
  {
    const cls = opts.cls ?? desktop.metrics.cls;
    const entry = desktop.layers.filter((l) => l.onTop && (l.kind === 'popup-offer' || l.kind === 'modal') && l.cover >= 0.3);
    let r = cls == null ? 4 : cls <= 0.1 ? 4 : cls <= 0.25 ? 2 : 0;
    const notes: string[] = [];
    if (cls != null) notes.push(cls <= 0.1 ? `Layout shift is low (CLS ${cls.toFixed(2)})` : `Content shifts while loading (CLS ${cls.toFixed(2)}; 0.1 or less is good)`);
    if (entry.length) { r -= 1; notes.push(`a pop-up covered ${Math.round(entry[0].cover * 100)}% of the screen on arrival`); }
    out['design.stability'] = { rating: clamp(r), evidence: notes.length ? `${notes.join('; ')}.` : 'No layout shift or entry pop-ups were detected.' };
  }

  // ---- persuasion.readability
  {
    const c = f.content;
    if (c.words < 120 || c.flesch == null) out['persuasion.readability'] = { rating: null, evidence: 'Too little body copy to measure readability reliably.' };
    else {
      // Marketing copy is short and punchy, so thresholds sit a little below the
      // classic "plain English" band (60–70) used for continuous prose.
      let r = c.flesch >= 55 ? 4 : c.flesch >= 45 ? 3 : c.flesch >= 35 ? 2 : c.flesch >= 25 ? 1 : 0;
      const notes = [`Reading ease ${c.flesch}/100 (${c.flesch >= 70 ? 'easy' : c.flesch >= 60 ? 'plain English' : c.flesch >= 50 ? 'fairly difficult' : c.flesch >= 30 ? 'difficult' : 'very difficult'})`];
      if (c.avgSentence && c.avgSentence > 25) { r -= 1; notes.push(`sentences average ${c.avgSentence} words`); }
      if (c.we >= 10 && c.we > c.you * 2) { r -= 1; notes.push(`the copy says “we/our” ${c.we} times but “you/your” only ${c.you} times`); }
      out['persuasion.readability'] = { rating: clamp(r), evidence: `${notes.join('; ')}.` };
    }
  }

  // ---- tech.seo
  {
    let pts = 0;
    const notes: string[] = [];
    const tl = f.title.trim().length;
    if (tl >= 10 && tl <= 70) pts += 1; else if (tl) { pts += 0.5; notes.push(`title is ${tl} characters`); } else notes.push('no page title');
    const dl = f.meta.description.length;
    if (dl >= 50 && dl <= 170) pts += 1; else if (dl) { pts += 0.5; notes.push(`meta description is ${dl} characters (aim for 50–160)`); } else notes.push('no meta description');
    if (f.h1Count === 1) pts += 0.75; else notes.push(f.h1Count ? `${f.h1Count} H1 headings` : 'no H1 heading');
    if (f.lang) pts += 0.5; else notes.push('no language attribute');
    if (f.meta.ogTitle || f.meta.ogImage) pts += 0.5; else notes.push('no social sharing (Open Graph) tags');
    if (f.meta.canonical) pts += 0.25;
    if (/noindex/i.test(f.meta.robots)) { pts = Math.min(pts, 1); notes.unshift('the page is set to noindex, so it will not appear in search results'); }
    out['tech.seo'] = { rating: clamp(Math.round(pts)), evidence: notes.length ? `Issues: ${notes.join('; ')}.` : 'Title, meta description, single H1, language and sharing tags are all in place.' };
  }

  // ---- Lighthouse-based
  const lh = opts.lighthouse;
  if (lh?.performance != null) {
    const s = lh.performance;
    out['tech.performance'] = { rating: s >= 90 ? 4 : s >= 75 ? 3 : s >= 50 ? 2 : s >= 30 ? 1 : 0, evidence: `Lighthouse mobile performance score: ${s}/100.` };
  } else out['tech.performance'] = { rating: null, evidence: 'The performance audit could not be completed for this page.' };
  if (lh?.lcpMs != null) {
    const s = lh.lcpMs / 1000;
    out['tech.lcp'] = { rating: s <= 2.5 ? 4 : s <= 3.5 ? 3 : s <= 4 ? 2 : s <= 6 ? 1 : 0, evidence: `Largest Contentful Paint on a simulated mid-range phone: ${s.toFixed(1)}s (2.5s or less is good).` };
  } else out['tech.lcp'] = { rating: null, evidence: 'Load timing could not be measured for this page.' };
  if (lh?.accessibility != null) {
    const s = lh.accessibility;
    out['tech.accessibility'] = { rating: s >= 95 ? 4 : s >= 85 ? 3 : s >= 70 ? 2 : s >= 50 ? 1 : 0, evidence: `Lighthouse accessibility score: ${s}/100.` };
  } else {
    const a = f.a11y;
    const problems = a.buttonsNoName + a.linksNoText + a.inputsNoLabel + f.media.imagesNoAlt;
    out['tech.accessibility'] = { rating: problems === 0 ? 4 : problems <= 3 ? 3 : problems <= 8 ? 2 : problems <= 20 ? 1 : 0, evidence: problems ? `${problems} elements lack accessible names or alt text.` : 'Buttons, links, form fields and images have accessible names.' };
  }

  // ---- Mobile (measured on the phone render)
  if (!mobile) {
    for (const id of ['mobile.viewport', 'mobile.cta', 'mobile.headline', 'mobile.tap_targets', 'mobile.text']) out[id] = { rating: null, evidence: 'The mobile version could not be captured.' };
  } else {
    const m = mobile.facts;
    const mvh = m.doc.viewportH;
    const vp = m.meta.viewport.toLowerCase();
    let r: number;
    let ev: string;
    if (!/width\s*=\s*device-width/.test(vp) || m.doc.viewportW > 500) { r = 0; ev = 'The page has no mobile viewport setting, so phones show a shrunken desktop layout.'; }
    else if (m.doc.overflowX && m.doc.width <= m.doc.viewportW * 1.1) { r = 2; ev = `Content is slightly wider than the phone screen (${m.doc.width}px on ${m.doc.viewportW}px), so the page wobbles sideways.`; }
    else if (m.doc.overflowX) { r = 1; ev = `Content is ${m.doc.width}px wide on a ${m.doc.viewportW}px phone screen, so visitors have to scroll sideways.`; }
    else if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp)) { r = 3; ev = 'The layout fits the phone screen, but zooming is disabled, which hurts accessibility.'; }
    else { r = 4; ev = 'The layout adapts to the phone screen without sideways scrolling.'; }
    out['mobile.viewport'] = { rating: r, evidence: ev };

    const p = m.primaryCta;
    const mForm = conversionForms(m).find((x) => x.aboveFold);
    const firstGoal = m.ctas.filter((c) => c.buttonLike && !c.inNav && !c.inFooter && (c.goalMatch || (f.primaryCta && c.text.toLowerCase() === f.primaryCta.text.toLowerCase()))).sort((a, b) => a.b.y - b.b.y)[0];
    if (p && !p.inNav) out['mobile.cta'] = { rating: 4, evidence: `${q(p.text, 50)} is visible on the first phone screen.`, location: { profile: 'mobile', box: p.b } };
    else if (mForm) out['mobile.cta'] = { rating: 4, evidence: 'A conversion form is visible on the first phone screen.', location: { profile: 'mobile', box: mForm.b } };
    else if (p?.inNav) out['mobile.cta'] = { rating: 2, evidence: `On a phone, the only visible action on the first screen is ${q(p.text, 50)} in the header.`, location: { profile: 'mobile', box: p.b } };
    else if (firstGoal && firstGoal.b.y < mvh * 2) out['mobile.cta'] = { rating: 2, evidence: `On a phone, the first call to action (${q(firstGoal.text, 50)}) only appears after scrolling about ${Math.round(firstGoal.b.y / mvh * 10) / 10} screens.`, location: { profile: 'mobile', box: firstGoal.b } };
    else if (firstGoal) out['mobile.cta'] = { rating: 1, evidence: `On a phone, the first call to action appears ${Math.round(firstGoal.b.y / mvh)} screens down the page.`, location: { profile: 'mobile', box: firstGoal.b } };
    else out['mobile.cta'] = { rating: 0, evidence: 'No call to action was found on the mobile page.' };

    const h = m.hero.headline;
    if (!h) out['mobile.headline'] = { rating: 0, evidence: 'No headline was found on the first phone screen.' };
    else {
      const rr = h.b.y < mvh * 0.75 && h.fs >= 24 ? 4 : h.b.y < mvh && h.fs >= 20 ? 3 : h.b.y < mvh ? 2 : 1;
      out['mobile.headline'] = { rating: rr, evidence: rr >= 3 ? `The headline ${q(h.text, 60)} is visible on the first phone screen at ${px(h.fs)}.` : h.b.y >= mvh ? `On a phone, the headline is pushed below the first screen (it starts ${px(h.b.y)} down).` : `The headline is on the first phone screen but small (${px(h.fs)}).`, location: { profile: 'mobile', box: h.b } };
    }

    const btns = m.ctas.filter((c: Cta) => c.buttonLike && !c.inFooter && c.b.y < mvh * 4 && c.b.w >= 24);
    if (!btns.length) out['mobile.tap_targets'] = { rating: null, evidence: 'No buttons were found near the top of the mobile page.' };
    else {
      const ok = btns.filter((c) => c.b.h >= 42).length / btns.length;
      let rr = ok >= 0.9 ? 4 : ok >= 0.75 ? 3 : ok >= 0.5 ? 2 : ok >= 0.25 ? 1 : 0;
      const small = btns.filter((c) => c.b.h < 42).sort((a, b) => a.b.h - b.b.h);
      if (p && p.b.h < 42) rr = Math.min(rr, 2);
      out['mobile.tap_targets'] = { rating: rr, evidence: small.length ? `${small.length} of ${btns.length} buttons near the top are shorter than 44px (smallest: ${q(small[0].text, 30)} at ${px(small[0].b.h)}).` : `All ${btns.length} buttons near the top are at least 44px tall.`, location: small[0] ? { profile: 'mobile', box: small[0].b } : undefined };
    }

    const bf = m.design.bodyFont;
    if (bf == null) out['mobile.text'] = { rating: null, evidence: 'Not enough body text to measure on mobile.' };
    else {
      let rr = bf >= 16 ? 4 : bf >= 15 ? 3 : bf >= 14 ? 2 : bf >= 12 ? 1 : 0;
      if (m.design.smallText > 8) rr -= 1;
      out['mobile.text'] = { rating: clamp(rr), evidence: `Body text on mobile is ${px(bf)}${bf < 16 ? ' (16px avoids zooming)' : ''}${m.design.smallText > 8 ? `, and ${m.design.smallText} passages are under 12px` : ''}.` };
    }
  }
  return out;
}

/** Measured limits on AI ratings for hybrid criteria: the AI may judge quality, but not contradict the facts. */
export function bounds(desktop: ProfileCapture, mobile: ProfileCapture | null): Record<string, Bound[]> {
  const f = desktop.facts;
  const vh = f.doc.viewportH;
  const b: Record<string, Bound[]> = {};
  const add = (id: string, bound: Bound) => { (b[id] ||= []).push(bound); };
  const p = f.primaryCta;

  if (!p && !conversionForms(f).some((x) => x.aboveFold)) add('cta.prominence', { max: 1, reason: 'no button is visible in the first screen' });
  else if (p && p.shapeContrast != null && p.shapeContrast < 1.4 && (p.textContrast ?? 21) < 3) add('cta.prominence', { max: 2, reason: `the main button has low contrast (${p.shapeContrast}:1 against its background)` });

  const heroTexts = new Set(f.ctas.filter((c) => c.aboveFold && c.buttonLike && !c.inNav && !c.inFooter).map((c) => c.text.toLowerCase()));
  if (heroTexts.size >= 5) add('cta.focus', { max: 1, reason: `${heroTexts.size} different buttons compete in the first screen` });
  else if (heroTexts.size === 4) add('cta.focus', { max: 2, reason: '4 different buttons compete in the first screen' });
  if (f.nav.links > 12) add('cta.focus', { max: 3, reason: `the navigation offers ${f.nav.links} links` });

  const forms = conversionForms(f).sort((a, b2) => b2.fields - a.fields);
  const main = forms[0];
  if (main && main.fields > 10) add('cta.friction', { max: 1, reason: `the form asks for ${main.fields} fields` });
  else if (main && (main.fields > 7 || main.required > 6)) add('cta.friction', { max: 2, reason: `the form asks for ${main.fields} fields` });

  const proof = proofSignals(f);
  if (proof.types === 0) {
    add('trust.social_proof', { max: 1, reason: 'no testimonials, logos, ratings or usage numbers were found in the page' });
    add('trust.proof_quality', { max: 1, reason: 'no proof was found in the page' });
    add('trust.proof_placement', { max: 0, reason: 'no proof was found in the page' });
  } else {
    if (proof.types >= 3 && proof.total >= 6) add('trust.social_proof', { min: 2, reason: 'several kinds of proof were found in the page' });
    if (proof.firstY < vh * 2) add('trust.proof_placement', { min: 2, reason: 'proof appears within the first two screens' });
  }
  if (!f.trust.guarantees.length && !f.pricing.present) add('trust.risk_reversal', { max: 2, reason: 'no guarantee, free trial, cancellation terms or pricing were found' });

  const screens = f.doc.height / vh;
  if (f.content.longParagraphs >= 4) add('design.scannability', { max: 2, reason: `${f.content.longParagraphs} paragraphs are longer than 80 words` });
  if (screens > 3 && f.headings.filter((h) => h.level >= 2).length < 2) add('design.scannability', { max: 2, reason: 'the page has almost no section headings' });

  if (f.quality.placeholders.length) add('design.polish', { max: 1, reason: `placeholder text is visible (${f.quality.placeholders[0].slice(0, 40)})` });
  if (f.quality.brokenImages >= 3) add('design.polish', { max: 1, reason: `${f.quality.brokenImages} images are broken` });
  else if (f.quality.brokenImages >= 1) add('design.polish', { max: 2, reason: `${f.quality.brokenImages} image${f.quality.brokenImages > 1 ? 's are' : ' is'} broken` });

  if (f.faq.present) add('persuasion.objections', { min: 2, reason: 'the page has an FAQ section' });

  if (mobile) {
    const m = mobile.facts;
    if (!/width\s*=\s*device-width/i.test(m.meta.viewport) || m.doc.viewportW > 500) add('mobile.layout', { max: 1, reason: 'the page is not set up for mobile screens' });
    else if (m.doc.overflowX && m.doc.width > m.doc.viewportW * 1.1) add('mobile.layout', { max: 1, reason: 'content overflows the phone screen sideways' });
    else if (m.doc.overflowX) add('mobile.layout', { max: 3, reason: 'content is slightly wider than the phone screen' });
  }
  return b;
}

/** Compact, model-friendly summary of the measured facts. */
export function factsForPrompt(desktop: ProfileCapture, mobile: ProfileCapture | null) {
  const f = desktop.facts;
  const vh = f.doc.viewportH;
  const cta = (c: Cta) => `${q(c.text, 50)}${c.buttonLike ? ' [button]' : ' [link]'}${c.inNav ? ' [nav]' : ''} at y=${c.b.y}`;
  const above = f.ctas.filter((c) => c.aboveFold && !c.inFooter).slice(0, 8);
  const proof = proofSignals(f);
  const lines = [
    `URL: ${desktop.finalUrl}`,
    `Title: ${q(f.title, 120)} · Language: ${f.lang || 'unknown'}`,
    `Desktop page height: ${f.doc.height}px (${(f.doc.height / vh).toFixed(1)} screens of ${vh}px)`,
    `Largest text in first screen: ${f.hero.headline ? `${q(f.hero.headline.text, 160)} (${f.hero.headline.fs}px, <${f.hero.headline.tag}>)` : 'none'}`,
    `Text under it: ${f.hero.subheadline ? `${q(f.hero.subheadline.text, 220)}${f.hero.headline?.split ? ' (styled as supporting text inside the same heading element)' : ''}` : 'none'}`,
    `First-screen actions: ${above.length ? above.map(cta).join('; ') : 'none'}`,
    `Most prominent first-screen button: ${f.primaryCta ? `${q(f.primaryCta.text, 50)} (button/background contrast ${f.primaryCta.shapeContrast ?? 'n/a'}:1, text contrast ${f.primaryCta.textContrast ?? 'n/a'}:1, ${f.primaryCta.b.w}×${f.primaryCta.b.h}px)` : 'none'}`,
    `Button-style CTAs on page: ${f.buttonCtaCount}; navigation links: ${f.nav.links}`,
    `Forms: ${f.forms.filter((x) => !x.isSearch).map((x) => `${x.fields} fields (${x.required} required)${x.submitText ? ` submit ${q(x.submitText, 30)}` : ''} at y=${x.b.y}${x.inFooter ? ' [footer]' : ''}`).join('; ') || 'none'}`,
    `Testimonials found: ${f.trust.testimonials.length}${f.trust.testimonials.slice(0, 3).map((t) => ` — ${q(t.text, 80)}${t.author ? ` by ${t.author}` : ' (no name)'}${t.hasPhoto ? ' [photo]' : ''} at y=${t.b.y}`).join('')}`,
    `Logo row: ${f.trust.logos.count ? `${f.trust.logos.count} logos at y=${f.trust.logos.y}${f.trust.logos.heading ? ` under ${q(f.trust.logos.heading, 60)}` : ''}` : 'none detected'}`,
    `Ratings: ${f.trust.ratings.join(' | ') || 'none'}; review platforms: ${f.trust.reviewPlatforms.join(', ') || 'none'}; stats: ${f.trust.stats.join(' | ') || 'none'}; case studies link: ${f.trust.caseStudies ? 'yes' : 'no'}`,
    `Security/compliance badges: ${f.trust.badges.join(', ') || 'none'}; guarantees/risk reducers: ${f.trust.guarantees.join(', ') || 'none'}`,
    `Pricing shown: ${f.pricing.present ? f.pricing.samples.join(' | ') : 'no'}${f.pricing.link ? ' (pricing link present)' : ''}; FAQ: ${f.faq.present ? `yes${f.faq.items ? ` (${f.faq.items} questions)` : ''}` : 'no'}`,
    `Copy: ${f.content.words} words, reading ease ${f.content.flesch ?? 'n/a'}, ${f.content.longParagraphs} paragraphs over 80 words, you/your ×${f.content.you} vs we/our ×${f.content.we}`,
    `Section headings: ${f.headings.filter((h) => h.level <= 3).slice(0, 14).map((h) => q(h.text, 60)).join(' · ') || 'none'}`,
    `Quality: ${f.quality.brokenImages} broken images, placeholders: ${f.quality.placeholders.join(' | ') || 'none'}; body text ${f.design.bodyFont ?? '?'}px; ${f.design.contrastIssues.length} low-contrast text elements`,
    `Pop-ups on arrival: ${desktop.layers.filter((l) => l.onTop && l.kind !== 'header').map((l) => `${l.kind} covering ${Math.round(l.cover * 100)}%`).join(', ') || 'none'}`,
  ];
  if (mobile) {
    const m = mobile.facts;
    lines.push(
      `Mobile (${m.doc.viewportW}×${m.doc.viewportH}): headline ${m.hero.headline ? `${q(m.hero.headline.text, 80)} at y=${m.hero.headline.b.y}, ${m.hero.headline.fs}px` : 'none'}; first-screen button ${m.primaryCta ? `${q(m.primaryCta.text, 40)} at y=${m.primaryCta.b.y}${m.primaryCta.inNav ? ' [header]' : ''}` : 'none'}; sideways overflow: ${m.doc.overflowX ? 'yes' : 'no'}; body text ${m.design.bodyFont ?? '?'}px`,
    );
  }
  return lines.join('\n');
}
