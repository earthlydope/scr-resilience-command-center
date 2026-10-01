/* ============================================================
   SCR · pages/executive.js
   Executive Summary — persona: Risk & Resilience Leader.
   Modernized from the original: breadcrumb + Filter flyout,
   icon-chip KPI strip with insight bulb, "Product by Wtd.AVAR"
   teal table, "Top 10 Nodes by AVAR" with AVAR/SALES/VAR
   toggle, then the risk landscape (bridge · donut · mekko ·
   mitigation) and the act row (alerts · agent digest · brief).
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const SECTOR_SLOT = { bev: 0, food: 1, hpc: 2, dev: 3 };
  const state = { sector: 'all', stream: 'all' };

  function scopeProducts() {
    return SCR.data.products.filter(p =>
      (state.sector === 'all' || p.sector === state.sector) &&
      (state.stream === 'all' || p.stream === state.stream));
  }

  function sectorAgg() {
    const D = SCR.data;
    return D.sectors.map(sec => {
      const prods = D.products.filter(p => p.sector === sec.key);
      const nts = prods.reduce((a, p) => a + p.nts, 0);
      return {
        key: sec.key, name: sec.name, nts,
        var: +prods.reduce((a, p) => a + p.var, 0).toFixed(1),
        avar: +prods.reduce((a, p) => a + p.avar, 0).toFixed(1),
        ri: +(prods.reduce((a, p) => a + p.ri * p.nts, 0) / nts).toFixed(1),
        products: prods.length,
        gaps: prods.filter(p => p.gapMax > 0).length
      };
    });
  }

  function mekkoData() {
    const D = SCR.data;
    const regions = [...new Set(D.markets.map(m => m.region))];
    const values = {};
    regions.forEach(r => { values[r] = {}; D.sectors.forEach(s => { values[r][s.name] = 0; }); });
    D.products.forEach(p => {
      const mks = p.markets.map(id => D.marketById(id));
      const tot = mks.reduce((a, m) => a + m.nts, 0);
      mks.forEach(mk => { values[mk.region][p.sectorName] += p.nts * (mk.nts / tot); });
    });
    regions.forEach(r => D.sectors.forEach(s => { values[r][s.name] = +values[r][s.name].toFixed(0); }));
    const cols = regions.slice().sort((a, b) =>
      Object.values(values[b]).reduce((x, y) => x + y, 0) - Object.values(values[a]).reduce((x, y) => x + y, 0));
    return { cols, cats: D.sectors.map(s => s.name), values };
  }

  function openInsights(prods) {
    const D = SCR.data, F = SCR.fmt, esc = SCR.ui.esc;
    const worst = prods.slice().sort((a, b) => b.avar - a.avar).slice(0, 3);
    const gapped = prods.filter(p => p.gapMax > 0);
    const pending = D.recommendations.filter(r => r.status === 'pending');
    SCR.ui.modal('Generated insights — Executive Summary', `
      <ul>
        <li><strong>${esc(worst[0].name)}</strong> carries the largest adjusted exposure in scope
          (${F.usdM(worst[0].avar)} AVAR on ${F.usdM(worst[0].nts)} NTS · RI ${F.ri(worst[0].ri)}).</li>
        <li><strong>${gapped.length} of ${prods.length} products</strong> in scope have at least one component
          whose recovery outlives inventory (TTR &gt; TTS) — the largest gap is
          <strong>${Math.max(...prods.map(p => p.gapMax))} days</strong>.</li>
        <li>Single-source concentration: <strong>${D.kpis.singleSourceRisky} risky sole-sourced materials</strong>
          drive ${F.usdM(+D.materials.filter(m => m.singleSource && m.score >= 2.8).reduce((a, m) => a + m.avar, 0).toFixed(1))}
          of AVAR — closures, MCU and enzymes lead.</li>
        <li><strong>${pending.length} agent recommendations</strong> are pending approval, protecting
          ${F.usdM(+pending.reduce((a, r) => a + r.exposure, 0).toFixed(1))} of exposure.</li>
        <li>Mitigation executed YTD has removed <strong>${F.usdM(D.kpis.mitigatedYtd)}</strong> of AVAR;
          enterprise RI recovered <strong>${F.signed(D.kpis.riDelta, ' pts')}</strong> this month.</li>
      </ul>
      <p class="muted" style="font-size:14px">Composed by the Impact &amp; VAR Agent from the current filter scope.</p>`);
  }

  function openExecBrief() {
    const D = SCR.data, F = SCR.fmt, esc = SCR.ui.esc;
    const secs = sectorAgg().slice().sort((a, b) => b.avar - a.avar);
    const topAlerts = D.alerts.filter(a => a.status !== 'closed' && a.sev === 'critical');
    const pending = D.recommendations.filter(r => r.status === 'pending')
      .slice().sort((a, b) => b.exposure - a.exposure);
    const h4 = 'font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin:15px 0 6px';
    SCR.ui.modal('Executive resilience brief — 10 Jul 2026', `
      <div style="font-size:15px;line-height:1.62;color:var(--ink-2)">
        <p style="margin:0 0 4px">${esc(D.company)} carries <strong style="color:var(--ink)">${F.usdM(D.kpis.totalVAR)} value at risk</strong>
          (${F.usdM(D.kpis.totalAVAR)} probability-adjusted) against ${F.usdM(D.kpis.totalNTS)} of NTS.
          Enterprise RI is <strong>${D.kpis.enterpriseRI}%</strong> (${F.signed(D.kpis.riDelta, ' pts')} vs last month);
          ${D.kpis.gapMaterials} components still recover slower than inventory survives.
          The agentic layer has mitigated <strong>${F.usdM(D.kpis.mitigatedYtd)}</strong> of AVAR YTD.</p>
        <h4 style="${h4}">Where the risk concentrates</h4>
        <ul style="margin:0;padding-left:18px">
          ${secs.slice(0, 3).map(s => `<li style="margin:3px 0"><strong style="color:var(--ink)">${esc(s.name)}</strong>
            — ${F.usdM(s.avar)} AVAR · RI ${s.ri}% · ${s.gaps} of ${s.products} products gapped</li>`).join('')}
        </ul>
        <h4 style="${h4}">Critical alerts open</h4>
        <ul style="margin:0;padding-left:18px">
          ${topAlerts.map(a => `<li style="margin:3px 0"><strong style="color:var(--ink)">${esc(a.title)}</strong></li>`).join('')}
        </ul>
        <h4 style="${h4}">Decisions pending</h4>
        <p style="margin:0"><strong style="color:var(--ink)">${pending.length} agent recommendations</strong> await approval.
          The largest — “${esc(pending[0].title)}” — protects ${F.usdM(pending[0].exposure)}
          (${esc(pending[0].riskCut)}, ${esc(pending[0].cost)}).</p>
        <h4 style="${h4}">Recommended focus</h4>
        <p style="margin:0">Approve the closures tooling transfer before Pune cover — now 6 days — is exhausted;
          fund the MCU air-freight bridge while second-source qualification matures; lock the arabica forward-buy
          inside the frost window; hold the AirPure channel gate until component cover reaches 21 days.</p>
      </div>`);
  }

  function render(host) {
    const D = SCR.data, F = SCR.fmt, U = SCR.ui;
    const scopeStr = `Sector: ${state.sector === 'all' ? 'All' : D.sectorName(state.sector)} ; Value Stream: ${state.stream === 'all' ? 'All' : state.stream}`;
    SCR.setCrumbs([{ label: 'Executive Summary' }], scopeStr);

    /* ===== Today: greeting + headline numbers, with the agents' briefing beside it ===== */
    const today = U.el('<section class="today"></section>');
    today.appendChild(U.el(`<div class="hero">
      <div>
        <div class="today-eyebrow"><span class="live-dot"></span>Executive Summary · ${U.esc(SCR.brief.asOfLong())}</div>
        <h1 class="today-title" data-hint="w-today">${SCR.brief.greeting()}. <span class="ai-text">${F.usdM(D.kpis.totalAVAR)}</span> of adjusted value is at risk across ${D.products.length} products.</h1>
        <p class="today-sub">End-to-end visibility of vulnerabilities across every product, material, supplier, plant, DC and market.
          Sensing, impact maths and mitigation run continuously on the agentic layer — you approve the moves that matter.</p>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="hs-val">${F.usdM(D.kpis.totalNTS)}</div><div class="hs-label">NTS in scope</div></div>
        <div class="hero-stat"><div class="hs-val">${F.usdM(D.kpis.totalVAR)}</div><div class="hs-label">Value at risk</div></div>
        <div class="hero-stat"><div class="hs-val">${D.kpis.enterpriseRI}%</div><div class="hs-label">Enterprise RI · ${F.signed(D.kpis.riDelta, ' pts')}</div></div>
        <div class="hero-stat"><div class="hs-val">${D.kpis.gapMaterials}</div><div class="hs-label">TTR &gt; TTS components</div></div>
        <div class="hero-stat"><div class="hs-val">${F.usdM(D.kpis.mitigatedYtd)}</div><div class="hs-label">Mitigated YTD</div></div>
        <div class="hero-stat"><div class="hs-val">${D.kpis.detectionLeadDays}d</div><div class="hs-label">Detection lead</div></div>
      </div>
    </div>`));
    today.appendChild(SCR.brief.card('rrl'));
    host.appendChild(today);

    /* ===== Filter flyout ===== */
    const streams = state.sector === 'all'
      ? D.sectors.flatMap(s => s.streams)
      : D.sectors.find(s => s.key === state.sector).streams;
    host.appendChild(U.filterBlock([
      {
        id: 'exSector', label: 'Sector',
        options: [{ v: 'all', label: 'All sectors', sel: state.sector === 'all' }]
          .concat(D.sectors.map(s => ({ v: s.key, label: s.name, sel: state.sector === s.key }))),
        onChange: v => { state.sector = v; state.stream = 'all'; SCR.navigate('executive'); }
      },
      {
        id: 'exStream', label: 'Value stream',
        options: [{ v: 'all', label: 'All value streams', sel: state.stream === 'all' }]
          .concat(streams.map(s => ({ v: s, label: s, sel: state.stream === s }))),
        onChange: v => { state.stream = v; SCR.navigate('executive'); }
      }
    ], 'Thresholds: RI ≥ 60 · gap ≤ 0 days · configurable per BU'));

    const prods = scopeProducts();
    if (!prods.length) {
      host.appendChild(U.el('<div class="empty">No products match this scope.</div>'));
      return;
    }
    const nts = prods.reduce((a, p) => a + p.nts, 0);
    const avar = +prods.reduce((a, p) => a + p.avar, 0).toFixed(1);
    const mkts = new Set(prods.flatMap(p => p.markets));
    const supSet = new Set();
    prods.forEach(p => p.materials.forEach(m => D.materialById(m).suppliers.forEach(s => supSet.add(s))));
    const siteSet = new Set(prods.flatMap(p => p.plants.concat(p.dcs)));

    /* ===== KPI strip (every tile drills to its analysis) ===== */
    const go = id => () => U.scrollToCard(document.getElementById(id));
    host.appendChild(U.kpiStrip([
      { icon: 'risk', color: 0, label: 'NTS', value: F.num(Math.round(nts)), sub: 'MM USD · open Value Streams', onClick: () => SCR.navigate('valuestream', { sector: state.sector }) },
      { icon: 'dollar', color: 5, label: 'Wtd. AVAR', value: F.num(Math.round(avar * 10) / 10), sub: F.usdM(+prods.reduce((a, p) => a + p.var, 0).toFixed(1)) + ' VAR', subClass: 'bad', onClick: go('exExposure') },
      { icon: 'box', color: 4, label: 'Products', value: prods.length, sub: 'by Wtd. AVAR', onClick: go('exExposure') },
      { icon: 'globe', color: 2, label: 'Countries', value: mkts.size, sub: 'region × sector mix', onClick: go('exMekko') },
      { icon: 'pin', color: 3, label: 'Nodes', value: supSet.size + siteSet.size, sub: 'top-10 ranking', onClick: go('exTopNodes') },
      { icon: 'truck', color: 1, label: 'Supplier / EM', value: supSet.size, sub: 'open Category Leader', onClick: () => SCR.navigate('category') },
      { icon: 'factory', color: 6, label: 'Plants & DCs', value: siteSet.size, sub: 'open Site Resilience', onClick: () => SCR.navigate('site') }
    ], { bulb: { onClick: () => openInsights(prods) } }));

    const grid = U.el('<div class="grid grid-12"></div>');
    host.appendChild(grid);

    /* ===== LEFT · Product by Wtd.AVAR (teal table, from the original) ===== */
    const prodCard = U.card({
      title: 'Product by Wtd. AVAR (MM USD)',
      sub: 'ranked by adjusted exposure · click a row for the SKU 360°',
      cols: 6, flush: true,
      insight: () => {
        const r = prods.slice().sort((a, b) => b.avar - a.avar);
        const top3 = r.slice(0, 3), share = r.length ? (top3.reduce((a, p) => a + p.avar, 0) / r.reduce((a, p) => a + p.avar, 0)) * 100 : 0;
        const weak = r.filter(p => p.ri < 60);
        return {
          agent: 'Impact & VAR Agent',
          reads: [
            { label: 'Products in scope', value: r.length },
            { label: 'Top 3 share of AVAR', value: share.toFixed(0) + '%', tone: share > 40 ? 'bad' : '' },
            { label: 'RI below 60', value: weak.length, tone: weak.length ? 'bad' : 'good' }
          ],
          points: [
            top3.length ? `<strong>${U.esc(top3[0].name)}</strong> carries the most adjusted exposure at ${top3[0].avar.toFixed(1)}M, on ${F.usdM(top3[0].nts)} of net sales.` : 'No products in this scope.',
            `The top 3 products account for ${share.toFixed(0)}% of AVAR here — exposure is ${share > 40 ? 'concentrated, so a few fixes move the number' : 'spread broadly, so expect incremental gains'}.`,
            weak.length ? `${weak.length} product${weak.length === 1 ? '' : 's'} sit${weak.length === 1 ? 's' : ''} below an RI of 60 and should be triaged first: ${weak.slice(0, 3).map(p => U.esc(p.name)).join(', ')}.` : 'Every product in scope holds an RI of 60 or better.'
          ],
          actions: [
            { label: 'Open Value Streams', onClick: () => SCR.navigate('valuestream') },
            top3.length ? { label: '360° on ' + top3[0].name, onClick: () => U.openProduct(top3[0].id) } : null
          ].filter(Boolean)
        };
      }
    });
    prodCard.id = 'exExposure';
    grid.appendChild(prodCard);
    const body = prodCard.querySelector('.card-body');
    body.style.maxHeight = '424px';
    body.style.overflowY = 'auto';
    const ranked = prods.slice().sort((a, b) => b.avar - a.avar);
    const tbl = U.table([
      { h: 'Sector', cell: p => `<span style="font-size:14px">${U.esc(p.sectorName)}</span>` },
      { h: 'Value Stream', cell: p => `<span style="font-size:14px">${U.esc(p.stream)}</span>` },
      { h: 'Product', cell: p => `<span class="cell-main">${U.esc(p.name)}</span>` },
      { h: 'NTS (MM USD)', cls: 'num', cell: p => F.num(p.nts) },
      { h: 'Total Wtd. AVAR ▾', cls: 'num', cell: p => `<strong>${p.avar.toFixed(1)}</strong>` },
      { h: 'RI', cell: p => U.riMeter(p.ri) }
    ], ranked, p => U.openProduct(p.id));
    tbl.querySelector('table').classList.add('tbl-teal');
    body.appendChild(tbl);

    /* ===== RIGHT · Top 10 nodes (AVAR/SALES/VAR toggle, from the original) ===== */
    let rankBy = 'avar';
    const seg = U.el(`<div class="seg">
      <button data-k="avar" class="active">AVAR</button>
      <button data-k="sales">SALES</button>
      <button data-k="var">VAR</button>
    </div>`);
    const nodesCard = U.card({
      title: 'Top 10 Nodes by Adjusted Value at Risk (MM USD)',
      sub: 'suppliers, plants and DCs · click a bar for the node 360°',
      cols: 6, chartClass: 'chart-lg', actions: [seg],
      insight: () => {
        const top = D.nodes.slice().sort((a, b) => b[rankBy] - a[rankBy]).slice(0, 10);
        const all = D.nodes.reduce((a, n) => a + n[rankBy], 0);
        const share = all ? (top.reduce((a, n) => a + n[rankBy], 0) / all) * 100 : 0;
        const byType = {};
        top.forEach(n => { byType[n.type] = (byType[n.type] || 0) + 1; });
        const label = rankBy === 'avar' ? 'AVAR' : rankBy === 'var' ? 'VAR' : 'sales impacted';
        return {
          agent: 'Network Sensing Agent',
          reads: [
            { label: 'Ranking by', value: label },
            { label: 'Top-10 share', value: share.toFixed(0) + '%', tone: share > 50 ? 'bad' : '' },
            { label: 'Worst node', value: top.length ? top[0][rankBy].toFixed(1) + 'M' : '—', tone: 'bad' }
          ],
          points: [
            top.length ? `<strong>${U.esc(top[0].name)}</strong> (${U.esc(top[0].type)}) leads on ${label} at ${top[0][rankBy].toFixed(1)}M.` : 'No nodes ranked.',
            `These 10 nodes carry ${share.toFixed(0)}% of all ${label} across the network — ${share > 50 ? 'a genuine concentration, so node-level fixes are the highest-leverage move' : 'the risk is comparatively distributed'}.`,
            `Mix in the top 10: ${Object.entries(byType).map(([t, c]) => `${c} ${t.toLowerCase()}${c === 1 ? '' : 's'}`).join(', ')}. Switching the toggle re-ranks by ${rankBy === 'avar' ? 'raw VAR or sales impacted' : 'AVAR'} to test whether the same names persist.`
          ],
          actions: [
            { label: 'Open Network Explorer', onClick: () => SCR.navigate('network') },
            top.length ? { label: '360° on ' + top[0].name, onClick: () => top[0].type === 'Supplier' ? U.openSupplier(top[0].id) : U.openSite(top[0].id) } : null
          ].filter(Boolean)
        };
      }
    });
    nodesCard.id = 'exTopNodes';
    grid.appendChild(nodesCard);
    const rankedNodes = () => D.nodes.slice().sort((a, b) => b[rankBy] - a[rankBy]).slice(0, 10).reverse();
    const nodesChart = SCR.charts.mount(nodesCard._chartEl, () => {
      const t = SCR.theme.tokens();
      const top = rankedNodes();
      const label = { avar: 'AVAR', sales: 'Sales linked', var: 'VAR' }[rankBy];
      return Object.assign(SCR.theme.baseOption(), {
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, {
          formatter: p => {
            const n = top[p.dataIndex];
            return `<strong>${n.name}</strong> · ${n.type}<br/>AVAR ${F.usdM(n.avar)} · VAR ${F.usdM(n.var)}<br/>Sales linked ${F.usdM(n.sales)} · RI ${F.ri(n.ri)}`;
          }
        }),
        legend: { show: false },
        grid: { left: 8, right: 52, top: 6, bottom: 4, containLabel: true },
        xAxis: SCR.theme.valAxis({ axisLabel: { formatter: v => F.num(v) } }),
        yAxis: Object.assign(SCR.theme.catAxis(top.map(n => n.name)), {
          axisLabel: { color: t.ink2, fontSize: 12.5, width: 168, overflow: 'truncate' }
        }),
        series: [{
          name: label, type: 'bar',
          data: top.map(n => +n[rankBy].toFixed(1)),
          barMaxWidth: 15,
          itemStyle: { color: t.series[4], borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', fontSize: 12, color: t.ink2, formatter: p => F.num(p.value) }
        }]
      });
    });
    if (nodesChart) nodesChart.on('click', p => {
      const n = rankedNodes()[p.dataIndex];
      if (n.type === 'Supplier') U.openSupplier(n.id); else U.openSite(n.id);
    });
    seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      rankBy = b.dataset.k;
      seg.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      SCR.charts.rerenderAll();
    }));

    /* ===== Risk landscape ===== */
    grid.appendChild(U.el('<div class="section-title col-12">Risk landscape</div>'));

    const wfCard = U.card({
      title: 'Adjusted value-at-risk bridge', sub: 'FY26 opening → today ($M AVAR) · decreases are risk removed',
      cols: 7, chartClass: 'chart-md',
      insight: () => {
        const steps = D.avarBridge.steps || [];
        const ups = steps.filter(s => s.type === 'up'), downs = steps.filter(s => s.type === 'down');
        const biggestUp = ups.slice().sort((a, b) => b.value - a.value)[0];
        const biggestDown = downs.slice().sort((a, b) => a.value - b.value)[0];
        return {
          agent: 'Mitigation Strategist Agent',
          reads: [
            { label: 'Risk added', value: '+' + ups.reduce((a, s) => a + s.value, 0).toFixed(1) + 'M', tone: 'bad' },
            { label: 'Risk removed', value: downs.reduce((a, s) => a + s.value, 0).toFixed(1) + 'M', tone: 'good' },
            { label: 'Closing AVAR', value: F.usdM(D.kpis.totalAVAR) }
          ],
          points: [
            'Read this left to right: the opening bar is where FY26 started, each middle bar is what moved AVAR since, and the closing bar is where the enterprise stands today.',
            biggestUp ? `The largest single addition is <strong>${U.esc(biggestUp.label)}</strong> at +${biggestUp.value.toFixed(1)}M — this is where new exposure entered the book.` : 'No step added exposure this year.',
            biggestDown ? `The largest reduction is <strong>${U.esc(biggestDown.label)}</strong> at ${biggestDown.value.toFixed(1)}M, which is the ${F.usdM(D.kpis.mitigatedYtd)} retired year to date.` : 'No mitigation steps have landed yet.'
          ],
          actions: [{ label: 'See the programs behind this', onClick: () => SCR.navigate('actions') }]
        };
      }
    });
    grid.appendChild(wfCard);
    SCR.charts.waterfall(wfCard._chartEl, D.avarBridge.steps);

    const secs = sectorAgg();
    const donutCard = U.card({
      title: 'AVAR by sector', sub: 'probability-adjusted exposure mix',
      cols: 5, chartClass: 'chart-md',
      insight: () => {
        const s = secs.slice().sort((a, b) => b.avar - a.avar);
        const total = s.reduce((a, x) => a + x.avar, 0) || 1;
        const lead = s[0], leadPct = lead ? (lead.avar / total) * 100 : 0;
        return {
          agent: 'Impact & VAR Agent',
          reads: [
            { label: 'Total AVAR', value: F.usdM(D.kpis.totalAVAR), tone: 'bad' },
            { label: 'Largest sector', value: lead ? lead.name : '—' },
            { label: 'Its share', value: leadPct.toFixed(0) + '%' }
          ],
          points: [
            lead ? `<strong>${U.esc(lead.name)}</strong> holds ${F.usdM(lead.avar)} of adjusted exposure — ${leadPct.toFixed(0)}% of the enterprise total.` : 'No sector data in scope.',
            leadPct > 40
              ? 'One sector dominating this mix means enterprise AVAR is effectively a bet on that sector\'s supply base.'
              : 'No single sector dominates, so exposure is a portfolio problem rather than one sector\'s problem.',
            `Ranked order: ${s.slice(0, 4).map(x => `${U.esc(x.name)} ${F.usdM(x.avar)}`).join(' · ')}.`
          ],
          actions: [{ label: 'Break down by region × sector', onClick: () => U.scrollToCard(document.getElementById('exMekko')) }]
        };
      }
    });
    grid.appendChild(donutCard);
    const donut = SCR.charts.mount(donutCard._chartEl, () => {
      const t = SCR.theme.tokens();
      return Object.assign(SCR.theme.baseOption(), {
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, {
          trigger: 'item',
          formatter: p => `<strong>${p.name}</strong><br/>${F.usdM(p.value)} AVAR · ${p.percent.toFixed(1)}% of total`
        }),
        legend: Object.assign(SCR.theme.baseOption().legend, { bottom: 0, left: 'center', itemGap: 12 }),
        title: {
          text: F.usdM(D.kpis.totalAVAR), subtext: 'total AVAR',
          left: 'center', top: '40%',
          textStyle: { color: t.ink, fontSize: 23, fontWeight: 700 },
          subtextStyle: { color: t.ink3, fontSize: 13 }
        },
        series: [{
          type: 'pie', radius: ['58%', '80%'], center: ['50%', '46%'],
          label: { show: false }, labelLine: { show: false },
          data: secs.map(s => ({
            name: s.name, value: s.avar,
            itemStyle: { color: t.series[SECTOR_SLOT[s.key]], borderColor: t.surface, borderWidth: 2 }
          }))
        }]
      });
    });
    if (donut) donut.on('click', p => {
      const sec = D.sectors.find(s => s.name === p.name);
      if (sec) SCR.navigate('valuestream', { sector: sec.key });
    });

    const mekkoCard = U.card({
      title: 'NTS by region × sector (mekko)', sub: 'column width = regional NTS · segment = sector share',
      cols: 7, chartClass: 'chart-md',
      insight: () => {
        const m = mekkoData();
        const colTotal = c => Object.values(m.values[c]).reduce((a, b) => a + b, 0);
        const grand = m.cols.reduce((a, c) => a + colTotal(c), 0) || 1;
        const lead = m.cols[0];
        const leadMix = lead ? Object.entries(m.values[lead]).sort((a, b) => b[1] - a[1])[0] : null;
        return {
          agent: 'Impact & VAR Agent',
          reads: [
            { label: 'Regions', value: m.cols.length },
            { label: 'Largest region', value: lead || '—' },
            { label: 'Its NTS share', value: lead ? ((colTotal(lead) / grand) * 100).toFixed(0) + '%' : '—' }
          ],
          points: [
            'Column width is regional net sales and segment height is that sector\'s share, so area equals revenue — wide columns are where the money is, not just where the risk is.',
            lead ? `<strong>${U.esc(lead)}</strong> is the widest column at ${F.usdM(colTotal(lead))} NTS, ${((colTotal(lead) / grand) * 100).toFixed(0)}% of the total.` : 'No regional data.',
            leadMix ? `Inside ${U.esc(lead)}, <strong>${U.esc(leadMix[0])}</strong> is the largest sector at ${F.usdM(leadMix[1])} — a disruption there hits the widest part of the book.` : ''
          ].filter(Boolean),
          actions: [{ label: 'Trace it in the network', onClick: () => SCR.navigate('network') }]
        };
      }
    });
    mekkoCard.id = 'exMekko';
    grid.appendChild(mekkoCard);
    SCR.charts.mekko(mekkoCard._chartEl, mekkoData());

    const mitKeys = Object.keys(D.monthly.mitigatedCum);
    const areaCard = U.card({
      title: 'Cumulative AVAR mitigated', sub: 'FY26 by mitigation lever ($M)',
      cols: 5, chartClass: 'chart-md',
      insight: () => {
        const last = a => (a && a.length ? a[a.length - 1] : 0);
        const byLever = mitKeys.map(k => ({ k, v: last(D.monthly.mitigatedCum[k]) })).sort((a, b) => b.v - a.v);
        const total = byLever.reduce((a, x) => a + x.v, 0);
        return {
          agent: 'Mitigation Strategist Agent',
          reads: [
            { label: 'Mitigated YTD', value: F.usdM(+total.toFixed(1)), tone: 'good' },
            { label: 'Top lever', value: byLever.length ? byLever[0].k : '—' },
            { label: 'Levers running', value: mitKeys.length }
          ],
          points: [
            `Bands are stacked, so the top edge is total AVAR retired — ${F.usdM(+total.toFixed(1))} by the latest month, which is the same figure as the bridge's mitigated step.`,
            byLever.length ? `<strong>${U.esc(byLever[0].k)}</strong> contributes most at ${F.usdM(+byLever[0].v.toFixed(1))}, ${total ? ((byLever[0].v / total) * 100).toFixed(0) : 0}% of everything retired.` : '',
            byLever.length > 1 ? `Weakest lever is <strong>${U.esc(byLever[byLever.length - 1].k)}</strong> at ${F.usdM(+byLever[byLever.length - 1].v.toFixed(1))} — worth asking whether it is under-funded or simply slower to land.` : ''
          ].filter(Boolean),
          actions: [{ label: 'Open Alerts & Actions', onClick: () => SCR.navigate('actions') }]
        };
      }
    });
    grid.appendChild(areaCard);
    SCR.charts.mount(areaCard._chartEl, () => {
      const t = SCR.theme.tokens();
      return Object.assign(SCR.theme.baseOption(), {
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, {
          trigger: 'axis',
          formatter: ps => {
            let tot = 0, h = `<strong>${ps[0].axisValue}</strong>`;
            ps.forEach(p => { tot += p.value; h += `<br/>${p.marker} ${p.seriesName}: <strong>${F.usdM(p.value)}</strong>`; });
            return h + `<br/><span style="opacity:.65">Total mitigated ${F.usdM(+tot.toFixed(1))}</span>`;
          }
        }),
        legend: Object.assign(SCR.theme.baseOption().legend, { bottom: 0, left: 'center' }),
        grid: { left: 8, right: 14, top: 14, bottom: 30, containLabel: true },
        xAxis: SCR.theme.catAxis(D.monthly.months, { axisLabel: { color: SCR.theme.tokens().ink3, fontSize: 12.5, interval: 2 } }),
        yAxis: SCR.theme.valAxis({ axisLabel: { formatter: v => '$' + v + 'M' } }),
        series: mitKeys.map((k, i) => ({
          name: k, type: 'line', stack: 'mit', smooth: false, symbol: 'none',
          data: D.monthly.mitigatedCum[k],
          lineStyle: { width: 2, color: t.series[i] },
          itemStyle: { color: t.series[i] },
          areaStyle: { color: t.series[i], opacity: 0.30 }
        }))
      });
    });

    /* ===== Act ===== */
    grid.appendChild(U.el('<div class="section-title col-12">Act on it</div>'));

    const alertsCard = U.card({
      title: 'Highest-priority alerts', sub: 'ranked by severity × exposure · click to inspect',
      cols: 7, flush: true,
      insight: () => {
        const openA = D.alerts.filter(a => a.status !== 'closed');
        const crit = openA.filter(a => a.sev === 'critical');
        const exp = +openA.reduce((a, x) => a + x.exposure, 0).toFixed(1);
        const top = openA.slice().sort((a, b) => b.exposure - a.exposure)[0];
        return {
          agent: 'Network Sensing Agent',
          reads: [
            { label: 'Open alerts', value: openA.length },
            { label: 'Critical', value: crit.length, tone: crit.length ? 'bad' : 'good' },
            { label: 'Exposure', value: F.usdM(exp), tone: 'bad' }
          ],
          points: [
            `${openA.length} exceptions are unresolved, carrying ${F.usdM(exp)} of linked value at risk.`,
            crit.length ? `${crit.length} are critical — a node already failing, or one that will inside its time-to-survive.` : 'Nothing is currently critical.',
            top ? `Largest single exposure is <strong>${U.esc(top.title)}</strong> at ${F.usdM(top.exposure)}, owned by ${U.esc(top.owner)}.` : ''
          ].filter(Boolean),
          actions: [{ label: 'Open the full inbox', onClick: () => SCR.navigate('actions') }]
        };
      }
    });
    grid.appendChild(alertsCard);
    const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
    const topAlerts = D.alerts.filter(a => a.status !== 'closed')
      .slice().sort((a, b) => (sevRank[a.sev] - sevRank[b.sev]) || (b.exposure - a.exposure)).slice(0, 6);
    alertsCard.querySelector('.card-body').appendChild(U.table([
      { h: 'Alert', cell: a => `<span class="cell-main">${U.esc(a.title)}</span><span class="cell-sub">${U.esc(a.type)} · routed to ${U.esc(a.owner)}</span>` },
      { h: 'Severity', cell: a => U.badge(a.sev === 'critical' ? 'Critical' : a.sev === 'high' ? 'High' : a.sev === 'medium' ? 'Medium' : 'Low') },
      { h: 'Exposure', cls: 'num', cell: a => F.usdM(a.exposure) },
      { h: 'Status', cell: a => U.statusBadge(a.status) }
    ], topAlerts, a => U.openAlert(a.id)));

    const btnAgents = U.el('<button class="btn btn-sm">Open Recommendations</button>');
    btnAgents.addEventListener('click', () => SCR.navigate('agents'));
    const btnBrief = U.el('<button class="btn btn-sm btn-primary">Generate exec brief</button>');
    btnBrief.addEventListener('click', openExecBrief);
    const digestCard = U.card({
      title: 'Agentic layer — latest', sub: 'live feed from the 6 resilience agents',
      cols: 5, actions: [btnAgents, btnBrief],
      insight: () => ({
        agent: 'Resilience Copilot',
        reads: [
          { label: 'Agents running', value: 6 },
          { label: 'Open alerts raised', value: D.alerts.filter(a => a.status !== 'closed').length },
          { label: 'Actions in flight', value: D.kpis.openActions }
        ],
        points: [
          'Six agents run continuously: Network Sensing watches for signals, Impact & VAR prices them, TTS Watch tracks inventory cover, Mitigation Strategist proposes fixes, Execution & Workflow lands them, and Scenario Twin stress-tests them.',
          'This feed is the audit trail — every alert and recommendation elsewhere in the product traces back to one of these agents, so nothing here is unattributed.',
          `They are currently holding ${D.alerts.filter(a => a.status !== 'closed').length} open alerts and ${D.kpis.openActions} actions in flight.`
        ],
        actions: [{ label: 'Open Recommendations', onClick: () => SCR.navigate('agents') }]
      })
    });
    grid.appendChild(digestCard);
    const feedWrap = U.el('<div class="feed"></div>');
    D.feed.slice(0, 5).forEach(f => {
      const a = D.agents.find(x => x.key === f.agent) || { name: f.agent, color: 1 };
      feedWrap.appendChild(U.el(`<div class="feed-item">
        <span style="width:9px;height:9px;border-radius:50%;background:var(--series-${a.color});flex-shrink:0;margin-top:6px"></span>
        <div class="feed-body">
          <span class="f-agent" style="color:var(--series-${a.color})">${U.esc(a.name)}</span>
          <div class="f-text">${f.text}</div>
        </div>
        <span class="feed-time">${U.esc(f.time)} UTC</span>
      </div>`));
    });
    digestCard.querySelector('.card-body').appendChild(feedWrap);
  }

  SCR.registerPage('executive', {
    context: () => ({
      scope: (state.sector === 'all' ? 'All sectors' : SCR.data.sectorName(state.sector)) + (state.stream === 'all' ? '' : ' · ' + state.stream),
      filters: Object.assign({}, state),
      products: scopeProducts()
    }),
    title: 'Executive Summary',
    render
  });
})();
