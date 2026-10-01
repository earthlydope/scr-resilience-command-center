/* ============================================================
   SCR · components.js
   Shared UI: badges, KPI tiles, tables, toasts, modal, and the
   360° detail drawers (supplier / material / product / site /
   alert) that every page opens for cross-navigation.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  const D = () => SCR.data;

  /* ---------------- Tiny DOM helpers ---------------- */
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  /* ---------------- Badges & meters ---------------- */
  const badge = rating => `<span class="badge ${SCR.risk.ratingClass(rating)}">${rating}</span>`;
  const riBadge = ri => `<span class="badge ${SCR.risk.riClass(ri)}">${SCR.risk.riBand(ri)} · ${SCR.fmt.ri(ri)}</span>`;
  const statusBadge = status => {
    const map = {
      'open': 'critical', 'ack': 'medium', 'assigned': 'accent', 'snoozed': 'neutral', 'closed': 'low',
      'Open': 'high', 'In progress': 'accent', 'Overdue': 'critical', 'Completed': 'low'
    };
    const label = { open: 'Open', ack: 'Acknowledged', assigned: 'Assigned', snoozed: 'Snoozed', closed: 'Closed' }[status] || status;
    return `<span class="badge plain ${map[status] || 'neutral'}">${label}</span>`;
  };
  const scoreSpan = score =>
    `<span class="risk-score ${SCR.risk.ratingClass(SCR.risk.ratingOf(score))}">${SCR.fmt.score(score)}</span>`;
  const riSpan = ri =>
    `<span class="risk-score ${SCR.risk.riClass(ri)}">${SCR.fmt.ri(ri)}</span>`;
  const meter = (score, max) => {
    max = max || 5;
    const pct = Math.min(100, (score / max) * 100);
    const color = SCR.risk.scoreColor(score);
    return `<span class="meter"><span class="meter-track"><span class="meter-fill" style="width:${pct}%;background:${color}"></span></span><span class="meter-val">${SCR.fmt.score(score)}</span></span>`;
  };
  const riMeter = ri => {
    const color = SCR.risk.riColor(ri);
    return `<span class="meter"><span class="meter-track"><span class="meter-fill" style="width:${ri}%;background:${color}"></span></span><span class="meter-val">${SCR.fmt.ri(ri)}</span></span>`;
  };

  /* TTS vs TTR paired bars (one row per item) */
  function gapRows(items, maxDays) {
    const mx = maxDays || Math.max(...items.map(i => Math.max(i.tts, i.ttr)), 1);
    return items.map(i => {
      const bad = i.ttr > i.tts;
      return `<div class="gap-row">
        <span class="gap-name" title="${esc(i.name)}">${esc(i.name)}${i.sub ? `<span class="cell-sub">${esc(i.sub)}</span>` : ''}</span>
        <span class="gap-track">
          <span class="gap-bar tts" style="left:0;width:${(i.tts / mx) * 100}%"></span>
          <span class="gap-bar ttr" style="left:0;width:${(i.ttr / mx) * 100}%"></span>
        </span>
        <span class="gap-val" style="color:${bad ? 'var(--crit-text)' : 'var(--good-text)'}">
          ${bad ? '−' + (i.ttr - i.tts) + 'd gap' : '+' + (i.tts - i.ttr) + 'd slack'}
        </span>
      </div>`;
    }).join('');
  }
  const gapLegend = `<div class="flex aic gap12" style="font-size:13px;color:var(--ink-3);margin-bottom:10px">
    <span class="flex aic gap8"><span style="width:14px;height:7px;border-radius:99px;background:var(--series-1)"></span>TTS · survive</span>
    <span class="flex aic gap8"><span style="width:14px;height:7px;border-radius:99px;background:var(--status-serious)"></span>TTR · recover</span>
  </div>`;

  /* ---------------- KPI strip (icon chips, from the original UI) ---------------- */
  const CHIP_ICONS = {
    dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 2v20"/><path d="M17 5.5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6.5"/></svg>',
    risk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5"/><path d="M12 16v.5"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="M12 13 3 8"/><path d="m12 13 9-5"/><path d="M12 13v8"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    gauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 14a8 8 0 1 1 16 0"/><path d="m12 14 4-4"/><path d="M4 19h16"/></svg>',
    factory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l7-5 7 5v13"/><path d="M10 21v-6h4v6"/><path d="M21 21V11l-4-3"/><path d="M3 21h18"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4h13v12H1z"/><path d="M14 9h4l4 4v3h-8"/><circle cx="6" cy="18.5" r="1.8"/><circle cx="17.5" cy="18.5" r="1.8"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>',
    gap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M5 8h9"/><path d="M5 16h14"/><path d="m17 5 3 3-3 3"/><path d="m8 13-3 3 3 3"/></svg>',
    spend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>'
  };
  // Apple system hues, in the original slot order (pink, cyan, green, orange, purple, teal, red-orange, indigo)
  const CHIP_COLORS = ['#ff2d55', '#32ade6', '#34c759', '#ff9500', '#af52de', '#30b0c7', '#ff6b22', '#5856d6'];

  /** items: [{icon, color(idx into CHIP_COLORS or hex), label, value, sub, subClass, progress:{pct,color}, onClick}]
      opts: {bulb: {onClick}} */
  const CHEV = '<svg class="k-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>';
  const SPARK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 4c.55 4.3 2.2 6.9 6.5 8.5-4.3 1.6-5.95 4.2-6.5 8.5-.55-4.3-2.2-6.9-6.5-8.5C8.8 10.9 10.45 8.3 11 4Z"/><path d="M18.5 2.5c.22 1.5.8 2.4 2.3 2.9-1.5.5-2.08 1.4-2.3 2.9-.22-1.5-.8-2.4-2.3-2.9 1.5-.5 2.08-1.4 2.3-2.9Z"/></svg>';
  /* Apple Health summary tile: coloured glyph + title, a chevron when it
     drills, a big rounded figure, one quiet line underneath. */
  /** Guide copy for a tile: the copilot's definition of the KPI when it has one. */
  function kpiHint(it) {
    const def = SCR.copilot && SCR.copilot.explainKpi ? SCR.copilot.explainKpi(it.label) : null;
    const sub = it.sub ? it.sub.charAt(0).toUpperCase() + it.sub.slice(1) + '.' : '';
    const body = def ? def.what : sub;
    return (body + (it.onClick ? ' Click to open the analysis behind it.' : '')).trim();
  }

  function kpiStrip(items, opts) {
    const wrap = el('<div class="kpi-cards"></div>');
    items.forEach((it, i) => {
      const color = typeof it.color === 'string' ? it.color : CHIP_COLORS[(it.color != null ? it.color : i) % CHIP_COLORS.length];
      const pill = it.subClass === 'good' || it.subClass === 'bad';
      const node = el(`<div class="kpi-card ${it.onClick ? 'clickable' : ''}" style="--kpi-accent:${color}" ${it.onClick ? 'role="button" tabindex="0"' : ''}
        data-hint="w-kpi" data-hint-title="${esc(it.label)}" data-hint-body="${esc(kpiHint(it))}">
        <div class="kc-top">
          <span class="k-title"><span class="kpi-glyph">${CHIP_ICONS[it.icon] || CHIP_ICONS.box}</span><span class="k-label">${esc(it.label)}</span></span>
          ${it.onClick ? CHEV : ''}
        </div>
        <div class="k-value">${it.value}${it.unit ? ` <small>${esc(it.unit)}</small>` : ''}</div>
        ${it.progress ? `<span class="progress"><i style="width:${Math.min(100, it.progress.pct)}%;background:${it.progress.color}"></i></span>` : ''}
        ${it.sub
          ? `<div class="k-sub ${it.subClass || ''} ${pill ? 'k-pill' : ''} ${it.subOnClick ? 'k-sub-link' : ''}">${esc(it.sub)}</div>`
          : '<div class="k-sub"></div>'}
      </div>`);
      if (it.onClick) {
        node.addEventListener('click', it.onClick);
        node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); it.onClick(e); } });
      }
      // A sub-pill can be its own drill target ("2 critical" → the critical queue),
      // so it must not also fire the tile's broader navigation.
      if (it.subOnClick) {
        const sub = node.querySelector('.k-sub');
        sub.title = it.subTitle || '';
        sub.addEventListener('click', e => { e.stopPropagation(); it.subOnClick(); });
      }
      wrap.appendChild(node);
    });
    if (opts && opts.bulb) {
      const bulb = el(`<button class="kpi-card bulb-card" title="Generated insights for this view" data-hint="w-summarize">
        <span class="bulb">${SPARK}</span>
        <span class="bulb-label">Summarize this view<span class="bulb-sub">Written by the agents from live data</span></span>
      </button>`);
      bulb.addEventListener('click', opts.bulb.onClick);
      wrap.appendChild(bulb);
    }
    return wrap;
  }

  /* ---------------- In-cell measure bar (multi-measure node tables) ---------------- */
  function cellBar(value, max, cssColor, text) {
    const pct = Math.max(1.5, Math.min(100, (value / (max || 1)) * 100));
    return `<span class="cellbar"><i style="width:${pct}%;background:${cssColor}"></i><span>${text}</span></span>`;
  }

  /* ---------------- Risk-factor heat pill (Node Risk Summary) ---------------- */
  function heatPill(v) {
    // v in 0–1; green (low) → red (high), like the original risk summary
    const c = v >= 0.6 ? '#e5342b' : v >= 0.45 ? '#f26a1b' : v >= 0.3 ? '#d48806' : '#248a3d';
    return `<span style="display:block;text-align:center;background:${c};color:#fff;font-weight:700;font-size:12.5px;border-radius:99px;padding:3px 0;min-width:52px;font-variant-numeric:tabular-nums">${v.toFixed(2)}</span>`;
  }

  /* ---------------- Filter bar (clean, always-visible inline filters) ---------------- */
  /** fields: [{id, label, options:[{v,label,sel}], onChange}] */
  function filterBlock(fields, note) {
    const wrap = el(`<div class="filterbar" data-hint="w-filters">
      <span class="fb-lead"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18"/><path d="M6 12h12"/><path d="M10 19h4"/></svg>Filters</span>
    </div>`);
    fields.forEach(f => {
      const field = el(`<label class="fb-field"><span>${esc(f.label)}</span>
        <select id="${f.id}">${f.options.map(o => `<option value="${esc(o.v)}" ${o.sel ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
      </label>`);
      field.querySelector('select').addEventListener('change', e => f.onChange(e.target.value));
      wrap.appendChild(field);
    });
    if (note) wrap.appendChild(el(`<span class="fb-note">${esc(note)}</span>`));
    return wrap;
  }

  /* ---------------- Guides (Links menu) ---------------- */
  function riMatrixGuide() {
    modal('Resilience Index (RI) matrix guide', `
      <p>The Resilience Index scores every product, node and site from <strong>0–100</strong> — higher is stronger.
      It is a weighted composite recalculated at every weekly refresh:</p>
      <div class="tbl-wrap"><table class="tbl tbl-teal">
        <thead><tr><th>Component</th><th>What it measures</th><th>Direction</th></tr></thead>
        <tbody>
          <tr><td class="cell-main">TTR − TTS gap</td><td>Days a failure outlives inventory cover</td><td>Larger gap → lower RI (dominant term)</td></tr>
          <tr><td class="cell-main">Gapped components</td><td>Breadth of exposed BOM lines</td><td>More components → lower RI</td></tr>
          <tr><td class="cell-main">Risky sole-sourcing</td><td>Single-source materials above risk 2.8</td><td>Each adds penalty</td></tr>
          <tr><td class="cell-main">Residual risk (RRE)</td><td>Risk remaining after mitigation, 0–1</td><td>Higher residual → lower RI</td></tr>
          <tr><td class="cell-main">Worst node severity</td><td>Highest supplier risk score in the BOM</td><td>Severity above 2.0 penalized</td></tr>
        </tbody>
      </table></div>
      <h3>Reading the bands</h3>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Band</th><th>RI</th><th>Posture</th></tr></thead>
        <tbody>
          <tr><td><span class="badge low">Strong</span></td><td class="num">≥ 85%</td><td>Withstands most single-node failures without revenue loss</td></tr>
          <tr><td><span class="badge medium">Stable</span></td><td class="num">70 – 85%</td><td>Covered for common disruptions; monitor concentrations</td></tr>
          <tr><td><span class="badge high">Stressed</span></td><td class="num">55 – 70%</td><td>At least one uncovered failure path — mitigation advised</td></tr>
          <tr><td><span class="badge critical">Fragile</span></td><td class="num">&lt; 55%</td><td>Recovery outlives survival on critical paths — act now</td></tr>
        </tbody>
      </table></div>
      <p style="margin-top:10px">Weights are configurable per business unit (FR-CALC-07). The enterprise RI is the NTS-weighted mean of product RIs.</p>`);
  }

  function metricGuide() {
    modal('Metric definitions', `
      <div class="tbl-wrap"><table class="tbl tbl-teal">
        <thead><tr><th>Metric</th><th>Definition</th><th>Formula in this platform</th></tr></thead>
        <tbody>
          <tr><td class="cell-main">TTS · Time to Survive</td><td>How long the business continues with current inventory</td><td>usable inventory ÷ daily consumption (days)</td></tr>
          <tr><td class="cell-main">TTR · Time to Recover</td><td>Time to restore a failed node/material to normal supply</td><td>supplier restart, alternate qualification, logistics recovery</td></tr>
          <tr><td class="cell-main">VAR · Value at Risk</td><td>Sales exposed if the node fails</td><td>dependent NTS × max(0, TTR − TTS) ÷ 365</td></tr>
          <tr><td class="cell-main">AVAR · Adjusted VAR</td><td>Probability/severity-adjusted exposure</td><td>VAR × P(disruption), P rising with node risk</td></tr>
          <tr><td class="cell-main">Wtd. AVAR</td><td>AVAR aggregated across a scope, NTS-attributed</td><td>Σ material AVAR × product share</td></tr>
          <tr><td class="cell-main">RRE · Residual Risk</td><td>Risk left after mitigations, 0–1</td><td>assessed per component; falls as actions execute</td></tr>
          <tr><td class="cell-main">RI · Resilience Index</td><td>Composite strength score, 0–100 (higher = better)</td><td>see the RI matrix guide</td></tr>
        </tbody>
      </table></div>
      <p style="margin-top:10px"><strong>TTR &gt; TTS</strong> is the red flag everywhere in this product: replenishment ordered on the day of failure would arrive after the line stops.</p>`);
  }

  /* ---------------- Table ---------------- */
  /** cols: [{h, cell(row), cls}], rows: data[], onRow(row) optional,
      opts.rowClass(row) → extra class (e.g. highlight a row the copilot just created) */
  function table(cols, rows, onRow, opts) {
    const wrap = el('<div class="tbl-wrap"></div>');
    const t = el(`<table class="tbl"><thead><tr>${
      cols.map(c => `<th class="${c.cls || ''}">${esc(c.h)}</th>`).join('')
    }</tr></thead><tbody></tbody></table>`);
    const tb = t.querySelector('tbody');
    rows.forEach(r => {
      const extra = opts && opts.rowClass ? opts.rowClass(r) || '' : '';
      const tr = el(`<tr class="${onRow ? 'row-link' : ''} ${extra}">${
        cols.map(c => `<td class="${c.cls || ''}">${c.cell(r)}</td>`).join('')
      }</tr>`);
      if (onRow) tr.addEventListener('click', () => onRow(r));
      tb.appendChild(tr);
    });
    wrap.appendChild(t);
    return wrap;
  }

  /* ---------------- Card scaffold ---------------- */
  /** cfg: {title, sub, cols (grid span), chartClass, flush, actions: HTMLElement[]} */
  function card(cfg) {
    const hint = cfg.hint || (cfg.sub ? cfg.sub.charAt(0).toUpperCase() + cfg.sub.slice(1) + '.' : '');
    const node = el(`<div class="card ${cfg.cols ? 'col-' + cfg.cols : ''}">
      <div class="card-head">
        <div ${hint ? `data-hint="w-card" data-hint-title="${esc(cfg.title)}" data-hint-body="${esc(hint + (cfg.noInsight ? '' : ' AI insights explains it in words.'))}"` : ''}><div class="card-title">${esc(cfg.title)}</div>
        ${cfg.sub ? `<div class="card-sub">${esc(cfg.sub)}</div>` : ''}</div>
        <div class="card-actions"></div>
      </div>
      <div class="card-body ${cfg.flush ? 'flush' : ''}"></div>
    </div>`);
    (cfg.actions || []).forEach(a => node.querySelector('.card-actions').appendChild(a));
    // Every card carries an agent-insight affordance so a chart never has to be
    // read cold. Opt out only where the card is itself an explanation.
    if (!cfg.noInsight) node.querySelector('.card-actions').appendChild(insightBtn(cfg.title, cfg.insight));
    if (cfg.chartClass) {
      const c = el(`<div class="chart ${cfg.chartClass}"></div>`);
      node.querySelector('.card-body').appendChild(c);
      node._chartEl = c;
    }
    return node;
  }

  /* ---------------- AI agent insights (platform-wide) ----------------
     Any card can declare `insight`, as an object or a function evaluated at
     click time so the reading reflects whatever filters are live:
       { agent, reads: [{label, value, tone}], points: [..], actions: [{label, onClick}] }
     Cards that declare nothing still get a button, answered from the
     enterprise roll-up — the affordance is never a dead end. */
  // SPARK (the intelligence glyph) is defined with the KPI strip above.

  function fallbackInsight(title) {
    const D = SCR.data, F = SCR.fmt, k = D.kpis;
    return {
      agent: 'Impact & VAR Agent',
      reads: [
        { label: 'Value at risk', value: F.usdM(k.totalVAR) },
        { label: 'Adjusted (AVAR)', value: F.usdM(k.totalAVAR), tone: 'bad' },
        { label: 'Resilience index', value: k.enterpriseRI + '%', tone: k.enterpriseRI >= 70 ? 'good' : 'bad' }
      ],
      points: [
        `“${title}” is scoped by the filters above it, so every figure here is a slice of the ${F.usdM(k.totalVAR)} enterprise value at risk.`,
        `${k.gapMaterials} components still recover slower than they can survive (TTR > TTS) — those are what convert exposure into lost sales.`,
        `${F.usdM(k.mitigatedYtd)} of AVAR has been retired year to date, which is the gap between the gross and adjusted numbers.`
      ],
      actions: [
        { label: 'Open Executive Summary', onClick: () => SCR.navigate('executive') }
      ]
    };
  }

  function openInsight(title, insight) {
    let spec;
    try { spec = (typeof insight === 'function' ? insight() : insight) || fallbackInsight(title); }
    catch (_) { spec = fallbackInsight(title); }
    openDrawer('AI agent insight', title, body => {
      body.appendChild(el(`<div class="ins-agent">
        <span class="ins-agent-chip">${SPARK}</span>
        <span><strong style="color:var(--ink)">${esc(spec.agent || 'Resilience Copilot')}</strong>
        <span class="muted" style="display:block;font-size:12.5px">read this card against the live filters and summarised what matters</span></span>
      </div>`));
      if (spec.reads && spec.reads.length) {
        const facts = el('<div class="facts" style="margin-bottom:14px"></div>');
        spec.reads.forEach(r => facts.appendChild(el(
          `<div class="fact"><div class="f-label">${esc(r.label)}</div>
           <div class="f-value" ${r.tone === 'bad' ? 'style="color:var(--status-critical)"' : r.tone === 'good' ? 'style="color:var(--status-good)"' : ''}>${r.value}</div></div>`)));
        body.appendChild(facts);
      }
      body.appendChild(el('<div class="sec-title">What the agent sees</div>'));
      const ul = el('<ul class="ins-points"></ul>');
      (spec.points || []).forEach(p => ul.appendChild(el(`<li>${p}</li>`)));
      body.appendChild(ul);
      if (spec.actions && spec.actions.length) {
        body.appendChild(el('<div class="sec-title">Where to go next</div>'));
        const row = el('<div class="ins-actions"></div>');
        spec.actions.forEach(a => {
          const b = el(`<button class="btn">${esc(a.label)}</button>`);
          b.addEventListener('click', () => { closeDrawer(); a.onClick && a.onClick(); });
          row.appendChild(b);
        });
        body.appendChild(row);
      }
      // carry the card into a conversation instead of ending at a summary
      const ask = el(`<button class="ai-ask ins-ask" type="button">${SPARK}<span>Ask a follow-up about this card…</span></button>`);
      ask.addEventListener('click', () => { if (SCR.copilot) SCR.copilot.discuss({ title, spec }); });
      body.appendChild(ask);
    }, { type: 'card', id: title, name: title, spec });
  }

  function insightBtn(title, insight) {
    const b = el(`<button class="insight-btn" title="AI agent insights for “${esc(title)}”" data-hint="w-insight"><span class="ib-orb">${SPARK}</span><span>AI insights</span></button>`);
    b.addEventListener('click', e => { e.stopPropagation(); openInsight(title, insight); });
    return b;
  }

  /* ---------------- In-place scenario runner ----------------
     "Simulate this" answers where it was asked rather than navigating to the
     Studio and losing the context you asked from. The Studio stays one click
     away for anyone who wants the full controls. */
  function openScenario(nodeId, opts) {
    opts = opts || {};
    if (!SCR.scenario || !SCR.scenario.simulate) { SCR.navigate('scenario'); return; }
    let r;
    try { r = SCR.scenario.simulate(nodeId, opts); } catch (_) { r = null; }
    if (!r || !r.node) { SCR.navigate('scenario'); return; }
    const F = SCR.fmt;
    openDrawer('Scenario · digital twin', r.node.name, body => {
      body.appendChild(el(`<p class="muted" style="font-size:14px;margin:0 0 12px">
        ${esc(opts.why || 'Failing this node on the twin')} — <strong>${r.days} days</strong> at
        <strong>${r.sev}% severity</strong>. Recomputed live from the same engine the Studio uses.</p>`));

      const facts = el('<div class="facts" style="margin-bottom:14px"></div>');
      [
        ['Sales exposed', F.usdM(r.exposed), 'bad'],
        ['Absorbed by cover', F.usdM(r.covered), 'good'],
        ['Residual at risk', F.usdM(r.residual), 'bad']
      ].forEach(([l, v, tone]) => facts.appendChild(el(
        `<div class="fact"><div class="f-label">${esc(l)}</div>
         <div class="f-value" style="color:var(--status-${tone === 'good' ? 'good' : 'critical'})">${v}</div></div>`)));
      body.appendChild(facts);

      if (r.bindingMat) {
        body.appendChild(el(`<div class="sim-out-note" style="margin-bottom:14px">
          Binding constraint: <strong>${esc(r.bindingMat.name)}</strong> —
          ${F.days(r.bindingMat.tts)} of cover against ${F.days(r.bindingMat.ttr)} to recover.</div>`));
      }

      const rows = (r.rows || []).slice().sort((a, b) => b.loss - a.loss).slice(0, 6);
      if (rows.length) {
        body.appendChild(el('<div class="sec-title">Worst-hit SKUs</div>'));
        body.appendChild(table(
          [{ h: 'Product', cell: x => `<span class="cell-main">${esc(x.p.name)}</span>` },
           { h: 'Revenue lost', cls: 'num', cell: x => F.usdM(+x.loss.toFixed(1)) }],
          rows, x => openProduct(x.p.id)));
      }

      const best = (r.opts || [])[0];
      if (best) {
        // el() returns one root, so these are appended separately
        body.appendChild(el('<div class="sec-title" style="margin-top:14px">Best mitigation</div>'));
        body.appendChild(el(`<p style="font-size:14px;margin:0 0 12px"><strong>${esc(best.name)}</strong> — removes
          ${(best.cut * 100).toFixed(0)}% of the ${F.usdM(r.atRisk)} at risk for ${F.usdM(best.cost)},
          in ${esc(best.time)}.</p>`));
      }

      const row = el('<div class="ins-actions"></div>');
      if (best) {
        const act = el('<button class="btn btn-primary" data-hint="w-d-act">Create action from best plan</button>');
        act.addEventListener('click', () => SCR.work.openSheet({ type: 'scenario', result: r, option: best }));
        row.appendChild(act);
      }
      const full = el('<button class="btn">Open in Scenario Studio</button>');
      full.addEventListener('click', () => {
        closeDrawer();
        SCR.scenario.openStudio(nodeId, opts);
      });
      row.appendChild(full);
      const ask = el(`<button class="btn" data-hint="w-d-ask">Ask Copilot</button>`);
      ask.addEventListener('click', () => SCR.copilot && SCR.copilot.ask(`What if ${r.node.name} fails for ${r.days} days?`, { open: true }));
      row.appendChild(ask);
      body.appendChild(row);
    }, SCR.ai.nodeEntity(nodeId));
  }

  /* ---------------- Toast ---------------- */
  const TOAST_IC = {
    good: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 7v6"/><path d="M12 17v.5"/></svg>',
    crit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 7v6"/><path d="M12 17v.5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 11v6"/><path d="M12 7v.5"/></svg>'
  };
  /** opts.action = { label, run } adds a link the user can follow. */
  function toast(title, body, type, opts) {
    const host = document.getElementById('toasts');
    const kind = type || 'info';
    const icon = kind === 'ai' ? SPARK : (TOAST_IC[kind] || TOAST_IC.info);
    const action = opts && (opts.action || (opts.label ? opts : null));
    const node = el(`<div class="toast ${kind}" role="status">
      <span class="toast-ic">${icon}</span>
      <div><strong>${esc(title)}</strong><span class="t-body">${body}</span>
      ${action ? `<br/><button class="toast-act">${esc(action.label)}</button>` : ''}</div>
    </div>`);
    if (action) node.querySelector('.toast-act').addEventListener('click', () => { action.run(); dismiss(); });
    host.appendChild(node);
    let timer = setTimeout(dismiss, action ? 7000 : 4800);
    node.addEventListener('mouseenter', () => clearTimeout(timer));
    node.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 2400); });
    function dismiss() { node.classList.add('out'); setTimeout(() => node.remove(), 320); }
  }

  /* ---------------- Modal ---------------- */
  function modal(title, html) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalScrim').classList.add('open');
  }
  function closeModal() { document.getElementById('modalScrim').classList.remove('open'); }

  /* ---------------- Drawer core ---------------- */
  /** focus: the entity this drawer is about ({type, id, name}) — it becomes
      the copilot's "this" while the drawer is open. */
  function openDrawer(kicker, title, build, focus) {
    document.getElementById('drawerKicker').textContent = kicker;
    document.getElementById('drawerTitle').textContent = title;
    const body = document.getElementById('drawerBody');
    body.innerHTML = '';
    body.scrollTop = 0;
    build(body);
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawerScrim').classList.add('open');
    document.body.classList.add('drawer-open');
    if (SCR.ai) SCR.ai.setFocus(focus || null);
  }
  function closeDrawer() {
    const wasOpen = document.getElementById('drawer').classList.contains('open');
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawerScrim').classList.remove('open');
    document.body.classList.remove('drawer-open');
    if (wasOpen && SCR.ai) SCR.ai.setFocus(null);
  }
  /** "Ask Copilot" from inside a 360° drawer: the drawer's entity is the context. */
  function askButton(prompt) {
    const b = el(`<button class="btn btn-sm" data-hint="w-d-ask">${SPARK}Ask Copilot</button>`);
    b.addEventListener('click', () => SCR.copilot && SCR.copilot.ask(prompt, { open: true }));
    return b;
  }

  const dimNames = { fin: 'Financial', qual: 'Quality', rel: 'Reliability', geo: 'Geopolitical', cyb: 'Cyber', clim: 'Climate' };
  function dimBars(dims) {
    return Object.keys(dims).map(k => {
      const v = dims[k];
      const color = SCR.risk.scoreColor(v);
      return `<div class="dim-row">
        <span class="dim-label">${dimNames[k] || k}</span>
        <span class="dim-track"><span class="dim-fill" style="width:${(v / 5) * 100}%;background:${color}"></span></span>
        <span class="dim-val">${v.toFixed(1)}</span>
      </div>`;
    }).join('');
  }

  /** Smooth-scroll a section card into view with a brief highlight ring. */
  function scrollToCard(node) {
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    node.style.transition = 'box-shadow .35s';
    node.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 40%, transparent)';
    setTimeout(() => { node.style.boxShadow = ''; }, 1400);
  }

  /* Create-mitigation-action helper (used across pages/drawers).
     target: an entity {type, id}, a scenario {type:'scenario', result, option},
     or plain text. The Mitigation Strategist drafts every field; the user
     confirms and it lands on the tracker as a real action. */
  function createAction(target) {
    if (SCR.work) SCR.work.openSheet(target);
  }

  /* ---------------- Supplier 360 drawer ---------------- */
  function openSupplier(id) {
    const s = D().supplierById(id);
    if (!s) return;
    const mats = D().materialsOf(id);
    const prods = D().productsOf(id);
    const alerts = D().alerts.filter(a => a.nodes.includes(id) && a.status !== 'closed');
    openDrawer('Supplier node 360', s.name, body => {
      body.innerHTML = `
        <div class="drawer-section">
          <div class="flex aic gap8" style="margin-bottom:12px">
            ${badge(s.rating)}
            <span class="badge neutral plain">${esc(s.catName)}</span>
            <span class="badge neutral plain">Tier ${s.tier}</span>
            <span class="muted" style="font-size:13px">${esc(s.city)}, ${esc(s.country)} · ${esc(s.region)}</span>
          </div>
          <div class="facts">
            <div class="fact"><div class="f-label">Node risk score</div><div class="f-value">${scoreSpan(s.score)}</div></div>
            <div class="fact"><div class="f-label">Resilience index</div><div class="f-value">${riSpan(s.ri)}</div></div>
            <div class="fact"><div class="f-label">TTR</div><div class="f-value">${s.ttr} <small>days</small></div></div>
            <div class="fact"><div class="f-label">VAR</div><div class="f-value">${SCR.fmt.usdM(s.var)}</div></div>
            <div class="fact"><div class="f-label">AVAR</div><div class="f-value">${SCR.fmt.usdM(s.avar)}</div></div>
            <div class="fact"><div class="f-label">Sales linked</div><div class="f-value">${SCR.fmt.usdM(s.depNTS)}</div></div>
            <div class="fact"><div class="f-label">Annual spend</div><div class="f-value">${SCR.fmt.usdM(s.spend)}</div></div>
            <div class="fact"><div class="f-label">Materials</div><div class="f-value">${s.materialsCount} <small>${s.singleCount ? s.singleCount + ' sole-src' : ''}</small></div></div>
            <div class="fact"><div class="f-label">Products touched</div><div class="f-value">${s.productsCount}</div></div>
          </div>
        </div>
        <div class="drawer-section">
          <h3>Node risk score · last 12 months</h3>
          <div class="chart" style="height:130px" id="drawerTrend"></div>
        </div>
        <div class="drawer-section">
          <h3>Risk drivers</h3>
          ${dimBars(s.dims)}
        </div>
        ${alerts.length ? `<div class="drawer-section"><h3>Open alerts</h3>${
          alerts.map(a => `<div class="reco" style="cursor:pointer" data-al="${a.id}">
            <div class="reco-head"><span class="reco-title">${esc(a.title)}</span>${statusBadge(a.status)}</div>
            <div class="reco-meta"><span class="rm">Severity<strong class="${a.sev === 'critical' ? 'bad' : ''}">${a.sev}</strong></span>
            <span class="rm">Exposure<strong>${SCR.fmt.usdM(a.exposure)}</strong></span>
            <span class="rm">Type<strong style="font-size:14px">${esc(a.type)}</strong></span></div>
          </div>`).join('')}</div>` : ''}
        <div class="drawer-section">
          <h3>Materials supplied (${mats.length})</h3>
          <div id="drawerMats"></div>
        </div>
        <div class="drawer-section">
          <h3>Finished products dependent (${prods.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${
            prods.map(p => `<span class="badge neutral plain" style="cursor:pointer" data-prod="${p.id}">${esc(p.name)}</span>`).join('') || '<span class="muted">None</span>'}
          </div>
        </div>
        <div class="drawer-section">
          <div class="flex aic gap8 wrap" id="drawerBtns">
            <button class="btn btn-primary btn-sm" id="drawerAct" data-hint="w-d-act">Create mitigation action</button>
            <button class="btn btn-sm" id="drawerSim" data-hint="w-d-sim">Simulate failure</button>
          </div>
        </div>`;

      body.querySelector('#drawerMats').appendChild(table([
        { h: 'Material', cell: m => `<span class="cell-main">${esc(m.name)}</span><span class="cell-sub">${esc(m.sub)}</span>` },
        { h: 'Sourcing', cell: m => m.singleSource ? '<span class="badge critical plain">Single</span>' : '<span class="badge low plain">Dual+</span>' },
        { h: 'TTS', cls: 'num', cell: m => SCR.fmt.days(m.tts) },
        { h: 'TTR', cls: 'num', cell: m => SCR.fmt.days(m.ttr) },
        { h: 'VAR', cls: 'num', cell: m => SCR.fmt.usdM(m.var) }
      ], mats, m => openMaterial(m.id)));

      body.querySelectorAll('[data-al]').forEach(n =>
        n.addEventListener('click', () => openAlert(n.dataset.al)));
      body.querySelectorAll('[data-prod]').forEach(n =>
        n.addEventListener('click', () => openProduct(n.dataset.prod)));
      body.querySelector('#drawerAct').addEventListener('click', () => createAction({ type: 'supplier', id: s.id }));
      body.querySelector('#drawerSim').addEventListener('click', () =>
        openScenario(s.id, { why: 'Failing ' + s.name + ' on the twin', days: 30 }));
      body.querySelector('#drawerBtns').appendChild(askButton(`Why is ${s.name} critical?`));

      SCR.charts.mount(body.querySelector('#drawerTrend'), () => {
        const t = SCR.theme.tokens();
        return Object.assign(SCR.theme.baseOption(), {
          grid: { left: 6, right: 10, top: 8, bottom: 2, containLabel: true },
          tooltip: Object.assign(SCR.theme.baseOption().tooltip, { trigger: 'axis' }),
          xAxis: SCR.theme.catAxis(D().monthly.months, { axisLabel: { fontSize: 11.5, color: t.ink3, interval: 2 } }),
          yAxis: SCR.theme.valAxis({ min: 0, max: 5, splitNumber: 3 }),
          series: [{
            type: 'line', data: s.trend, symbol: 'none', smooth: 0.35,
            lineStyle: { width: 2.5, color: SCR.risk.scoreColor(s.score) },
            areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: SCR.risk.scoreColor(s.score) + '33' }, { offset: 1, color: SCR.risk.scoreColor(s.score) + '00' }]) }
          }]
        });
      });
    }, { type: 'supplier', id: s.id, name: s.name });
  }

  /* ---------------- Material drawer ---------------- */
  function openMaterial(id) {
    const m = D().materialById(id);
    if (!m) return;
    const sups = m.suppliers.map(sid => D().supplierById(sid));
    const prods = D().productsUsing(id);
    const plantNames = m.plants.map(p => (D().plantById(p) || {}).name).filter(Boolean);
    const gapBad = m.ttr > m.tts;
    openDrawer('Material / component risk', m.name, body => {
      body.innerHTML = `
        <div class="drawer-section">
          <div class="flex aic gap8" style="margin-bottom:12px">
            ${badge(m.rating)}
            <span class="badge neutral plain">${esc(m.catName)} · ${esc(m.sub)}</span>
            ${m.singleSource ? '<span class="badge critical">Single source</span>' : ''}
            ${gapBad ? '<span class="badge critical plain">TTR &gt; TTS</span>' : ''}
          </div>
          <div class="facts">
            <div class="fact"><div class="f-label">TTS · survive</div><div class="f-value">${m.tts} <small>days</small></div></div>
            <div class="fact"><div class="f-label">TTR · recover</div><div class="f-value">${m.ttr} <small>days</small></div></div>
            <div class="fact"><div class="f-label">Gap</div><div class="f-value" style="color:${gapBad ? 'var(--status-critical)' : 'var(--status-good)'}">${gapBad ? '−' : '+'}${Math.abs(m.tts - m.ttr)} <small>days</small></div></div>
            <div class="fact"><div class="f-label">VAR</div><div class="f-value">${SCR.fmt.usdM(m.var)}</div></div>
            <div class="fact"><div class="f-label">AVAR</div><div class="f-value">${SCR.fmt.usdM(m.avar)}</div></div>
            <div class="fact"><div class="f-label">RRE · residual</div><div class="f-value">${SCR.fmt.rre(m.rre)}</div></div>
            <div class="fact"><div class="f-label">Sales dependent</div><div class="f-value">${SCR.fmt.usdM(m.depNTS)}</div></div>
            <div class="fact"><div class="f-label">Annual spend</div><div class="f-value">${SCR.fmt.usdM(m.spend)}</div></div>
            <div class="fact"><div class="f-label">Disruption prob.</div><div class="f-value">${Math.round(m.prob * 100)}<small>%</small></div></div>
          </div>
        </div>
        <div class="drawer-section">
          <h3>Substitution feasibility</h3>
          <div class="sim-out-note">${esc(m.substitution)}</div>
        </div>
        <div class="drawer-section"><h3>Suppliers</h3><div id="dmSup"></div></div>
        <div class="drawer-section">
          <h3>Consuming plants</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${plantNames.map(p => `<span class="badge neutral plain">${esc(p)}</span>`).join('')}</div>
        </div>
        <div class="drawer-section">
          <h3>Finished products using this material (${prods.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${
            prods.map(p => `<span class="badge neutral plain" style="cursor:pointer" data-prod="${p.id}">${esc(p.name)}</span>`).join('')}
          </div>
        </div>
        <div class="drawer-section flex aic gap8 wrap" id="dmBtns">
          <button class="btn btn-primary btn-sm" id="dmAct" data-hint="w-d-act">Create mitigation action</button>
        </div>`;
      body.querySelector('#dmSup').appendChild(table([
        { h: 'Supplier', cell: s => `<span class="cell-main">${esc(s.name)}</span><span class="cell-sub">${esc(s.city)}, ${esc(s.country)}</span>` },
        { h: 'Rating', cell: s => badge(s.rating) },
        { h: 'TTR', cls: 'num', cell: s => SCR.fmt.days(s.ttr) },
        { h: 'Risk', cls: 'num', cell: s => scoreSpan(s.score) }
      ], sups, s => openSupplier(s.id)));
      body.querySelectorAll('[data-prod]').forEach(n =>
        n.addEventListener('click', () => openProduct(n.dataset.prod)));
      body.querySelector('#dmAct').addEventListener('click', () => createAction({ type: 'material', id: m.id }));
      body.querySelector('#dmBtns').appendChild(askButton(`Who else can supply ${m.name}?`));
    }, { type: 'material', id: m.id, name: m.name });
  }

  /* ---------------- Product drawer ---------------- */
  function openProduct(id) {
    const p = D().productById(id);
    if (!p) return;
    const mats = p.materials.map(mid => D().materialById(mid)).filter(Boolean)
      .sort((a, b) => b.gap - a.gap);
    const mkNames = p.markets.map(mk => (D().marketById(mk) || {}).name).filter(Boolean);
    openDrawer('Product / SKU resilience', p.name, body => {
      body.innerHTML = `
        <div class="drawer-section">
          <div class="flex aic gap8" style="margin-bottom:12px;flex-wrap:wrap">
            ${riBadge(p.ri)}
            <span class="badge neutral plain">${esc(p.sectorName)}</span>
            <span class="badge neutral plain">${esc(p.stream)}</span>
            ${p.growth >= 15 ? '<span class="badge accent plain">High growth</span>' : ''}
            ${p.gapMax > 0 ? '<span class="badge critical plain">TTR &gt; TTS</span>' : ''}
          </div>
          <div class="facts">
            <div class="fact"><div class="f-label">NTS · FY26</div><div class="f-value">${SCR.fmt.usdM(p.nts)}</div></div>
            <div class="fact"><div class="f-label">Growth YoY</div><div class="f-value">${SCR.fmt.signed(p.growth, '%')}</div></div>
            <div class="fact"><div class="f-label">Margin</div><div class="f-value">${SCR.fmt.pct(p.margin)}</div></div>
            <div class="fact"><div class="f-label">VAR</div><div class="f-value">${SCR.fmt.usdM(p.var)}</div></div>
            <div class="fact"><div class="f-label">AVAR</div><div class="f-value">${SCR.fmt.usdM(p.avar)}</div></div>
            <div class="fact"><div class="f-label">Resilience index</div><div class="f-value">${riSpan(p.ri)}</div></div>
            <div class="fact"><div class="f-label">Min TTS</div><div class="f-value">${p.ttsMin} <small>days</small></div></div>
            <div class="fact"><div class="f-label">Max TTR</div><div class="f-value">${p.ttrMax} <small>days</small></div></div>
            <div class="fact"><div class="f-label">Gapped components</div><div class="f-value">${p.gapCount} <small>of ${p.materials.length}</small></div></div>
          </div>
        </div>
        <div class="drawer-section">
          <h3>Resilience index · last 12 months</h3>
          <div class="chart" style="height:130px" id="dpTrend"></div>
        </div>
        <div class="drawer-section">
          <h3>TTS vs TTR by component</h3>
          ${gapLegend}
          ${gapRows(mats.map(m => ({ name: m.name, tts: m.tts, ttr: m.ttr })))}
        </div>
        <div class="drawer-section"><h3>Bill of materials — risk view</h3><div id="dpMats"></div></div>
        <div class="drawer-section">
          <h3>Markets served</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${mkNames.map(n => `<span class="badge neutral plain">${esc(n)}</span>`).join('')}</div>
        </div>
        <div class="drawer-section flex aic gap8 wrap" id="dpBtns">
          <button class="btn btn-primary btn-sm" id="dpAct" data-hint="w-d-act">Create mitigation action</button>
        </div>`;
      body.querySelector('#dpMats').appendChild(table([
        { h: 'Component', cell: m => `<span class="cell-main">${esc(m.name)}</span><span class="cell-sub">${esc(m.sub)}</span>` },
        { h: 'Sourcing', cell: m => m.singleSource ? '<span class="badge critical plain">Single</span>' : '<span class="badge low plain">Dual+</span>' },
        { h: 'Gap', cls: 'num', cell: m => `<span style="color:${m.gap > 0 ? 'var(--status-critical)' : 'var(--status-good)'};font-weight:700">${m.gap > 0 ? '−' + m.gap + 'd' : 'OK'}</span>` },
        { h: 'AVAR', cls: 'num', cell: m => SCR.fmt.usdM(m.avar) },
        { h: 'Risk', cls: 'num', cell: m => scoreSpan(m.score) }
      ], mats, m => openMaterial(m.id)));
      body.querySelector('#dpAct').addEventListener('click', () => createAction({ type: 'product', id: p.id }));
      body.querySelector('#dpBtns').appendChild(askButton(`What breaks ${p.name} first?`));

      SCR.charts.mount(body.querySelector('#dpTrend'), () => {
        const t = SCR.theme.tokens();
        const c = SCR.risk.riColor(p.ri);
        return Object.assign(SCR.theme.baseOption(), {
          grid: { left: 6, right: 10, top: 8, bottom: 2, containLabel: true },
          tooltip: Object.assign(SCR.theme.baseOption().tooltip, { trigger: 'axis' }),
          xAxis: SCR.theme.catAxis(D().monthly.months, { axisLabel: { fontSize: 11.5, color: t.ink3, interval: 2 } }),
          yAxis: SCR.theme.valAxis({ min: 40, max: 100, splitNumber: 3, axisLabel: { formatter: v => v + '%' } }),
          series: [{
            type: 'line', data: p.riTrend, symbol: 'none', smooth: 0.35,
            lineStyle: { width: 2.5, color: c },
            areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: c + '33' }, { offset: 1, color: c + '00' }]) }
          }]
        });
      });
    }, { type: 'product', id: p.id, name: p.name });
  }

  /* ---------------- Site drawer (plant / DC) ---------------- */
  function openSite(id) {
    const isPlant = id.startsWith('PT');
    const site = isPlant ? D().plantById(id) : D().dcById(id);
    if (!site) return;
    openDrawer(isPlant ? 'Plant 360' : 'Distribution center 360', site.name, body => {
      const prods = (site.products || []).map(pid => D().productById(pid)).filter(Boolean);
      let matsHtml = '';
      if (isPlant) {
        const mats = site.materials.map(mid => D().materialById(mid)).filter(Boolean)
          .filter(m => m.gap > 0).sort((a, b) => b.gap - a.gap);
        matsHtml = `<div class="drawer-section">
          <h3>Components that can stop this site (TTR &gt; TTS)</h3>
          ${gapLegend}
          ${gapRows(mats.map(m => ({ name: m.name, tts: m.tts, ttr: m.ttr })))}
        </div>`;
      }
      body.innerHTML = `
        <div class="drawer-section">
          <div class="flex aic gap8" style="margin-bottom:12px">
            ${riBadge(site.ri)}
            <span class="badge neutral plain">${isPlant ? esc(site.focus) : esc(site.region) + ' distribution'}</span>
          </div>
          <div class="facts">
            <div class="fact"><div class="f-label">NTS served</div><div class="f-value">${SCR.fmt.usdM(site.nts)}</div></div>
            <div class="fact"><div class="f-label">Products</div><div class="f-value">${(site.products || []).length}</div></div>
            <div class="fact"><div class="f-label">Site TTR</div><div class="f-value">${site.ttr} <small>days</small></div></div>
            ${isPlant ? `
            <div class="fact"><div class="f-label">Min component TTS</div><div class="f-value">${site.ttsMin} <small>days</small></div></div>
            <div class="fact"><div class="f-label">Critical materials</div><div class="f-value">${site.criticalMats}</div></div>
            <div class="fact"><div class="f-label">Utilization</div><div class="f-value">${site.utilization}<small>%</small></div></div>` : `
            <div class="fact"><div class="f-label">Markets served</div><div class="f-value">${site.marketsServed}</div></div>
            <div class="fact"><div class="f-label">VAR</div><div class="f-value">${SCR.fmt.usdM(site.var)}</div></div>
            <div class="fact"><div class="f-label">AVAR</div><div class="f-value">${SCR.fmt.usdM(site.avar)}</div></div>`}
          </div>
        </div>
        ${matsHtml}
        <div class="drawer-section">
          <h3>Products flowing through this site</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${
            prods.map(p => `<span class="badge neutral plain" style="cursor:pointer" data-prod="${p.id}">${esc(p.name)}</span>`).join('')}
          </div>
        </div>
        <div class="drawer-section flex aic gap8 wrap" id="dsBtns">
          ${isPlant ? '<button class="btn btn-primary btn-sm" id="dsSite">Open Site Resilience view</button>' : ''}
          <button class="btn btn-sm" id="dsSim" data-hint="w-d-sim">Simulate outage</button>
          <button class="btn btn-sm" id="dsAct" data-hint="w-d-act">Create mitigation action</button>
        </div>`;
      body.querySelectorAll('[data-prod]').forEach(n =>
        n.addEventListener('click', () => openProduct(n.dataset.prod)));
      if (isPlant) body.querySelector('#dsSite').addEventListener('click', () => {
        closeDrawer(); SCR.navigate('site', { site: id });
      });
      body.querySelector('#dsSim').addEventListener('click', () =>
        openScenario(id, { why: 'Taking ' + site.name + ' offline on the twin', days: isPlant ? 21 : 14 }));
      body.querySelector('#dsAct').addEventListener('click', () => createAction({ type: isPlant ? 'plant' : 'dc', id }));
      body.querySelector('#dsBtns').appendChild(askButton(`Status of ${site.name}`));
    }, { type: isPlant ? 'plant' : 'dc', id, name: site.name });
  }

  /* ---------------- Alert drawer ---------------- */
  function openAlert(id) {
    const a = D().alertById(id);
    if (!a) return;
    const sups = a.nodes.map(nid => D().supplierById(nid)).filter(Boolean);
    const mats = (a.mats || []).map(mid => D().materialById(mid)).filter(Boolean);
    const skus = new Set();
    mats.forEach(m => D().productsUsing(m.id).forEach(p => skus.add(p.id)));
    const acts = D().actions.filter(x => x.linked === a.id);
    openDrawer(`Alert ${a.id} · ${a.type}`, a.title, body => {
      body.innerHTML = `
        <div class="drawer-section">
          <div class="flex aic gap8" style="margin-bottom:12px">
            ${badge(a.sev === 'critical' ? 'Critical' : a.sev === 'high' ? 'High' : a.sev === 'medium' ? 'Medium' : 'Low')}
            ${statusBadge(a.status)}
            <span class="muted" style="font-size:13px">Routed to ${esc(a.owner)}</span>
          </div>
          <div class="facts">
            <div class="fact"><div class="f-label">Exposure (VAR)</div><div class="f-value">${SCR.fmt.usdM(a.exposure)}</div></div>
            <div class="fact"><div class="f-label">Nodes</div><div class="f-value">${a.nodes.length}</div></div>
            <div class="fact"><div class="f-label">SKUs at risk</div><div class="f-value">${skus.size}</div></div>
          </div>
        </div>
        <div class="drawer-section"><h3>What the agents found</h3>
          <p style="font-size:14.5px;color:var(--ink-2);line-height:1.55">${esc(a.detail)}</p>
        </div>
        ${sups.length ? `<div class="drawer-section"><h3>Impacted nodes</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${
            sups.map(s => `<span class="badge high plain" style="cursor:pointer" data-sup="${s.id}">${esc(s.name)}</span>`).join('')}</div>
        </div>` : ''}
        ${mats.length ? `<div class="drawer-section"><h3>Impacted materials</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${
            mats.map(m => `<span class="badge medium plain" style="cursor:pointer" data-mat="${m.id}">${esc(m.name)}</span>`).join('')}</div>
        </div>` : ''}
        ${acts.length ? `<div class="drawer-section"><h3>Linked mitigation actions</h3>${
          acts.map(x => `<div class="reco">
            <div class="reco-head"><span class="reco-title">${esc(x.title)}</span>${statusBadge(x.status)}</div>
            <div class="reco-meta">
              <span class="rm">Owner<strong style="font-size:14px">${esc(x.owner)}</strong></span>
              <span class="rm">Due<strong style="font-size:14px">${esc(x.due)}</strong></span>
              <span class="rm">AVAR cut<strong class="good">${SCR.fmt.usdM(x.riskCut)}</strong></span>
              ${x.rrePre != null ? `<span class="rm">RRE<strong>${x.rrePre} → ${x.rrePost}</strong></span>` : ''}
            </div>
          </div>`).join('')}</div>` : ''}
        <div class="drawer-section flex aic gap8 wrap" id="daBtns">
          <button class="btn btn-primary btn-sm" id="daAct" data-hint="w-d-act">Create mitigation action</button>
        </div>`;
      body.querySelector('#daAct').addEventListener('click', () => createAction({ type: 'alert', id: a.id }));
      body.querySelector('#daBtns').appendChild(askButton(`How do I resolve ${a.id}?`));
      body.querySelectorAll('[data-sup]').forEach(n =>
        n.addEventListener('click', () => openSupplier(n.dataset.sup)));
      body.querySelectorAll('[data-mat]').forEach(n =>
        n.addEventListener('click', () => openMaterial(n.dataset.mat)));
    }, { type: 'alert', id: a.id, name: a.id + ' · ' + a.type });
  }

  SCR.ui = {
    el, esc, badge, riBadge, statusBadge, scoreSpan, riSpan, meter, riMeter,
    gapRows, gapLegend, dimBars, kpiStrip, cellBar, heatPill, filterBlock, table, card,
    riMatrixGuide, metricGuide, scrollToCard, openInsight, insightBtn, openScenario,
    toast, modal, closeModal, createAction, SPARK,
    openDrawer, closeDrawer,
    openSupplier, openMaterial, openProduct, openSite, openAlert
  };
})();
