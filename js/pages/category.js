/* ============================================================
   SCR · pages/category.js
   Category Leader — persona cockpit, modernized from the
   original Category Leader dashboards:
   · Filter flyout · KPI strip with alternate-coverage progress
   · VAR vs RRE and VAR vs Current-Year-Spend scatters with
     range sliders (dataZoom)
   · "Category Leader Node Data Summary" — multi-measure table
     with in-cell bars (NTS · Sales Impacted · VAR · AVAR)
   · "Node Risk Summary" — risk-factor heat cells per supplier
   · spend tree map + driver profile · alternate sourcing
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const CAT_SLOT = { ing: 0, pkg: 1, elc: 2, chm: 3 };
  const state = { cat: 'all', sourcing: 'all', region: 'all' };

  function fMaterials() {
    const D = SCR.data;
    return D.materials.filter(m =>
      (state.cat === 'all' || m.cat === state.cat) &&
      (state.sourcing === 'all' || (state.sourcing === 'single' ? m.singleSource : !m.singleSource)) &&
      (state.region === 'all' || m.suppliers.some(s => D.supplierById(s).region === state.region)));
  }
  function fSuppliers(mats) {
    const D = SCR.data;
    const ids = new Set(mats.flatMap(m => m.suppliers));
    return D.suppliers.filter(s => ids.has(s.id) &&
      (state.region === 'all' || s.region === state.region));
  }

  /* Derived external risk factors (0–1), deterministic per supplier —
     mirrors the original's BSI flood/drought, economic and political columns. */
  const clamp01 = v => Math.max(0.05, Math.min(0.95, v));
  function extFactors(s) {
    const c = s.id.charCodeAt(2) * 1.0;
    return {
      fin: clamp01(s.dims.fin / 5),
      qual: clamp01(s.dims.qual / 5),
      rel: clamp01(s.dims.rel / 5),
      cyb: clamp01(s.dims.cyb / 5),
      floodBSI: clamp01(s.dims.clim / 5 + 0.10 * Math.sin(c * 1.7)),
      droughtBSI: clamp01(s.dims.clim / 5 * 0.82 + 0.12 * Math.sin(c * 2.3)),
      political: clamp01(s.dims.geo / 5 * 0.88 + 0.08 * Math.sin(c * 2.9)),
      economic: clamp01(s.dims.fin / 5 * 0.7 + s.dims.geo / 5 * 0.3 + 0.06 * Math.sin(c * 1.3))
    };
  }

  /* Scatter with range sliders (original had draggable axis sliders) */
  function scatterCard(grid, cfg) {
    const U = SCR.ui, F = SCR.fmt;
    const card = U.card({ title: cfg.title, sub: cfg.sub, cols: 6, chartClass: 'chart-lg', insight: cfg.insight });
    if (cfg.id) card.id = cfg.id;
    grid.appendChild(card);
    const chart = SCR.charts.mount(card._chartEl, () => {
      const t = SCR.theme.tokens();
      return Object.assign(SCR.theme.baseOption(), {
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, { formatter: p => cfg.tooltip(p.data.meta) }),
        legend: { show: false },
        grid: { left: 64, right: 18, top: 14, bottom: 44, containLabel: true },
        xAxis: SCR.theme.valAxis({
          name: cfg.xName, nameLocation: 'middle', nameGap: 26,
          nameTextStyle: { color: t.ink3, fontSize: 12 },
          axisLabel: { formatter: v => F.num(v) }
        }),
        yAxis: SCR.theme.valAxis({
          name: cfg.yName, nameLocation: 'middle', nameGap: 42,
          nameTextStyle: { color: t.ink3, fontSize: 12 },
          min: cfg.yMin, max: cfg.yMax,
          axisLabel: { formatter: cfg.yFmt || (v => F.num(v)) }
        }),
        dataZoom: [
          { type: 'slider', xAxisIndex: 0, height: 13, bottom: 4, borderColor: t.border, fillerColor: 'rgba(79,70,229,.14)', handleStyle: { color: t.accent }, textStyle: { color: t.ink3, fontSize: 11 } },
          { type: 'slider', yAxisIndex: 0, width: 13, left: 2, borderColor: t.border, fillerColor: 'rgba(79,70,229,.14)', handleStyle: { color: t.accent }, textStyle: { color: t.ink3, fontSize: 11 } }
        ],
        series: [{
          type: 'scatter',
          data: cfg.points().map(pt => ({
            value: pt.xy, meta: pt.meta,
            symbolSize: pt.size,
            itemStyle: { color: t.series[pt.slot], opacity: 0.78, borderColor: t.surface, borderWidth: 1.5 }
          }))
        }]
      });
    });
    if (chart) chart.on('click', p => { if (p.data && p.data.meta) cfg.onClick(p.data.meta); });
  }

  function render(host, opts) {
    const D = SCR.data, F = SCR.fmt, U = SCR.ui;
    if (opts.cat) state.cat = opts.cat;

    const scopeStr = `Category: ${state.cat === 'all' ? 'All' : D.catName(state.cat)} ; Sourcing: ${state.sourcing === 'all' ? 'All' : state.sourcing} ; Region: ${state.region === 'all' ? 'All' : state.region}`;
    SCR.setCrumbs([
      { label: 'Category Leader', key: 'category' },
      { label: 'Node & Material Risk' }
    ], scopeStr);

    host.appendChild(U.el(`<div class="page-head">
      <span class="ph-kicker">Category Leader · Node &amp; Material Risk</span><h1>${state.cat === 'all' ? 'All Categories' : D.catName(state.cat)}</h1>
    </div>`));
    if (SCR.persona.current() === 'cat') host.appendChild(SCR.brief.card('cat', { wide: true }));

    const regions = [...new Set(D.suppliers.map(s => s.region))];
    host.appendChild(U.filterBlock([
      {
        id: 'ctCat', label: 'Category',
        options: [{ v: 'all', label: 'All categories', sel: state.cat === 'all' }]
          .concat(D.categories.map(c => ({ v: c.key, label: c.name, sel: state.cat === c.key }))),
        onChange: v => { state.cat = v; SCR.navigate('category'); }
      },
      {
        id: 'ctSrc', label: 'Sourcing',
        options: [
          { v: 'all', label: 'All sourcing', sel: state.sourcing === 'all' },
          { v: 'single', label: 'Single-source only', sel: state.sourcing === 'single' },
          { v: 'dual', label: 'Dual+ sourced', sel: state.sourcing === 'dual' }
        ],
        onChange: v => { state.sourcing = v; SCR.navigate('category'); }
      },
      {
        id: 'ctReg', label: 'Supplier region',
        options: [{ v: 'all', label: 'All regions', sel: state.region === 'all' }]
          .concat(regions.map(r => ({ v: r, label: r, sel: state.region === r }))),
        onChange: v => { state.region = v; SCR.navigate('category'); }
      }
    ], 'Risk drivers: financial · quality · reliability · geo · cyber · climate + external BSI feeds'));

    const mats = fMaterials();
    const sups = fSuppliers(mats);
    if (!mats.length || !sups.length) {
      host.appendChild(U.el('<div class="empty">No materials match this filter.</div>'));
      return;
    }
    const spend = +mats.reduce((a, m) => a + m.spend, 0).toFixed(0);
    const varSum = +mats.reduce((a, m) => a + m.var, 0).toFixed(1);
    const avarSum = +mats.reduce((a, m) => a + m.avar, 0).toFixed(1);
    const singles = mats.filter(m => m.singleSource);
    const altCoverage = Math.round((1 - singles.length / mats.length) * 100);

    /* ===== KPI strip ===== */
    const go = id => () => U.scrollToCard(document.getElementById(id));
    host.appendChild(U.kpiStrip([
      { icon: 'spend', color: 0, label: 'Spend (CY, MM USD)', value: F.num(spend), sub: 'category → sub-category', onClick: go('catTree') },
      { icon: 'risk', color: 5, label: 'VAR (MM USD)', value: F.num(Math.round(varSum)), sub: 'VAR vs RRE', onClick: go('catRre') },
      { icon: 'dollar', color: 3, label: 'Wtd. AVAR', value: F.num(Math.round(avarSum * 10) / 10), sub: 'node data summary', onClick: go('catNodeData') },
      { icon: 'truck', color: 1, label: 'Suppliers', value: sups.length, sub: sups.filter(s => s.score >= 3).length + ' high risk', subClass: 'bad', onClick: go('catRisk') },
      { icon: 'layers', color: 4, label: 'Materials', value: mats.length, sub: 'VAR vs RRE', onClick: go('catRre') },
      {
        icon: 'gap', color: 6, label: 'Single-source', value: singles.length,
        sub: singles.filter(m => m.score >= 2.8).length + ' risky', subClass: 'bad',
        onClick: () => { state.sourcing = 'single'; SCR.navigate('category'); }
      },
      {
        icon: 'gauge', color: 2, label: 'Alt. coverage', value: altCoverage + '%',
        progress: { pct: altCoverage, color: altCoverage >= 70 ? 'var(--status-good)' : 'var(--status-serious)' },
        sub: 'target ≥ 70%', subClass: altCoverage >= 70 ? 'good' : 'bad',
        onClick: go('catAlt')
      }
    ], {
      bulb: {
        onClick: () => {
          const worst = sups.slice().sort((a, b) => b.avar - a.avar)[0];
          const worstMat = mats.slice().sort((a, b) => b.avar - a.avar)[0];
          U.modal('Generated insights — Category Leader', `
            <ul>
              <li><strong>${U.esc(worst.name)}</strong> is the highest-exposure supplier in scope
                (${F.usdM(worst.avar)} AVAR · risk ${F.score(worst.score)} · recovery ${worst.ttr}d).</li>
              <li><strong>${U.esc(worstMat.name)}</strong> is the material to fix first —
                ${worstMat.singleSource ? 'single-sourced, ' : ''}gap ${worstMat.gap > 0 ? '−' + worstMat.gap + 'd' : 'covered'},
                RRE ${F.rre(worstMat.rre)} after current mitigations.</li>
              <li>${singles.filter(m => m.score >= 2.8).length} risky sole-sourced materials sit above the 2.8 threshold —
                qualification actions exist for ${D.actions.filter(a => a.type === 'Alternate supplier').length} of them.</li>
              <li>Alternate coverage is <strong>${altCoverage}%</strong> against the 70% target.</li>
            </ul>
            <p class="muted" style="font-size:14px">Composed by the Mitigation Strategist Agent from the current filter scope.</p>`);
        }
      }
    }));

    const grid = U.el('<div class="grid grid-12"></div>');
    host.appendChild(grid);

    /* ===== VAR vs RRE scatter (from the original) ===== */
    scatterCard(grid, {
      id: 'catRre',
      title: 'VAR vs RRE by material',
      sub: 'bubble size = dependent NTS · drag the sliders to zoom · click for the material 360°',
      xName: 'VAR (MM USD)', yName: 'RRE — residual risk', yMin: 0, yMax: 1,
      yFmt: v => v.toFixed(1),
      insight: () => {
        const hot = mats.filter(m => m.rre >= 0.5 && m.var >= 10).sort((a, b) => b.var - a.var);
        const w = mats.slice().sort((a, b) => (b.var * b.rre) - (a.var * a.rre))[0];
        const single = mats.filter(m => m.singleSource);
        return {
          agent: 'Impact & VAR Agent',
          reads: [
            { label: 'Materials', value: mats.length },
            { label: 'High VAR + high RRE', value: hot.length, tone: hot.length ? 'bad' : 'good' },
            { label: 'Single-sourced', value: single.length, tone: single.length ? 'bad' : 'good' }
          ],
          points: [
            'Read the top-right quadrant first: high value at risk and high residual risk together means real money is exposed and the mitigation in place is not yet holding it.',
            w ? `<strong>${U.esc(w.name)}</strong> is the worst combination at ${F.usdM(w.var)} VAR and an RRE of ${w.rre.toFixed(2)}.` : 'No materials in scope.',
            `Bubble size is dependent net sales, so a large bubble far right is a material a lot of revenue leans on. ${single.length} material${single.length === 1 ? '' : 's'} here ${single.length === 1 ? 'has' : 'have'} only one qualified supplier.`
          ],
          actions: [
            { label: 'See sourcing worklist', onClick: () => U.scrollToCard(document.getElementById('catAlt')) },
            w ? { label: '360° on ' + w.name, onClick: () => U.openMaterial(w.id) } : null
          ].filter(Boolean)
        };
      },
      points: () => mats.map(m => ({
        xy: [+m.var.toFixed(1), m.rre],
        size: 8 + Math.sqrt(m.depNTS) * 0.55,
        slot: CAT_SLOT[m.cat],
        meta: m
      })),
      tooltip: m => `<strong>${m.name}</strong><br/>VAR ${F.usdM(m.var)} · RRE ${F.rre(m.rre)}<br/>${m.singleSource ? 'Single source · ' : ''}${m.depProducts.length} products · dependent NTS ${F.usdM(m.depNTS)}`,
      onClick: m => U.openMaterial(m.id)
    });

    /* ===== VAR vs Current Year Spend scatter (from the original) ===== */
    scatterCard(grid, {
      id: 'catSpend',
      title: 'VAR vs Current-Year Spend by supplier',
      sub: 'business exposure vs procurement spend · bubble size = AVAR · click for the supplier 360°',
      xName: 'VAR (MM USD)', yName: 'CY Spend (MM USD)',
      insight: () => {
        const byVar = sups.slice().sort((a, b) => b.var - a.var);
        const w = byVar[0];
        const lowSpendHighVar = sups.filter(x => x.var >= 20 && x.cySpend <= 40).sort((a, b) => b.var - a.var);
        return {
          agent: 'Mitigation Strategist Agent',
          reads: [
            { label: 'Suppliers', value: sups.length },
            { label: 'Highest VAR', value: w ? F.usdM(w.var) : '—', tone: 'bad' },
            { label: 'Low spend, high risk', value: lowSpendHighVar.length, tone: lowSpendHighVar.length ? 'bad' : 'good' }
          ],
          points: [
            'The useful asymmetry is bottom-right: suppliers carrying large value at risk on comparatively small spend. Commercial leverage is limited there, so the fix is usually a second source rather than a negotiation.',
            w ? `<strong>${U.esc(w.name)}</strong> carries the most exposure at ${F.usdM(w.var)} VAR on ${F.usdM(w.cySpend)} of current-year spend.` : 'No suppliers in scope.',
            lowSpendHighVar.length ? `${lowSpendHighVar.length} supplier${lowSpendHighVar.length === 1 ? '' : 's'} sit${lowSpendHighVar.length === 1 ? 's' : ''} in that low-spend, high-risk corner: ${lowSpendHighVar.slice(0, 3).map(x => U.esc(x.name)).join(', ')}.` : 'No supplier is disproportionately risky relative to its spend.'
          ],
          actions: w ? [{ label: '360° on ' + w.name, onClick: () => U.openSupplier(w.id) }] : []
        };
      },
      points: () => sups.map(s => ({
        xy: [+s.var.toFixed(1), s.spend],
        size: 9 + Math.sqrt(Math.max(0.3, s.avar)) * 4.6,
        slot: CAT_SLOT[s.cat],
        meta: s
      })),
      tooltip: s => `<strong>${s.name}</strong><br/>${s.city}, ${s.country}<br/>VAR ${F.usdM(s.var)} · Spend ${F.usdM(s.spend)}<br/>Risk ${F.score(s.score)} (${s.rating}) · AVAR ${F.usdM(s.avar)}`,
      onClick: s => U.openSupplier(s.id)
    });

    /* ===== Category Leader Node Data Summary (multi-measure in-cell bars) ===== */
    grid.appendChild(U.el('<div class="section-title col-12">Category Leader node data summary <small>— every measure as an in-row bar, like the original</small></div>'));
    const nodeCard = U.card({
      title: 'Node Data Summary',
      sub: 'RRE trend · dependent NTS · sales impacted · VAR · AVAR per supplier node · click a row for the 360°',
      cols: 12, flush: true,
      insight: () => {
        const r = sups.slice().sort((a, b) => b.avar - a.avar);
        const totAvar = r.reduce((a, x) => a + x.avar, 0) || 1;
        const top3 = r.slice(0, 3);
        return {
          agent: 'Impact & VAR Agent',
          reads: [
            { label: 'Supplier nodes', value: sups.length },
            { label: 'Total AVAR', value: F.usdM(+totAvar.toFixed(1)), tone: 'bad' },
            { label: 'Top 3 share', value: ((top3.reduce((a, x) => a + x.avar, 0) / totAvar) * 100).toFixed(0) + '%' }
          ],
          points: [
            'Each row carries the same measures used everywhere else in the product, so a supplier\u2019s AVAR here is the identical figure that rolls into the executive total.',
            r.length ? `<strong>${U.esc(r[0].name)}</strong> is the largest node at ${F.usdM(r[0].avar)} AVAR on ${F.usdM(r[0].depNTS)} of dependent net sales.` : 'No suppliers in scope.',
            `The top three (${top3.map(x => U.esc(x.name)).join(', ')}) hold ${((top3.reduce((a, x) => a + x.avar, 0) / totAvar) * 100).toFixed(0)}% of supplier AVAR in this scope.`
          ],
          actions: r.length ? [{ label: '360° on ' + r[0].name, onClick: () => U.openSupplier(r[0].id) }] : []
        };
      }
    });
    nodeCard.id = 'catNodeData';
    grid.appendChild(nodeCard);
    const nBody = nodeCard.querySelector('.card-body');
    nBody.style.maxHeight = '430px';
    nBody.style.overflowY = 'auto';
    const supRows = sups.slice().sort((a, b) => b.avar - a.avar);
    const maxNTS = Math.max(...supRows.map(s => s.depNTS));
    const maxSales = maxNTS;
    const maxVar = Math.max(...supRows.map(s => s.var));
    const maxAvar = Math.max(...supRows.map(s => s.avar));
    const rreTrend = s => s.trend[11] >= s.trend[8] ? '<span class="trend-up">↗</span>' : '<span class="trend-down">↘</span>';
    const ndTbl = U.table([
      { h: 'Node', cell: s => `<span class="cell-main" style="font-size:14px">${U.esc(s.name)}</span><span class="cell-sub">${U.esc(s.city)}, ${U.esc(s.country)} · Tier ${s.tier}</span>` },
      { h: 'Category', cell: s => `<span style="font-size:13px">${U.esc(s.catName)}</span>` },
      { h: 'RRE', cls: 'num', cell: s => {
        const avgRre = +(D.materialsOf(s.id).reduce((a, m) => a + m.rre, 0) / Math.max(1, s.materialsCount)).toFixed(2);
        return `${avgRre.toFixed(2)} ${rreTrend(s)}`;
      } },
      { h: 'NTS (MM USD)', cell: s => U.cellBar(s.depNTS, maxNTS, 'var(--series-5)', F.num(s.depNTS)) },
      { h: 'Sales Impacted (MM USD)', cell: s => U.cellBar(s.depNTS * 0.6, maxSales, 'var(--series-4)', F.num(Math.round(s.depNTS * 0.6))) },
      { h: 'VAR (MM USD)', cell: s => U.cellBar(s.var, maxVar, 'var(--series-6)', F.num(+s.var.toFixed(1))) },
      { h: 'AVAR (MM USD)', cell: s => U.cellBar(s.avar, maxAvar, 'var(--series-3)', F.num(+s.avar.toFixed(1))) },
      { h: 'Products', cls: 'num', cell: s => s.productsCount },
      { h: 'Materials', cls: 'num', cell: s => s.materialsCount }
    ], supRows, s => U.openSupplier(s.id));
    ndTbl.querySelector('table').classList.add('tbl-teal');
    nBody.appendChild(ndTbl);

    /* ===== Node Risk Summary (heat cells, from the original) ===== */
    const riskCard = U.card({
      title: 'Node Risk Summary',
      sub: 'internal drivers + external feeds (Excel/BSI) normalized 0–1 · red = high · click a row for the 360°',
      cols: 12, flush: true,
      insight: () => {
        const scored = sups.map(x => ({ x, f: extFactors(x) }));
        const avg = key => scored.reduce((a, s2) => a + s2.f[key], 0) / (scored.length || 1);
        const keys = ['floodBSI', 'droughtBSI', 'political', 'economic'];
        const NAME = { floodBSI: 'flood', droughtBSI: 'drought', political: 'political', economic: 'economic' };
        const worstKey = keys.slice().sort((a, b) => avg(b) - avg(a))[0];
        const worstSup = scored.slice().sort((a, b) => b.f[worstKey] - a.f[worstKey])[0];
        return {
          agent: 'Network Sensing Agent',
          reads: [
            { label: 'Suppliers scored', value: scored.length },
            { label: 'Dominant driver', value: NAME[worstKey] },
            { label: 'Mean score', value: avg(worstKey).toFixed(2), tone: avg(worstKey) >= 0.5 ? 'bad' : '' }
          ],
          points: [
            'Every cell is normalised 0\u20131 so internal drivers and external feeds can be compared on one scale; red is high risk regardless of which column it sits in.',
            `The strongest driver across this scope is <strong>${NAME[worstKey]}</strong>, averaging ${avg(worstKey).toFixed(2)}.`,
            worstSup ? `<strong>${U.esc(worstSup.x.name)}</strong> is most exposed to it at ${worstSup.f[worstKey].toFixed(2)} — worth pairing with its commercial position before deciding whether to dual-source.` : ''
          ].filter(Boolean),
          actions: worstSup ? [{ label: '360° on ' + worstSup.x.name, onClick: () => U.openSupplier(worstSup.x.id) }] : []
        };
      }
    });
    riskCard.id = 'catRisk';
    grid.appendChild(riskCard);
    const rBody = riskCard.querySelector('.card-body');
    rBody.style.maxHeight = '380px';
    rBody.style.overflowY = 'auto';
    const rTbl = U.table([
      { h: 'Node', cell: s => `<span class="cell-main" style="font-size:14px;white-space:nowrap">${U.esc(s.name)}</span>` },
      { h: 'Country', cell: s => `<span style="font-size:13px">${U.esc(s.country)}</span>` },
      { h: 'Supplier Financial', cell: s => U.heatPill(extFactors(s).fin) },
      { h: 'Supplier Quality', cell: s => U.heatPill(extFactors(s).qual) },
      { h: 'Supplier Reliability', cell: s => U.heatPill(extFactors(s).rel) },
      { h: 'Cyber Risk', cell: s => U.heatPill(extFactors(s).cyb) },
      { h: 'Flood BSI', cell: s => U.heatPill(extFactors(s).floodBSI) },
      { h: 'Drought BSI', cell: s => U.heatPill(extFactors(s).droughtBSI) },
      { h: 'Political', cell: s => U.heatPill(extFactors(s).political) },
      { h: 'Economic', cell: s => U.heatPill(extFactors(s).economic) },
      { h: 'Composite', cls: 'num', cell: s => U.meter(s.score) }
    ], supRows, s => U.openSupplier(s.id));
    rTbl.querySelector('table').classList.add('tbl-teal');
    rBody.appendChild(rTbl);

    /* ===== Spend & drivers ===== */
    grid.appendChild(U.el('<div class="section-title col-12">Spend & risk drivers</div>'));

    const treeCard = U.card({
      title: 'Spend contribution — category → sub-category',
      sub: 'tree map of current-year spend · click to zoom',
      cols: 5, chartClass: 'chart-lg',
      insight: () => {
        const byCat = {};
        mats.forEach(m => { byCat[m.cat] = (byCat[m.cat] || 0) + (m.spend || 0); });
        const r = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
        const tot = r.reduce((a, x) => a + x[1], 0) || 1;
        return {
          agent: 'Mitigation Strategist Agent',
          reads: [
            { label: 'Categories', value: r.length },
            { label: 'Largest', value: r.length ? r[0][0] : '—' },
            { label: 'Its share', value: r.length ? ((r[0][1] / tot) * 100).toFixed(0) + '%' : '—' }
          ],
          points: [
            'Area is current-year spend, so this is where procurement leverage actually sits — not where risk sits. Compare it against the risk views to find the mismatches.',
            r.length ? `<strong>${U.esc(r[0][0])}</strong> is the largest block at ${F.usdM(+r[0][1].toFixed(1))}, ${((r[0][1] / tot) * 100).toFixed(0)}% of spend in scope.` : 'No spend in scope.',
            'A category that is small here but prominent in the VAR views is the classic trap: little commercial leverage, disproportionate exposure.'
          ],
          actions: [{ label: 'Compare against risk', onClick: () => U.scrollToCard(document.getElementById('catSpend')) }]
        };
      }
    });
    treeCard.id = 'catTree';
    grid.appendChild(treeCard);
    SCR.charts.mount(treeCard._chartEl, () => {
      const t = SCR.theme.tokens();
      const tree = D.categories
        .filter(c => state.cat === 'all' || c.key === state.cat)
        .map(c => {
          const catMats = mats.filter(m => m.cat === c.key);
          const bySub = {};
          catMats.forEach(m => { bySub[m.sub] = (bySub[m.sub] || 0) + m.spend; });
          return {
            name: c.name,
            value: +catMats.reduce((a, m) => a + m.spend, 0).toFixed(0),
            itemStyle: { color: t.series[CAT_SLOT[c.key]] },
            children: Object.keys(bySub).map(sub => ({
              name: sub, value: +bySub[sub].toFixed(0),
              itemStyle: { color: t.series[CAT_SLOT[c.key]], opacity: 0.82 }
            }))
          };
        }).filter(n => n.value > 0);
      return Object.assign(SCR.theme.baseOption(), {
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, {
          formatter: p => `<strong>${p.name}</strong><br/>${F.usdM(p.value)} spend`
        }),
        series: [{
          type: 'treemap',
          roam: false, nodeClick: 'zoomToNode',
          breadcrumb: { show: true, top: 0, itemStyle: { color: t.surface3, textStyle: { color: t.ink2 } } },
          label: { show: true, fontSize: 12.5, color: '#fff', formatter: p => p.name + '\n' + F.usdM(p.value) },
          upperLabel: { show: true, height: 22, color: '#fff', fontSize: 12.5, fontWeight: 600 },
          itemStyle: { borderColor: t.surface, borderWidth: 2, gapWidth: 2 },
          levels: [
            { itemStyle: { borderWidth: 0, gapWidth: 3 } },
            { itemStyle: { gapWidth: 2, borderColor: t.surface } }
          ],
          data: tree
        }]
      });
    });

    const dimCard = U.card({
      title: 'Risk-driver profile', sub: 'average driver scores across suppliers in scope',
      cols: 7,
      insight: () => {
        const dims = ['fin', 'geo', 'rel', 'clim', 'qual', 'cyb'];
        const NAME = { fin: 'financial', geo: 'geopolitical', rel: 'reliability', clim: 'climate', qual: 'quality', cyb: 'cyber' };
        const avg = d => sups.reduce((a, x) => a + x.dims[d], 0) / (sups.length || 1);
        const r = dims.slice().sort((a, b) => avg(b) - avg(a));
        return {
          agent: 'Network Sensing Agent',
          reads: [
            { label: 'Suppliers', value: sups.length },
            { label: 'Weakest driver', value: NAME[r[0]] },
            { label: 'Score (of 5)', value: avg(r[0]).toFixed(1), tone: avg(r[0]) >= 3 ? 'bad' : '' }
          ],
          points: [
            `Averaged across ${sups.length} suppliers in scope, <strong>${NAME[r[0]]}</strong> risk scores highest at ${avg(r[0]).toFixed(1)} of 5.`,
            `Lowest concern is ${NAME[r[r.length - 1]]} at ${avg(r[r.length - 1]).toFixed(1)}, so effort spent there returns less than effort on ${NAME[r[0]]}.`,
            'These are the same driver scores that feed each supplier\u2019s residual risk, so improving one moves RRE and AVAR together.'
          ],
          actions: [{ label: 'Open the node risk matrix', onClick: () => U.scrollToCard(document.getElementById('catRisk')) }]
        };
      }
    });
    grid.appendChild(dimCard);
    const dimKeys = ['fin', 'qual', 'rel', 'geo', 'cyb', 'clim'];
    const avgDims = {};
    dimKeys.forEach(k => {
      avgDims[k] = +(sups.reduce((a, s) => a + s.dims[k], 0) / sups.length).toFixed(1);
    });
    dimCard.querySelector('.card-body').innerHTML = U.dimBars(avgDims) + `
      <div class="sim-out-note" style="margin-top:12px">
        Highest driver in scope: <strong>${{ fin: 'Financial', qual: 'Quality', rel: 'Reliability', geo: 'Geopolitical', cyb: 'Cyber', clim: 'Climate' }[dimKeys.slice().sort((a, b) => avgDims[b] - avgDims[a])[0]]}</strong>.
        Internal drivers blend ERP performance with external feeds — financial ratings, geo &amp; climate BSI indices,
        cyber posture — refreshed weekly (FR-RISK-03: normalized across sources).
      </div>`;

    /* ===== Alternate sourcing opportunities ===== */
    const altCard = U.card({
      title: 'Alternate sourcing opportunities', sub: 'risky single-source materials — qualification recommended (FR-CAT-07)',
      cols: 12, flush: true,
      insight: () => {
        const single = mats.filter(m => m.singleSource);
        const risky = single.filter(m => m.ttr > m.tts);
        const w = single.slice().sort((a, b) => b.avar - a.avar)[0];
        return {
          agent: 'Mitigation Strategist Agent',
          reads: [
            { label: 'Single-source', value: single.length, tone: single.length ? 'bad' : 'good' },
            { label: 'Also uncovered', value: risky.length, tone: risky.length ? 'bad' : 'good' },
            { label: 'AVAR at stake', value: F.usdM(+single.reduce((a, m) => a + m.avar, 0).toFixed(1)), tone: 'bad' }
          ],
          points: [
            `${single.length} material${single.length === 1 ? '' : 's'} in scope ${single.length === 1 ? 'has' : 'have'} exactly one qualified supplier, carrying ${F.usdM(+single.reduce((a, m) => a + m.avar, 0).toFixed(1))} of adjusted risk between them.`,
            risky.length ? `${risky.length} of those also recover slower than they survive — qualification there buys days of cover, not just negotiating room.` : 'None of them currently recover slower than they survive.',
            w ? `Start with <strong>${U.esc(w.name)}</strong>: ${F.usdM(w.avar)} AVAR, ${F.days(w.tts)} of cover against ${F.days(w.ttr)} to recover.` : ''
          ].filter(Boolean),
          actions: w ? [{ label: '360° on ' + w.name, onClick: () => U.openMaterial(w.id) }, { label: 'Simulate losing its supplier', onClick: () => U.openScenario((w.suppliers || [])[0], { why: 'Failing the sole supplier of ' + w.name, days: 30 }) }] : []
        };
      }
    });
    altCard.id = 'catAlt';
    grid.appendChild(altCard);
    const opp = D.materials.filter(m => m.singleSource && m.score >= 2.8)
      .sort((a, b) => b.avar - a.avar);
    altCard.querySelector('.card-body').appendChild(U.table([
      { h: 'Material', cell: m => `<span class="cell-main">${U.esc(m.name)}</span><span class="cell-sub">${U.esc(m.catName)}</span>` },
      { h: 'Sole supplier', cell: m => U.esc(D.supplierById(m.suppliers[0]).name) },
      { h: 'Gap', cls: 'num', cell: m => `<span style="font-weight:700;color:${m.gap > 0 ? 'var(--status-critical)' : 'var(--status-good)'}">${m.gap > 0 ? '−' + m.gap + 'd' : 'OK'}</span>` },
      { h: 'AVAR', cls: 'num', cell: m => F.usdM(m.avar) },
      { h: 'RRE', cls: 'num', cell: m => F.rre(m.rre) },
      { h: 'Substitution', cell: m => `<span class="muted" style="font-size:13px">${U.esc(m.substitution)}</span>` },
      { h: '', cell: m => `<button class="btn btn-sm btn-primary" data-act="${m.id}">Qualify alternate</button>` }
    ], opp));
    altCard.querySelectorAll('[data-act]').forEach(b =>
      b.addEventListener('click', e => {
        e.stopPropagation();
        const m = D.materialById(b.dataset.act);
        U.createAction({ type: 'material', id: m.id });
      }));
  }

  SCR.registerPage('category', {
    title: 'Category & Suppliers',
    context: () => {
      const D = SCR.data;
      const mats = fMaterials();
      return {
        scope: [
          state.cat === 'all' ? 'All categories' : D.catName(state.cat),
          state.sourcing === 'all' ? null : (state.sourcing === 'single' ? 'Single-source only' : 'Dual+ sourced'),
          state.region === 'all' ? null : state.region
        ].filter(Boolean).join(' · '),
        filters: Object.assign({}, state),
        materials: mats,
        suppliers: fSuppliers(mats)
      };
    },
    render
  });
})();
