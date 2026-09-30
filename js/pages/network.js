/* ============================================================
   SCR · pages/network.js
   Network Explorer — the supply chain digital twin.
   Sankey dependency trace (supplier → material → plant → DC →
   market) with product scoping · enterprise value flow by material
   category · single-point-of-failure list.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  // fixed tier → series-slot identity
  const TIER = {
    Supplier: { slot: 1, x: 0 },
    Material: { slot: 2, x: 1 },
    Plant:    { slot: 0, x: 2 },
    DC:       { slot: 3, x: 3 },
    Market:   { slot: 4, x: 4 }
  };

  const state = { product: 'P07' };

  function buildGraph() {
    const D = SCR.data;
    const prods = state.product === 'all' ? D.products : [D.productById(state.product)];
    const mats = [...new Set(prods.flatMap(p => p.materials))].map(D.materialById);
    const sups = [...new Set(mats.flatMap(m => m.suppliers))].map(D.supplierById);
    const plants = [...new Set(prods.flatMap(p => p.plants))].map(D.plantById);
    const dcIds = new Set(prods.flatMap(p => p.dcs));
    const dcList = D.dcs.filter(d => dcIds.has(d.id));
    const mkIds = new Set(prods.flatMap(p => p.markets));
    const mkList = D.markets.filter(m => mkIds.has(m.id));

    const nodes = [], links = [], idx = {};
    function add(tier, id, name, value, sub, riskColorScore) {
      idx[id] = nodes.length;
      nodes.push({ tier, id, name, value, sub, riskColorScore });
    }
    sups.forEach(s => add('Supplier', s.id, s.name, s.avar, s.city + ', ' + s.country, s.score));
    mats.forEach(m => add('Material', m.id, m.name, m.avar, m.sub, m.score));
    plants.forEach(p => add('Plant', p.id, p.name, p.avar, p.focus, null));
    dcList.forEach(d => add('DC', d.id, d.name, d.avar, d.region, null));
    mkList.forEach(mk => add('Market', mk.id, mk.name, mk.nts * 0.02, mk.region, null));

    mats.forEach(m => {
      m.suppliers.forEach(sid => { if (idx[sid] != null) links.push([sid, m.id, m.singleSource]); });
      m.plants.forEach(pid => { if (idx[pid] != null) links.push([m.id, pid, false]); });
    });
    prods.forEach(p => {
      p.plants.forEach(pt => p.dcs.forEach(dc => {
        if (idx[pt] != null && idx[dc] != null) links.push([pt, dc, false]);
      }));
      p.dcs.forEach(dc => p.markets.forEach(mk => {
        const d = D.dcById(dc);
        if (d && d.markets.includes(mk) && idx[dc] != null && idx[mk] != null) links.push([dc, mk, false]);
      }));
    });
    // dedupe links
    const seen = new Set();
    const uniq = links.filter(l => {
      const k = l[0] + '>' + l[1];
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    return { nodes, links: uniq };
  }

  /* Dependency trace as a Sankey: supplier → material → plant → DC → market,
     with the traced product's NTS attributed along every path. Value is
     conserved at each stage, so ribbon width is directly comparable across
     the whole chain. Single-source supplier→material edges are flagged. */
  function buildTraceSankey() {
    const D = SCR.data;
    const prods = state.product === 'all' ? D.products : [D.productById(state.product)].filter(Boolean);
    if (!prods.length) return { nodes: [], links: [], tierOf: {}, single: new Set() };

    const flows = {};              // 'a␟b' -> value
    const tierOf = {};             // node name -> tier
    const single = new Set();      // 'a␟b' keys that are sole-sourced
    const put = (n, tier) => { tierOf[n] = tier; };
    const bump = (a, b, v) => { const k = a + '␟' + b; flows[k] = (flows[k] || 0) + v; };

    prods.forEach(p => {
      const mats = p.materials.map(D.materialById).filter(Boolean);
      if (!mats.length) return;
      const perMat = p.nts / mats.length;
      mats.forEach(m => {
        put(m.name, 'Material');
        const sups = m.suppliers.map(D.supplierById).filter(Boolean);
        // supplier → material
        sups.forEach(s => {
          put(s.name, 'Supplier');
          bump(s.name, m.name, perMat / sups.length);
          if (m.singleSource) single.add(s.name + '␟' + m.name);
        });
        // material → plant (only plants this product actually runs on)
        const pl = p.plants.map(D.plantById).filter(Boolean).filter(x => m.plants.includes(x.id));
        const plants = pl.length ? pl : p.plants.map(D.plantById).filter(Boolean);
        plants.forEach(x => { put(x.name, 'Plant'); bump(m.name, x.name, perMat / plants.length); });
      });
      // plant → DC → market, carrying the same NTS
      const plants = p.plants.map(D.plantById).filter(Boolean);
      const dcs = p.dcs.map(D.dcById).filter(Boolean);
      if (!plants.length || !dcs.length) return;
      plants.forEach(x => dcs.forEach(d => {
        put(d.name, 'DC');
        bump(x.name, d.name, p.nts / plants.length / dcs.length);
      }));
      dcs.forEach(d => {
        const served = p.markets.map(D.marketById).filter(Boolean).filter(mk => d.markets.includes(mk.id));
        const list = served.length ? served : p.markets.map(D.marketById).filter(Boolean);
        list.forEach(mk => { put(mk.name, 'Market'); bump(d.name, mk.name, p.nts / dcs.length / list.length); });
      });
    });

    const names = new Set();
    const links = Object.keys(flows).map(k => {
      const [a, b] = k.split('␟');
      names.add(a); names.add(b);
      return { source: a, target: b, value: +flows[k].toFixed(1), single: single.has(k) };
    }).filter(l => l.value > 0);
    return { nodes: [...names].map(n => ({ name: n })), links, tierOf, single };
  }

  /* Sankey: material category → plant → market region, NTS-attributed.
     Deliberately three stages, not four: routing every flow through the DC
     tier as well doubled the crossings without changing the story, and the
     dependency trace above already carries DC detail. Thin flows are folded
     away so the picture stays readable rather than exhaustive. */
  function buildSankey() {
    const D = SCR.data;
    const flows = {}; // 'a␟b' -> value
    const bump = (a, b, v) => { const k = a + '␟' + b; flows[k] = (flows[k] || 0) + v; };
    D.products.forEach(p => {
      if (!p.plants.length) return;
      const perPlant = p.nts / p.plants.length;
      const cats = [...new Set(p.materials.map(m => D.materialById(m).cat))];
      p.plants.forEach(pt => {
        const plant = D.plantById(pt);
        if (!plant) return;
        cats.forEach(c => bump(D.catName(c), plant.name, perPlant / cats.length));
        const regions = [...new Set(p.markets.map(mk => (D.marketById(mk) || {}).region).filter(Boolean))];
        if (!regions.length) return;
        regions.forEach(r => bump(plant.name, r + ' markets', perPlant / regions.length));
      });
    });
    const total = Object.values(flows).reduce((a, b) => a + b, 0) || 1;
    const names = new Set();
    const links = Object.keys(flows).map(k => {
      const [a, b] = k.split('␟');
      return { source: a, target: b, value: +flows[k].toFixed(0) };
    })
      // drop the long tail: anything under 1.5% of total flow is noise here
      .filter(l => l.value / total >= 0.015)
      .sort((a, b) => b.value - a.value);
    links.forEach(l => { names.add(l.source); names.add(l.target); });
    return { nodes: [...names].map(n => ({ name: n })), links, dropped: Object.keys(flows).length - links.length };
  }

  /* Open the nodes behind a scope chip. Rows route into the existing 360°
     drawers where one exists for that tier. */
  function openTierList(tier, g) {
    const D = SCR.data, F = SCR.fmt, U = SCR.ui;
    const OPEN = { Supplier: U.openSupplier, Material: U.openMaterial, Plant: U.openSite };
    const LABEL = { Supplier: 'Suppliers', Material: 'Materials', Plant: 'Plants', DC: 'Distribution centres', Market: 'Markets', Single: 'Single-source dependencies' };
    const scope = state.product === 'all' ? 'the entire network' : D.productById(state.product).name;

    if (tier === 'Single') {
      const rows = g.links.filter(l => l[2]).map(l => {
        const s = g.nodes.find(n => n.id === l[0]), m = g.nodes.find(n => n.id === l[1]);
        return { s, m };
      }).filter(r => r.s && r.m);
      U.openDrawer('Network scope', 'Single-source dependencies', body => {
        body.appendChild(U.el(`<p class="muted" style="font-size:14px;margin:0 0 12px">
          ${rows.length} material${rows.length === 1 ? '' : 's'} in ${U.esc(scope)} ${rows.length === 1 ? 'has' : 'have'} exactly one qualified supplier.
          If that supplier stops, the material stops — there is no second source to switch to.</p>`));
        if (!rows.length) { body.appendChild(U.el('<div class="empty">No single-source links in this scope.</div>')); return; }
        const t = U.table(
          [{ h: 'Material', cell: r => `<span class="cell-main">${U.esc(r.m.name)}</span><span class="cell-sub">sole supplier · ${U.esc(r.s.name)}</span>` },
           { h: 'AVAR', cls: 'num', cell: r => F.usdM(r.m.value) }],
          rows, r => U.openMaterial(r.m.id));
        body.appendChild(t);
      });
      return;
    }

    const nodes = g.nodes.filter(n => n.tier === tier).sort((a, b) => b.value - a.value);
    U.openDrawer('Network scope', LABEL[tier] + ' in scope', body => {
      body.appendChild(U.el(`<p class="muted" style="font-size:14px;margin:0 0 12px">
        ${nodes.length} ${LABEL[tier].toLowerCase()} feeding ${U.esc(scope)}, ranked by the AVAR carried at the node.
        ${OPEN[tier] ? 'Select any row for its 360°.' : ''}</p>`));
      if (!nodes.length) { body.appendChild(U.el('<div class="empty">Nothing in this tier for the current scope.</div>')); return; }
      body.appendChild(U.table(
        [{ h: LABEL[tier].replace(/s$/, ''), cell: n => `<span class="cell-main">${U.esc(n.name)}</span><span class="cell-sub">${U.esc(n.sub || '')}</span>` },
         { h: tier === 'Market' ? 'NTS impact' : 'AVAR', cls: 'num', cell: n => F.usdM(+n.value.toFixed(1)) }],
        nodes, OPEN[tier] ? (n => OPEN[tier](n.id)) : null));
    });
  }

  function render(host, opts) {
    const D = SCR.data, F = SCR.fmt, U = SCR.ui;
    if (opts.product) state.product = opts.product;

    /* ===== Scope bar ===== */
    host.appendChild(U.el(`<div class="page-head">
      <span class="ph-kicker">Digital twin</span><h1>Network Explorer</h1>
    </div>`));
    const g = buildGraph();
    const tierCount = tier => g.nodes.filter(n => n.tier === tier).length;
    const singleLinks = g.links.filter(l => l[2]).length;
    const fb = U.el(`<div class="filterbar">
      <label class="fb-field"><span>Trace a product</span>
        <select id="fProd">
          <option value="all">Entire network — all products</option>
          ${D.products.map(p => `<option value="${p.id}" ${state.product === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>
      </label>
      <span class="fb-note" style="margin-left:auto"><span class="chip-row">
        <span class="badge neutral plain chip-link" data-tier="Supplier">${tierCount('Supplier')} suppliers</span>
        <span class="badge neutral plain chip-link" data-tier="Material">${tierCount('Material')} materials</span>
        <span class="badge neutral plain chip-link" data-tier="Plant">${tierCount('Plant')} plants</span>
        <span class="badge neutral plain chip-link" data-tier="DC">${tierCount('DC')} DCs</span>
        <span class="badge neutral plain chip-link" data-tier="Market">${tierCount('Market')} markets</span>
        <span class="badge chip-link ${singleLinks ? 'critical' : 'low'}" data-tier="Single">${singleLinks} single-source link${singleLinks === 1 ? '' : 's'}</span>
      </span></span>
    </div>`);
    host.appendChild(fb);
    // Each scope chip opens the nodes it counts, so the number is a way in
    // rather than a dead statistic.
    fb.querySelectorAll('.chip-link').forEach(chip => {
      const NOUN = { Supplier: 'suppliers', Material: 'materials', Plant: 'plants', DC: 'distribution centres', Market: 'markets' };
      chip.title = chip.dataset.tier === 'Single'
        ? 'List the single-source dependencies in this scope'
        : 'List the ' + NOUN[chip.dataset.tier] + ' in this scope';
      chip.addEventListener('click', () => openTierList(chip.dataset.tier, g));
    });
    fb.querySelector('#fProd').addEventListener('change', e => {
      state.product = e.target.value;
      SCR.navigate('network');
    });
    const grid = U.el('<div class="grid grid-12"></div>');
    host.appendChild(grid);
    /* ===== Dependency trace (Sankey) =====
       Replaces the earlier node-link graph: the same five tiers, but ribbon
       width carries NTS, labels never collide, and nothing is hidden at
       enterprise scale. */
    const trace = buildTraceSankey();
    const TIER_SLOT = { Supplier: 1, Material: 2, Plant: 0, DC: 3, Market: 4 };
    const traceCard = U.card({
      title: state.product === 'all'
        ? 'Supply network — digital twin'
        : 'Dependency trace — ' + D.productById(state.product).name,
      sub: 'supplier → material → plant → DC → market · ribbon width = NTS carried along that path · click any node for its 360°',
      cols: 12, chartClass: 'chart-xxl',
      insight: () => {
        const single = g.links.filter(l => l[2]).length;
        const top = g.nodes.slice().sort((a, b) => b.value - a.value)[0];
        const counts = {};
        g.nodes.forEach(n => { counts[n.tier] = (counts[n.tier] || 0) + 1; });
        const byTarget = {};
        trace.links.forEach(l => { byTarget[l.target] = (byTarget[l.target] || 0) + l.value; });
        const hub = Object.entries(byTarget).sort((a, b) => b[1] - a[1])[0];
        return {
          agent: 'Network Sensing Agent',
          reads: [
            { label: 'Nodes in scope', value: g.nodes.length },
            { label: 'Dependencies', value: g.links.length },
            { label: 'Single-source', value: single, tone: single ? 'bad' : 'good' }
          ],
          points: [
            `${g.nodes.length} nodes across five tiers — ${Object.entries(counts).map(([t, c]) => `${c} ${t.toLowerCase()}${c === 1 ? '' : 's'}`).join(', ')} — joined by ${g.links.length} dependencies.`,
            hub ? `<strong>${U.esc(hub[0])}</strong> is the largest convergence point with ${F.usdM(+hub[1].toFixed(1))} of NTS passing through it. Concentration mid-network is exactly what a single outage exploits.` : '',
            single ? `${single} supplier→material link${single === 1 ? ' is' : 's are'} drawn red because the material has only one qualified supplier — those edges have no fallback.` : 'No single-source links in this scope.'
          ].filter(Boolean),
          actions: [{ label: 'List single points of failure', onClick: () => openTierList('Single', g) }]
        };
      }
    });
    grid.appendChild(traceCard);
    // The Sankey lays columns out itself, so tier identity comes from a legend
    // rather than axis labels.
    traceCard.querySelector('.card-body').insertBefore(
      U.el(`<div class="tier-legend">${
        ['Supplier', 'Material', 'Plant', 'DC', 'Market']
          .map((tr, i) => `<span><i style="background:var(--series-${TIER_SLOT[tr] + 1})"></i>${tr}</span>`)
          .join('<span class="tl-arrow">→</span>')
      }<span class="tl-single"><i></i>single-source</span></div>`),
      traceCard._chartEl);
    const traceChart = SCR.charts.mount(traceCard._chartEl, () => {
      const t = SCR.theme.tokens();
      if (!trace.links.length) return { series: [] };
      return Object.assign(SCR.theme.baseOption(), {
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, {
          formatter: p => p.dataType === 'edge'
            ? `<strong>${p.data.source}</strong> → <strong>${p.data.target}</strong><br/>${F.usdM(p.data.value)} NTS carried${p.data.single ? '<br/><span style="color:#dc2626">single-source dependency</span>' : ''}`
            : `<strong>${p.name}</strong> · ${trace.tierOf[p.name] || ''}<br/>${F.usdM(+p.value.toFixed(1))} NTS through this node`
        }),
        series: [{
          type: 'sankey',
          left: 8, right: 128, top: 12, bottom: 8,
          nodeWidth: 13, nodeGap: 12,
          nodeAlign: 'left',
          data: trace.nodes.map(n => ({
            name: n.name,
            itemStyle: { color: t.series[TIER_SLOT[trace.tierOf[n.name]] != null ? TIER_SLOT[trace.tierOf[n.name]] : 7], borderColor: t.surface }
          })),
          links: trace.links.map(l => Object.assign({}, l, {
            lineStyle: l.single
              ? { color: t.status.critical, opacity: 0.42 }
              : { color: 'gradient', opacity: 0.26 }
          })),
          lineStyle: { curveness: 0.36 },
          // Middle-column labels necessarily sit over outgoing ribbons; a halo in
          // the surface color keeps them legible without hiding the flow.
          label: {
            color: t.ink2, fontSize: 11.5,
            textBorderColor: t.surface, textBorderWidth: 3,
            formatter: p => p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name
          },
          emphasis: { focus: 'adjacency' }
        }]
      });
    });
    if (traceChart) traceChart.on('click', p => {
      if (p.dataType !== 'node') return;
      const D2 = SCR.data;
      const s = D2.suppliers.find(x => x.name === p.name); if (s) return U.openSupplier(s.id);
      const m = D2.materials.find(x => x.name === p.name); if (m) return U.openMaterial(m.id);
      const pl = D2.plants.find(x => x.name === p.name); if (pl) return U.openSite(pl.id);
      const d = D2.dcs.find(x => x.name === p.name); if (d) return U.openSite(d.id);
    });

    /* ===== Sankey value flow ===== */
    const sank = buildSankey();
    const sankCard = U.card({
      title: 'Value flow by material category',
      sub: 'enterprise-wide roll-up — not narrowed by the product trace above · category → plant → market region ($M)',
      cols: 7, chartClass: 'chart-xl',
      insight: () => {
        const sk = buildSankey();
        const byTarget = {};
        sk.links.forEach(l => { byTarget[l.target] = (byTarget[l.target] || 0) + l.value; });
        const widest = sk.links.slice().sort((a, b) => b.value - a.value)[0];
        const hub = Object.entries(byTarget).sort((a, b) => b[1] - a[1])[0];
        return {
          agent: 'Impact & VAR Agent',
          reads: [
            { label: 'Flow stages', value: 3 },
            { label: 'Widest single flow', value: widest ? F.usdM(+widest.value.toFixed(1)) : '—' },
            { label: 'Largest hub', value: hub ? hub[0] : '—' }
          ],
          points: [
            'Ribbon width is net sales attributed along that path — material category, through the plant that converts it, to the market region that sells it. Three stages, not four: routing through DCs as well doubled the crossings without changing the story, and the trace above already carries DC detail.',
            widest ? `The heaviest single flow is <strong>${U.esc(widest.source)} → ${U.esc(widest.target)}</strong> at ${F.usdM(+widest.value.toFixed(1))}.` : 'No flows in scope.',
            hub ? `<strong>${U.esc(hub[0])}</strong> is the biggest convergence point at ${F.usdM(+hub[1].toFixed(1))} passing through it — concentration in the middle of a network is exactly what a single outage exploits.` : ''
          ].filter(Boolean),
          actions: [{ label: 'Open Site Resilience', onClick: () => SCR.navigate('site') }]
        };
      }
    });
    grid.appendChild(sankCard);
    SCR.charts.mount(sankCard._chartEl, () => {
      const t = SCR.theme.tokens();
      return Object.assign(SCR.theme.baseOption(), {
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, {
          formatter: p => p.dataType === 'edge'
            ? `<strong>${p.data.source}</strong> → <strong>${p.data.target}</strong><br/>${F.usdM(p.data.value)} NTS attributed`
            : `<strong>${p.name}</strong>`
        }),
        series: [{
          type: 'sankey',
          left: 8, right: 130, top: 12, bottom: 8,
          nodeWidth: 14, nodeGap: 16,
          data: sank.nodes.map((n, i) => ({
            name: n.name,
            itemStyle: { color: t.series[i % 8], borderColor: t.surface }
          })),
          links: sank.links,
          lineStyle: { color: 'gradient', opacity: 0.26, curveness: 0.36 },
          label: { color: t.ink2, fontSize: 12 },
          emphasis: { focus: 'adjacency' }
        }]
      });
    });

    /* ===== Single points of failure ===== */
    const spofCard = U.card({
      title: 'Single points of failure',
      sub: 'sole-sourced dependencies ranked by AVAR',
      cols: 5, flush: true,
      insight: () => {
        const spof = D.materials.filter(m => m.singleSource).sort((a, b) => b.avar - a.avar);
        const uncovered = spof.filter(m => m.ttr > m.tts);
        return {
          agent: 'Mitigation Strategist Agent',
          reads: [
            { label: 'Single points of failure', value: spof.length, tone: spof.length ? 'bad' : 'good' },
            { label: 'AVAR concentrated', value: F.usdM(+spof.reduce((a, m) => a + m.avar, 0).toFixed(1)), tone: 'bad' },
            { label: 'Also uncovered', value: uncovered.length, tone: uncovered.length ? 'bad' : 'good' }
          ],
          points: [
            `${spof.length} materials across the enterprise have exactly one qualified supplier, concentrating ${F.usdM(+spof.reduce((a, m) => a + m.avar, 0).toFixed(1))} of adjusted risk on those relationships.`,
            spof.length ? `<strong>${U.esc(spof[0].name)}</strong> is the largest at ${F.usdM(spof[0].avar)} AVAR.` : 'No single points of failure.',
            uncovered.length ? `${uncovered.length} of them also recover slower than they survive — that combination is the shortest path from a supplier event to lost sales.` : 'None of them recover slower than they survive.'
          ],
          actions: [{ label: 'Open sourcing worklist', onClick: () => SCR.navigate('category') }]
        };
      }
    });
    grid.appendChild(spofCard);
    const spofs = D.materials.filter(m => m.singleSource)
      .sort((a, b) => b.avar - a.avar);
    spofCard.querySelector('.card-body').appendChild(U.table([
      { h: 'Dependency', cell: m => `<span class="cell-main">${U.esc(m.name)}</span><span class="cell-sub">${U.esc(D.supplierById(m.suppliers[0]).name)}</span>` },
      { h: 'SKUs', cls: 'num', cell: m => m.depProducts.length },
      { h: 'Gap', cls: 'num', cell: m => `<span style="font-weight:700;color:${m.gap > 0 ? 'var(--status-critical)' : 'var(--status-good)'}">${m.gap > 0 ? '−' + m.gap + 'd' : 'OK'}</span>` },
      { h: 'AVAR', cls: 'num', cell: m => F.usdM(m.avar) }
    ], spofs, m => U.openMaterial(m.id)));
  }

  SCR.registerPage('network', {
    context: () => {
      const p = SCR.data.productById(state.product);
      return { scope: p ? p.name : '', entity: p ? { type: 'product', id: p.id, name: p.name, ref: p } : null };
    },
    title: 'Network Explorer',
    crumb: 'Digital twin · multi-tier dependency graph',
    render
  });
})();
