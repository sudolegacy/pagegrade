/**
 * Scripts evaluated inside the captured page. They are plain JavaScript strings
 * (not functions) so bundlers cannot inject helpers that do not exist in the
 * page context. Each is an expression that evaluates to a function taking one
 * JSON argument; call through `runInPage`.
 */

export const SETTLE_DOM = String.raw`async ({ quietMs, maxMs }) => {
  await new Promise((resolve) => {
    let timer;
    const start = performance.now();
    const finish = () => { try { obs.disconnect(); } catch (e) {} resolve(); };
    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      if (performance.now() - start > maxMs) return finish();
      timer = setTimeout(finish, quietMs);
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    timer = setTimeout(finish, quietMs);
    setTimeout(finish, maxMs);
  });
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch (e) {}
  return true;
}`;

export const DETECT_WALL = String.raw`() => {
  const title = document.title || '';
  const text = ((document.body && document.body.innerText) || '').replace(/\s+/g, ' ').trim();
  const html = document.documentElement.outerHTML.slice(0, 250000);
  const words = text ? text.split(' ').length : 0;
  const head = (title + ' ' + text.slice(0, 700)).toLowerCase();
  const signals = [];
  if (/just a moment|attention required|checking your browser|verify you are human|verifying you are human|are you a robot|access denied|request blocked|pardon our interruption|security check|unusual traffic|bot detection|enable javascript and cookies/.test(head)) signals.push('challenge-text');
  if (/cf-chl-|challenge-platform|_cf_chl_opt|cf_chl_prog/i.test(html)) signals.push('cloudflare');
  if (/px-captcha|_pxhd|perimeterx/i.test(html) && words < 300) signals.push('perimeterx');
  if (/geo\.captcha-delivery|datadome/i.test(html) && words < 300) signals.push('datadome');
  if (/(g-recaptcha|h-captcha|cf-turnstile)/i.test(html) && words < 120) signals.push('captcha');
  const passwordFields = document.querySelectorAll('input[type=password]').length;
  const loginWall = passwordFields > 0 && words < 220;
  return { signals, loginWall, words, title, textSample: text.slice(0, 400) };
}`;

/** Marks likely consent buttons (incl. open shadow roots) so Playwright can click them for real. */
export const MARK_CONSENT = String.raw`() => {
  const accept = /^(accept( all)?( cookies)?|allow( all)?( cookies)?|agree( and close)?|i agree|i accept|got it|ok(ay)?|understood|yes,? i agree|accept and close|accept & close|alle akzeptieren|tout accepter|aceptar( todo)?|accetta( tutto)?)$/i;
  const reject = /^(reject( all)?|decline( all)?|only necessary|necessary only|essential only|use necessary cookies only|refuse)$/i;
  const consentContext = /cookie|consent|gdpr|privacy|tracking|personal data|we use|datenschutz/i;
  const roots = [document];
  const walk = (root) => {
    const all = root.querySelectorAll('*');
    for (const el of all) if (el.shadowRoot) { roots.push(el.shadowRoot); walk(el.shadowRoot); }
  };
  walk(document);
  let marked = 0;
  for (const root of roots) {
    for (const el of root.querySelectorAll('button, [role=button], a, input[type=button], input[type=submit]')) {
      const label = ((el.innerText || el.value || el.getAttribute('aria-label') || '') + '').replace(/\s+/g, ' ').trim();
      if (!label || label.length > 40) continue;
      const kind = accept.test(label) ? 'accept' : reject.test(label) ? 'reject' : null;
      if (!kind) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      let node = el, ctx = false, depth = 0;
      while (node && depth < 12) {
        const t = (node.innerText || node.textContent || '').slice(0, 1500);
        const idc = ((node.id || '') + ' ' + (typeof node.className === 'string' ? node.className : '')).toLowerCase();
        if (/cookie|consent|gdpr|cmp|privacy/.test(idc) || (t.length < 1500 && consentContext.test(t))) { ctx = true; break; }
        node = node.parentElement || (node.getRootNode && node.getRootNode().host) || null;
        depth++;
      }
      if (!ctx) continue;
      el.setAttribute('data-pg-consent', kind);
      marked++;
    }
  }
  return marked;
}`;

