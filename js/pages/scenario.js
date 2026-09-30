/* ============================================================
   SCR · pages/scenario.js
   Scenario Studio — disruption simulation on the digital twin.
   Pick a node, disruption type, duration and severity; the
   engine recomputes exposed sales, VAR/AVAR, RI and the best
   mitigation plan live. Baseline vs scenario waterfall,
   impacted-SKU table and ranked mitigation options.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const state = { node: 'S01', type: 'Supplier failure', days: 30, sev: 100 };

  const TYPES = [
    'Supplier failure', 'Plant outage', 'Port / lane disruption',
    'Material shortage', 'Quality recall', 'Cyber incident',
    'Extreme weather', 'Demand spike'
  ];

  const PRESETS = [
    { label: 'CapForm closures failure · 30d', node: 'S01', type: 'Supplier failure', days: 30, sev: 100 },
    { label: 'Taicang MCU export halt · 45d', node: 'S02', type: 'Port / lane disruption', days: 45, sev: 100 },
    { label: 'Pune plant monsoon outage · 21d', node: 'PT5', type: 'Extreme weather', days: 21, sev: 75 },
    { label: 'Rotterdam EDC congestion · 14d', node: 'DC2', type: 'Port / lane disruption', days: 14, sev: 50 }
  ];

  /* ---------------- Engine ---------------- */
  function compute() {
    const D = SCR.data;
    const sev = state.sev / 100;
    const d = state.days;
    const isSup = state.node.startsWith('S');
    const isPlant = state.node.startsWith('PT');
    const node = isSup ? D.supplierById(state.node) : isPlant ? D.plantById(state.node) : D.dcById(state.node);

    let rows = []; // {product, loss}
    let exposed = 0, atRisk = 0;
    let bindingMat = null;

    if (isSup) {
      const mats = D.materialsOf(node.id);
      const perProduct = {};
      mats.forEach(m => {
        const shareFactor = m.singleSource ? 1 : 0.45;
        const uncoveredDays = Math.max(0, d - m.tts);
        if (!bindingMat || uncoveredDays > Math.max(0, d - bindingMat.tts)) bindingMat = m;
        const matRisk = m.depNTS * (uncoveredDays / 365) * sev * shareFactor;
        m.depProducts.forEach(pid => {
          const p = D.productById(pid);
          const share = p.nts / m.depNTS;
          perProduct[pid] = (perProduct[pid] || 0) + matRisk * share;
        });
        atRisk += matRisk;
      });
      exposed = mats.reduce((a, m) => a + m.depNTS * (d / 365) * sev, 0);
      rows = Object.keys(perProduct).map(pid => ({ p: D.productById(pid), loss: perProduct[pid] }));
    } else {
      // site outage: finished-goods buffer of 12 days shields the tail
      const prods = (node.products || []).map(pid => D.productById(pid));
      const uncovered = Math.max(0, d - 12);
      prods.forEach(p => {
        const share = isPlant ? 1 / p.plants.length : 1 / p.dcs.length;
        const ex = p.nts * share * (d / 365) * sev;
        const loss = p.nts * share * (uncovered / 365) * sev;
        exposed += ex; atRisk += loss;
        rows.push({ p, loss });
      });
    }

    rows = rows.filter(r => r.loss > 0.05).sort((a, b) => b.loss - a.loss);
    const avar = atRisk * (0.35 + 0.4 * sev);
    const riNew = Math.max(30, +(SCR.data.kpis.enterpriseRI - (atRisk / SCR.data.kpis.totalNTS) * 100 * 2.6).toFixed(1));

    /* mitigation options, ranked by net benefit */
    const opts = [];
    if (isSup) {
      const single = D.materialsOf(node.id).some(m => m.singleSource);
      opts.push(
        { name: single ? 'Emergency alternate-supplier activation' : 'Shift volume to qualified alternate', cut: single ? 0.58 : 0.72, cost: +(atRisk * 0.045 + 0.3).toFixed(1), time: single ? '3–4 weeks' : '1–2 weeks' },
        { name: 'Safety-stock release + expedited replenishment', cut: 0.34, cost: +(atRisk * 0.03 + 0.2).toFixed(1), time: 'days' },
        { name: 'Approved substitution (where certified)', cut: 0.26, cost: +(atRisk * 0.02 + 0.15).toFixed(1), time: '2–6 weeks' }
      );
    } else if (isPlant) {
      opts.push(
        { name: 'Shift volume to sister plant(s)', cut: 0.62, cost: +(atRisk * 0.05 + 0.4).toFixed(1), time: '1–3 weeks' },
        { name: 'Prioritized allocation to top markets', cut: 0.31, cost: 0.1, time: 'days' },
        { name: 'Co-packer emergency capacity', cut: 0.44, cost: +(atRisk * 0.07 + 0.5).toFixed(1), time: '2–4 weeks' }
      );
    } else {
      opts.push(
        { name: 'Re-route via alternate DC / rail corridor', cut: 0.66, cost: +(atRisk * 0.04 + 0.2).toFixed(1), time: 'days' },
        { name: 'Direct plant-to-market shipping', cut: 0.38, cost: +(atRisk * 0.06 + 0.3).toFixed(1), time: '1 week' }
      );
    }
    opts.sort((a, b) => (b.cut * atRisk - b.cost) - (a.cut * atRisk - a.cost));
    const best = opts[0];
    const residual = atRisk * (1 - best.cut);

    return {
      node, rows, bindingMat,
      exposed: +exposed.toFixed(1),
      atRisk: +atRisk.toFixed(1),
      avar: +avar.toFixed(1),
      riNew, opts,
      residual: +residual.toFixed(1),
      covered: +(exposed - atRisk).toFixed(1)
    };
  }

  /* ---------------- Render ---------------- */
  function render(host, opts) {
    const D = SCR.data, F = SCR.fmt, U = SCR.ui;
    if (opts.node) {
      state.node = opts.node;
      state.type = opts.node.startsWith('S') ? 'Supplier failure' : opts.node.startsWith('PT') ? 'Plant outage' : 'Port / lane disruption';
    }

    const grid = U.el('<div class="grid grid-12"></div>');
    host.appendChild(grid);

    /* ===== Controls ===== */
    const ctrl = U.card({ title: 'Design the disruption', sub: 'the twin recomputes as you move the sliders', cols: 4, noInsight: true });
    grid.appendChild(ctrl);
    ctrl.querySelector('.card-body').innerHTML = `
      <div class="sim-panel">
        <div class="sim-field">
          <label>Node to disrupt</label>
          <select id="scNode">
            <optgroup label="Suppliers">
              ${D.suppliers.map(s => `<option value="${s.id}" ${state.node === s.id ? 'selected' : ''}>${s.name} — ${s.country}</option>`).join('')}
            </optgroup>
            <optgroup label="Plants">
              ${D.plants.map(p => `<option value="${p.id}" ${state.node === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
            </optgroup>
            <optgroup label="Distribution centers">
              ${D.dcs.map(d => `<option value="${d.id}" ${state.node === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
            </optgroup>
          </select>
        </div>
        <div class="sim-field">
          <label>Disruption type</label>
          <select id="scType">${TYPES.map(t => `<option ${state.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </div>
        <div class="sim-field">
          <label>Duration</label>
          <div class="range-row">
            <input type="range" id="scDays" min="7" max="90" step="1" value="${state.days}" />
            <span class="range-val" id="scDaysVal">${state.days} days</span>
          </div>
        </div>
        <div class="sim-field">
          <label>Severity — share of node capacity lost</label>
          <div class="range-row">
            <input type="range" id="scSev" min="25" max="100" step="5" value="${state.sev}" />
            <span class="range-val" id="scSevVal">${state.sev}%</span>
          </div>
        </div>
        <div class="sim-field">
          <label>Presets</label>
          <div class="chip-row">${PRESETS.map((p, i) => `<button class="chip" data-preset="${i}">${p.label}</button>`).join('')}</div>
        </div>
        <button class="btn btn-primary" id="scSave">Save as continuity playbook</button>
      </div>`;

    /* ===== Output panel ===== */
    const out = U.el('<div class="col-8" style="display:flex;flex-direction:column;gap:16px;min-width:0"></div>');
    grid.appendChild(out);

    const cmpWrap = U.el('<div></div>');
    out.appendChild(cmpWrap);

    const wfCard = U.card({
      title: 'Scenario impact bridge', sub: 'exposed sales window → inventory cover → mitigation → residual at risk ($M)',
      chartClass: 'chart-md',
      insight: () => {
        const r = compute();
        const coverPct = r.exposed ? (r.covered / r.exposed) * 100 : 0;
        return {
          agent: 'Scenario Twin Agent',
          reads: [
            { label: 'Sales exposed', value: F.usdM(r.exposed), tone: 'bad' },
            { label: 'Absorbed by cover', value: F.usdM(r.covered), tone: 'good' },
            { label: 'Residual at risk', value: F.usdM(r.residual), tone: 'bad' }
          ],
          points: [
            `Losing <strong>${U.esc(r.node.name)}</strong> for ${state.days} days at ${state.sev}% severity puts ${F.usdM(r.exposed)} of sales inside the disruption window.`,
            `Inventory cover absorbs ${F.usdM(r.covered)} of that — ${coverPct.toFixed(0)}% — which is why time-to-survive matters as much as time-to-recover.`,
            `After the best-ranked mitigation, ${F.usdM(r.residual)} remains at risk. ${r.bindingMat ? `The binding constraint is <strong>${U.esc(r.bindingMat.name)}</strong>.` : ''}`
          ],
          actions: [{ label: 'See ranked mitigations', onClick: () => U.scrollToCard(mitCard) }]
        };
      }
    });
    wfCard.classList.add('col-12');
    out.appendChild(wfCard);

    const noteWrap = U.el('<div></div>');
    out.appendChild(noteWrap);

    /* full-width lower row */
    const prodCard = U.card({
      title: 'Impacted SKUs under this scenario', sub: 'projected revenue loss before mitigation · click for the 360°',
      cols: 7, flush: true,
      insight: () => {
        const r = compute();
        const rows = r.rows.slice().sort((a, b) => b.loss - a.loss);
        const tot = rows.reduce((a, x) => a + x.loss, 0) || 1;
        return {
          agent: 'Scenario Twin Agent',
          reads: [
            { label: 'SKUs impacted', value: rows.length, tone: rows.length ? 'bad' : 'good' },
            { label: 'Projected loss', value: F.usdM(+tot.toFixed(1)), tone: 'bad' },
            { label: 'Worst SKU', value: rows.length ? F.usdM(+rows[0].loss.toFixed(1)) : '—', tone: 'bad' }
          ],
          points: [
            `${rows.length} SKUs lose revenue if <strong>${U.esc(r.node.name)}</strong> goes down for ${state.days} days.`,
            rows.length ? `<strong>${U.esc(rows[0].p.name)}</strong> takes the largest hit at ${F.usdM(+rows[0].loss.toFixed(1))}, ${((rows[0].loss / tot) * 100).toFixed(0)}% of the total.` : 'No SKUs impacted at this setting.',
            'These are pre-mitigation figures — the bridge above shows what the ranked options claw back.'
          ],
          actions: rows.length ? [{ label: '360° on ' + rows[0].p.name, onClick: () => U.openProduct(rows[0].p.id) }] : []
        };
      }
    });
    grid.appendChild(prodCard);

    const mitCard = U.card({
      title: 'Mitigation options — ranked by net benefit', sub: 'risk removed minus cost, feasibility-checked by the Scenario Twin Agent',
      cols: 5,
      insight: () => {
        const r = compute();
        const best = r.opts[0];
        return {
          agent: 'Mitigation Strategist Agent',
          reads: [
            { label: 'Options modelled', value: r.opts.length },
            { label: 'Best net benefit', value: best ? F.usdM(+(best.cut * r.atRisk - best.cost).toFixed(1)) : '—', tone: 'good' },
            { label: 'Risk it removes', value: best ? (best.cut * 100).toFixed(0) + '%' : '—' }
          ],
          points: [
            'Ranking is net benefit — risk removed minus what the lever costs — so an expensive option that removes more risk can still lose to a cheap partial fix.',
            best ? `Top option is <strong>${U.esc(best.name)}</strong>: removes ${(best.cut * 100).toFixed(0)}% of the ${F.usdM(r.atRisk)} at risk for ${F.usdM(best.cost)}.` : 'No options available.',
            `Applying it leaves ${F.usdM(r.residual)} residual — the number worth carrying into an actual decision.`
          ],
          actions: [{ label: 'Open Alerts & Actions', onClick: () => SCR.navigate('actions') }]
        };
      }
    });
    grid.appendChild(mitCard);

    let wfChart = null;

    function update() {
      const r = compute();
      const isSup = state.node.startsWith('S');

      /* compare tiles */
      cmpWrap.innerHTML = '';
      const cmp = U.el(`<div class="cmp-grid">
        <div class="cmp"><div class="c-label">Sales exposed in window</div>
          <div class="c-now">${F.usdM(r.exposed)}</div>
          <div class="c-base">${state.days}d × ${state.sev}% severity</div></div>
        <div class="cmp"><div class="c-label">Net at risk (VAR)</div>
          <div class="c-now" style="color:var(--status-critical)">${F.usdM(r.atRisk)}</div>
          <div class="c-delta bad">inventory covers ${F.usdM(r.covered)}</div></div>
        <div class="cmp"><div class="c-label">Scenario AVAR</div>
          <div class="c-now">${F.usdM(r.avar)}</div>
          <div class="c-base">baseline ${F.usdM(D.kpis.totalAVAR)} total</div></div>
        <div class="cmp"><div class="c-label">Enterprise RI under scenario</div>
          <div class="c-now" style="color:${SCR.risk.riColor(r.riNew)}">${F.ri(r.riNew)}</div>
          <div class="c-delta ${r.riNew < D.kpis.enterpriseRI ? 'bad' : 'good'}">${F.signed(+(r.riNew - D.kpis.enterpriseRI).toFixed(1), ' pts')} vs baseline</div></div>
      </div>`);
      cmpWrap.appendChild(cmp);

      /* waterfall */
      if (wfChart) { try { wfChart.dispose(); } catch (_) {} }
      wfChart = SCR.charts.waterfall(wfCard._chartEl, [
        { label: 'Sales exposed', value: +r.exposed.toFixed(1), type: 'total' },
        { label: 'Covered by inventory (TTS)', value: -Math.max(0, +r.covered.toFixed(1)), type: 'down' },
        { label: 'Best mitigation plan', value: -Math.max(0, +(r.atRisk - r.residual).toFixed(1)), type: 'down' },
        { label: 'Residual at risk', value: +r.residual.toFixed(1), type: 'total' }
      ]);

      /* narrative */
      noteWrap.innerHTML = `<div class="sim-out-note">
        <strong>${U.esc(state.type)}</strong> at <strong>${U.esc(r.node.name)}</strong> for <strong>${state.days} days</strong>
        at ${state.sev}% severity puts <strong>${F.usdM(r.atRisk)}</strong> of NTS at risk across
        <strong>${r.rows.length} SKUs</strong>${r.bindingMat ? ` — the binding constraint is <strong>${U.esc(r.bindingMat.name)}</strong>
        (${r.bindingMat.tts}d cover vs ${r.bindingMat.ttr}d recovery)` : ''}.
        The best plan — <strong>${U.esc(r.opts[0].name)}</strong> — cuts that to
        <strong>${F.usdM(r.residual)}</strong> for ${F.usdM(r.opts[0].cost)} (${U.esc(r.opts[0].time)} to effect).
      </div>`;

      /* impacted products */
      const body = prodCard.querySelector('.card-body');
      body.innerHTML = '';
      body.appendChild(U.table([
        { h: 'SKU', cell: x => `<span class="cell-main">${U.esc(x.p.name)}</span><span class="cell-sub">${U.esc(x.p.sectorName)} · ${U.esc(x.p.stream)}</span>` },
        { h: 'NTS', cls: 'num', cell: x => F.usdM(x.p.nts) },
        { h: 'Projected loss', cls: 'num', cell: x => `<span style="color:var(--status-critical);font-weight:700">${F.usdM(+x.loss.toFixed(1))}</span>` },
        { h: '% of SKU', cls: 'num', cell: x => F.pct(x.loss / x.p.nts * 100) },
        { h: 'RI today', cell: x => U.riMeter(x.p.ri) }
      ], r.rows.slice(0, 8), x => U.openProduct(x.p.id)));

      /* mitigation options */
      const mbody = mitCard.querySelector('.card-body');
      mbody.innerHTML = r.opts.map((o, i) => `
        <div class="reco">
          <div class="reco-head"><span class="reco-title">${i === 0 ? '★ ' : ''}${U.esc(o.name)}</span>
            ${i === 0 ? '<span class="badge accent plain">Best plan</span>' : ''}</div>
          <div class="reco-meta">
            <span class="rm">Risk removed<strong class="good">−${F.usdM(+(r.atRisk * o.cut).toFixed(1))}</strong></span>
            <span class="rm">Cost<strong>${F.usdM(o.cost)}</strong></span>
            <span class="rm">Time to effect<strong style="font-size:14px">${U.esc(o.time)}</strong></span>
          </div>
          <div class="reco-actions">
            <button class="btn btn-sm btn-good" data-apply="${i}">Create action</button>
          </div>
        </div>`).join('');
      mbody.querySelectorAll('[data-apply]').forEach(b =>
        b.addEventListener('click', () => {
          const o = r.opts[+b.dataset.apply];
          U.createAction({ type: 'scenario', result: Object.assign({}, r, { days: state.days, sev: state.sev, type: state.type }), option: o });
        }));
    }

    /* wiring */
    const nodeSel = ctrl.querySelector('#scNode');
    nodeSel.addEventListener('change', () => { state.node = nodeSel.value; update(); });
    ctrl.querySelector('#scType').addEventListener('change', e => { state.type = e.target.value; update(); });
    const daysIn = ctrl.querySelector('#scDays'), daysVal = ctrl.querySelector('#scDaysVal');
    daysIn.addEventListener('input', () => { state.days = +daysIn.value; daysVal.textContent = state.days + ' days'; update(); });
    const sevIn = ctrl.querySelector('#scSev'), sevVal = ctrl.querySelector('#scSevVal');
    sevIn.addEventListener('input', () => { state.sev = +sevIn.value; sevVal.textContent = state.sev + '%'; update(); });
    ctrl.querySelectorAll('[data-preset]').forEach(b =>
      b.addEventListener('click', () => {
        const p = PRESETS[+b.dataset.preset];
        Object.assign(state, { node: p.node, type: p.type, days: p.days, sev: p.sev });
        SCR.navigate('scenario');
      }));
    ctrl.querySelector('#scSave').addEventListener('click', () => {
      const r = compute();
      U.toast('Playbook saved',
        `“${state.type} — ${r.node.name} · ${state.days}d” stored with the best plan (<strong>${U.esc(r.opts[0].name)}</strong>). The Scenario Twin Agent will re-validate it weekly.`, 'good');
    });

    update();
  }

  /* Run the twin on a node without opening the Studio, so a "simulate this"
     affordance can answer in place instead of navigating the user away.
     State is saved and restored, so an inline run never disturbs whatever the
     Studio itself is currently set to. */
  function simulate(nodeId, opts) {
    const saved = Object.assign({}, state);
    try {
      if (nodeId) state.node = nodeId;
      if (opts && opts.days != null) state.days = opts.days;
      if (opts && opts.sev != null) state.sev = opts.sev;
      if (opts && opts.type) state.type = opts.type;
      const r = compute();
      return Object.assign({}, r, { days: state.days, sev: state.sev, type: state.type, node: r.node });
    } finally {
      Object.assign(state, saved);
    }
  }

  /** Open the Studio already set to this node. */
  function openStudio(nodeId, opts) {
    if (nodeId) state.node = nodeId;
    if (opts && opts.days != null) state.days = opts.days;
    if (opts && opts.sev != null) state.sev = opts.sev;
    SCR.navigate('scenario');
  }

  SCR.scenario = { simulate, openStudio };

  SCR.registerPage('scenario', {
    title: 'Scenario Studio',
    context: () => {
      const ent = SCR.ai.nodeEntity(state.node);
      return {
        scope: (ent ? ent.name : state.node) + ' · ' + state.days + 'd · ' + state.sev + '%',
        entity: ent,
        scenario: Object.assign({}, state)
      };
    },
    crumb: 'Simulate disruptions on the digital twin before they happen',
    render
  });
})();
