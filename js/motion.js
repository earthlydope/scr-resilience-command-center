/* ============================================================
   SCR · motion.js — the "Signal" motion layer, shared by the
   chooser, the web application and the mobile app.

   · Arrivals — blocks rise into place as they reach the viewport
     (one IntersectionObserver for every scroll container).
   · Count-ups — headline figures run up to their value once.
   · Highlighter — key phrases get a yellow bar that sweeps in.
   · Pointer companion — a dot that sticks and a ring that
     follows; it opens on anything clickable, steps aside over
     text fields and charts, and turns into a fingertip over the
     phone so the mobile demo feels touched, not clicked.
   · Marquee — SCR.motion.ticker() builds a live-signal band.
   · Tilt — [data-tilt] cards lean toward the pointer.
   · Route line — a yellow stroke under the toolbar on navigate.
   Everything stands down under prefers-reduced-motion.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;

  /* ---------------- Arrivals ---------------- */
  const revealIO = hasIO ? new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      revealIO.unobserve(e.target);
      arrive(e.target);
    });
  }, { rootMargin: '0px 0px -4% 0px', threshold: 0.04 }) : null;

  const sweepIO = hasIO ? new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      sweepIO.unobserve(e.target);
      const d = parseFloat(e.target.dataset.sweepDelay || '0.25') * 1000;
      setTimeout(() => e.target.classList.add('in'), d);
    });
  }, { threshold: 0.4 }) : null;

  function arrive(el) {
    el.classList.add('rv-in');
    countWithin(el);
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      el.classList.remove('rv', 'rv-in');
      el.style.removeProperty('--rv-d');
    };
    el.addEventListener('animationend', function h(ev) {
      if (ev.target !== el || ev.animationName !== 'rvIn') return;
      el.removeEventListener('animationend', h);
      finish();
    });
    setTimeout(finish, 2600);
  }

  /** Mark nodes to rise in as they arrive. opts.stagger (s) staggers siblings. */
  function reveal(nodes, opts) {
    opts = opts || {};
    const list = Array.from(nodes || []).filter(n => n && n.nodeType === 1 && !n.dataset.rvd);
    if (reduce || !revealIO) { list.forEach(n => { n.dataset.rvd = '1'; countWithin(n); }); return; }
    const step = opts.stagger == null ? 0.06 : opts.stagger;
    const groups = new Map();
    list.forEach(n => {
      n.dataset.rvd = '1';
      const k = n.parentNode;
      const i = groups.get(k) || 0;
      groups.set(k, i + 1);
      n.style.setProperty('--rv-d', Math.min(i * step, 0.42).toFixed(2) + 's');
      n.classList.add('rv');
      revealIO.observe(n);
    });
  }

  /* ---------------- Count-ups ---------------- */
  const COUNT_SEL = '.k-value, .hs-val, .m-hero-value, [data-count]';
  function countWithin(root) {
    if (reduce) return;
    if (root.matches && root.matches(COUNT_SEL)) countUp(root);
    root.querySelectorAll && root.querySelectorAll(COUNT_SEL).forEach(countUp);
  }
  function firstText(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue.trim()) return n;
      if (n.nodeType === 1 && !/^(SMALL|SVG|I)$/i.test(n.tagName)) { const t = firstText(n); if (t) return t; }
    }
    return null;
  }
  const NUM = /^(\s*[^\d\s−-]{0,2})([−-]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?([^\d]{0,7})$/;
  function countUp(el) {
    if (reduce || el.dataset.counted) return;
    const node = firstText(el);
    if (!node) return;
    const raw = node.nodeValue;
    const m = raw.match(NUM);
    if (!m) return;
    const pre = m[1], sign = m[2], intPart = m[3], dec = m[4] || '', post = m[5];
    const target = parseFloat(intPart.replace(/,/g, '') + dec);
    if (!isFinite(target) || target === 0) return;
    el.dataset.counted = '1';
    const decimals = dec ? dec.length - 1 : 0;
    const commas = intPart.indexOf(',') >= 0;
    const fmt = v => {
      const s = commas
        ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : v.toFixed(decimals);
      return pre + sign + s + post;
    };
    const dur = 1050 + Math.min(450, Math.log10(target + 1) * 150);
    const t0 = performance.now();
    node.nodeValue = fmt(0);
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      node.nodeValue = p >= 1 ? raw : fmt(target * e);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ---------------- Highlighter & full stops ---------------- */
  function sweep(nodes, delay) {
    Array.from(nodes || []).forEach(n => {
      if (!n || n.dataset.sw) return;
      n.dataset.sw = '1';
      if (reduce || !sweepIO) { n.classList.add('in'); return; }
      n.classList.add('hl-sweep');
      if (delay != null) n.dataset.sweepDelay = String(delay);
      sweepIO.observe(n);
    });
  }
  /** Wrap a heading's content in a highlighter span (once). */
  function highlight(h, opts) {
    if (!h || h.querySelector('.hl') || h.dataset.hld) return null;
    h.dataset.hld = '1';
    const span = document.createElement('span');
    span.className = 'hl' + (opts && opts.fill ? ' hl-fill' : '');
    while (h.firstChild) span.appendChild(h.firstChild);
    h.appendChild(span);
    return span;
  }
  /** "Risk landscape" → "Risk landscape." with a yellow stop. */
  function stop(el, cls) {
    if (!el || el.dataset.stop) return;
    el.dataset.stop = '1';
    const t = Array.from(el.childNodes).find(n => n.nodeType === 3 && n.nodeValue.trim());
    if (!t) return;
    const text = t.nodeValue.replace(/\s+$/, '');
    if (/[.?!:…]$/.test(text)) return;
    // text and stop travel together, so a flex gap never splits them
    const wrap = document.createElement('span');
    wrap.className = 'st-t';
    wrap.textContent = text;
    const dot = document.createElement('span');
    dot.className = cls || 'st-dot';
    dot.textContent = '.';
    wrap.appendChild(dot);
    t.parentNode.replaceChild(wrap, t);
  }

  /** One pass over freshly rendered content. mode: 'web' | 'mobile' | 'landing'. */
  function decorate(root, opts) {
    if (!root) return;
    opts = opts || {};
    const animate = opts.animate !== false;
    if (opts.mode === 'web') {
      root.querySelectorAll('.page-head h1').forEach(h => { const s = highlight(h); if (s && animate) sweep([s], 0.3); });
      root.querySelectorAll('.section-title').forEach(s => stop(s));
      if (!animate) return;
      const blocks = [];
      Array.from(root.children).forEach(c => {
        if (c.matches('.grid, .kpi-cards, .today, .agent-grid, .persona-grid')) blocks.push(...c.children);
        else blocks.push(c);
      });
      reveal(blocks, { stagger: 0.05 });
    } else if (opts.mode === 'mobile') {
      root.querySelectorAll('.m-large').forEach(h => { const s = highlight(h); if (s && animate) sweep([s], 0.32); });
      root.querySelectorAll('.m-section').forEach(s => stop(s));
      if (!animate) return;
      const body = root.querySelector('.view-body') || root;
      const blocks = [];
      Array.from(body.children).forEach(c => {
        if (c.matches('.m-quick, .m-facts')) blocks.push(...c.children);
        else if (!c.matches('.m-head')) blocks.push(c);
      });
      reveal(blocks, { stagger: 0.045 });
    } else {
      reveal(root.querySelectorAll('[data-rv]'), { stagger: 0.07 });
      sweep(root.querySelectorAll('.hl[data-sweep]'));
    }
  }

  /* ---------------- Marquee ---------------- */
  const STAR = '<svg class="tk-sep" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.6 6.2 3.8 9.4 10 10-6.2.6-9.4 3.8-10 10-.6-6.2-3.8-9.4-10-10 6.2-.6 9.4-3.8 10-10Z"/></svg>';
  /** items: [{html, sev, onClick}] → a looping band. opts: {label, speed, cls} */
  function ticker(items, opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'ticker' + (opts.label ? ' has-label' : '') + (opts.cls ? ' ' + opts.cls : '');
    if (!items || !items.length) return wrap;
    let list = items.slice();
    while (list.length < 8) list = list.concat(items);
    const seq = hidden => `<div class="ticker-seq"${hidden ? ' aria-hidden="true"' : ''}>${list.map((it, i) =>
      `<button type="button" class="tk-item" data-i="${i % items.length}"${hidden ? ' tabindex="-1"' : ''}>${it.sev ? `<i class="tk-sev" style="background:${it.sev}"></i>` : ''}${it.html}</button>${STAR}`).join('')}</div>`;
    wrap.innerHTML = (opts.label ? `<span class="tk-label"><i class="live-dot"></i>${opts.label}</span>` : '') +
      `<div class="ticker-track">${seq(false)}${seq(true)}</div>`;
    wrap.style.setProperty('--dur', Math.round(Math.max(26, list.length * (opts.speed || 5.5))) + 's');
    wrap.addEventListener('click', e => {
      const b = e.target.closest('.tk-item');
      const it = b && items[+b.dataset.i];
      if (it && it.onClick) it.onClick();
    });
    return wrap;
  }

  /* ---------------- Tilt ---------------- */
  function tilt(root) {
    if (reduce || !fine) return;
    (root || document).querySelectorAll('[data-tilt]').forEach(el => {
      if (el._tilt) return;
      el._tilt = true;
      const max = parseFloat(el.dataset.tilt) || 4;
      let raf = 0, ev = null;
      el.addEventListener('pointermove', e => {
        ev = e;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = el.getBoundingClientRect();
          const px = (ev.clientX - r.left) / r.width - 0.5, py = (ev.clientY - r.top) / r.height - 0.5;
          el.style.transform = `perspective(1200px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-4px)`;
          el.style.setProperty('--mx', ((px + 0.5) * 100).toFixed(1) + '%');
          el.style.setProperty('--my', ((py + 0.5) * 100).toFixed(1) + '%');
        });
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------------- Route line ---------------- */
  function route(host) {
    if (!host || reduce) return;
    let line = host.querySelector(':scope > .route-line');
    if (!line) { line = document.createElement('i'); line.className = 'route-line'; host.prepend(line); }
    line.classList.remove('run');
    void line.offsetWidth;
    line.classList.add('run');
  }

  /* ---------------- Pointer companion ---------------- */
  let cursorOn = false;
  function cursor() {
    if (cursorOn || reduce || !fine) return;
    cursorOn = true;
    const dot = document.createElement('div'); dot.className = 'cur cur-dot';
    const ring = document.createElement('div'); ring.className = 'cur cur-ring';
    document.body.append(ring, dot);
    const LINK = 'a, button, [role="button"], [role="radio"], .clickable, .row-link, select, label, summary, .tk-item, input[type="range"], input[type="checkbox"], .lp-row, .search-hit';
    const TEXT = 'input:not([type="range"]):not([type="checkbox"]), textarea, [contenteditable="true"]';
    const CHART = '.chart';
    let x = -200, y = -200, rx = -200, ry = -200, raf = 0, shown = false, mode = '', down = false;
    const modes = ['is-link', 'is-text', 'is-chart', 'is-touch'];
    function setMode(m) {
      if (m === mode) return;
      mode = m;
      modes.forEach(c => { const on = c === 'is-' + m; dot.classList.toggle(c, on); ring.classList.toggle(c, on); });
      document.documentElement.classList.toggle('cur-touch', m === 'touch');
    }
    function place() {
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${down && mode !== 'touch' ? 0.8 : 1})`;
    }
    function loop() {
      rx += (x - rx) * 0.22; ry += (y - ry) * 0.22;
      place();
      if (Math.abs(x - rx) + Math.abs(y - ry) > 0.4) raf = requestAnimationFrame(loop);
      else { rx = x; ry = y; place(); raf = 0; }
    }
    document.addEventListener('pointermove', e => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      if (!shown) { shown = true; rx = x; ry = y; dot.classList.add('on'); ring.classList.add('on'); }
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (mode === 'touch') { rx = x; ry = y; place(); }
      else if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('pointerover', e => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('.screen')) setMode('touch');
      else if (t.closest(TEXT)) setMode('text');
      else if (t.closest(CHART)) setMode('chart');
      else if (t.closest(LINK)) setMode('link');
      else setMode('');
    }, { passive: true });
    document.addEventListener('pointerdown', () => { down = true; ring.classList.add('is-down'); place(); }, { passive: true });
    document.addEventListener('pointerup', () => { down = false; ring.classList.remove('is-down'); place(); }, { passive: true });
    const hide = () => { shown = false; dot.classList.remove('on'); ring.classList.remove('on'); };
    document.documentElement.addEventListener('mouseleave', hide);
    window.addEventListener('blur', hide);
  }

  /* ---------------- Boot ---------------- */
  function init(opts) {
    opts = opts || {};
    cursor();
    if (opts.mode === 'landing') { decorate(document, { mode: 'landing' }); tilt(document); }
  }

  SCR.motion = { init, decorate, reveal, sweep, highlight, stop, countUp, ticker, tilt, route, reduce };
})();