/** Finds fixed/sticky/dialog layers and classifies them. Marks each with data-pg-layer. */
export const DETECT_LAYERS = String.raw`() => {
  const vw = innerWidth, vh = innerHeight, area = vw * vh;
  const out = [];
  let i = 0;
  const chat = /intercom|drift|crisp|hubspot|zendesk|tawk|livechat|gorgias|freshchat|tidio|olark|helpscout|chatwoot|messenger/i;
  for (const el of document.body ? document.body.querySelectorAll('*') : []) {
    const cs = getComputedStyle(el);
    const isDialog = el.tagName === 'DIALOG' || el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true';
    if (cs.position !== 'fixed' && cs.position !== 'sticky' && !isDialog) continue;
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // Skip layers nested inside another fixed layer; the outer one is what matters.
    let p = el.parentElement, nested = false;
    while (p && p !== document.body) { const ps = getComputedStyle(p).position; if (ps === 'fixed' || ps === 'sticky') { nested = true; break; } p = p.parentElement; }
    if (nested) continue;
    const visW = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const cover = (visW * visH) / area;
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    const idc = ((el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : '') + ' ' + (el.querySelector('iframe') ? el.querySelector('iframe').src : '')).toLowerCase();
    let kind = 'other';
    if (/cookie|consent|gdpr|cmp/.test(idc) || /cookie|consent|gdpr/i.test(text.slice(0, 300))) kind = 'cookie';
    else if (chat.test(idc)) kind = 'chat';
    else if (cs.position === 'sticky' || (r.top <= 4 && r.height < vh * 0.3 && r.width > vw * 0.7)) kind = 'header';
    else if (r.bottom >= vh - 4 && r.height < vh * 0.3 && r.width > vw * 0.6) kind = 'bottom-bar';
    else if (cover < 0.06) kind = 'widget';
    else if (cover >= 0.2 || isDialog) {
      if (/18\+|over 18|of legal|date of birth|age verification/i.test(text)) kind = 'age-gate';
      else if (/country|region|location|language|ship to/i.test(text) && text.length < 400) kind = 'region';
      else if (el.querySelector('input[type=email]') || /subscribe|newsletter|% off|discount|sign up|join our|get \d+%|offer/i.test(text)) kind = 'popup-offer';
      else kind = 'modal';
    }
    const cx = Math.min(vw - 2, Math.max(1, r.left + Math.min(r.width, vw) / 2)), cy = Math.min(vh - 2, Math.max(1, r.top + Math.min(r.height, vh) / 2));
    const hit = document.elementFromPoint(cx, cy);
    const onTop = !!hit && (hit === el || el.contains(hit));
    if (!onTop && kind !== 'cookie' && kind !== 'header') continue;
    el.setAttribute('data-pg-layer', String(i));
    out.push({ id: i, kind, onTop, position: cs.position, cover: Math.round(cover * 100) / 100, top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width), text: text.slice(0, 160), hasEmail: !!el.querySelector('input[type=email]'), hasButton: !!el.querySelector('a,button') });
    i++;
  }
  return out;
}`;

/** Marks close/dismiss controls inside a given layer. */
export const MARK_CLOSE = String.raw`({ id }) => {
  const layer = document.querySelector('[data-pg-layer="' + id + '"]');
  if (!layer) return 0;
  const re = /^(×|✕|✖|x|close|dismiss|no,? thanks|no thank you|not now|maybe later|skip|continue to site|continue browsing|stay on this site)$/i;
  let n = 0;
  for (const el of layer.querySelectorAll('button, [role=button], a, [aria-label], span, div, svg')) {
    const label = ((el.getAttribute('aria-label') || '') + ' ' + (el.innerText || '')).replace(/\s+/g, ' ').trim();
    const al = (el.getAttribute('aria-label') || '').toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    if (re.test(label) || /close|dismiss/.test(al) || /(^|[\s_-])close([\s_-]|$)/.test(cls)) {
      const r = el.getBoundingClientRect();
      if (r.width >= 6 && r.height >= 6) { el.setAttribute('data-pg-close', String(id)); n++; }
    }
  }
  return n;
}`;

export const HIDE_LAYERS = String.raw`({ ids }) => {
  for (const id of ids) {
    const el = document.querySelector('[data-pg-layer="' + id + '"]');
    if (el) el.style.setProperty('display', 'none', 'important');
  }
  // Remove scroll locks and full-screen backdrops left behind by modals.
  for (const el of [document.documentElement, document.body]) {
    if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') el.style.setProperty('overflow', 'visible', 'important');
    if (el === document.body && cs.position === 'fixed') el.style.setProperty('position', 'static', 'important');
  }
  return true;
}`;

/** Unlocks pages that scroll inside an inner container or a transformed smooth-scroll wrapper. */
export const UNLOCK_SCROLL = String.raw`() => {
  const vh = innerHeight;
  const docH = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  if (docH > vh * 1.3) return { unlocked: false, docH };
  let best = null;
  for (const el of document.querySelectorAll('body *')) {
    if (el.scrollHeight > el.clientHeight + 200 && el.clientHeight >= vh * 0.7) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll|hidden)/.test(cs.overflowY) && (!best || el.scrollHeight > best.scrollHeight)) best = el;
    }
  }
  const css = document.createElement('style');
  css.textContent = 'html,body{height:auto!important;min-height:0!important;overflow:visible!important}[data-scroll-container]{transform:none!important}';
  document.head.appendChild(css);
  if (best) {
    let node = best;
    while (node && node !== document.body) {
      node.style.setProperty('height', 'auto', 'important');
      node.style.setProperty('max-height', 'none', 'important');
      node.style.setProperty('overflow', 'visible', 'important');
      node = node.parentElement;
    }
  }
  const after = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  return { unlocked: after > docH + 100, docH: after };
}`;

