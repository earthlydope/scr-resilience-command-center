/* ============================================================
   SCR · landing.js — the entry chooser.
   Two ways into the same command center (as in the HCCB hub):
   pick a role, then the mobile app or the web application. The
   previews, copy and links follow the chosen role, and a role
   map explains what each role does and where. Around that: live
   figures floating by the orb, a live-signal band, the agentic
   loop on a dark chrome section and a closing band.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const D = () => SCR.data;
  const esc = s => SCR.ui.esc(s);
  const usd = v => SCR.fmt.usdM(v);
  const $ = id => document.getElementById(id);
  let pid = SCR.personas.stored();
  const ARROW = '<span class="go-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></span>';

  SCR.persona = { current: () => pid, get: () => SCR.personas.byId(pid), list: () => SCR.personas.list(), set: id => choose(id) };

  /** The headline each role sees first on its phone. */
  function headline(p) {
    const d = D(), k = d.kpis;
    if (p.id === 'rrl') return { label: 'Adjusted value at risk', value: usd(k.totalAVAR) };
    if (p.id === 'vsl') return { label: 'SKUs exposed', value: `${d.products.filter(x => x.gapMax > 0).length} of ${d.products.length}` };
    if (p.id === 'cat') return { label: 'Sole-sourced at risk', value: `${d.materials.filter(m => m.singleSource && m.score >= 2.8).length} materials` };
    const pt = d.plants.slice().sort((a, b) => a.ttsMin - b.ttsMin || b.criticalMats - a.criticalMats)[0];
    return { label: 'Runs out first', value: `${pt.name.split(',')[0]} · ${pt.ttsMin}d` };
  }

  const NAV = { executive: 'Executive Summary', valuestream: 'Value Streams', category: 'Category & Suppliers', site: 'Site Resilience' };

  function renderRoles() {
    $('lzRoles').innerHTML = SCR.personas.list().map(p => `
      <button type="button" class="lz-role ${p.id === pid ? 'on' : ''}" role="radio" aria-checked="${p.id === pid}" data-role="${p.id}" style="--av:${p.color}" data-rv>
        <span class="lz-av">${esc(SCR.personas.initials(p.name))}</span>
        <span><b>${esc(p.name)}</b><small>${esc(p.tag)}</small></span>
      </button>`).join('');
    $('lzRoles').querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => choose(b.dataset.role)));
  }

  function renderDevices() {
    const p = SCR.personas.byId(pid);
    const h = headline(p);
    const items = SCR.brief.itemsFor(p.id);
    $('lzLens').innerHTML = `<span class="lz-av sm" style="--av:${p.color}">${esc(SCR.personas.initials(p.name))}</span>“${esc(p.lens)}”`;
    ['lzMobile', 'lzGoMobile', 'lzEndMobile'].forEach(id => { $(id).href = 'mobile.html?as=' + p.id; });
    ['lzWeb', 'lzGoWeb', 'lzEndWeb'].forEach(id => { $(id).href = 'web.html?as=' + p.id; });
    $('lzMobileText').textContent = p.mobile.focus;
    $('lzWebText').textContent = 'The full command center: ' + p.web.focus.charAt(0).toLowerCase() + p.web.focus.slice(1);
    $('lzMobileFeat').innerHTML = ['Today briefing', p.mobile.tab.label, 'Simulate', 'Ask Copilot'].map(f => `<span>${esc(f)}</span>`).join('');
    $('lzWebFeat').innerHTML = [NAV[p.home], 'Scenario Studio', 'Hover guide', 'AI insights'].map(f => `<span>${esc(f)}</span>`).join('');

    // mini phone: the role's Today
    $('lzPhone').innerHTML = `
      <div class="mp-island"></div>
      <div class="mp-bar"><span>9:41</span><i></i></div>
      <div class="mp-body">
        <small class="mp-date">FRIDAY 10 JULY</small>
        <div class="mp-title"><b>Today</b><span class="mp-av" style="--av:${p.color}">${esc(SCR.personas.initials(p.name))}</span></div>
        <div class="mp-hero"><span>${esc(h.label)}</span><b>${esc(h.value)}</b></div>
        <div class="mp-brief"><span class="mp-brief-h"><i></i>For you today</span>
          ${items.slice(0, 3).map((it, i) => `<div class="mp-item" style="--tone:${it.tone}"><em>${i + 1}</em><span><u>${esc(it.kicker)}</u><i class="w${70 - i * 12}"></i></span></div>`).join('')}
        </div>
      </div>
      <div class="mp-tabs">${['Today', p.mobile.tab.label, 'Alerts', 'Simulate', 'Ask'].map((t, i) => `<span class="${i === 0 ? 'on' : ''}"><i></i>${esc(t)}</span>`).join('')}</div>`;

    // mini browser: the role's cockpit
    $('lzBrowser').innerHTML = `
      <div class="mw-bar"><i class="dot r"></i><i class="dot y"></i><i class="dot g"></i><span>scr-resilience-command-center.vercel.app/web</span></div>
      <div class="mw-body">
        <div class="mw-side">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
        <div class="mw-main">
          <div class="mw-head"><b>${esc(NAV[p.home])}</b><span class="mw-pill" style="--av:${p.color}">${esc(p.short)}</span></div>
          <div class="mw-grid">
            <div class="mw-tile brief"><span><i></i>For you today</span>${items.slice(0, 3).map((it, i) => `<em style="--tone:${it.tone}" class="w${80 - i * 14}"></em>`).join('')}</div>
            <div class="mw-tile dark"><span>${esc(h.label)}</span><b>${esc(h.value)}</b></div>
            <div class="mw-tile chart"><u style="height:46%"></u><u style="height:72%"></u><u style="height:58%"></u><u class="hot" style="height:88%"></u><u style="height:64%"></u><u style="height:40%"></u></div>
          </div>
        </div>
      </div>`;

    document.querySelectorAll('.lz-role-card').forEach(c => c.classList.toggle('on', c.dataset.role === pid));
  }

  function renderRoleMap() {
    $('lzRoleMap').innerHTML = SCR.personas.list().map(p => `
      <article class="lz-role-card ${p.id === pid ? 'on' : ''}" data-role="${p.id}" style="--av:${p.color}" data-rv>
        <div class="lz-rc-head"><span class="lz-av">${esc(SCR.personas.initials(p.name))}</span><span><b>${esc(p.name)}</b><small>${esc(p.tag)}</small></span></div>
        <p class="lz-rc-lens">${esc(p.lens)}</p>
        <ol>${p.tasks.map(t => `<li><b>${esc(t.t)}</b><span>${esc(t.d)}</span><em>${esc(t.where)}</em></li>`).join('')}</ol>
        <div class="lz-rc-go">
          <a href="mobile.html?as=${p.id}" data-pick="${p.id}">Mobile ${ARROW}</a>
          <a href="web.html?as=${p.id}" data-pick="${p.id}">Web ${ARROW}</a>
        </div>
      </article>`).join('');
    $('lzRoleMap').querySelectorAll('[data-pick]').forEach(a => a.addEventListener('click', () => SCR.personas.remember(a.dataset.pick)));
  }

  function choose(id) {
    pid = SCR.personas.byId(id).id;
    SCR.personas.remember(pid);
    renderRoles();
    renderDevices();
    if (SCR.guide) SCR.guide.refresh();
  }

  function stats() {
    const d = D(), k = d.kpis;
    $('lzStats').innerHTML = [
      [usd(k.totalNTS), 'Sales in scope'],
      [usd(k.totalAVAR), 'Adjusted value at risk'],
      [String(k.nodes), 'Nodes monitored'],
      [String((d.agents || []).length), 'AI agents on watch']
    ].map(([v, l]) => `<div><b data-count>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  }

  /* ---------------- the figures floating by the orb ---------------- */
  function sparkLine(vals) {
    const w = 120, h = 30, lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const pts = vals.map((v, i) => [(i / (vals.length - 1)) * w, h - 3 - ((v - lo) / span) * (h - 6)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${line} L ${w} ${h} L 0 ${h} Z" fill="rgba(250,196,0,.22)"/><path d="${line}" fill="none" stroke="#e3ad00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function floats() {
    const d = D(), k = d.kpis;
    const avar = (d.monthly && d.monthly.avar) || [];
    $('lzF1').innerHTML = `<small>Adjusted value at risk</small><b data-count>${esc(usd(k.totalAVAR))}</b>${avar.length > 1 ? sparkLine(avar) : ''}`;
    $('lzF2').innerHTML = `<small>Enterprise resilience</small><b data-count>${esc(k.enterpriseRI + '%')}</b><em class="${k.riDelta >= 0 ? 'up' : ''}">${esc(SCR.fmt.signed(k.riDelta, ' pts'))} this month</em>`;
    $('lzF3').innerHTML = `<div class="lf-row"><i class="live-dot"></i><span><small>Agents live</small><b>${(d.agents || []).length} on watch</b></span></div>`;
  }

  /* ---------------- live-signal band ---------------- */
  function band() {
    const d = D();
    const sevC = { critical: 'var(--status-critical)', high: 'var(--status-serious)', medium: 'var(--status-warning)' };
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    const open = d.alerts.filter(a => a.status !== 'closed')
      .sort((a, b) => (rank[a.sev] - rank[b.sev]) || (b.exposure - a.exposure)).slice(0, 10);
    $('lzTicker').appendChild(SCR.motion.ticker(open.map(a => ({
      html: `${esc(a.title.split(' — ')[0])}${a.exposure ? ` <b>${esc(usd(a.exposure))}</b>` : ''}`,
      sev: sevC[a.sev] || 'var(--ink-4)',
      onClick: () => { location.href = 'web.html?as=' + pid; }
    })), { label: 'Live signals', speed: 6.5 }));
  }

  /* ---------------- the agentic loop ---------------- */
  function loop() {
    const d = D(), k = d.kpis;
    const ag = key => ((d.agents || []).find(a => a.key === key) || {}).name || '';
    const steps = [
      ['Sense', 'Weather, port, financial, cyber and quality signals are read against every supplier, plant and lane.', ag('sensing')],
      ['Score', 'Each signal becomes value at risk, and the time a node can survive is set against the time it takes to recover.', [ag('impact'), ag('inventory')].filter(Boolean).join(' · ')],
      ['Simulate', 'A plant down for 21 days, a port closed, a supplier lost — rehearsed on the digital twin before it happens.', ag('scenario')],
      ['Act', 'The fix is drafted, costed and routed to an owner; every approval lands as a tracked action.', [ag('mitigation'), ag('workflow')].filter(Boolean).join(' · ')]
    ];
    $('lzLoop').innerHTML = steps.map(s => `<li><b>${esc(s[0])}</b><span>${esc(s[1])}</span>${s[2] ? `<em>${esc(s[2])}</em>` : ''}</li>`).join('');
    const sens = (d.agents || []).find(a => a.key === 'sensing');
    const sig = sens && sens.stats && sens.stats[0];
    $('lzLoopStats').innerHTML = [
      sig ? [SCR.fmt.num(sig[1]), String(sig[0])] : null,
      [k.detectionLeadDays + 'd', 'Detection lead time'],
      [usd(k.mitigatedYtd), 'Value at risk mitigated YTD']
    ].filter(Boolean).map(([v, l]) => `<div><b data-count>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  }

  /* ---------------- closing words marquee ---------------- */
  function words() {
    const STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.6 6.2 3.8 9.4 10 10-6.2.6-9.4 3.8-10 10-.6-6.2-3.8-9.4-10-10 6.2-.6 9.4-3.8 10-10Z"/></svg>';
    const list = ['Sense', 'Quantify', 'Simulate', 'Mitigate', 'Govern', 'Sense', 'Quantify', 'Simulate', 'Mitigate', 'Govern'];
    const seq = list.map(w => `<span><b>${w}</b>${STAR}</span>`).join('');
    $('lzWords').innerHTML = `<div class="ticker-track"><div class="ticker-seq">${seq}</div><div class="ticker-seq">${seq}</div></div>`;
  }

  /* ---------------- scroll: header, progress, rail ---------------- */
  function scrollChrome() {
    const bar = $('lzTopBar'), prog = $('lzProgress'), rail = $('lzTop');
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY, max = document.documentElement.scrollHeight - innerHeight;
      bar.classList.toggle('scrolled', y > 8);
      prog.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : 0);
      rail.classList.toggle('on', y > innerHeight * 0.8);
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    rail.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    update();
  }

  /* ---------------- the orb leans toward the pointer ---------------- */
  function parallax() {
    if (SCR.motion.reduce) return;
    const vis = $('lzVisual'), hero = document.querySelector('.lz-hero');
    if (!vis || !hero) return;
    let raf = 0, ev = null;
    hero.addEventListener('pointermove', e => {
      ev = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = vis.getBoundingClientRect();
        const px = Math.max(-1, Math.min(1, (ev.clientX - (r.left + r.width / 2)) / (r.width / 2)));
        const py = Math.max(-1, Math.min(1, (ev.clientY - (r.top + r.height / 2)) / (r.height / 2)));
        vis.style.setProperty('--px', px.toFixed(3));
        vis.style.setProperty('--py', py.toFixed(3));
      });
    });
    hero.addEventListener('pointerleave', () => { vis.style.setProperty('--px', 0); vis.style.setProperty('--py', 0); });
  }

  function initTheme() {
    let t = null;
    try { t = localStorage.getItem('scr-theme'); } catch (_) { t = null; }
    if (t) document.body.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    const sync = () => { if (meta) meta.setAttribute('content', document.body.getAttribute('data-theme') === 'dark' ? '#0a0a0b' : '#ffffff'); };
    sync();
    $('lzTheme').addEventListener('click', () => {
      const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', next);
      try { localStorage.setItem('scr-theme', next); } catch (_) { /* private mode */ }
      sync();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    stats();
    floats();
    band();
    renderRoles();
    renderRoleMap();
    renderDevices();
    loop();
    words();
    scrollChrome();
    parallax();
    SCR.motion.init({ mode: 'landing' });
    SCR.guide.init({ mode: 'landing' });
  });
})();
