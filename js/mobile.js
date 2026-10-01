/* ============================================================
   SCR · mobile.js
   The iPhone app — the same data, agents and copilot as the web
   application, tailored per role for decisions on the move.
   · Five tabs: Today · <role tab> · Alerts · Simulate · Ask. The
     second tab is the role's own list: Decisions, Products,
     Suppliers or Sites.
   · Phone patterns: highlighted large titles that collapse into
     a blurred nav bar, push navigation with a back label, bottom
     sheets, an ink tab dock with a yellow active tab, a live-
     signal strip, confirmations in the Dynamic Island, and a
     yellow radar rim while the copilot thinks.
   · Shares SCR.copilot (intent router and answers), SCR.work
     (real actions and approvals) and SCR.brief (the briefing)
     with the web app. The web-only entry points — drawers,
     modal, toast, router — are re-pointed at mobile screens at
     the bottom of this file, so every answer chip still works.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const D = () => SCR.data;
  const F = () => SCR.fmt;
  const esc = s => SCR.ui.esc(s);
  const el = h => SCR.ui.el(h);
  const usd = v => SCR.fmt.usdM(v);
  const $ = id => document.getElementById(id);
  /** Lower-case a name for use mid-sentence, leaving acronyms alone. */
  const lc = s => String(s).replace(/\b([A-Z])([a-z])/g, (m, a, b) => a.toLowerCase() + b);
  const strip = h => { const t = document.createElement('div'); t.innerHTML = h || ''; return t.textContent.replace(/\s+/g, ' ').trim(); };

  /* ---------------- icons (SF Symbols in spirit) ---------------- */
  const sv = (d, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra || ''}>${d}</svg>`;
  const I = {
    today: sv('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>'),
    decisions: sv('<path d="m12 2.5 2.3 1.7 2.8-.2.9 2.7 2.3 1.6-.8 2.7.8 2.7-2.3 1.6-.9 2.7-2.8-.2L12 21.5l-2.3-1.7-2.8.2-.9-2.7-2.3-1.6.8-2.7-.8-2.7 2.3-1.6.9-2.7 2.8.2Z"/><path d="m8.6 12.2 2.3 2.3 4.5-4.8"/>'),
    products: sv('<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>'),
    suppliers: sv('<path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h7A1.5 1.5 0 0 1 14 5.5V21"/><path d="M14 10h4.5a1.5 1.5 0 0 1 1.5 1.5V21"/><path d="M3 21h18"/><path d="M7.5 8h3M7.5 12h3M7.5 16h3"/>'),
    sites: sv('<path d="M3 21V9l5 3V9l5 3V6l8 4v11Z"/><path d="M3 21h18"/><path d="M8 17h2M14 17h2"/>'),
    alerts: sv('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
    simulate: sv('<path d="M6 3v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>'),
    chevR: sv('<path d="m9 6 6 6-6 6"/>', 'stroke-width="2.4"'),
    chevL: sv('<path d="m15 5-7 7 7 7"/>', 'stroke-width="2.6"'),
    search: sv('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 'stroke-width="2.2"'),
    close: sv('<path d="M17 7 7 17M7 7l10 10"/>', 'stroke-width="2.6"'),
    check: sv('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 'stroke-width="2.6"'),
    doc: sv('<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8Z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 17h5"/>'),
    warn: sv('<path d="M12 3 2 20h20Z"/><path d="M12 10v4"/><path d="M12 17.5v.5"/>'),
    bolt: sv('<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>'),
    clock: sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    swap: sv('<path d="M7 7h12l-3.5-3.5"/><path d="M17 17H5l3.5 3.5"/>'),
    mail: sv('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>'),
    link: sv('<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>'),
    list: sv('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>'),
    power: sv('<path d="M12 3v8"/><path d="M6.3 7.2a8 8 0 1 0 11.4 0"/>'),
    gauge: sv('<path d="M4 14a8 8 0 1 1 16 0"/><path d="m12 14 4-4"/><path d="M4 19h16"/>'),
    compose: sv('<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'stroke-width="2.1"'),
    send: sv('<path d="M12 19V5"/><path d="m5.5 11.5 6.5-6.5 6.5 6.5"/>', 'stroke-width="2.6"'),
    pin: sv('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/>', 'stroke-width="2.2"'),
    view: sv('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/>', 'stroke-width="2.2"'),
    info: sv('<path d="M12 11v6"/><path d="M12 7v.5"/>', 'stroke-width="2.4"')
  };
  const spark = () => SCR.ui.SPARK;

  /* ---------------- role ---------------- */
  let pid = SCR.personas.stored();
  const persona = () => SCR.personas.byId(pid);

  /* ---------------- navigation: one stack per tab ---------------- */
  const stacks = {};
  let tab = 'today';
  let lastPlace = null;              // the screen the copilot treats as "here"
  const alertsState = { mine: true, sev: 'all' };
  const listState = { q: '', seg: 0 };
  const sim = { node: null, days: 30, sev: 100, type: null };
  const threads = {};

  const top = () => { const s = stacks[tab]; return s && s[s.length - 1]; };
  const tabKeys = () => ['today', persona().mobile.tab.key, 'alerts', 'simulate', 'ask'];

  function switchTab(key) {
    if (!tabKeys().includes(key)) key = 'today';
    const cur = top();
    if (cur) saveScroll(cur);
    if (tab === key && stacks[key]) {
      stacks[key] = [stacks[key][0]];   // tapping the active tab pops to its root
      tab = key; return render('fade');
    }
    tab = key;
    if (!stacks[key]) stacks[key] = [rootScreen(key)];
    render('fade');
  }
  function push(screen) {
    const cur = top();
    if (cur) saveScroll(cur);
    if (!stacks[tab]) stacks[tab] = [rootScreen(tab)];
    stacks[tab].push(screen);
    render('push');
  }
  function pop() {
    const s = stacks[tab];
    if (!s || s.length < 2) return;
    s.pop();
    render('pop');
  }
  /** Re-render the visible screen in place (data changed underneath it). */
  function refresh() {
    const cur = top();
    if (!cur) return;
    saveScroll(cur);
    render('none');
  }
  function pushOrRefresh(id) {
    const cur = top();
    if (cur && cur.id === id) return refresh();
    push(screenFor(id));
  }
  function saveScroll(scr) {
    const v = document.querySelector('#views .view:not(.leaving) .view-scroll');
    if (v && scr) scr.scrollY = v.scrollTop;
  }

  function rootScreen(key) {
    switch (key) {
      case 'today': return todayScreen();
      case 'alerts': return alertsScreen();
      case 'simulate': return simulateScreen();
      case 'ask': return askScreen();
      default: return screenFor(key);
    }
  }
  function screenFor(id) {
    switch (id) {
      case 'decisions': return decisionsScreen();
      case 'products': return productsScreen();
      case 'suppliers': return suppliersScreen();
      case 'sites': return sitesScreen();
      case 'actions': return actionsScreen();
      case 'quality': return qualityScreen();
      default: return todayScreen();
    }
  }

  /* ---------------- rendering ---------------- */
  function render(how) {
    const scr = top();
    const views = $('views');
    const prev = views.querySelector('.view:not(.leaving)');
    const stack = stacks[tab];
    const back = stack.length > 1 ? stack[stack.length - 2] : null;
    const v = el(`<section class="view ${scr.cls || ''}" data-screen="${scr.id}">
      <header class="nav-bar">
        ${back ? `<button class="nav-back" type="button" data-hint="m-back">${I.chevL}<span>${esc(back.short || back.title)}</span></button>` : '<span class="nav-spacer"></span>'}
        <span class="nav-title">${esc(scr.title)}</span>
        <span class="nav-trail"></span>
      </header>
      <div class="view-scroll"><div class="view-body"></div></div>
    </section>`);
    if (back) v.querySelector('.nav-back').addEventListener('click', pop);
    scr.build(v.querySelector('.view-body'), v);
    views.appendChild(v);
    // titles get the highlighter; fresh screens rise in, refreshed ones stay put
    if (SCR.motion) SCR.motion.decorate(v, { mode: 'mobile', animate: how !== 'none' });
    const sc = v.querySelector('.view-scroll');
    sc.addEventListener('scroll', () => v.classList.toggle('scrolled', sc.scrollTop > 40), { passive: true });
    if (scr.scrollY) { sc.scrollTop = scr.scrollY; v.classList.toggle('scrolled', sc.scrollTop > 40); }
    if (prev) {
      if (how === 'none') prev.remove();
      else {
        const anim = how === 'push' ? ['enter-push', 'leave-push'] : how === 'pop' ? ['enter-pop', 'leave-pop'] : ['enter-fade', 'leave-fade'];
        v.classList.add(anim[0]);
        prev.classList.add('leaving', anim[1]);
        setTimeout(() => prev.remove(), 460);
      }
    }
    applyContext(scr);
    syncTabbar();
    if (SCR.guide) SCR.guide.clear();
  }

  /** The copilot answers about where you are: the screen's web page and its entity. */
  function applyContext(scr) {
    if (scr.id === 'ask') return;          // asking keeps the context you came from
    lastPlace = scr;
    if (scr.key) SCR.ai.setRoute(scr.key, {});
    SCR.ai.setFocus(scr.entity || null);
  }

  /* ---------------- building blocks ---------------- */
  function head(title, sub, opts) {
    opts = opts || {};
    return `<div class="m-head">
      ${opts.eyebrow ? `<div class="m-eyebrow">${esc(opts.eyebrow)}</div>` : ''}
      <div class="m-title-row"><h1 class="m-large">${esc(title)}</h1>${opts.trail || ''}</div>
      ${sub ? `<p class="m-sub">${sub}</p>` : ''}
    </div>`;
  }
  function row(o) {
    return `<button class="m-row ${o.cls || ''}" type="button" ${o.attrs || ''}>
      ${o.lead || ''}
      <span class="m-row-main"><b>${o.title}</b>${o.sub ? `<small>${o.sub}</small>` : ''}</span>
      ${o.trail ? `<span class="m-row-trail">${o.trail}</span>` : ''}
      ${o.noChev ? '' : `<span class="m-chev">${I.chevR}</span>`}
    </button>`;
  }
  const dot = c => `<span class="m-dot" style="background:${c}"></span>`;
  const sevColor = { critical: 'var(--status-critical)', high: 'var(--status-serious)', medium: 'var(--status-warning)', low: 'var(--ink-4)' };
  function facts(list) {
    return `<div class="m-facts" data-hint="m-d-facts">${list.map(f =>
      `<div class="m-fact"><span>${esc(f.l)}</span><b class="${f.tone || ''}">${f.v}</b></div>`).join('')}</div>`;
  }
  function seg(options, active, hint) {
    return `<div class="m-seg" role="tablist" data-hint="${hint || 'm-seg'}">${options.map((o, i) =>
      `<button type="button" class="${i === active ? 'on' : ''}" data-seg="${i}">${esc(o)}</button>`).join('')}</div>`;
  }
  function bindSeg(body, fn) {
    body.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => fn(+b.dataset.seg)));
  }
  function sparkPath(vals, w, h) {
    const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
    const pts = vals.map((v, i) => [(i / (vals.length - 1)) * w, h - 3 - ((v - lo) / span) * (h - 6)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    return { line, area: line + ` L ${w} ${h} L 0 ${h} Z` };
  }
  function sparkSvg(vals, color) {
    const p = sparkPath(vals, 96, 38);
    const id = 'g' + Math.random().toString(36).slice(2, 7);
    return `<svg class="m-spark" viewBox="0 0 96 38" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".32"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${p.area}" fill="url(#${id})"/><path d="${p.line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  function btnRow(list) {
    return `<div class="m-btns">${list.filter(Boolean).map(b =>
      `<button type="button" class="m-btn ${b.primary ? 'primary' : ''}" data-act="${b.id}" ${b.hint ? `data-hint="${b.hint}"` : ''}>${b.icon || ''}<span>${esc(b.label)}</span></button>`).join('')}</div>`;
  }
  function bindBtns(body, map) {
    body.querySelectorAll('[data-act]').forEach(b => {
      const fn = map[b.dataset.act];
      if (fn) b.addEventListener('click', e => { e.stopPropagation(); fn(b); });
    });
  }
  function riTone(ri) { return ri < 60 ? 'bad' : ri >= 80 ? 'good' : ''; }

  /* ================= TODAY (role-specific) ================= */
  function heroFor(p) {
    const d = D(), f = F(), k = d.kpis;
    if (p.id === 'rrl') {
      return {
        label: 'Adjusted value at risk', value: usd(k.totalAVAR), sub: `of ${usd(k.totalVAR)} value at risk across ${k.products} products`,
        spark: sparkSvg(d.monthly.avar, p.color),
        stats: [{ l: 'Resilience', v: k.enterpriseRI + '%', s: f.signed(k.riDelta, ' pts') }, { l: 'Retired YTD', v: usd(k.mitigatedYtd), s: 'AVAR mitigated' }]
      };
    }
    if (p.id === 'vsl') {
      const exposed = d.products.filter(x => x.gapMax > 0);
      const fragile = d.products.slice().sort((a, b) => a.ri - b.ri)[0];
      return {
        label: 'SKUs exposed', value: `${exposed.length} <small>of ${d.products.length}</small>`, sub: 'have a component that recovers slower than it survives',
        spark: sparkSvg(d.monthly.ri, p.color),
        stats: [{ l: 'Most fragile', v: f.ri(fragile.ri), s: fragile.brand }, { l: 'Sales exposed', v: usd(exposed.reduce((a, x) => a + x.nts, 0)), s: 'NTS behind gaps' }]
      };
    }
    if (p.id === 'cat') {
      const risky = d.materials.filter(m => m.singleSource && m.score >= 2.8);
      const topSup = d.suppliers.slice().sort((a, b) => b.avar - a.avar)[0];
      const cover = Math.round((1 - d.materials.filter(m => m.singleSource).length / d.materials.length) * 100);
      return {
        label: 'Sole-sourced at risk', value: `${risky.length} <small>materials</small>`, sub: `carrying ${usd(+risky.reduce((a, m) => a + m.avar, 0).toFixed(1))} of adjusted value at risk`,
        spark: sparkSvg(topSup.trend, p.color),
        stats: [{ l: 'Top supplier', v: usd(topSup.avar), s: topSup.name.split(' ')[0] }, { l: 'Dual-sourced', v: cover + '%', s: 'of materials' }]
      };
    }
    const pt = d.plants.slice().sort((a, b) => a.ttsMin - b.ttsMin || b.criticalMats - a.criticalMats)[0];
    const tight = pt.materials.map(d.materialById).sort((a, b) => a.tts - b.tts)[0];
    const atRisk = d.plants.filter(x => x.criticalMats > 0).length;
    return {
      label: 'Runs out first', value: `${esc(pt.name.split(',')[0])} <small>· ${pt.ttsMin} days</small>`, sub: `cover on ${esc(lc(tight.name))}; ${pt.criticalMats} components can stop the site`,
      spark: sparkSvg(d.plants.map(x => x.ttsMin), p.color),
      stats: [{ l: 'Sites exposed', v: `${atRisk}/${d.plants.length}`, s: 'with stoppers' }, { l: 'Utilisation', v: pt.utilization + '%', s: pt.name.split(',')[0] }]
    };
  }

  function watchFor(p) {
    const d = D(), f = F();
    if (p.id === 'rrl') {
      return { title: 'Top risk nodes', items: d.nodes.slice().sort((a, b) => b.avar - a.avar).slice(0, 5).map(n => ({
        title: esc(n.name), sub: esc(n.type + ' · ' + n.sub), trail: `<b>${usd(n.avar)}</b><small>AVAR</small>`,
        go: () => openNode(n.id)
      })) };
    }
    if (p.id === 'vsl') {
      return { title: 'Fragile products', items: d.products.slice().sort((a, b) => a.ri - b.ri).slice(0, 5).map(x => ({
        title: esc(x.name), sub: esc(x.sectorName + ' · ' + x.stream), trail: `<b class="${riTone(x.ri)}">${f.ri(x.ri)}</b><small>RI</small>`,
        go: () => SCR.ui.openProduct(x.id)
      })) };
    }
    if (p.id === 'cat') {
      return { title: 'Suppliers to watch', items: d.suppliers.slice().sort((a, b) => b.avar - a.avar).slice(0, 5).map(s => ({
        title: esc(s.name), sub: esc(s.city + ', ' + s.country + ' · ' + s.catName), trail: `<b>${usd(s.avar)}</b><small>${esc(s.rating)}</small>`,
        go: () => SCR.ui.openSupplier(s.id)
      })) };
    }
    return { title: 'Sites by cover', items: d.plants.slice().sort((a, b) => a.ttsMin - b.ttsMin || b.criticalMats - a.criticalMats).slice(0, 5).map(x => ({
      title: esc(x.name), sub: esc(x.focus), trail: `<b class="${x.ttsMin < 10 ? 'bad' : ''}">${x.ttsMin}d</b><small>cover</small>`,
      go: () => SCR.ui.openSite(x.id)
    })) };
  }

  function quickFor(key) {
    const d = D();
    const pending = d.recommendations.filter(r => r.status === 'pending').length;
    const crit = d.alerts.filter(a => a.status !== 'closed' && a.sev === 'critical').length;
    const fragile = d.products.slice().sort((a, b) => a.ri - b.ri)[0];
    const topSup = d.suppliers.slice().sort((a, b) => b.avar - a.avar)[0];
    const pt = d.plants.slice().sort((a, b) => a.ttsMin - b.ttsMin || b.criticalMats - a.criticalMats)[0];
    const openActs = d.actions.filter(a => a.status !== 'Completed').length;
    const Q = {
      approvals: { icon: I.decisions, tone: '#fac400', label: 'Approvals', value: pending + ' waiting', go: () => SCR.navigate('agents') },
      brief: { icon: I.doc, tone: '#4c8dff', label: 'Daily brief', value: 'Draft it', go: () => ask('Draft the executive brief') },
      simulate: { icon: I.simulate, tone: '#34bfaf', label: 'Simulate', value: 'Run the twin', go: () => switchTab('simulate') },
      critical: { icon: I.warn, tone: '#ff5a4e', label: 'Critical alerts', value: crit + ' open', go: () => { alertsState.mine = false; alertsState.sev = 'critical'; stacks.alerts = null; switchTab('alerts'); } },
      breaks: { icon: I.bolt, tone: '#ffb347', label: 'What breaks first', value: fragile.brand, go: () => ask(`What breaks ${fragile.name} first?`) },
      gaps: { icon: I.clock, tone: '#ff5a4e', label: 'TTR > TTS', value: d.kpis.gapMaterials + ' components', go: () => ask('Which products have TTR > TTS?') },
      alerts: { icon: I.alerts, tone: '#ffb347', label: 'My alerts', value: myAlerts().length + ' open', go: () => { alertsState.mine = true; alertsState.sev = 'all'; stacks.alerts = null; switchTab('alerts'); } },
      plan: { icon: I.swap, tone: '#3cc47a', label: 'Plan alternates', value: d.kpis.singleSourceRisky + ' at risk', go: () => ask('Mitigation plan for single-source materials') },
      email: { icon: I.mail, tone: '#4c8dff', label: 'Supplier email', value: topSup.name.split(' ')[0], go: () => ask(`Draft an email to ${topSup.name}`) },
      single: { icon: I.link, tone: '#9a80f5', label: 'Sole sources', value: d.kpis.singleSourceCount + ' materials', go: () => ask('Which materials are single-sourced?') },
      actions: { icon: I.list, tone: '#3cc47a', label: 'Actions', value: openActs + ' in flight', go: () => SCR.navigate('actions') },
      outage: { icon: I.power, tone: '#ff5a4e', label: 'Rehearse outage', value: pt.name.split(',')[0], go: () => openSimulate(pt.id, { days: 21 }) },
      cover: { icon: I.gauge, tone: '#4c8dff', label: 'Shortest cover', value: pt.ttsMin + ' days', go: () => ask('Which plant has the shortest cover?') }
    };
    return Q[key];
  }

  function todayScreen() {
    return {
      id: 'today', title: 'Today', key: persona().home, short: 'Today',
      build(body) {
        const p = persona(), d = D();
        const date = new Date(d.asOf + 'T05:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
        const h = heroFor(p);
        const items = SCR.brief.itemsFor(p.id);
        const watch = watchFor(p);
        body.innerHTML = `
          ${head('Today', `${SCR.brief.greeting()}, ${esc(p.name)}`, {
            eyebrow: date,
            trail: `<button class="m-avatar" type="button" data-hint="m-avatar" style="--av:${p.color}">${esc(SCR.personas.initials(p.name))}</button>`
          })}
          <section class="m-card m-hero" data-hint="m-hero" style="--tone:${p.color}">
            <div class="chrome-field" aria-hidden="true"></div>
            <div class="m-hero-top">
              <div><span class="m-hero-label">${esc(h.label)}</span><div class="m-hero-value">${h.value}</div></div>
              ${h.spark}
            </div>
            <p class="m-hero-sub">${h.sub}</p>
            <div class="m-hero-stats">${h.stats.map(s => `<div><span>${esc(s.l)}</span><b>${s.v}</b><small>${esc(s.s)}</small></div>`).join('')}</div>
          </section>
          <section class="m-card m-brief ai-ring">
            <div class="m-brief-head" data-hint="m-brief"><span class="ai-mark">${spark()}</span><span><b>For you today</b><small>Ranked for the ${esc(p.name)}</small></span></div>
            <ol class="m-brief-list">${items.map((it, i) => `
              <li style="--tone:${it.tone}">
                <span class="ai-dot">${i + 1}</span>
                <div><span class="m-kicker">${esc(it.kicker)}</span><p>${it.html}</p>
                <button type="button" class="m-pill" data-brief="${i}">${esc(it.act.label)}</button></div>
              </li>`).join('')}
            </ol>
          </section>
          <h2 class="m-section">Shortcuts</h2>
          <div class="m-quick" data-hint="m-quick">${p.mobile.quick.map((qk, i) => {
            const q = quickFor(qk);
            return `<button type="button" class="m-tile" data-quick="${i}" style="--tone:${q.tone}"><span class="m-tile-ic">${q.icon}</span><b>${esc(q.label)}</b><small>${esc(q.value)}</small></button>`;
          }).join('')}</div>
          <h2 class="m-section">${esc(watch.title)}</h2>
          <div class="m-list" data-hint="m-watch">${watch.items.map((w, i) => row({ title: w.title, sub: w.sub, trail: w.trail, attrs: `data-watch="${i}"` })).join('')}</div>
          <button type="button" class="m-ask-cta" data-hint="m-ask-cta">${spark()}<span>Ask about today…</span></button>`;
        body.querySelector('.m-avatar').addEventListener('click', openRoleSheet);
        // live signals for this role, worst first, as a strip under the headline
        const heroEl = body.querySelector('.m-hero');
        if (SCR.motion && heroEl) {
          const sevC = { critical: 'var(--status-critical)', high: 'var(--status-serious)', medium: 'var(--status-warning)' };
          const rank = { critical: 0, high: 1, medium: 2, low: 3 };
          let sig = myAlerts();
          if (sig.length < 3) sig = d.alerts.filter(a => a.status !== 'closed');
          sig = sig.slice().sort((a, b) => (rank[a.sev] - rank[b.sev]) || (b.exposure - a.exposure)).slice(0, 6);
          const strip = SCR.motion.ticker(sig.map(a => ({
            html: `${esc(a.title.split(' — ')[0])}${a.exposure ? ` <b>${usd(a.exposure)}</b>` : ''}`,
            sev: sevC[a.sev] || 'var(--ink-4)',
            onClick: () => SCR.ui.openAlert(a.id)
          })), { label: 'Live', cls: 'm-ticker', speed: 5 });
          strip.setAttribute('data-hint', 'm-ticker');
          strip.setAttribute('data-hint-title', 'Live signals');
          strip.setAttribute('data-hint-body', 'Open alerts for this role, worst first, scrolling past. Tap one to open it.');
          heroEl.after(strip);
        }
        body.querySelectorAll('[data-brief]').forEach(b => b.addEventListener('click', () => items[+b.dataset.brief].act.run()));
        body.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => quickFor(p.mobile.quick[+b.dataset.quick]).go()));
        body.querySelectorAll('[data-watch]').forEach(b => b.addEventListener('click', () => watch.items[+b.dataset.watch].go()));
        body.querySelector('.m-ask-cta').addEventListener('click', () => switchTab('ask'));
      }
    };
  }

  /* ================= ROLE TABS ================= */
  function decisionsScreen() {
    return {
      id: 'decisions', title: 'Decisions', key: 'agents',
      build(body) {
        const d = D(), f = F();
        const ranked = SCR.work.rankRecommendations();
        const done = d.recommendations.filter(r => r.status !== 'pending');
        const segIx = listState.decSeg || 0;
        const protect = ranked.reduce((a, x) => a + x.protect, 0);
        body.innerHTML = `
          ${head('Decisions', ranked.length ? `${ranked.length} awaiting approval · protects about ${usd(+protect.toFixed(1))}` : 'Nothing waiting — every proposal is actioned')}
          ${seg(['Pending', 'Done'], segIx)}
          <div class="m-stack">${segIx === 0
            ? (ranked.map((x, i) => `
              <article class="m-card m-reco ${x.r.fresh ? 'fresh' : ''}" data-hint="m-reco">
                <div class="m-reco-top">${i === 0 ? '<span class="m-badge best">Best first</span>' : ''}<span class="m-badge">${esc(x.r.linked)}</span>${x.a ? `<span class="m-badge sev-${x.a.sev}">${esc(x.a.sev)}</span>` : ''}</div>
                <h3>${esc(x.r.title)}</h3>
                <div class="m-reco-meta"><div><span>Protects</span><b>${usd(+x.protect.toFixed(1))}</b></div><div><span>Cost</span><b>${usd(x.cost)}</b></div><div><span>Risk cut</span><b class="good">${esc(x.r.riskCut)}</b></div></div>
                <p class="m-fine">Approvers · ${esc(x.r.approvers)}</p>
                <div class="m-btns"><button type="button" class="m-btn primary" data-approve="${esc(x.r.id)}" data-hint="m-reco-approve">${I.check}<span>Approve</span></button>
                ${x.a ? `<button type="button" class="m-btn" data-alert="${esc(x.a.id)}"><span>Why</span></button>` : ''}</div>
              </article>`).join('') || '<p class="m-empty">The queue is empty.</p>')
            : (done.map(r => `<article class="m-card m-reco done"><div class="m-reco-top"><span class="m-badge ${r.status === 'approved' ? 'ok' : ''}">${esc(r.status)}</span>${r.actionId ? `<span class="m-badge">${esc(r.actionId)}</span>` : ''}</div><h3>${esc(r.title)}</h3></article>`).join('') || '<p class="m-empty">Nothing decided yet in this session.</p>')}
          </div>`;
        bindSeg(body, i => { listState.decSeg = i; refresh(); });
        body.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => {
          const r = d.recommendations.find(x => x.id === b.dataset.approve);
          const act = SCR.work.approve(r);
          island('Approved · ' + r.id, act ? `${act.id} is on the tracker — ${act.owner}, due ${act.due}` : '', 'good');
          refresh();
        }));
        body.querySelectorAll('[data-alert]').forEach(b => b.addEventListener('click', () => SCR.ui.openAlert(b.dataset.alert)));
      }
    };
  }

  function searchBox(placeholder) {
    return `<label class="m-search" data-hint="m-search">${I.search}<input type="search" placeholder="${esc(placeholder)}" value="${esc(listState.q)}" /></label>`;
  }
  function bindSearch(body, rerenderList) {
    const inp = body.querySelector('.m-search input');
    inp.addEventListener('input', () => { listState.q = inp.value; rerenderList(); });
  }

  function productsScreen() {
    return {
      id: 'products', title: 'Products', key: 'valuestream',
      build(body) {
        const d = D(), f = F();
        body.innerHTML = `${head('Products', `${d.kpis.gapProducts} of ${d.products.length} SKUs exposed through TTR &gt; TTS`)}
          ${searchBox('Search products or brands')}${seg(['All', 'Gapped', 'RI < 60'], listState.prodSeg || 0)}<div class="m-list m-results"></div>`;
        const draw = () => {
          const q = listState.q.toLowerCase();
          const s = listState.prodSeg || 0;
          const list = d.products.filter(x => (!q || (x.name + x.brand + x.stream).toLowerCase().includes(q)) &&
            (s === 0 || (s === 1 ? x.gapMax > 0 : x.ri < 60))).sort((a, b) => a.ri - b.ri);
          const box = body.querySelector('.m-results');
          box.innerHTML = list.map(x => row({ title: esc(x.name), sub: esc(`${x.sectorName} · AVAR ${usd(x.avar)}${x.gapMax > 0 ? ' · −' + x.gapMax + 'd gap' : ''}`),
            trail: `<b class="${riTone(x.ri)}">${f.ri(x.ri)}</b><small>RI</small>`, attrs: `data-id="${x.id}"` })).join('') || '<p class="m-empty">No products match.</p>';
          box.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => SCR.ui.openProduct(b.dataset.id)));
        };
        bindSearch(body, draw);
        bindSeg(body, i => { listState.prodSeg = i; refresh(); });
        draw();
      }
    };
  }

  function suppliersScreen() {
    return {
      id: 'suppliers', title: 'Suppliers', key: 'category',
      build(body) {
        const d = D();
        body.innerHTML = `${head('Suppliers', `${d.suppliers.length} suppliers · ${d.kpis.singleSourceCount} sole-sourced materials`)}
          ${searchBox('Search suppliers or cities')}${seg(['By AVAR', 'Sole source', 'Critical'], listState.supSeg || 0)}<div class="m-list m-results"></div>`;
        const draw = () => {
          const q = listState.q.toLowerCase();
          const s = listState.supSeg || 0;
          const list = d.suppliers.filter(x => (!q || (x.name + x.city + x.country + x.catName).toLowerCase().includes(q)) &&
            (s === 0 || (s === 1 ? x.singleCount > 0 : x.rating === 'Critical' || x.rating === 'High'))).sort((a, b) => b.avar - a.avar);
          const box = body.querySelector('.m-results');
          box.innerHTML = list.map(x => row({ title: esc(x.name), sub: esc(`${x.city}, ${x.country} · ${x.catName}${x.singleCount ? ' · sole source' : ''}`),
            trail: `<b>${usd(x.avar)}</b><small>${esc(x.rating)}</small>`, attrs: `data-id="${x.id}"` })).join('') || '<p class="m-empty">No suppliers match.</p>';
          box.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => SCR.ui.openSupplier(b.dataset.id)));
        };
        bindSearch(body, draw);
        bindSeg(body, i => { listState.supSeg = i; refresh(); });
        draw();
      }
    };
  }

  function sitesScreen() {
    return {
      id: 'sites', title: 'Sites', key: 'site',
      build(body) {
        const d = D(), f = F();
        const s = listState.siteSeg || 0;
        body.innerHTML = `${head('Sites', `${d.plants.length} plants · ${d.dcs.length} distribution centres`)}
          ${seg(['Plants', 'DCs'], s)}<div class="m-list">${s === 0
            ? d.plants.slice().sort((a, b) => a.ttsMin - b.ttsMin || b.criticalMats - a.criticalMats).map(x => row({
                title: esc(x.name), sub: esc(`${x.focus} · ${x.criticalMats} can stop it`),
                trail: `<b class="${x.ttsMin < 10 ? 'bad' : ''}">${x.ttsMin}d</b><small>cover</small>`, attrs: `data-id="${x.id}"` })).join('')
            : d.dcs.slice().sort((a, b) => b.avar - a.avar).map(x => row({
                title: esc(x.name), sub: esc(`${x.region} · ${x.marketsServed} markets`),
                trail: `<b class="${riTone(x.ri)}">${f.ri(x.ri)}</b><small>RI</small>`, attrs: `data-id="${x.id}"` })).join('')}
          </div>`;
        bindSeg(body, i => { listState.siteSeg = i; refresh(); });
        body.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => SCR.ui.openSite(b.dataset.id)));
      }
    };
  }

  /* ================= ALERTS ================= */
  function myAlerts() { const o = persona().owner; return D().alerts.filter(a => a.status !== 'closed' && a.owner === o); }

  function alertsScreen() {
    return {
      id: 'alerts', title: 'Alerts', key: 'actions',
      build(body) {
        const d = D(), p = persona();
        const rank = { critical: 0, high: 1, medium: 2, low: 3 };
        let list = d.alerts.filter(a => a.status !== 'closed' && (!alertsState.mine || a.owner === p.owner));
        if (alertsState.sev !== 'all') list = list.filter(a => a.sev === alertsState.sev);
        list.sort((a, b) => rank[a.sev] - rank[b.sev] || b.exposure - a.exposure);
        const exposure = +list.reduce((a, x) => a + x.exposure, 0).toFixed(1);
        body.innerHTML = `${head('Alerts', `${list.length} open · ${usd(exposure)} exposure${alertsState.mine ? ` · routed to the ${esc(p.owner)}` : ''}`)}
          ${seg(['Mine', 'All'], alertsState.mine ? 0 : 1, 'm-tab-alerts')}
          <div class="m-chips">${['all', 'critical', 'high', 'medium'].map(s => `<button type="button" class="m-chip ${alertsState.sev === s ? 'on' : ''}" data-sev="${s}">${s === 'all' ? 'Any severity' : s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
          <div class="m-list">${list.map(a => row({
            lead: dot(sevColor[a.sev]), title: esc(a.title), sub: esc(`${a.id} · ${a.type} · ${a.time}`),
            trail: a.exposure ? `<b>${usd(a.exposure)}</b><small>${esc(a.status)}</small>` : `<small>${esc(a.status)}</small>`,
            attrs: `data-id="${a.id}" data-hint="m-alert-row"`
          })).join('') || `<p class="m-empty">${alertsState.mine ? 'Nothing routed to you right now. Switch to All for the whole inbox.' : 'No open alerts.'}</p>`}</div>`;
        bindSeg(body, i => { alertsState.mine = i === 0; refresh(); });
        body.querySelectorAll('[data-sev]').forEach(b => b.addEventListener('click', () => { alertsState.sev = b.dataset.sev; refresh(); }));
        body.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => SCR.ui.openAlert(b.dataset.id)));
      }
    };
  }

  /* ================= DETAIL SCREENS ================= */
  function dimBars(dims) {
    const N = { fin: 'Financial', qual: 'Quality', rel: 'Reliability', geo: 'Geopolitical', cyb: 'Cyber', clim: 'Climate' };
    return `<div class="m-card m-bars">${Object.keys(dims).map(k => {
      const v = dims[k];
      return `<div class="m-bar"><span>${N[k]}</span><i><u style="width:${v / 5 * 100}%;background:${SCR.risk.scoreColor(v)}"></u></i><b>${v.toFixed(1)}</b></div>`;
    }).join('')}</div>`;
  }

  function supplierScreen(id) {
    const s = D().supplierById(id);
    return {
      id: 'supplier:' + id, title: s.name, short: s.name.split(' ')[0], key: lastPlace ? lastPlace.key : 'category',
      entity: { type: 'supplier', id: s.id, name: s.name, ref: s },
      build(body) {
        const d = D(), f = F();
        const mats = d.materialsOf(s.id);
        const al = d.alerts.filter(a => a.nodes.includes(s.id) && a.status !== 'closed');
        body.innerHTML = `${head(s.name, `${esc(s.city)}, ${esc(s.country)} · tier ${s.tier} ${esc(lc(s.catName))}`, { trail: `<span class="badge ${SCR.risk.ratingClass(s.rating)}">${esc(s.rating)}</span>` })}
          ${facts([{ l: 'AVAR', v: usd(s.avar), tone: 'bad' }, { l: 'Value at risk', v: usd(s.var) }, { l: 'Sales linked', v: usd(s.depNTS) },
            { l: 'Recovery', v: s.ttr + 'd' }, { l: 'Resilience', v: f.ri(s.ri), tone: riTone(s.ri) }, { l: 'Risk score', v: s.score.toFixed(2) }])}
          ${btnRow([{ id: 'sim', label: 'Simulate failure', icon: I.simulate, primary: true, hint: 'm-d-sim' }, { id: 'act', label: 'Create action', icon: I.list, hint: 'm-d-act' },
            { id: 'mail', label: 'Draft email', icon: I.mail, hint: 'm-d-email' }, { id: 'ask', label: 'Ask', icon: spark(), hint: 'm-d-ask' }])}
          ${al.length ? `<h2 class="m-section">Open alerts</h2><div class="m-list">${al.map(a => row({ lead: dot(sevColor[a.sev]), title: esc(a.title), sub: esc(a.id + ' · ' + a.type), attrs: `data-al="${a.id}"` })).join('')}</div>` : ''}
          <h2 class="m-section">Risk drivers</h2>${dimBars(s.dims)}
          <h2 class="m-section">Materials supplied</h2>
          <div class="m-list">${mats.map(m => row({ title: esc(m.name), sub: esc(`${m.tts}d cover · ${m.ttr}d to recover${m.singleSource ? ' · single source' : ''}`),
            trail: m.gap > 0 ? `<b class="bad">−${m.gap}d</b><small>gap</small>` : `<b class="good">OK</b>`, attrs: `data-mat="${m.id}"` })).join('')}</div>`;
        bindBtns(body, {
          sim: () => openSimulate(s.id, { days: 30 }),
          act: () => SCR.work.openSheet({ type: 'supplier', id: s.id }),
          mail: () => ask(`Draft an email to ${s.name}`),
          ask: () => ask(`Why is ${s.name} critical?`)
        });
        body.querySelectorAll('[data-al]').forEach(b => b.addEventListener('click', () => SCR.ui.openAlert(b.dataset.al)));
        body.querySelectorAll('[data-mat]').forEach(b => b.addEventListener('click', () => SCR.ui.openMaterial(b.dataset.mat)));
      }
    };
  }

  function materialScreen(id) {
    const m = D().materialById(id);
    return {
      id: 'material:' + id, title: m.name, short: m.name.split(' ')[0], key: lastPlace ? lastPlace.key : 'category',
      entity: { type: 'material', id: m.id, name: m.name, ref: m },
      build(body) {
        const d = D(), f = F();
        const sups = m.suppliers.map(d.supplierById);
        const prods = d.productsUsing(m.id);
        body.innerHTML = `${head(m.name, `${esc(lc(m.catName))} · ${esc(lc(m.sub))}${m.singleSource ? ' · <b class="bad">single source</b>' : ''}`)}
          ${facts([{ l: 'Cover (TTS)', v: m.tts + 'd' }, { l: 'Recover (TTR)', v: m.ttr + 'd' }, { l: 'Gap', v: m.gap > 0 ? '−' + m.gap + 'd' : 'none', tone: m.gap > 0 ? 'bad' : 'good' },
            { l: 'Value at risk', v: usd(m.var) }, { l: 'AVAR', v: usd(m.avar) }, { l: 'P(disruption)', v: Math.round(m.prob * 100) + '%' }])}
          ${btnRow([{ id: 'act', label: m.singleSource ? 'Plan alternate' : 'Create action', icon: I.list, primary: true, hint: 'm-d-act' },
            { id: 'who', label: 'Who else?', icon: spark(), hint: 'm-d-ask' }, { id: 'sim', label: 'Simulate supplier', icon: I.simulate, hint: 'm-d-sim' }])}
          <div class="m-card m-note"><b>Substitution</b><p>${esc(m.substitution)}</p></div>
          <h2 class="m-section">Suppliers</h2>
          <div class="m-list">${sups.map(s => row({ title: esc(s.name), sub: esc(`${s.city}, ${s.country}`), trail: `<b>${s.score.toFixed(2)}</b><small>${esc(s.rating)}</small>`, attrs: `data-sup="${s.id}"` })).join('')}</div>
          <h2 class="m-section">Products using it</h2>
          <div class="m-list">${prods.map(x => row({ title: esc(x.name), sub: esc(x.sectorName), trail: `<b class="${riTone(x.ri)}">${f.ri(x.ri)}</b><small>RI</small>`, attrs: `data-prod="${x.id}"` })).join('')}</div>`;
        bindBtns(body, {
          act: () => SCR.work.openSheet({ type: 'material', id: m.id }),
          who: () => ask(`Who else can supply ${lc(m.name)}?`),
          sim: () => openSimulate(m.suppliers[0], { days: 30 })
        });
        body.querySelectorAll('[data-sup]').forEach(b => b.addEventListener('click', () => SCR.ui.openSupplier(b.dataset.sup)));
        body.querySelectorAll('[data-prod]').forEach(b => b.addEventListener('click', () => SCR.ui.openProduct(b.dataset.prod)));
      }
    };
  }

  function productScreen(id) {
    const x = D().productById(id);
    return {
      id: 'product:' + id, title: x.name, short: x.brand, key: lastPlace ? lastPlace.key : 'valuestream',
      entity: { type: 'product', id: x.id, name: x.name, ref: x },
      build(body) {
        const d = D(), f = F();
        const mats = x.materials.map(d.materialById).sort((a, b) => b.gap - a.gap);
        const max = Math.max(...mats.map(m => Math.max(m.tts, m.ttr)), 1);
        const binding = mats.find(m => m.gap > 0) || mats[0];
        body.innerHTML = `${head(x.name, `${esc(x.sectorName)} · ${esc(x.stream)} · growing ${f.signed(x.growth, '%')}`)}
          ${facts([{ l: 'NTS', v: usd(x.nts) }, { l: 'AVAR', v: usd(x.avar), tone: 'bad' }, { l: 'Resilience', v: f.ri(x.ri), tone: riTone(x.ri) },
            { l: 'Worst gap', v: x.gapMax > 0 ? x.gapMax + 'd' : 'none', tone: x.gapMax > 0 ? 'bad' : 'good' }, { l: 'Short of cover', v: `${x.gapCount}/${x.materials.length}` }, { l: 'Margin', v: f.pct(x.margin) }])}
          ${btnRow([{ id: 'breaks', label: 'What breaks first', icon: spark(), primary: true, hint: 'm-d-ask' }, { id: 'act', label: 'Create action', icon: I.list, hint: 'm-d-act' },
            { id: 'sim', label: 'Simulate supplier', icon: I.simulate, hint: 'm-d-sim' }])}
          <h2 class="m-section">Components · cover vs recovery</h2>
          <div class="m-card m-gaps">${mats.map(m => `<button type="button" class="m-gap" data-mat="${m.id}">
              <span class="m-gap-name">${esc(m.name)}</span>
              <span class="m-gap-track"><i class="tts" style="width:${m.tts / max * 100}%"></i><i class="ttr" style="width:${m.ttr / max * 100}%"></i></span>
              <b class="${m.gap > 0 ? 'bad' : 'good'}">${m.gap > 0 ? '−' + m.gap + 'd' : '+' + -m.gap + 'd'}</b></button>`).join('')}
            <div class="m-gap-legend"><span><i class="tts"></i>Cover (TTS)</span><span><i class="ttr"></i>Recovery (TTR)</span></div>
          </div>`;
        bindBtns(body, {
          breaks: () => ask(`What breaks ${x.name} first?`),
          act: () => SCR.work.openSheet({ type: 'product', id: x.id }),
          sim: () => openSimulate(binding.suppliers[0], { days: 30 })
        });
        body.querySelectorAll('[data-mat]').forEach(b => b.addEventListener('click', () => SCR.ui.openMaterial(b.dataset.mat)));
      }
    };
  }

  function siteScreen(id) {
    const isPlant = /^PT/.test(id);
    const site = isPlant ? D().plantById(id) : D().dcById(id);
    return {
      id: 'site:' + id, title: site.name, short: site.name.split(/[ ,]/)[0], key: lastPlace ? lastPlace.key : 'site',
      entity: { type: isPlant ? 'plant' : 'dc', id: site.id, name: site.name, ref: site },
      build(body) {
        const d = D(), f = F();
        if (!isPlant) {
          body.innerHTML = `${head(site.name, `${esc(site.region)} distribution · ${site.marketsServed} markets`)}
            ${facts([{ l: 'NTS served', v: usd(site.nts) }, { l: 'AVAR', v: usd(site.avar), tone: 'bad' }, { l: 'Resilience', v: f.ri(site.ri), tone: riTone(site.ri) },
              { l: 'Recovery', v: site.ttr + 'd' }, { l: 'SKUs', v: site.products.length }, { l: 'Markets', v: site.marketsServed }])}
            ${btnRow([{ id: 'sim', label: 'Simulate disruption', icon: I.simulate, primary: true, hint: 'm-d-sim' }, { id: 'act', label: 'Create action', icon: I.list, hint: 'm-d-act' }])}
            <h2 class="m-section">Markets served</h2>
            <div class="m-list">${site.markets.map(mk => { const m = d.marketById(mk); return row({ title: esc(m.name), sub: esc(m.region), trail: `<b>${usd(m.nts)}</b><small>NTS</small>`, noChev: true }); }).join('')}</div>`;
          bindBtns(body, { sim: () => openSimulate(site.id, { days: 14 }), act: () => SCR.work.openSheet({ type: 'dc', id: site.id }) });
          return;
        }
        const stoppers = site.materials.map(d.materialById).filter(m => m.gap > 0).sort((a, b) => a.tts - b.tts);
        const max = Math.max(...stoppers.map(m => m.ttr), 1);
        body.innerHTML = `${head(site.name, `${esc(site.focus)} · ${site.markets} markets`)}
          ${facts([{ l: 'NTS served', v: usd(site.nts) }, { l: 'Resilience', v: f.ri(site.ri), tone: riTone(site.ri) }, { l: 'Min cover', v: site.ttsMin + 'd', tone: site.ttsMin < 10 ? 'bad' : '' },
            { l: 'Can stop it', v: site.criticalMats, tone: site.criticalMats ? 'bad' : 'good' }, { l: 'Utilisation', v: site.utilization + '%' }, { l: 'Site recovery', v: site.ttr + 'd' }])}
          ${btnRow([{ id: 'sim', label: 'Simulate outage', icon: I.power, primary: true, hint: 'm-d-sim' }, { id: 'act', label: 'Create action', icon: I.list, hint: 'm-d-act' },
            { id: 'ask', label: 'Ask', icon: spark(), hint: 'm-d-ask' }])}
          <h2 class="m-section">What can stop this site</h2>
          ${stoppers.length ? `<div class="m-card m-gaps">${stoppers.map(m => `<button type="button" class="m-gap" data-mat="${m.id}">
              <span class="m-gap-name">${esc(m.name)}</span>
              <span class="m-gap-track"><i class="tts" style="width:${m.tts / max * 100}%"></i><i class="ttr" style="width:${m.ttr / max * 100}%"></i></span>
              <b class="bad">${m.tts}d</b></button>`).join('')}
              <div class="m-gap-legend"><span><i class="tts"></i>Cover (TTS)</span><span><i class="ttr"></i>Recovery (TTR)</span></div></div>`
            : '<p class="m-empty">Every inbound component has cover beyond its recovery time.</p>'}`;
        bindBtns(body, {
          sim: () => openSimulate(site.id, { days: 21 }),
          act: () => SCR.work.openSheet({ type: 'plant', id: site.id }),
          ask: () => ask(`Status of ${site.name.split(',')[0]}`)
        });
        body.querySelectorAll('[data-mat]').forEach(b => b.addEventListener('click', () => SCR.ui.openMaterial(b.dataset.mat)));
      }
    };
  }

  function alertScreen(id) {
    const a = D().alertById(id);
    return {
      id: 'alert:' + id, title: a.id, short: a.id, key: 'actions',
      entity: { type: 'alert', id: a.id, name: a.id + ' · ' + a.type, ref: a },
      build(body) {
        const d = D();
        const sups = a.nodes.map(d.supplierById).filter(Boolean);
        const mats = (a.mats || []).map(d.materialById).filter(Boolean);
        const acts = d.actions.filter(x => x.linked === a.id);
        const reco = d.recommendations.find(r => r.linked === a.id && r.status === 'pending');
        const skus = new Set(); mats.forEach(m => d.productsUsing(m.id).forEach(p => skus.add(p.id)));
        body.innerHTML = `${head(a.type, esc(a.title), { eyebrow: `${a.id} · ${a.sev} · ${a.status}` })}
          ${facts([{ l: 'Exposure', v: usd(a.exposure), tone: 'bad' }, { l: 'SKUs at risk', v: skus.size }, { l: 'Owner', v: esc(a.owner) }])}
          ${btnRow([
            a.status === 'open' ? { id: 'ack', label: 'Acknowledge', icon: I.check, hint: 'm-al-ack' } : null,
            a.status !== 'assigned' && a.status !== 'closed' ? { id: 'assign', label: 'Assign', icon: I.list, hint: 'm-al-assign' } : null,
            { id: 'act', label: 'Create action', icon: I.list, primary: true, hint: 'm-al-act' },
            { id: 'ask', label: 'How to resolve', icon: spark(), hint: 'm-al-ask' }])}
          <div class="m-card m-note"><b>What the agents found</b><p>${esc(a.detail)}</p></div>
          ${reco ? `<h2 class="m-section">Waiting for approval</h2><article class="m-card m-reco"><h3>${esc(reco.title)}</h3>
            <div class="m-reco-meta"><div><span>Protects</span><b>${usd(reco.exposure)}</b></div><div><span>Cost</span><b>${esc(reco.cost.replace(/^\+/, ''))}</b></div><div><span>Risk cut</span><b class="good">${esc(reco.riskCut)}</b></div></div>
            <div class="m-btns"><button type="button" class="m-btn primary" data-approve="${esc(reco.id)}" data-hint="m-reco-approve">${I.check}<span>Approve ${esc(reco.id)}</span></button></div></article>` : ''}
          ${sups.length ? `<h2 class="m-section">Impacted suppliers</h2><div class="m-list">${sups.map(s => row({ title: esc(s.name), sub: esc(`${s.city}, ${s.country}`), trail: `<b>${usd(s.avar)}</b><small>AVAR</small>`, attrs: `data-sup="${s.id}"` })).join('')}</div>` : ''}
          ${mats.length ? `<h2 class="m-section">Impacted materials</h2><div class="m-list">${mats.map(m => row({ title: esc(m.name), sub: esc(`${m.tts}d cover · ${m.ttr}d to recover`), attrs: `data-mat="${m.id}"` })).join('')}</div>` : ''}
          ${acts.length ? `<h2 class="m-section">Actions in flight</h2><div class="m-list">${acts.map(x => row({ title: esc(x.title), sub: esc(`${x.id} · ${x.owner} · due ${x.due}`), trail: `<small>${esc(x.status)}</small>`, noChev: true })).join('')}</div>` : ''}`;
        bindBtns(body, {
          ack: () => { a.status = 'ack'; island('Acknowledged', `${a.id} marked as seen`, 'good'); refresh(); },
          assign: () => { a.status = 'assigned'; island('Assigned', `${a.id} routed to the ${a.owner}`, 'good'); refresh(); },
          act: () => SCR.work.openSheet({ type: 'alert', id: a.id }),
          ask: () => ask(`How do I resolve ${a.id}?`)
        });
        body.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => {
          const act = SCR.work.approve(reco);
          island('Approved · ' + reco.id, act ? `${act.id} is on the tracker — ${act.owner}, due ${act.due}` : '', 'good');
          refresh();
        }));
        body.querySelectorAll('[data-sup]').forEach(b => b.addEventListener('click', () => SCR.ui.openSupplier(b.dataset.sup)));
        body.querySelectorAll('[data-mat]').forEach(b => b.addEventListener('click', () => SCR.ui.openMaterial(b.dataset.mat)));
      }
    };
  }

  function actionsScreen() {
    return {
      id: 'actions', title: 'Actions', key: 'actions',
      build(body) {
        const d = D();
        const s = listState.actSeg || 0;
        const list = d.actions.filter(x => s === 0 ? x.status !== 'Completed' : s === 1 ? x.status === 'Overdue' : true);
        body.innerHTML = `${head('Actions', `${d.kpis.openActions} in flight · ${d.kpis.overdueActions} overdue`)}
          ${seg(['In flight', 'Overdue', 'All'], s)}
          <div class="m-list">${list.map(x => row({
            lead: dot(x.status === 'Overdue' ? 'var(--status-critical)' : x.fresh ? 'var(--accent)' : 'var(--status-good)'),
            title: esc(x.title), sub: esc(`${x.id} · ${x.owner} · due ${x.due}`),
            trail: x.riskCut ? `<b class="good">−${usd(x.riskCut)}</b><small>${esc(x.status)}</small>` : `<small>${esc(x.status)}</small>`,
            attrs: `data-al="${esc(x.linked)}"`, cls: x.fresh ? 'fresh' : ''
          })).join('') || '<p class="m-empty">Nothing here.</p>'}</div>`;
        bindSeg(body, i => { listState.actSeg = i; refresh(); });
        body.querySelectorAll('[data-al]').forEach(b => b.addEventListener('click', () => { if (D().alertById(b.dataset.al)) SCR.ui.openAlert(b.dataset.al); }));
      }
    };
  }

  function qualityScreen() {
    return {
      id: 'quality', title: 'Data quality', key: 'quality',
      build(body) {
        const dq = D().dataQuality;
        body.innerHTML = `${head('Data quality', `${dq.missingTTR} components missing TTR · ${dq.missingRRE} missing RRE`)}
          <div class="m-card m-bars">${dq.domains.map(x => `<div class="m-bar"><span>${esc(x.name)}</span><i><u style="width:${x.pct}%;background:${x.pct >= 95 ? 'var(--status-good)' : x.pct >= 88 ? 'var(--status-warning)' : 'var(--status-critical)'}"></u></i><b>${x.pct}%</b></div>`).join('')}</div>
          <h2 class="m-section">Worklist</h2>
          <div class="m-list">${dq.worklist.map(w => row({ title: esc(w.item), sub: esc(`${w.gap} · ${w.owner} · due ${w.due}`), noChev: true })).join('')}</div>`;
      }
    };
  }

  /* ================= SIMULATE ================= */
  function defaultNode() {
    const d = D(), p = persona();
    if (p.id === 'site') return d.plants.slice().sort((a, b) => a.ttsMin - b.ttsMin || b.criticalMats - a.criticalMats)[0].id;
    if (p.id === 'vsl') {
      const fragile = d.products.slice().sort((a, b) => a.ri - b.ri)[0];
      const b = fragile.materials.map(d.materialById).sort((x, y) => (y.gap > 0) - (x.gap > 0) || y.gap - x.gap)[0];
      return b.suppliers[0];
    }
    return d.suppliers.slice().sort((a, b) => b.avar - a.avar)[0].id;
  }
  const typeFor = id => /^PT/.test(id) ? 'Plant outage' : /^DC/.test(id) ? 'Port / lane disruption' : 'Supplier failure';

  function openSimulate(nodeId, opts) {
    opts = opts || {};
    if (nodeId) { sim.node = nodeId; sim.type = opts.type || typeFor(nodeId); }
    if (opts.days != null) sim.days = opts.days;
    if (opts.sev != null) sim.sev = opts.sev;
    stacks.simulate = null;
    switchTab('simulate');
  }

  function simulateScreen() {
    return {
      id: 'simulate', title: 'Simulate', key: 'scenario', cls: 'v-sim',
      get entity() { return SCR.ai.nodeEntity(sim.node || defaultNode()); },
      build(body) {
        if (!sim.node) { sim.node = defaultNode(); sim.type = typeFor(sim.node); }
        const node = SCR.ai.nodeEntity(sim.node);
        body.innerHTML = `${head('Simulate', 'Fail a node on the digital twin — the same engine as the Scenario Studio')}
          <button type="button" class="m-card m-node" data-hint="m-sim-node">
            <span class="m-node-ic">${node.type === 'supplier' ? I.suppliers : node.type === 'plant' ? I.sites : I.products}</span>
            <span class="m-row-main"><small>${esc(SCR.ai.TYPE_LABEL[node.type])}</small><b>${esc(node.name)}</b></span>
            <span class="m-node-change">Change ${I.chevR}</span>
          </button>
          <div class="m-chips m-scroll-x" data-hint="m-sim-type">${SCR.scenario.TYPES.map(t => `<button type="button" class="m-chip ${sim.type === t ? 'on' : ''}" data-type="${esc(t)}">${esc(t)}</button>`).join('')}</div>
          <div class="m-card m-sliders">
            <label data-hint="m-sim-days"><span>Duration <b id="mDays">${sim.days} days</b></span><input type="range" min="7" max="90" step="1" value="${sim.days}" id="mDaysIn" /></label>
            <label data-hint="m-sim-sev"><span>Severity <b id="mSev">${sim.sev}%</b></span><input type="range" min="25" max="100" step="5" value="${sim.sev}" id="mSevIn" /></label>
          </div>
          <div class="m-sim-out"></div>
          <h2 class="m-section">Presets</h2>
          <div class="m-chips">${SCR.scenario.PRESETS.map((pr, i) => `<button type="button" class="m-chip" data-preset="${i}">${esc(pr.label)}</button>`).join('')}</div>`;
        const out = body.querySelector('.m-sim-out');
        const draw = () => { out.innerHTML = ''; out.appendChild(simResult()); };
        body.querySelector('.m-node').addEventListener('click', openNodePicker);
        body.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => { sim.type = b.dataset.type; body.querySelectorAll('[data-type]').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
        let raf = 0;
        const bindRange = (id, key, lbl, suffix) => {
          const inp = body.querySelector(id);
          inp.addEventListener('input', () => {
            sim[key] = +inp.value;
            body.querySelector(lbl).textContent = sim[key] + suffix;
            cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
          });
        };
        bindRange('#mDaysIn', 'days', '#mDays', ' days');
        bindRange('#mSevIn', 'sev', '#mSev', '%');
        body.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
          const pr = SCR.scenario.PRESETS[+b.dataset.preset];
          Object.assign(sim, { node: pr.node, days: pr.days, sev: pr.sev, type: pr.type });
          refresh();
        }));
        draw();
      }
    };
  }

  function simResult() {
    const f = F(), k = D().kpis;
    SCR.scenario.setState({ node: sim.node, days: sim.days, sev: sim.sev, type: sim.type });
    const r = SCR.scenario.simulate(sim.node, { days: sim.days, sev: sim.sev, type: sim.type });
    const best = r.opts[0];
    const durations = [7, 14, 30, 45, 60, 90];
    if (!durations.includes(sim.days)) durations.push(sim.days);
    durations.sort((a, b) => a - b);
    const sens = durations.map(dd => ({ dd, v: SCR.scenario.simulate(sim.node, { days: dd, sev: sim.sev, type: sim.type }).atRisk }));
    const max = Math.max(...sens.map(x => x.v), 0.1);
    const bm = r.bindingMat;
    const node = el(`<div class="m-stack">
      <section class="m-card m-result" data-hint="m-sim-result">
        <p class="m-result-lead">A <b>${sim.days}-day ${esc(lc(sim.type))}</b> at <b>${esc(r.node.name)}</b>${sim.sev < 100 ? ` at ${sim.sev}% severity` : ''} leaves <b class="bad">${usd(r.atRisk)}</b> of sales at risk.</p>
        <div class="m-facts">${[
          { l: 'In the path', v: usd(r.exposed) }, { l: 'Absorbed', v: usd(r.covered), tone: 'good' },
          { l: 'At risk', v: usd(r.atRisk), tone: 'bad' }, { l: 'Enterprise RI', v: `${k.enterpriseRI}→${r.riNew}%`, tone: r.riNew < k.enterpriseRI ? 'bad' : '' }
        ].map(x => `<div class="m-fact"><span>${esc(x.l)}</span><b class="${x.tone || ''}">${x.v}</b></div>`).join('')}</div>
        ${bm && /^S/.test(r.node.id) ? `<p class="m-fine">Binding constraint: <b>${esc(bm.name)}</b> — ${bm.tts} days of cover against a ${sim.days}-day outage.</p>` : ''}
        ${r.rows.length ? `<p class="m-fine">Hit hardest: ${r.rows.slice(0, 3).map(x => `${esc(x.p.name)} (${usd(+x.loss.toFixed(1))})`).join(', ')}.</p>` : '<p class="m-fine">No SKU loses sales — cover outlasts this disruption.</p>'}
      </section>
      ${best && r.atRisk > 0 ? `<section class="m-card m-plan">
        <span class="m-kicker" style="color:var(--status-good)">Best plan</span>
        <h3>${esc(best.name)}</h3>
        <p class="m-fine">Removes ${Math.round(best.cut * 100)}% (${usd(+(r.atRisk * best.cut).toFixed(1))}) for ${usd(best.cost)}, effective in ${esc(best.time)}. Residual ${usd(r.residual)}.</p>
        <div class="m-btns"><button type="button" class="m-btn primary" data-plan data-hint="m-sim-act">${I.list}<span>Create action from best plan</span></button>
        <button type="button" class="m-btn" data-explain>${spark()}<span>Explain</span></button></div>
      </section>` : ''}
      <section class="m-card" data-hint="m-sim-sens">
        <span class="m-kicker">Sales at risk by outage length</span>
        <div class="ans-bars">${sens.map(x => `<div class="ans-bar ${x.dd === sim.days ? 'cur' : ''}"><span>${x.dd}d</span><i style="width:${Math.max(1.5, x.v / max * 100)}%"></i><b>${x.v < 0.05 ? 'none' : usd(+x.v.toFixed(1))}</b></div>`).join('')}</div>
      </section>
    </div>`);
    const plan = node.querySelector('[data-plan]');
    if (plan) plan.addEventListener('click', () => SCR.work.openSheet({ type: 'scenario', result: Object.assign({}, r, { days: sim.days, sev: sim.sev, type: sim.type }), option: best }));
    const exp = node.querySelector('[data-explain]');
    if (exp) exp.addEventListener('click', () => ask('Explain this scenario'));
    // keep the copilot's "this" in step with the slider
    SCR.ai.setFocus(SCR.ai.nodeEntity(sim.node));
    return node;
  }

  function openNodePicker() {
    const d = D();
    const groups = [
      ['Suppliers', d.suppliers.slice().sort((a, b) => b.avar - a.avar).map(s => ({ id: s.id, name: s.name, sub: `${s.city}, ${s.country} · ${usd(s.avar)} AVAR` }))],
      ['Plants', d.plants.map(x => ({ id: x.id, name: x.name, sub: `${x.focus} · ${x.ttsMin}d min cover` }))],
      ['Distribution centres', d.dcs.map(x => ({ id: x.id, name: x.name, sub: `${x.region} · ${x.marketsServed} markets` }))]
    ];
    openSheet({
      title: 'Choose a node', className: 'tall',
      build(body) {
        body.innerHTML = `<label class="m-search">${I.search}<input type="search" placeholder="Search suppliers, plants, DCs" /></label><div class="m-picker"></div>`;
        const box = body.querySelector('.m-picker');
        const draw = q => {
          q = (q || '').toLowerCase();
          box.innerHTML = groups.map(([g, items]) => {
            const hits = items.filter(x => !q || (x.name + x.sub).toLowerCase().includes(q));
            return hits.length ? `<h2 class="m-section">${g}</h2><div class="m-list">${hits.map(x => row({
              title: esc(x.name), sub: esc(x.sub), attrs: `data-node="${x.id}"`, noChev: true,
              trail: x.id === sim.node ? `<span class="m-check">${I.check}</span>` : ''
            })).join('')}</div>` : '';
          }).join('') || '<p class="m-empty">No nodes match.</p>';
          box.querySelectorAll('[data-node]').forEach(b => b.addEventListener('click', () => {
            sim.node = b.dataset.node; sim.type = typeFor(sim.node);
            closeSheet(); refresh();
          }));
        };
        const inp = body.querySelector('input');
        inp.addEventListener('input', () => draw(inp.value));
        draw('');
      }
    });
  }

  /* ================= ASK ================= */
  function thread() {
    if (!threads[pid]) {
      threads[pid] = el('<div class="ask-thread"></div>');
      const p = persona(), d = D();
      threads[pid].appendChild(renderAnswer({
        tag: 'Resilience Copilot',
        html: `<p>${SCR.brief.greeting()}, ${esc(p.name)}. I watch <strong>${d.nodes.length} nodes</strong> and <strong>${d.products.length} products</strong> — ${usd(d.kpis.totalVAR)} of value at risk right now.</p>
          <p>I follow what you open, so you can ask about <em>this</em> without naming it. I can run what-ifs, create actions and draft emails.</p>`
      }));
    }
    return threads[pid];
  }

  function factsHtml(list) {
    if (!list || !list.length) return '';
    return `<div class="ans-facts">${list.map(f => `<div class="ans-fact"><div class="af-l">${esc(f.l)}</div><div class="af-v ${f.tone || ''}">${f.v}</div></div>`).join('')}</div>`;
  }
  function workingHtml(lines) {
    if (!lines || !lines.length) return '';
    return `<details class="working"><summary>Show working</summary><ol>${lines.map(l => `<li>${l}</li>`).join('')}</ol></details>`;
  }
  function renderAnswer(a) {
    const node = el(`<div class="msg bot">
      <span class="agent-tag"><i></i>${esc(a.tag || 'Resilience Copilot')}</span>
      <div class="bubble">${a.lead || ''}${a.lead ? factsHtml(a.facts) : ''}${a.html || ''}${a.lead ? '' : factsHtml(a.facts)}${a.tail || ''}${workingHtml(a.working)}</div>
    </div>`);
    if (a.actions && a.actions.filter(Boolean).length) {
      const rowEl = el('<div class="msg-actions"></div>');
      a.actions.filter(Boolean).forEach(ac => {
        const b = el(`<button type="button" class="chip ${ac.primary ? 'primary' : ''}">${esc(ac.label)}</button>`);
        b.addEventListener('click', () => ac.go(b));
        rowEl.appendChild(b);
      });
      node.appendChild(rowEl);
    }
    if (a.followUps && a.followUps.filter(Boolean).length) {
      const rowEl = el('<div class="dym"></div>');
      a.followUps.filter(Boolean).slice(0, 3).forEach(q => {
        const b = el(`<button type="button" class="chip follow">${esc(q)}</button>`);
        b.addEventListener('click', () => ask(q));
        rowEl.appendChild(b);
      });
      node.appendChild(rowEl);
    }
    return node;
  }

  function contextLabel() {
    const f = SCR.ai.get().focus;
    if (f) return (SCR.ai.TYPE_LABEL[f.type] || f.type) + ' · ' + f.name;
    return lastPlace ? lastPlace.title : 'Today';
  }

  function askScreen() {
    return {
      id: 'ask', title: 'Ask', cls: 'v-ask', short: 'Ask',
      build(body, view) {
        body.innerHTML = `${head('Ask', 'The Resilience Copilot, on the live model', {
          trail: `<button type="button" class="m-icon-btn" data-new data-hint="m-ask-new" aria-label="New conversation">${I.compose}</button>`
        })}`;
        body.appendChild(thread());
        const dock = el(`<div class="ask-dock">
          <div class="ask-suggests" data-hint="m-ask-suggests"></div>
          <div class="ask-context"></div>
          <form class="ask-form" data-hint="m-ask-input"><input type="text" placeholder="Ask about this, or anything" autocomplete="off" /><button type="submit" aria-label="Send">${I.send}</button></form>
        </div>`);
        view.appendChild(dock);
        const form = dock.querySelector('form'), inp = form.querySelector('input');
        form.addEventListener('submit', e => { e.preventDefault(); const t = inp.value.trim(); if (!t) return; inp.value = ''; ask(t); });
        body.querySelector('[data-new]').addEventListener('click', () => { delete threads[pid]; refresh(); });
        drawDock(dock);
        requestAnimationFrame(() => scrollThread());
      }
    };
  }

  function drawDock(dock) {
    dock = dock || document.querySelector('#views .view:not(.leaving) .ask-dock');
    if (!dock) return;
    const on = SCR.copilot.contextEnabled();
    const ctx = dock.querySelector('.ask-context');
    ctx.innerHTML = `<button type="button" class="ctx-chip ${on ? '' : 'off'}" data-hint="m-ask-context">${SCR.ai.get().focus ? I.pin : I.view}<span>${esc(contextLabel())}</span><i>${on ? I.close : '+'}</i></button>`;
    ctx.querySelector('button').addEventListener('click', () => { SCR.copilot.setContextEnabled(!on); drawDock(dock); });
    const sug = dock.querySelector('.ask-suggests');
    sug.innerHTML = '';
    SCR.copilot.suggestions().slice(0, 6).forEach(q => {
      const b = el(`<button type="button" class="chip">${esc(q)}</button>`);
      b.addEventListener('click', () => ask(q));
      sug.appendChild(b);
    });
  }

  function scrollThread() {
    const sc = document.querySelector('#views .view.v-ask:not(.leaving) .view-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  }

  /** The copilot's host on mobile: every "ask" — chips, briefing, buttons — lands here. */
  function ask(text) {
    text = String(text || '').trim();
    if (!text) return;
    if (tab !== 'ask' || (top() && top().id !== 'ask')) { tab = 'ask'; if (!stacks.ask) stacks.ask = [askScreen()]; stacks.ask = [stacks.ask[0]]; render('fade'); }
    const th = thread();
    th.appendChild(el(`<div class="msg user"><div class="bubble">${esc(text)}</div></div>`));
    let a;
    try { a = SCR.copilot.route(text); } catch (e) { a = { tag: 'Resilience Copilot', html: '<p>Something went wrong computing that answer. Try rephrasing, or name the supplier, material, product or site.</p>' }; }
    const typing = el(`<div class="msg bot"><div class="bubble typing"><i></i><i></i><i></i></div><span class="typing-label">${esc(a.thinking || (a.tag || 'Resilience Copilot') + ' is thinking…')}</span></div>`);
    th.appendChild(typing);
    scrollThread();
    $('screen').classList.add('thinking');
    setTimeout(() => {
      typing.remove();
      $('screen').classList.remove('thinking');
      th.appendChild(renderAnswer(a));
      scrollThread();
      drawDock();
      if (a.after) a.after();
    }, a.delay || 650 + Math.random() * 350);
  }

  /* ================= SHEETS & ISLAND ================= */
  function openSheet(o) {
    closeSheet(true);
    const wrap = el(`<div class="m-sheet-wrap">
      <div class="m-sheet-scrim"></div>
      <div class="m-sheet ${o.className || ''}" role="dialog" aria-label="${esc(o.title || '')}">
        <div class="m-grabber"></div>
        <div class="m-sheet-head"><b>${esc(o.title || '')}</b><button type="button" class="m-close" aria-label="Close">${I.close}</button></div>
        <div class="m-sheet-body"></div>
      </div>
    </div>`);
    const body = wrap.querySelector('.m-sheet-body');
    if (o.html) body.innerHTML = o.html;
    $('sheetHost').appendChild(wrap);
    if (o.build) o.build(body);
    wrap.querySelector('.m-sheet-scrim').addEventListener('click', () => closeSheet());
    wrap.querySelector('.m-close').addEventListener('click', () => closeSheet());
    requestAnimationFrame(() => wrap.classList.add('open'));
  }
  function closeSheet(now) {
    const w = $('sheetHost').querySelector('.m-sheet-wrap');
    if (!w) return;
    if (now) return w.remove();
    w.classList.remove('open');
    setTimeout(() => w.remove(), 380);
  }

  let islandTimer = 0;
  function island(title, body, type, action) {
    const isl = $('island');
    const text = strip(body);
    const ic = type === 'good' ? I.check : type === 'crit' || type === 'warn' ? I.warn : spark();
    isl.innerHTML = `<span class="isl-ic ${type || 'info'}">${ic}</span><span class="isl-txt"><b>${esc(title)}</b>${text ? `<small>${esc(text)}</small>` : ''}</span>${action ? `<span class="isl-act">${esc(action.label)}</span>` : ''}`;
    isl.classList.add('open');
    isl.onclick = action ? () => { isl.classList.remove('open'); action.run(); } : null;
    clearTimeout(islandTimer);
    islandTimer = setTimeout(() => isl.classList.remove('open'), action ? 5200 : 3800);
  }

  /* ---------------- role & appearance ---------------- */
  function openRoleSheet() {
    const dark = document.body.getAttribute('data-theme') === 'dark';
    openSheet({
      title: 'Viewing as',
      build(body) {
        const p = persona();
        body.innerHTML = `<div class="m-list">${SCR.personas.list().map(x => `<button type="button" class="m-row m-role" data-role="${x.id}">
            <span class="m-av" style="--av:${x.color}">${esc(SCR.personas.initials(x.name))}</span>
            <span class="m-row-main"><b>${esc(x.name)}</b><small>${esc(x.mobile.focus)}</small></span>
            ${x.id === p.id ? `<span class="m-check">${I.check}</span>` : ''}</button>`).join('')}</div>
          <h2 class="m-section">What you do here</h2>
          <div class="m-list">${p.tasks.map((t, i) => `<button type="button" class="m-row" data-task="${i}"><span class="m-n" style="background:${p.color}">${i + 1}</span>
            <span class="m-row-main"><b>${esc(t.t)}</b><small>${esc(t.d)}</small></span><span class="m-chev">${I.chevR}</span></button>`).join('')}</div>
          <h2 class="m-section">Appearance</h2>
          <div class="m-seg m-theme"><button type="button" class="${dark ? '' : 'on'}" data-theme-set="light">Light</button><button type="button" class="${dark ? 'on' : ''}" data-theme-set="dark">Dark</button></div>
          <a class="m-link" href="web.html">Open the web application ${I.chevR}</a>`;
        body.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => { closeSheet(); if (b.dataset.role !== pid) SCR.persona.set(b.dataset.role, { toast: true }); }));
        body.querySelectorAll('[data-task]').forEach(b => b.addEventListener('click', () => {
          const t = p.tasks[+b.dataset.task];
          closeSheet();
          if (t.m === 'ask') return switchTab('ask');
          if (tabKeys().includes(t.m)) return switchTab(t.m);
          pushOrRefresh(t.m);
        }));
        body.querySelectorAll('[data-theme-set]').forEach(b => b.addEventListener('click', () => { setTheme(b.dataset.themeSet); closeSheet(); }));
      }
    });
  }

  function setTheme(t) {
    document.body.setAttribute('data-theme', t);
    try { localStorage.setItem('scr-theme', t); } catch (_) { /* private mode */ }
  }

  function setPersona(id, opts) {
    pid = SCR.personas.byId(id).id;
    SCR.personas.remember(pid);
    SCR.copilot.setSuggests(persona().suggests);
    Object.keys(stacks).forEach(k => delete stacks[k]);
    tab = 'today';
    buildTabbar();
    stacks.today = [todayScreen()];
    render('fade');
    syncCaption();
    if (opts && opts.toast) island('Viewing as ' + persona().name, persona().lens, 'info');
  }

  /* ---------------- tab bar & stage ---------------- */
  function buildTabbar() {
    const p = persona();
    const tb = $('tabbar');
    const T = [
      { key: 'today', label: 'Today', icon: I.today, hint: 'm-tab-today' },
      { key: p.mobile.tab.key, label: p.mobile.tab.label, icon: I[p.mobile.tab.key], hint: 'm-tab-role' },
      { key: 'alerts', label: 'Alerts', icon: I.alerts, hint: 'm-tab-alerts' },
      { key: 'simulate', label: 'Simulate', icon: I.simulate, hint: 'm-tab-sim' },
      { key: 'ask', label: 'Ask', icon: spark(), hint: 'm-tab-ask' }
    ];
    tb.innerHTML = T.map(t => `<button type="button" class="tab" data-tab="${t.key}" data-hint="${t.hint}">${t.icon}<span>${esc(t.label)}</span><i class="tab-badge"></i></button>`).join('');
    tb.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    syncTabbar();
  }
  function syncTabbar() {
    const d = D(), p = persona();
    const badge = {
      alerts: myAlerts().filter(a => a.sev === 'critical' || a.sev === 'high').length,
      decisions: d.recommendations.filter(r => r.status === 'pending').length
    };
    $('tabbar').querySelectorAll('[data-tab]').forEach(b => {
      b.classList.toggle('on', b.dataset.tab === tab);
      const n = badge[b.dataset.tab] || 0;
      const i = b.querySelector('.tab-badge');
      i.textContent = n ? String(n) : '';
      i.classList.toggle('show', !!n);
    });
    $('screen').dataset.role = p.id;
  }
  function syncCaption() {
    const p = persona();
    const cap = $('stCaption');
    if (cap) cap.innerHTML = `<span class="st-av" style="--av:${p.color}">${esc(SCR.personas.initials(p.name))}</span><span><b>${esc(p.name)}</b><small>${esc(p.mobile.focus)}</small></span>`;
  }

  /** Scale the phone to the window, keeping its 390 × 844 proportions. */
  function fit() {
    const dev = $('device');
    const s = Math.max(0.55, Math.min(1, (window.innerHeight - 84) / 866, (window.innerWidth - 24) / 412));
    dev.style.zoom = s.toFixed(3);
  }

  /* ---------------- entities → screens ---------------- */
  function openNode(id) {
    if (/^S\d/.test(id)) return SCR.ui.openSupplier(id);
    return SCR.ui.openSite(id);
  }

  /* ================= the web entry points, re-pointed at mobile ================= */
  function installShims() {
    const ROLE_SCREEN = { agents: 'decisions', valuestream: 'products', category: 'suppliers', site: 'sites' };
    SCR.navigate = function (key, opts) {
      opts = opts || {};
      const p = persona();
      if (key === 'scenario') { if (opts.node) return openSimulate(opts.node, opts); return switchTab('simulate'); }
      if (key === 'site' && opts.site) return push(siteScreen(opts.site));
      if ((key === 'network' || key === 'valuestream') && opts.product) return push(productScreen(opts.product));
      if (key === p.home || key === 'executive') return switchTab('today');
      const target = ROLE_SCREEN[key] || (key === 'network' ? 'products' : key);
      if (target === p.mobile.tab.key) return switchTab(target);
      if (['decisions', 'products', 'suppliers', 'sites', 'actions', 'quality'].includes(target)) return pushOrRefresh(target);
      switchTab('today');
    };
    SCR.refreshNav = syncTabbar;
    Object.assign(SCR.ui, {
      openSupplier: id => push(supplierScreen(id)),
      openMaterial: id => push(materialScreen(id)),
      openProduct: id => push(productScreen(id)),
      openSite: id => push(siteScreen(id)),
      openAlert: id => push(alertScreen(id)),
      openScenario: (id, opts) => openSimulate(id, opts),
      closeDrawer: () => {},
      modal: (title, html) => openSheet({ title, html, className: 'form' }),
      closeModal: () => closeSheet(),
      toast: (title, body, type, opts) => island(title, body, type, opts && (opts.action || (opts.label ? opts : null))),
      riMatrixGuide: () => openSheet({ title: 'Resilience Index', html: `<div class="m-note-plain"><p>The Resilience Index scores every product, node and site from <b>0–100</b> — higher is stronger. Each product starts at 97 and loses points for its largest recovery gap, gapped components, risky sole-sourcing, residual risk and worst supplier severity.</p>
          <p><b>Strong</b> ≥ 85 · <b>Stable</b> 70–85 · <b>Stressed</b> 55–70 · <b>Fragile</b> &lt; 55. The enterprise RI is the NTS-weighted mean of product RIs.</p></div>` }),
      metricGuide: () => SCR.ui.riMatrixGuide()
    });
    SCR.scenario.openStudio = (id, opts) => openSimulate(id, opts);
    Object.assign(SCR.copilot, {
      open: () => switchTab('ask'),
      close: () => {},
      focusInput: () => setTimeout(() => { const i = document.querySelector('.ask-form input'); if (i) i.focus(); }, 300),
      discuss: card => ask(`Explain ${card.title}`)
    });
    SCR.copilot.useHost(text => ask(text));
    SCR.persona = { current: () => pid, get: persona, list: () => SCR.personas.list(), set: setPersona };
  }

  /* ================= boot ================= */
  document.addEventListener('DOMContentLoaded', () => {
    try { const t = localStorage.getItem('scr-theme'); if (t) document.body.setAttribute('data-theme', t); } catch (_) { /* private mode */ }
    if (SCR.motion) SCR.motion.init({ mode: 'mobile' });
    installShims();
    SCR.copilot.setSuggests(persona().suggests);
    buildTabbar();
    syncCaption();
    stacks.today = [todayScreen()];
    render('fade');
    fit();
    window.addEventListener('resize', fit);
    SCR.guide.init({ mode: 'stage', stage: $('stage'), device: $('device') });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSheet();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); switchTab('ask'); SCR.copilot.focusInput(); }
    });
    let told = false;
    try { told = sessionStorage.getItem('scr-m-guide-told') === '1'; } catch (_) { told = false; }
    if (!told && SCR.guide.enabled()) {
      setTimeout(() => island('Guide is on', 'Point at anything for what it does', 'info'), 1100);
      try { sessionStorage.setItem('scr-m-guide-told', '1'); } catch (_) { /* private mode */ }
    }
  });
})();