/** Scrolls progressively so lazy content and scroll-triggered sections load. */
export const PROGRESSIVE_SCROLL = String.raw`async ({ stepRatio, pauseMs, maxSteps, maxHeight, imageWaitMs, maxMs }) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const docH = () => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  const vh = innerHeight;
  const step = Math.max(240, Math.floor(vh * stepRatio));
  let y = 0, steps = 0, growth = 0, stableAtEnd = 0, lastH = docH();
  const startH = lastH;
  const began = performance.now();
  while (steps < maxSteps && performance.now() - began < (maxMs || 20000)) {
    y += step;
    window.scrollTo(0, y);
    window.dispatchEvent(new Event('scroll'));
    steps++;
    await sleep(pauseMs);
    const t0 = performance.now();
    while (performance.now() - t0 < (imageWaitMs || 600)) {
      const pending = Array.prototype.filter.call(document.images, (img) => {
        const r = img.getBoundingClientRect();
        return r.bottom > -100 && r.top < vh + 100 && r.width > 24 && r.height > 24 && !img.complete;
      });
      if (!pending.length) break;
      await sleep(120);
    }
    const h = docH();
    if (h > lastH + 80) { growth++; lastH = h; }
    if (y + vh >= h - 4) { stableAtEnd++; if (stableAtEnd >= 2) break; } else stableAtEnd = 0;
    if (y > maxHeight) break;
  }
  // Force any remaining lazy images to load.
  for (const img of document.images) {
    if (img.loading === 'lazy') img.loading = 'eager';
    const ds = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
    if (ds && (!img.getAttribute('src') || img.getAttribute('src').startsWith('data:'))) img.setAttribute('src', ds);
  }
  window.scrollTo(0, 0);
  await sleep(350);
  const finalH = docH();
  return { steps, startHeight: startH, finalHeight: finalH, growthEvents: growth, reachedEnd: stableAtEnd >= 1 || y + vh >= finalH - 4, truncated: finalH > maxHeight };
}`;

export const WAIT_IMAGES = String.raw`async ({ maxMs }) => {
  const imgs = Array.prototype.filter.call(document.images, (i) => !i.complete && i.getBoundingClientRect().width > 24);
  await Promise.race([
    Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => undefined) : undefined))),
    new Promise((r) => setTimeout(r, maxMs)),
  ]);
  return imgs.length;
}`;

/** Reveals content still hidden by scroll-triggered entrance animations. */
export const REVEAL = String.raw`() => {
  const skip = (el) => el.closest('nav, header [role=menu], [role=menu], [role=listbox], [role=tooltip], [role=dialog], dialog, [aria-hidden="true"], [data-pg-layer], .swiper-slide:not(.swiper-slide-active), .slick-slide:not(.slick-active), [class*="dropdown" i], [class*="tooltip" i], [class*="submenu" i], [class*="mega-menu" i]');
  const marker = /aos|wow|reveal|fade|animate|motion|appear|scroll|inview|in-view|sal-|lazy/i;
  let revealed = 0;
  const all = document.body ? document.body.querySelectorAll('*') : [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    const hidden = parseFloat(cs.opacity) < 0.05 || cs.visibility === 'hidden';
    if (!hidden) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const hasContent = (el.innerText || '').trim().length > 0 || el.querySelector('img, svg, video, picture, canvas');
    if (!hasContent || skip(el)) continue;
    const attrs = Array.prototype.map.call(el.attributes, (a) => a.name + '=' + a.value).join(' ');
    const animated = marker.test(attrs) || cs.transitionDuration !== '0s' || cs.animationName !== 'none' || /opacity:\s*0/.test(el.getAttribute('style') || '') || el.hasAttribute('data-framer-appear-id');
    if (!animated) continue;
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('transform', 'none', 'important');
    el.style.setProperty('clip-path', 'none', 'important');
    revealed++;
  }
  return revealed;
}`;

/** Prepares a clean, stable layout for full-page capture. Returns removed fixed layers. */
export const STABILIZE = String.raw`() => {
  const style = document.createElement('style');
  style.setAttribute('data-pg', 'stabilize');
  style.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}*{content-visibility:visible!important;background-attachment:scroll!important}::-webkit-scrollbar{display:none!important}';
  document.head.appendChild(style);
  const removed = [];
  const vh = innerHeight, vw = innerWidth;
  for (const el of document.body ? document.body.querySelectorAll('*') : []) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (cs.position === 'sticky') { el.style.setProperty('position', 'relative', 'important'); el.style.setProperty('top', 'auto', 'important'); continue; }
    if (r.top <= 4 && r.height < vh * 0.3 && r.width > vw * 0.7) {
      el.style.setProperty('position', 'absolute', 'important');
      continue;
    }
    removed.push({ text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80), top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width) });
    el.style.setProperty('display', 'none', 'important');
  }
  return removed;
}`;
