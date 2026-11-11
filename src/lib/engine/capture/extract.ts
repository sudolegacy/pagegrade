/**
 * In-page structural extraction. Produces measured facts with page-coordinate
 * bounding boxes so findings can point at real elements. Plain JS string; see
 * inpage.ts for why.
 */
export const EXTRACT = String.raw`({ goalPattern }) => {
  const vw = innerWidth, vh = innerHeight;
  const sx = scrollX, sy = scrollY;
  const goalRe = goalPattern ? new RegExp(goalPattern, 'i') : null;
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const box = (r) => ({ x: Math.round(r.left + sx), y: Math.round(r.top + sy), w: Math.round(r.width), h: Math.round(r.height) });
  const styleCache = new Map();
  const cs = (el) => { let s = styleCache.get(el); if (!s) { s = getComputedStyle(el); styleCache.set(el, s); } return s; };
  const visible = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const parseColor = (c) => {
    const m = (c || '').match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const bgOf = (el) => {
    let node = el;
    while (node && node.nodeType === 1) {
      const s = cs(node);
      if (s.backgroundImage && s.backgroundImage !== 'none') return { unknown: true };
      const c = parseColor(s.backgroundColor);
      if (c && c.a >= 0.5) return c;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const inAncestor = (el, sel) => !!el.closest(sel);
  const ownText = (el) => { let t = ''; for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue; return clean(t); };
  // Text a visitor actually sees: drops visually-hidden screen-reader copies and
  // collapses phrases repeated twice (animated duplicates of a heading).
  const srOnly = (n) => {
    const s = cs(n);
    if (s.position !== 'absolute' && s.position !== 'fixed') return false;
    const r = n.getBoundingClientRect();
    return r.width <= 2 || r.height <= 2 || /rect\(\s*0(px)?[\s,]+0(px)?[\s,]+0(px)?[\s,]+0(px)?\s*\)/.test(s.clip || '') || /inset\(\s*50%/.test(s.clipPath || '');
  };
  const undouble = (t) => {
    const w = t.split(' ');
    if (w.length >= 4 && w.length % 2 === 0) { const h = w.length / 2; const a = w.slice(0, h).join(' '); if (a.toLowerCase() === w.slice(h).join(' ').toLowerCase()) return a; }
    return t;
  };
  const seenText = (el) => {
    let t = el.innerText || '';
    if (el.firstElementChild) {
      const kids = el.getElementsByTagName('*');
      const removed = [];
      for (let i = 0; i < kids.length && i < 80; i++) {
        const k = kids[i];
        if (removed.some((r) => r.contains(k))) continue;
        if (cs(k).display === 'none' || !srOnly(k)) continue;
        removed.push(k);
        const kt = k.innerText || '';
        if (!kt.trim()) continue;
        const j = t.lastIndexOf(kt);
        if (j >= 0) t = t.slice(0, j) + ' ' + t.slice(j + kt.length);
      }
    }
    return undouble(clean(t));
  };
  // Product screenshots are often built from live HTML (Linear, Basecamp). Their
  // text and buttons are not the page's own copy or calls to action, so they are
  // treated as pictures: regions marked inert, and regions where several labelled
  // controls are taken out of the keyboard order without being hidden (and which
  // hold no heading, form or ordinary link, unlike carousels and tab sets).
  const mockRoots = new Set();
  {
    const deadSel = 'a[href][tabindex="-1"], button[tabindex="-1"], [role=button][tabindex="-1"]';
    const dead = [];
    for (const d of document.querySelectorAll(deadSel)) {
      if (dead.length >= 300) break;
      const role = d.getAttribute('role');
      if (role && role !== 'button' && role !== 'link') continue; // roving tabindex (tabs, menus, radios)
      if (d.closest('[aria-hidden="true"]') || !visible(d)) continue;
      if (!clean(d.innerText) && !d.getAttribute('aria-label')) continue;
      dead.push(d);
    }
    const deadIn = new Map();
    const countDead = (n) => { let c = deadIn.get(n); if (c === undefined) { c = n.querySelectorAll(deadSel).length; deadIn.set(n, c); } return c; };
    const checked = new Set();
    for (const d of dead) {
      let n = d.parentElement;
      for (let i = 0; n && n !== document.body && n !== document.documentElement && i < 14; i++, n = n.parentElement) {
        if (n.tagName === 'MAIN') break;
        const c = countDead(n);
        if (c < 3) continue;
        const r = n.getBoundingClientRect();
        if (r.width < 300 || r.height < 200) continue;
        if (!checked.has(n)) {
          checked.add(n);
          const controls = n.querySelectorAll('a[href], button, [role=button]').length;
          const liveLink = Array.prototype.some.call(n.querySelectorAll('a[href]:not([tabindex="-1"])'), (a) => clean(a.innerText) && visible(a));
          if (c >= controls * 0.3 && !liveLink && !n.querySelector('h1, form, input:not([type=hidden]), select, textarea')) mockRoots.add(n);
        }
        break;
      }
    }
  }
  const inMock = (el) => {
    if (el.closest('[inert]')) return true;
    if (!mockRoots.size) return false;
    let n = el;
    for (let i = 0; n && i < 40; i++) { if (mockRoots.has(n)) return true; n = n.parentElement; }
    return false;
  };

  // ---------- Meta ----------
  const meta = (name) => { const m = document.querySelector('meta[name="' + name + '"], meta[property="' + name + '"]'); return m ? clean(m.getAttribute('content')) : ''; };
  const jsonLdTypes = [];
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { const j = JSON.parse(s.textContent || ''); const items = Array.isArray(j) ? j : (j['@graph'] || [j]); for (const it of items) { const t = it && it['@type']; if (t) jsonLdTypes.push(...[].concat(t)); } } catch (e) {}
  }
  const docH = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const docW = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);

  // ---------- Visible text blocks (evidence index) ----------
  const blockSel = 'h1,h2,h3,h4,h5,h6,p,li,a,button,label,blockquote,figcaption,td,th,dt,dd,span,strong,em,small,div,summary,cite';
  const blocks = [];
  for (const el of document.querySelectorAll(blockSel)) {
    if (blocks.length >= 900) break;
    const leaf = el.tagName === 'DIV' || el.tagName === 'SPAN';
    let t = leaf ? ownText(el) : clean(el.innerText);
    if (!t || t.length < 2 || t.length > 400) continue;
    if (!visible(el)) continue;
    if (!leaf && el.parentElement && el.parentElement.closest('p,li,h1,h2,h3,h4,h5,h6,blockquote,button,a') && el.tagName !== 'A' && el.tagName !== 'BUTTON') continue;
    if (!leaf && el.firstElementChild) { t = seenText(el); if (!t || t.length < 2) continue; }
    const r = el.getBoundingClientRect();
    const s = cs(el);
    blocks.push({ t: t.slice(0, 240), tag: el.tagName.toLowerCase(), b: box(r), fs: Math.round(parseFloat(s.fontSize)), fw: parseInt(s.fontWeight, 10) || 400, _el: el, _m: inMock(el), _ah: !!el.closest('[aria-hidden="true"]') });
  }
  blocks.sort((a, b) => a.b.y - b.b.y || a.b.x - b.b.x);

  // ---------- Headings ----------
  const headings = [];
  for (const h of document.querySelectorAll('h1,h2,h3')) {
    if (!visible(h)) continue;
    const t = seenText(h);
    if (!t) continue;
    const r = h.getBoundingClientRect();
    headings.push({ level: Number(h.tagName[1]), text: t.slice(0, 160), y: Math.round(r.top + sy), fs: Math.round(parseFloat(cs(h).fontSize)) });
    if (headings.length > 60) break;
  }
  const h1Count = Array.prototype.filter.call(document.querySelectorAll('h1'), visible).length;

  // ---------- Hero ----------
  const heroAll = blocks.filter((b) => b.b.y < vh * 0.95 && b.b.y + b.b.h > 0 && b.t.length >= 3 && b.t.length <= 180 && b.tag !== 'a' && b.tag !== 'button');
  const heroLive = heroAll.filter((b) => !b._m);
  const heroCandidates = heroLive.length ? heroLive : heroAll;
  let headline = null;
  for (const b of heroCandidates) {
    const score = b.fs * (b.fw >= 600 ? 1.15 : 1) * (b.tag === 'h1' ? 1.2 : 1);
    if (!headline || score > headline.score) headline = Object.assign({ score }, b);
  }
  let subheadline = null;
  // Many sites style headline + supporting copy inside one <h1> (e.g. a dark first
  // sentence followed by lighter text). Split it when the style changes after a
  // sentence ends, or after a line break with noticeably smaller text.
  const splitHeadline = (hb) => {
    const el = hb._el;
    if (!el || !el.childNodes || el.childNodes.length < 2) return null;
    const parts = [];
    for (const n of el.childNodes) {
      if (n.nodeType === 3) { const t = clean(n.nodeValue); if (t) parts.push({ n, t, s: cs(el), brk: false }); continue; }
      if (n.nodeType !== 1) continue;
      if (n.tagName === 'BR') { parts.push({ n, t: '', s: null, brk: true }); continue; }
      if (!visible(n)) continue;
      const t = clean(n.innerText);
      const ns = cs(n);
      parts.push({ n, t, s: ns, brk: /^(block|flex|grid|list-item|table)$/.test(ns.display) });
    }
    const sig = (st) => st ? st.color + '|' + Math.round(parseFloat(st.fontSize)) + '|' + st.fontWeight : '';
    const fsOf = (st) => st ? parseFloat(st.fontSize) || 0 : 0;
    for (let i = 1; i < parts.length; i++) {
      const head = clean(parts.slice(0, i).map((p) => p.t).join(' '));
      const rest = clean(parts.slice(i).map((p) => p.t).join(' '));
      if (head.length < 8 || rest.length < 20) continue;
      const prevS = parts.slice(0, i).reverse().find((p) => p.s);
      const next = parts.slice(i).find((p) => p.s && p.t);
      if (!prevS || !next) continue;
      const brk = parts[i].brk || parts[i - 1].brk;
      const smaller = fsOf(next.s) > 0 && fsOf(next.s) <= fsOf(prevS.s) * 0.85;
      const restyled = sig(prevS.s) !== sig(next.s);
      if (!((/[.!?]$/.test(head) && restyled) || (brk && smaller))) continue;
      const rangeBox = (from, to) => { try { const rg = document.createRange(); rg.setStartBefore(from); rg.setEndAfter(to); return box(rg.getBoundingClientRect()); } catch (e) { return hb.b; } };
      const firstNode = parts[0].n, lastHead = parts[i - 1].n, firstRest = parts[i].n, lastNode = parts[parts.length - 1].n;
      return {
        head: { t: head.slice(0, 240), b: rangeBox(firstNode, lastHead), fs: Math.round(fsOf(prevS.s)) || hb.fs },
        rest: { t: rest.slice(0, 240), b: rangeBox(firstRest, lastNode), fs: Math.round(fsOf(next.s)) || hb.fs },
      };
    }
    return null;
  };
  if (headline) {
    const split = splitHeadline(headline);
    if (split) {
      headline = Object.assign({}, headline, { t: split.head.t, b: split.head.b, fs: split.head.fs, split: true });
      subheadline = { t: split.rest.t, b: split.rest.b, fs: split.rest.fs };
    }
  }
  // Supporting text must sit just below the headline and share its column, so
  // captions inside a neighbouring product screenshot are not mistaken for it.
  if (headline && !subheadline) {
    const hx1 = headline.b.x, hx2 = headline.b.x + headline.b.w;
    for (const b of blocks) {
      if (b.b.y <= headline.b.y + headline.b.h - 4 || b.b.y > headline.b.y + headline.b.h + 260) continue;
      if (b.tag === 'a' || b.tag === 'button' || b.t.length < 25) continue;
      if (b.fs >= headline.fs || b.fs < 12 || b._m || b._ah) continue;
      const overlap = Math.min(hx2, b.b.x + b.b.w) - Math.max(hx1, b.b.x);
      if (overlap < Math.min(b.b.w, hx2 - hx1) * 0.5) continue;
      subheadline = b; break;
    }
  }
  const aboveFoldText = blocks.filter((b) => b.b.y < vh && !b._m).map((b) => b.t).join(' · ').slice(0, 1200);

  // ---------- CTAs ----------
  const ctas = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('a[href], button, [role=button], input[type=submit], input[type=button]')) {
    if (!visible(el)) continue;
    // Skip controls a visitor cannot use as a call to action: mock-up buttons,
    // inert or hidden regions, and icon-only or menu/accordion toggles.
    if (el.closest('[inert], [aria-hidden="true"]') || cs(el).pointerEvents === 'none' || inMock(el)) continue;
    const text = el.tagName === 'INPUT' ? clean(el.value) : seenText(el);
    if (!text || text.length > 60 || !/[\p{L}\p{N}]/u.test(text)) continue;
    const toggle = el.hasAttribute('aria-expanded') || /^(menu|listbox|tree|grid|true)$/.test(el.getAttribute('aria-haspopup') || '');
    if (toggle && !(goalRe && goalRe.test(text))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 16) continue;
    const s = cs(el);
    const bg = parseColor(s.backgroundColor);
    const parentBg = bgOf(el.parentElement || el);
    const hasBg = bg && bg.a > 0.5;
    const border = parseFloat(s.borderTopWidth) >= 1 && s.borderTopStyle !== 'none';
    const padY = parseFloat(s.paddingTop) + parseFloat(s.paddingBottom);
    const cls = ((typeof el.className === 'string' ? el.className : '') + ' ' + (el.getAttribute('data-testid') || '')).toLowerCase();
    const buttonLike = el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.getAttribute('role') === 'button' || (hasBg && !parentBg.unknown && contrast(bg, parentBg) > 1.3) || (hasBg && parentBg.unknown) || (border && padY >= 10) || /\b(btn|button|cta)\b/.test(cls);
    const inNav = inAncestor(el, 'nav, header');
    const inFooter = inAncestor(el, 'footer');
    const fg = parseColor(s.color) || { r: 0, g: 0, b: 0 };
    const surface = hasBg ? bg : parentBg;
    const textContrast = surface && !surface.unknown ? Math.round(contrast(fg, surface) * 10) / 10 : null;
    const shapeContrast = hasBg && !parentBg.unknown ? Math.round(contrast(bg, parentBg) * 10) / 10 : null;
    const key = text.toLowerCase() + '|' + Math.round(r.top + sy);
    if (seen.has(key)) continue;
    seen.add(key);
    const href = el.getAttribute('href') || '';
    const aboveFold = r.top + sy < vh && r.bottom + sy > 0;
    ctas.push({
      text, href: href.slice(0, 200), tag: el.tagName.toLowerCase(), buttonLike: !!buttonLike, inNav, inFooter, aboveFold,
      b: box(r), fs: Math.round(parseFloat(s.fontSize)), textContrast, shapeContrast,
      goalMatch: goalRe ? goalRe.test(text) : false,
      vague: /^(learn more|click here|read more|more|submit|go|continue|details|see more|discover|explore)$/i.test(text),
    });
    if (ctas.length > 250) break;
  }
  const prominence = (c) => (c.buttonLike ? 1 : 0.25) * Math.min(c.b.w * c.b.h, 60000) * (1 + Math.min(c.shapeContrast || 1, 8) / 4) * (c.goalMatch ? 1.4 : 1) * (c.inNav ? 0.6 : 1) * (c.vague ? 0.7 : 1);
  const heroCtas = ctas.filter((c) => c.aboveFold && !c.inFooter && c.buttonLike).sort((a, b) => prominence(b) - prominence(a));
  const primaryCta = heroCtas.find((c) => !c.inNav) || heroCtas[0] || null;
  const buttonCtas = ctas.filter((c) => c.buttonLike && !c.inFooter);

  // ---------- Navigation ----------
  const navEl = document.querySelector('header nav, nav, [role=navigation], header');
  const navLinks = navEl ? Array.prototype.filter.call(navEl.querySelectorAll('a[href]'), visible).length : 0;

  // ---------- Forms ----------
  const forms = [];
  for (const f of document.querySelectorAll('form')) {
    if (!visible(f)) continue;
    const fields = Array.prototype.filter.call(f.querySelectorAll('input, select, textarea'), (i) => visible(i) && !/^(hidden|submit|button|image|reset)$/i.test(i.type || ''));
    if (!fields.length) continue;
    const r = f.getBoundingClientRect();
    const labelled = fields.filter((i) => (i.id && document.querySelector('label[for="' + CSS.escape(i.id) + '"]')) || i.closest('label') || i.getAttribute('aria-label') || i.getAttribute('aria-labelledby')).length;
    const submit = f.querySelector('button[type=submit], input[type=submit], button:not([type])');
    const isSearch = !!(f.getAttribute('role') === 'search' || f.querySelector('input[type=search]') || /search/i.test(f.getAttribute('action') || '') || fields.some((i) => i.name === 'q' || i.name === 's'));
    const emailOnly = fields.length === 1 && (fields[0].type === 'email' || /email/i.test(fields[0].name || fields[0].placeholder || ''));
    forms.push({ b: box(r), fields: fields.length, required: fields.filter((i) => i.required || i.getAttribute('aria-required') === 'true').length, labelled, placeholderOnly: fields.filter((i) => i.placeholder).length - labelled, types: fields.map((i) => (i.type || i.tagName).toLowerCase()).slice(0, 12), submitText: submit ? clean(submit.innerText || submit.value).slice(0, 60) : '', isSearch, emailOnly, aboveFold: r.top + sy < vh, inFooter: inAncestor(f, 'footer') });
    if (forms.length > 12) break;
  }

  // ---------- Trust ----------
  const bodyText = clean(document.body ? document.body.innerText : '');
  const lower = bodyText.toLowerCase();
  const testimonials = [];
  const tSeen = new Set();
  for (const el of document.querySelectorAll('blockquote, figure, [class*="testimonial" i], [class*="review" i], [class*="quote" i], [itemtype*="Review"], [data-testid*="testimonial" i]')) {
    if (testimonials.length >= 12) break;
    if (!visible(el) || inAncestor(el, 'nav, header, footer')) continue;
    const t = clean(el.innerText);
    if (t.length < 40 || t.length > 900) continue;
    if (Array.from(tSeen).some((s) => s.includes(t) || t.includes(s))) continue;
    tSeen.add(t);
    const cite = el.querySelector('cite, [class*="author" i], [class*="name" i], figcaption, strong');
    const r = el.getBoundingClientRect();
    testimonials.push({ text: t.slice(0, 220), author: cite ? clean(cite.innerText).slice(0, 80) : '', hasPhoto: !!el.querySelector('img'), b: box(r) });
  }
  // Logo rows: >=4 wide-ish images/svgs of similar height aligned on one line.
  const logoCandidates = [];
  for (const el of document.querySelectorAll('img, svg')) {
    if (!visible(el) || inAncestor(el, 'nav, header, footer')) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 12 || r.height > 120 || r.width < 30 || r.width / r.height < 1.2) continue;
    logoCandidates.push({ y: Math.round(r.top + sy), h: r.height, x: r.left, el });
  }
  logoCandidates.sort((a, b) => a.y - b.y);
  let bestRow = [];
  for (let i = 0; i < logoCandidates.length; i++) {
    const row = logoCandidates.filter((c) => Math.abs(c.y - logoCandidates[i].y) <= 24 && Math.abs(c.h - logoCandidates[i].h) <= 40);
    if (row.length > bestRow.length) bestRow = row;
  }
  let logoHeading = '';
  if (bestRow.length >= 4) {
    const y = bestRow[0].y;
    const near = blocks.filter((b) => b.b.y < y && b.b.y > y - 220).map((b) => b.t).join(' ');
    logoHeading = near.slice(-160);
  }
  // Returns the match plus a little word-aligned context before it (e.g. "Rated 4.8/5").
  const findAll = (re, max, before = 0) => {
    const out = [];
    let m;
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    while ((m = g.exec(bodyText)) && out.length < max) {
      let pre = before ? bodyText.slice(Math.max(0, m.index - before), m.index) : '';
      if (pre && m.index - before > 0) pre = pre.replace(/^\S*\s/, '');
      pre = pre.split(/[.!?|•·]\s/).pop() || '';
      const text = clean(pre + m[0]).slice(0, 120);
      if (!out.includes(text)) out.push(text);
    }
    return out;
  };
  const ratings = findAll(/(★{3,}|⭐{3,}|\b[3-5](\.\d)?\s?(\/\s?5|out of 5|stars?)\b|\b\d[\d,]*\+?\s(5-star |verified )?reviews\b)/i, 6, 30);
  const reviewPlatforms = Array.from(new Set((lower.match(/\b(trustpilot|g2|capterra|product hunt|google reviews|yelp|feefo|reviews\.io|trustradius|getapp|clutch)\b/g) || [])));
  const stats = findAll(/\b\d[\d,.]{0,8}\s?(%|x|k\+?|m\+?|\+|million|billion)\s(?=[a-z])[^.!?\n]{0,32}?\b(customers|users|teams|companies|businesses|brands|downloads|reviews|countries|faster|saved|increase|growth|revenue|conversions?|roi|hours|members|orders|sold)\b/i, 6);
  const badges = Array.from(new Set((lower.match(/\b(soc ?2|iso ?27001|gdpr|hipaa|pci( dss)?|256-bit|ssl|secure checkout|encrypted|ccpa|ce certified|fsc|b corp)\b/g) || [])));
  const guarantees = Array.from(new Set((lower.match(/(money[- ]back|\bguarantee[d]?\b|free returns|free shipping|free delivery|cancel anytime|no credit card|no commitment|risk[- ]free|refund|free trial|warranty|no contract|\d+[- ]day returns)/g) || [])));
  const links = Array.prototype.map.call(document.querySelectorAll('a[href]'), (a) => ({ t: clean(a.innerText).toLowerCase(), h: (a.getAttribute('href') || '').toLowerCase() }));
  const has = (re) => links.some((l) => re.test(l.t) || re.test(l.h));
  const contact = { email: links.some((l) => l.h.startsWith('mailto:')), phone: links.some((l) => l.h.startsWith('tel:')) || /\+?\d[\d\s().-]{8,}\d/.test(bodyText.slice(-3000)), contactLink: has(/contact/), about: has(/about|company|team/) };
  const legal = { privacy: has(/privacy/), terms: has(/terms|conditions|legal/) };
  const caseStudies = has(/case[- ]stud|customer[- ]stor|success[- ]stor/);

  // ---------- Pricing / FAQ ----------
  // Prices are read from visible text blocks (not <option> lists), ignoring ranges like "£1k-£5k".
  const blockText = blocks.map((b) => b.t).join(' \n ');
  // (?=(...))\1 emulates an atomic group so backtracking cannot split "£15k" into "£1".
  const priceRe = /([$£€]\s?(?=(\d[\d,.]*))\2(?!\s?[kKmM]\b)|\b\d[\d,.]*\s?(usd|eur|gbp)\b)\s?(\/\s?(month|mo|year|yr|user|seat)|per (month|year|user|seat))?/gi;
  const priceMatches = [];
  for (const m of blockText.matchAll(priceRe)) { const t = clean(m[0]); if (!priceMatches.includes(t)) priceMatches.push(t); if (priceMatches.length >= 8) break; }
  const pricing = { present: priceMatches.length > 0, samples: priceMatches.slice(0, 5), link: has(/pricing|plans/) };
  const faqHeading = headings.some((h) => /faq|frequently asked|questions/i.test(h.text));
  const faq = { present: faqHeading || document.querySelectorAll('details summary').length >= 3, items: document.querySelectorAll('details summary').length };

  // ---------- Content ----------
  const mainRoot = document.querySelector('main') || document.body;
  const mainText = clean(Array.prototype.filter.call(mainRoot.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,td'), (el) => visible(el) && !inAncestor(el, 'nav, footer') && !inMock(el)).map((el) => el.innerText).join('. '));
  const words = mainText ? mainText.split(/\s+/).filter((w) => /[a-z]/i.test(w)) : [];
  const sentences = mainText.split(/[.!?]+\s/).filter((s) => s.split(/\s+/).length >= 3);
  const syll = (w) => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return m ? m.length : 1; };
  const syllables = words.slice(0, 4000).reduce((n, w) => n + syll(w), 0);
  const sampleWords = Math.min(words.length, 4000);
  const flesch = sampleWords > 50 && sentences.length ? Math.round(206.835 - 1.015 * (sampleWords / Math.max(1, sentences.length)) - 84.6 * (syllables / sampleWords)) : null;
  const paragraphs = Array.prototype.filter.call(mainRoot.querySelectorAll('p'), visible).map((p) => clean(p.innerText).split(/\s+/).length);
  const you = (mainText.match(/\b(you|your|you're|yours)\b/gi) || []).length;
  const we = (mainText.match(/\b(we|our|us|we're)\b/gi) || []).length;

  // ---------- Sections (page outline) ----------
  const sections = [];
  const sectionEls = Array.prototype.filter.call(document.querySelectorAll('main > *, body > *, section, [class*="section" i]'), (el) => {
    if (!visible(el)) return false;
    const r = el.getBoundingClientRect();
    return r.height >= 120 && r.width >= vw * 0.6;
  });
  const used = [];
  for (const el of sectionEls) {
    const r = el.getBoundingClientRect();
    const y = Math.round(r.top + sy), h = Math.round(r.height);
    if (h > docH * 0.8) continue;
    if (used.some((u) => Math.abs(u.y - y) < 40 && Math.abs(u.h - h) < 80)) continue;
    used.push({ y, h });
    const hd = el.querySelector('h1,h2,h3');
    sections.push({ y, h, heading: hd ? clean(hd.innerText).slice(0, 120) : '', text: clean(el.innerText).slice(0, 220), tag: el.tagName.toLowerCase() });
  }
  sections.sort((a, b) => a.y - b.y);
  const outline = [];
  for (const s of sections) { if (!outline.some((o) => s.y >= o.y && s.y + s.h <= o.y + o.h + 20 && o.h < docH * 0.6)) outline.push(s); }

  // ---------- Design / readability ----------
  const fontCount = new Map();
  const sizes = [];
  let smallText = 0;
  const contrastIssues = [];
  let checked = 0;
  for (const b of blocks) {
    if (b.tag === 'p' || b.tag === 'li') sizes.push(b.fs);
  }
  // Computed colours are unreliable for composited text (blend modes, gradient
  // fills, decorative aria-hidden copies layered over the real text), so those are
  // skipped rather than reported as false contrast failures.
  const composited = (el) => {
    let n = el, i = 0;
    while (n && n.nodeType === 1 && i < 8) {
      const s = cs(n);
      if (n.getAttribute('aria-hidden') === 'true') return true;
      if (s.mixBlendMode && s.mixBlendMode !== 'normal') return true;
      if ((s.webkitBackgroundClip || s.backgroundClip) === 'text') return true;
      const fill = parseColor(s.webkitTextFillColor);
      if (fill && fill.a < 0.05) return true;
      n = n.parentElement; i++;
    }
    return false;
  };
  const textEls = [];
  const layered = new Map();
  for (const el of document.querySelectorAll('p, li, h1, h2, h3, a, button, span, label')) {
    if (textEls.length > 700) break;
    const t = el.tagName === 'SPAN' ? ownText(el) : clean(el.innerText);
    if (!t || t.length < 3 || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= 0 || r.left >= vw) continue; // off-canvas carousel slides etc.
    if (inMock(el)) continue; // text inside a product screenshot is part of a picture
    const key = t.slice(0, 40) + '|' + Math.round((r.left + sx) / 6) + '|' + Math.round((r.top + sy) / 6);
    layered.set(key, (layered.get(key) || 0) + 1);
    textEls.push({ el, t, r, key });
  }
  for (const { el, t, r, key } of textEls) {
    if (checked > 500) break;
    const s = cs(el);
    const fam = (s.fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
    fontCount.set(fam, (fontCount.get(fam) || 0) + t.length);
    if (layered.get(key) > 1 || composited(el)) continue;
    checked++;
    const fs = parseFloat(s.fontSize);
    if (fs < 12 && t.length >= 25 && !inAncestor(el, 'footer, sup, sub')) smallText++;
    const fg = parseColor(s.color), bg = bgOf(el);
    if (fg && !bg.unknown && fg.a > 0.5) {
      const ratio = contrast(fg, bg);
      const large = fs >= 24 || (fs >= 18.6 && parseInt(s.fontWeight, 10) >= 700);
      // Below ~1.3:1 text would be practically invisible, so the real background is
      // something we cannot see from CSS (image, video, pseudo-element): skip it.
      if (ratio >= 1.3 && ratio < (large ? 3 : 4.5) && contrastIssues.length < 25) contrastIssues.push({ text: t.slice(0, 80), ratio: Math.round(ratio * 100) / 100, b: box(r) });
    }
  }
  sizes.sort((a, b) => a - b);
  const bodyFont = sizes.length ? sizes[Math.floor(sizes.length / 2)] : null;
  const pWidths = Array.prototype.filter.call(mainRoot.querySelectorAll('p'), visible).slice(0, 60).map((p) => { const r = p.getBoundingClientRect(); const fs = parseFloat(cs(p).fontSize) || 16; return r.width / (fs * 0.5); }).sort((a, b) => a - b);
  const lineLength = pWidths.length ? Math.round(pWidths[Math.floor(pWidths.length / 2)]) : null;

  // ---------- Media / a11y / quality ----------
  const imgs = Array.prototype.filter.call(document.images, (i) => visible(i) && i.getBoundingClientRect().width >= 40);
  const iframes = Array.prototype.map.call(document.querySelectorAll('iframe'), (f) => { try { return new URL(f.src, location.href).hostname; } catch (e) { return ''; } }).filter(Boolean).slice(0, 12);
  const carousels = document.querySelectorAll('.swiper, .slick-slider, .splide, .glide, .flickity-enabled, .owl-carousel, [class*="carousel" i], [aria-roledescription="carousel"]').length;
  const buttonsNoName = Array.prototype.filter.call(document.querySelectorAll('button, [role=button]'), (b) => visible(b) && !clean(b.innerText) && !b.getAttribute('aria-label') && !b.getAttribute('title') && !b.querySelector('img[alt]:not([alt=""]), [aria-label], title')).length;
  const linksNoText = Array.prototype.filter.call(document.querySelectorAll('a[href]'), (a) => visible(a) && !clean(a.innerText) && !a.getAttribute('aria-label') && !a.getAttribute('title') && !a.querySelector('img[alt]:not([alt=""]), [aria-label], title')).length;
  const inputsNoLabel = Array.prototype.filter.call(document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea'), (i) => visible(i) && !((i.id && document.querySelector('label[for="' + CSS.escape(i.id) + '"]')) || i.closest('label') || i.getAttribute('aria-label') || i.getAttribute('aria-labelledby') || i.getAttribute('title'))).length;
  let headingSkips = 0, prev = 0;
  for (const h of headings) { if (prev && h.level > prev + 1) headingSkips++; prev = h.level; }
  const brokenImages = Array.prototype.filter.call(document.images, (i) => i.complete && i.naturalWidth === 0 && (i.getAttribute('src') || '').length > 0 && visible(i)).length;
  const unloadedImages = Array.prototype.filter.call(document.images, (i) => !i.complete && visible(i) && i.getBoundingClientRect().width > 40).length;
  const placeholders = findAll(/\b(lorem ipsum|dolor sit amet|your (headline|text|title) here|placeholder text|coming soon|insert (text|image))\b/i, 4);
  const stillHidden = Array.prototype.filter.call(document.querySelectorAll('section, main > div, [class*="section" i]'), (el) => { const s = cs(el); const r = el.getBoundingClientRect(); return r.height > 100 && (parseFloat(s.opacity) < 0.05 || s.visibility === 'hidden') && clean(el.innerText).length > 20; }).length;

  return {
    url: location.href,
    title: document.title || '',
    lang: document.documentElement.lang || '',
    meta: { description: meta('description'), robots: meta('robots'), viewport: meta('viewport'), ogTitle: meta('og:title'), ogImage: meta('og:image'), canonical: !!document.querySelector('link[rel="canonical"]'), jsonLdTypes: Array.from(new Set(jsonLdTypes)).slice(0, 12) },
    doc: { width: docW, height: docH, viewportW: vw, viewportH: vh, overflowX: docW > vw + 4 },
    headings, h1Count,
    hero: { headline: headline ? { text: headline.t, fs: headline.fs, b: headline.b, tag: headline.tag, split: !!headline.split } : null, subheadline: subheadline ? { text: subheadline.t, fs: subheadline.fs, b: subheadline.b } : null, aboveFoldText },
    ctas: ctas.slice(0, 120), primaryCta, heroCtaCount: heroCtas.filter((c) => !c.inNav).length, buttonCtaCount: buttonCtas.length,
    nav: { links: navLinks, hasCta: ctas.some((c) => c.inNav && c.buttonLike) },
    forms,
    trust: { testimonials, logos: { count: bestRow.length >= 4 ? bestRow.length : 0, y: bestRow.length >= 4 ? bestRow[0].y : null, heading: logoHeading }, ratings, reviewPlatforms, stats, badges, guarantees, contact, legal, caseStudies },
    pricing, faq,
    content: { words: words.length, sentences: sentences.length, flesch, avgSentence: sentences.length ? Math.round(sampleWords / sentences.length) : null, paragraphs: paragraphs.length, longParagraphs: paragraphs.filter((n) => n > 80).length, you, we },
    outline: outline.slice(0, 30),
    design: { fonts: Array.from(fontCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map((e) => e[0]), bodyFont, lineLength, smallText, contrastIssues, contrastChecked: checked },
    media: { images: imgs.length, imagesNoAlt: imgs.filter((i) => !i.hasAttribute('alt')).length, videos: document.querySelectorAll('video').length, iframes, carousels },
    a11y: { buttonsNoName, linksNoText, inputsNoLabel, headingSkips },
    quality: { brokenImages, unloadedImages, placeholders, stillHidden },
    blocks: blocks.slice(0, 700).map(({ _el, _m, _ah, ...rest }) => rest),
  };
}`;
