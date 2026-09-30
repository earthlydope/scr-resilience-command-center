/* ============================================================
   SCR · intelligence.js
   The shared intelligence layer every AI surface draws on.
   · SCR.ai     — context (what the user is looking at: page,
                  live filters, the entity open in the drawer)
                  and entity resolution across the whole model,
                  tolerant of typos and diacritics.
   · SCR.work   — the Execution & Workflow Agent. Turns AI
                  output into real, tracked actions and queued
                  recommendations instead of toasts.
   · SCR.brief  — per-persona "For you today" priorities and
                  the notification summary, computed live.
   Everything reads SCR.data at call time; nothing is canned.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const D = () => SCR.data;
  const F = () => SCR.fmt;
  const esc = s => SCR.ui.esc(s);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  /** Lower-case a name for use mid-sentence, leaving acronyms (MCU, BOPP, HEPA) alone. */
  const lc = s => String(s).replace(/\b([A-Z])([a-z])/g, (m, a, b) => a.toLowerCase() + b);

  const SPARK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 4c.55 4.3 2.2 6.9 6.5 8.5-4.3 1.6-5.95 4.2-6.5 8.5-.55-4.3-2.2-6.9-6.5-8.5C8.8 10.9 10.45 8.3 11 4Z"/><path d="M18.5 2.5c.22 1.5.8 2.4 2.3 2.9-1.5.5-2.08 1.4-2.3 2.9-.22-1.5-.8-2.4-2.3-2.9 1.5-.5 2.08-1.4 2.3-2.9Z"/></svg>';

  /* ================= Context ================= */
  let route = { key: null, opts: {} };
  let focus = null;               // entity open in the 360° drawer
  const listeners = [];

  function notify() {
    const c = get();
    listeners.forEach(fn => { try { fn(c); } catch (_) {} });
  }
  function onChange(fn) { listeners.push(fn); }
  function setRoute(key, opts) { route = { key, opts: opts || {} }; notify(); }
  function setFocus(f) { focus = f || null; notify(); }

  /** Snapshot of what the user is looking at. Pages expose `context()`
      on their registration so live filters and selections come through. */
  function get() {
    const page = route.key && SCR.pages ? SCR.pages[route.key] : null;
    let view = null;
    if (page && typeof page.context === 'function') {
      try { view = page.context(); } catch (_) { view = null; }
    }
    return {
      pageKey: route.key,
      pageTitle: page ? page.title : '',
      view: view || {},
      focus,
      persona: SCR.persona ? SCR.persona.get() : null
    };
  }

  /** The entity "this" most plausibly means: the open drawer, else what the page is about. */
  function subject(c) {
    c = c || get();
    return c.focus || (c.view && c.view.entity) || null;
  }

  const TYPE_LABEL = {
    supplier: 'Supplier', material: 'Material', product: 'Product', plant: 'Plant',
    dc: 'Distribution centre', market: 'Market', alert: 'Alert', sector: 'Sector',
    category: 'Category', stream: 'Value stream', recommendation: 'Recommendation', action: 'Action', card: 'Card'
  };

  /* ================= Entities ================= */
  function refOf(type, id) {
    const d = D();
    switch (type) {
      case 'supplier': return d.supplierById(id);
      case 'material': return d.materialById(id);
      case 'product': return d.productById(id);
      case 'plant': return d.plantById(id);
      case 'dc': return d.dcById(id);
      case 'market': return d.marketById(id);
      case 'alert': return d.alertById(id);
      case 'sector': return d.sectors.find(s => s.key === id);
      case 'category': return d.categories.find(c => c.key === id);
      case 'stream': return d.sectors.some(s => s.streams.includes(id)) ? { name: id } : null;
      case 'recommendation': return d.recommendations.find(r => r.id === id);
      case 'action': return d.actions.find(a => a.id === id);
      default: return null;
    }
  }
  function entity(type, id) {
    const ref = refOf(type, id);
    if (!ref) return null;
    return { type, id, name: ref.name || ref.title || id, ref };
  }
  /** Node id (S.., PT.., DC..) → entity */
  function nodeEntity(id) {
    if (!id) return null;
    if (/^S\d/.test(id)) return entity('supplier', id);
    if (/^PT/.test(id)) return entity('plant', id);
    if (/^DC/.test(id)) return entity('dc', id);
    return null;
  }

  /** Lower-case, strip diacritics (ł is its own letter, so map it first),
      spell out '&', collapse punctuation — the same for keys and queries. */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/ł/g, 'l').replace(/ø/g, 'o')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  const GENERIC = new Set([
    'industries', 'co', 'op', 'coop', 'group', 'sa', 'gmbh', 'oyj', 'sarl', 'tech', 'packaging', 'films',
    'labels', 'partners', 'millers', 'mills', 'refineries', 'proteins', 'flavors', 'parfums', 'biotech',
    'surfactants', 'filtration', 'polymers', 'glassworks', 'cell', 'motor', 'thermal', 'ems', 'dairy',
    'sugar', 'coffee', 'citrus', 'grain', 'palm', 'hazelnut', 'cocoa', 'board', 'americas', 'resins',
    'and', 'the', 'of', 'river', 'great', 'city'
  ]);

  const MATERIAL_ALIASES = {
    M01: ['sugar', 'cane sugar'], M02: ['arabica', 'green coffee', 'coffee beans'], M03: ['oj', 'orange juice', 'juice concentrate', 'oj concentrate'],
    M04: ['palm oil'], M05: ['flour', 'grains'], M06: ['hazelnut paste', 'cocoa paste'], M07: ['milk powder', 'smp'],
    M08: ['flavor', 'flavour', 'flavors', 'flavours', 'aroma'], M09: ['surfactant', 'surfactants', 'sles'], M10: ['enzyme', 'enzymes'],
    M11: ['fragrance', 'fragrances'], M12: ['whey'], M13: ['pet', 'pet resin', 'preforms'], M14: ['closures', 'caps', 'closure', 'bottle caps'],
    M15: ['cans', 'aluminium cans', 'aluminum cans'], M16: ['film', 'bopp', 'laminate'], M17: ['corrugated', 'shippers', 'boxes'],
    M18: ['carton board', 'liquid carton'], M19: ['glass jars', 'jars'], M20: ['labels', 'sleeves'], M21: ['hdpe', 'hdpe bottles'],
    M22: ['mcu', 'mcus', 'microcontroller', 'microcontrollers', 'control chip', 'semiconductor', 'semiconductors'],
    M23: ['li ion', 'cells', 'battery', 'batteries', 'battery cells'], M24: ['motors', 'bldc'], M25: ['heating elements', 'heaters'],
    M26: ['pcba', 'pcb', 'circuit board'], M27: ['housing resin', 'abs'], M28: ['hepa', 'filter media', 'hepa media']
  };
  const PRODUCT_ALIASES = {
    P01: ['verispark sparkling'], P02: ['still water'], P03: ['isotonic'], P04: ['cold brew'], P05: ['instant coffee'],
    P06: ['orchardpress'], P07: ['cola zero', 'cola'], P08: ['crunchwave', 'potato chips', 'chips'], P09: ['nutribar', 'protein bar'],
    P10: ['goldenmill cereal', 'cereal'], P11: ['choconova', 'hazelnut spread'], P12: ['bakehouse', 'cookies'],
    P13: ['instant oats', 'oats'], P14: ['purewash', 'detergent'], P15: ['softsilk', 'fabric conditioner'], P16: ['aquafresh', 'dish gel'],
    P17: ['velvetcare shampoo', 'shampoo'], P18: ['body wash'], P19: ['dermapure', 'bar soap', 'soap'], P20: ['brewmaster', 'coffee machine'],
    P21: ['aeroblend', 'blender'], P22: ['steamglide', 'steamer'], P23: ['trimtech', 'grooming kit'], P24: ['airpure', 'purifier']
  };
  const PLANT_ALIASES = { PT6: ['hcmc', 'saigon', 'ho chi minh'], PT8: ['sao paulo plant'] };
  const MARKET_ALIASES = { US: ['united states', 'usa', 'america'], UK: ['united kingdom', 'uk', 'britain'], AE: ['uae', 'gulf', 'dubai market'] };
  const SECTOR_ALIASES = {
    bev: ['beverages', 'beverage', 'drinks'], food: ['foods and snacks', 'foods', 'food', 'snacks'],
    hpc: ['home and personal care', 'hpc'], dev: ['appliances and devices', 'appliances', 'devices']
  };
  const CATEGORY_ALIASES = {
    ing: ['ingredients', 'raw materials'], pkg: ['packaging'], elc: ['electronics', 'electronics and components'], chm: ['chemicals', 'chemicals and actives']
  };

  let INDEX = null;
  function buildIndex() {
    const d = D();
    const idx = [];
    const add = (type, id, key, w) => {
      const k = norm(key);
      if (!k || k.length < 2) return;
      idx.push({ type, id, key: k, w, tokens: k.split(' ') });
    };
    d.suppliers.forEach(s => {
      const n = norm(s.name);
      add('supplier', s.id, n, 1.25);
      const toks = n.split(' ');
      const core = toks.filter(t => !GENERIC.has(t));
      if (core.length && core.join(' ') !== n) add('supplier', s.id, core.join(' '), 1.1);
      core.forEach(t => { if (t.length >= 5) add('supplier', s.id, t, 1.0); });
      if (norm(s.city).length >= 5) add('supplier', s.id, s.city, 0.45);
    });
    d.materials.forEach(m => {
      add('material', m.id, m.name, 1.25);
      add('material', m.id, m.id, 1.3);
      (MATERIAL_ALIASES[m.id] || []).forEach(a => add('material', m.id, a, 1.0));
    });
    const brandCount = {};
    d.products.forEach(p => { brandCount[p.brand] = (brandCount[p.brand] || 0) + 1; });
    d.products.forEach(p => {
      add('product', p.id, p.name, 1.3);
      const noSize = norm(p.name).split(' ').filter(t => !/\d/.test(t)).join(' ');
      if (noSize !== norm(p.name)) add('product', p.id, noSize, 1.2);
      add('product', p.id, p.brand, brandCount[p.brand] > 1 ? 0.7 : 1.0);
      (PRODUCT_ALIASES[p.id] || []).forEach(a => add('product', p.id, a, 1.0));
    });
    d.plants.forEach(pt => {
      const city = pt.name.split(',')[0];
      add('plant', pt.id, pt.name, 1.25);
      add('plant', pt.id, city, 1.0);
      add('plant', pt.id, city + ' plant', 1.35);
      (PLANT_ALIASES[pt.id] || []).forEach(a => add('plant', pt.id, a, 1.0));
    });
    d.dcs.forEach(dc => {
      add('dc', dc.id, dc.name, 1.3);
      add('dc', dc.id, dc.name.split(' ')[0], 0.9);
      add('dc', dc.id, dc.name.split(' ')[0] + ' dc', 1.3);
    });
    d.markets.forEach(mk => {
      add('market', mk.id, mk.name, 0.7);
      (MARKET_ALIASES[mk.id] || []).forEach(a => add('market', mk.id, a, 0.7));
    });
    d.sectors.forEach(s => {
      (SECTOR_ALIASES[s.key] || [s.name]).forEach(a => add('sector', s.key, a, 0.8));
      s.streams.forEach(st => add('stream', st, st, 0.85));
    });
    d.categories.forEach(c => (CATEGORY_ALIASES[c.key] || [c.name]).forEach(a => add('category', c.key, a, 0.8)));
    d.alerts.forEach(a => add('alert', a.id, a.id, 1.6));
    return idx;
  }
  function index() { return INDEX || (INDEX = buildIndex()); }

  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const prev = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      let diag = prev[0];
      prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = prev[j];
        prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
        diag = tmp;
      }
    }
    return prev[b.length];
  }

  /** Every entity named in `text`, best first; overlapping mentions resolve
      to the stronger reading ("pune india" → the plant, not the market). */
  function scan(text, opts) {
    opts = opts || {};
    const q = ' ' + norm(text) + ' ';
    const types = opts.types ? new Set(opts.types) : null;
    const hits = [];
    index().forEach(e => {
      if (types && !types.has(e.type)) return;
      const pos = q.indexOf(' ' + e.key + ' ');
      if (pos >= 0) hits.push({ type: e.type, id: e.id, key: e.key, score: e.key.length * e.w, start: pos, end: pos + e.key.length + 1, fuzzy: false });
    });
    hits.sort((a, b) => b.score - a.score);
    const chosen = [];
    hits.forEach(h => {
      if (chosen.some(c => c.type === h.type && c.id === h.id)) return;
      if (chosen.some(c => h.start < c.end && c.start < h.end)) return;
      chosen.push(h);
    });
    return chosen.map(h => Object.assign(entity(h.type, h.id) || {}, { score: h.score, key: h.key, start: h.start })).filter(e => e.ref);
  }

  function resolve(text, opts) { return scan(text, opts)[0] || null; }

  /** Near-misses for "did you mean": single-token keys within edit distance. */
  function suggest(text, opts) {
    opts = opts || {};
    const toks = norm(text).split(' ').filter(t => t.length >= 4);
    const seen = new Set();
    const out = [];
    index().forEach(e => {
      if (e.tokens.length !== 1 || e.key.length < 5 || e.w < 0.8) return;
      if (opts.types && !opts.types.includes(e.type)) return;
      toks.forEach(t => {
        const lim = e.key.length >= 6 ? 2 : 1;
        if (t !== e.key && lev(t, e.key) <= lim) {
          const k = e.type + ':' + e.id;
          if (seen.has(k)) return;
          seen.add(k);
          const ent = entity(e.type, e.id);
          if (ent) out.push(Object.assign(ent, { token: t }));
        }
      });
    });
    return out.slice(0, 4);
  }

  function describe(c) {
    c = c || get();
    const s = subject(c);
    if (s) return { kind: TYPE_LABEL[s.type] || s.type, text: s.name, entity: s };
    const scope = c.view && c.view.scope;
    return { kind: 'View', text: (c.pageTitle || 'Command Center') + (scope ? ' · ' + scope : ''), entity: null };
  }

  SCR.ai = { get, subject, describe, setRoute, setFocus, onChange, resolve, scan, suggest, entity, nodeEntity, norm, TYPE_LABEL, SPARK };

  /* ================= Work engine (Execution & Workflow Agent) ================= */
  const OWNER_BY_CAT = { pkg: 'L. Tran', elc: 'A. Chen', ing: 'C. Duarte', chm: 'M. Sørensen' };
  const OWNER_BY_SITE = { PT1: 'P. Mehta', PT2: 'R. Iyer', PT3: 'M. Sørensen', PT4: 'R. Iyer', PT5: 'P. Mehta', PT6: 'N. Vu', PT7: 'J. Park', PT8: 'S. Costa' };
  const ACTION_TYPES = ['Alternate supplier', 'Inventory buffer', 'Contract action', 'Emergency procurement', 'Re-routing', 'Capacity shift', 'Supplier improvement', 'Supplier outreach', 'Demand shaping', 'Data quality'];

  function addDays(iso, n) {
    const d = new Date(iso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + Math.round(n));
    return d.toISOString().slice(0, 10);
  }
  function nowUTC() {
    const d = new Date();
    return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  }
  function nextId(prefix, list) {
    const max = list.reduce((a, x) => {
      const m = /(\d+)$/.exec(x.id || '');
      return m ? Math.max(a, +m[1]) : a;
    }, 0);
    return prefix + (max + 1);
  }
  function parseMoney(s) {
    const m = /\$\s*([\d.]+)\s*([MK])?/i.exec(String(s || ''));
    if (!m) return 0;
    const v = parseFloat(m[1]);
    return m[2] && m[2].toUpperCase() === 'K' ? v / 1000 : v;
  }
  function parsePct(s) {
    const m = /([\d.]+)\s*%/.exec(String(s || ''));
    return m ? parseFloat(m[1]) / 100 : 0.4;
  }
  function typeFromText(t) {
    t = String(t || '').toLowerCase();
    if (/re-?route|routing|corridor|\brail\b|air-?freight|air-?bridge|reefer|shipping/.test(t)) return 'Re-routing';
    if (/sister plant|co-packer|capacity shift/.test(t)) return 'Capacity shift';
    if (/alternate|qualif|second source|tooling transfer|shift volume/.test(t)) return 'Alternate supplier';
    if (/buffer|safety.stock|forward.buy|cover|stock release/.test(t)) return 'Inventory buffer';
    if (/contract|hedge|reserve|capacity|terms/.test(t)) return 'Contract action';
    if (/gate|defer|allocation|prioriti/.test(t)) return 'Demand shaping';
    if (/screening|8d|audit|review|improv/.test(t)) return 'Supplier improvement';
    if (/substitut/.test(t)) return 'Emergency procurement';
    return 'Supplier improvement';
  }
  function dueFromTime(time) {
    const t = String(time || '');
    const m = /(\d+)\s*[–-]\s*(\d+)\s*w/.exec(t) || /(\d+)\s*w/.exec(t);
    if (/day/.test(t)) return 7;
    if (m) return (+(m[2] || m[1])) * 7;
    return 30;
  }

  function logFeed(agent, text) {
    D().feed.unshift({ time: nowUTC(), agent, text, fresh: true });
  }
  function refreshCounts() {
    const d = D();
    d.kpis.openActions = d.actions.filter(a => a.status !== 'Completed').length;
    d.kpis.overdueActions = d.actions.filter(a => a.status === 'Overdue').length;
    if (SCR.refreshNav) SCR.refreshNav();
  }
  /** Pages that list what just changed re-render so the new row is visible. */
  function refreshIfShowing(keys) {
    const drawer = document.getElementById('drawer');
    if (drawer && drawer.classList.contains('open')) return; // never yank an open 360° away
    if (keys.includes(route.key) && SCR.navigate) {
      const scroller = document.getElementById('pageScroll');
      const y = scroller ? scroller.scrollTop : 0;
      SCR.navigate(route.key);
      if (scroller) requestAnimationFrame(() => {
        scroller.style.scrollBehavior = 'auto';   // jump back, don't glide from the top
        scroller.scrollTop = y;
        scroller.style.scrollBehavior = '';
      });
    }
  }

  /** opts.refresh === false lets a caller finish its own bookkeeping first. */
  function createAction(spec, opts) {
    const d = D();
    const act = Object.assign({
      id: nextId('ACT-', d.actions), title: 'Mitigation action', type: 'Supplier improvement',
      owner: 'Unassigned', due: addDays(d.asOf, 30), status: 'Open', linked: '—',
      cost: 0, riskCut: 0, rrePre: null, rrePost: null
    }, spec, { createdBy: 'copilot', fresh: true });
    ['rationale', 'subject', 'basis'].forEach(k => delete act[k]);
    act.cost = +(+act.cost || 0).toFixed(1);
    act.riskCut = +(+act.riskCut || 0).toFixed(1);
    d.actions.unshift(act);
    refreshCounts();
    logFeed('workflow', `Opened <strong>${esc(act.id)}</strong> — ${esc(act.title)} · owner ${esc(act.owner)}, due ${esc(act.due)}.`);
    if (!opts || opts.refresh !== false) refreshIfShowing(['actions', 'agents']);
    return act;
  }

  function addRecommendation(spec) {
    const d = D();
    const r = Object.assign({
      id: nextId('R-', d.recommendations), status: 'pending', agent: 'mitigation', linked: '—',
      approvers: 'Category Leader', cost: '', riskCut: '', exposure: 0
    }, spec, { fresh: true });
    d.recommendations.unshift(r);
    refreshCounts();
    logFeed('mitigation', `New proposal <strong>${esc(r.id)}</strong>: ${esc(r.title)}.`);
    refreshIfShowing(['agents']);
    return r;
  }

  function actionFromReco(r) {
    const d = D();
    const alert = d.alertById(r.linked);
    const mat = alert && alert.mats && alert.mats.length ? d.materialById(alert.mats[0]) : (r.material ? d.materialById(r.material) : null);
    const cut = parsePct(r.riskCut);
    return {
      title: r.title,
      type: typeFromText(r.title),
      owner: mat ? (OWNER_BY_CAT[mat.cat] || 'Category Leader') : (alert ? alert.owner : 'Category Leader'),
      due: addDays(d.asOf, mat ? clamp(mat.tts * 3, 14, 60) : 30),
      linked: r.linked || '—',
      cost: parseMoney(r.cost),
      riskCut: mat ? mat.avar * cut : (r.exposure || 0) * 0.4 * cut,
      rrePre: mat ? mat.rre : null,
      rrePost: mat ? +(mat.rre * (1 - cut * 0.8)).toFixed(2) : null
    };
  }

  /** Approving a recommendation now puts a real action on the tracker. */
  function approve(r) {
    if (!r || r.status !== 'pending') return null;
    r.status = 'approved';
    const act = createAction(actionFromReco(r), { refresh: false });
    r.actionId = act.id;
    refreshIfShowing(['actions', 'agents']);
    return act;
  }

  /* ---- drafting: the agent proposes, the human edits and confirms ---- */
  function openAlertFor(pred) { return D().alerts.find(a => a.status !== 'closed' && pred(a)); }
  function bindingMaterial(mats) {
    return mats.slice().sort((a, b) =>
      (b.gap > 0) - (a.gap > 0) || (b.singleSource - a.singleSource) || b.gap - a.gap || b.avar - a.avar)[0];
  }

  function draftForMaterial(m, subjectName) {
    const d = D(), f = F();
    const sup = d.supplierById(m.suppliers[0]);
    const alert = openAlertFor(a => (a.mats || []).includes(m.id));
    let title, type, cut, cost, why;
    if (m.gap > 0 && m.singleSource) {
      type = 'Alternate supplier'; cut = 0.58;
      title = `Qualify a second source for ${lc(m.name)}`;
      cost = m.spend * 0.03 + 0.3;
      why = `${m.name} is single-sourced from ${sup.name} and takes ${m.ttr} days to recover against ${m.tts} days of cover — a ${m.gap}-day gap no purchase order can close. A second qualified source removes the gap instead of postponing it.`;
    } else if (m.gap > 0) {
      type = 'Inventory buffer'; cut = 0.4;
      title = `Raise ${lc(m.name)} cover from ${m.tts} to ${m.ttr} days`;
      cost = m.spend * (m.gap / 365) * 1.1 + 0.1;
      why = `${m.name} already has alternates, so the cheapest protection is cover that outlasts recovery: +${m.gap} days of stock bridges the switch.`;
    } else if (m.singleSource) {
      type = 'Contract action'; cut = 0.25;
      title = `Reserve capacity and continuity terms with ${sup.name}`;
      cost = m.spend * 0.01 + 0.1;
      why = `Cover already outlasts recovery for ${lc(m.name)}, but there is only one supplier. A capacity reservation with a continuity clause keeps it that way.`;
    } else {
      type = 'Supplier improvement'; cut = 0.18;
      title = `Quarterly risk review of ${lc(m.name)} suppliers`;
      cost = 0.1;
      why = `${m.name} is dual-sourced and cover sits inside recovery, so a review cadence is enough here — no spend is needed yet.`;
    }
    return {
      subject: subjectName || m.name,
      title, type,
      owner: OWNER_BY_CAT[m.cat] || 'Category Leader',
      due: addDays(d.asOf, clamp(m.tts * 3, 14, 60)),
      linked: alert ? alert.id : '—',
      cost: +cost.toFixed(1),
      riskCut: +(m.avar * cut).toFixed(1),
      rrePre: m.rre,
      rrePost: +(m.rre * (1 - cut * 0.85)).toFixed(2),
      rationale: why,
      basis: [
        `Binding component: ${m.name} — TTS ${m.tts}d, TTR ${m.ttr}d, ${m.singleSource ? 'single-sourced' : m.suppliers.length + ' suppliers'}.`,
        `Expected AVAR cut = AVAR ${f.usdM(m.avar)} × ${Math.round(cut * 100)}% typical reduction for a ${type.toLowerCase()} action.`,
        `Due date sized to cover: ${m.tts} days of TTS × 3, bounded to 14–60 days.`
      ]
    };
  }

  function draftForScenario(r, o) {
    const d = D(), f = F();
    const node = r.node;
    const isSup = /^S\d/.test(node.id), isPlant = /^PT/.test(node.id);
    o = o || (r.opts || [])[0];
    return {
      subject: node.name,
      title: `${o.name} — ${node.name}`,
      type: typeFromText(o.name),
      owner: isSup ? (OWNER_BY_CAT[node.cat] || 'Category Leader') : isPlant ? (OWNER_BY_SITE[node.id] || 'SC Site Leader') : 'Logistics Director',
      due: addDays(d.asOf, dueFromTime(o.time)),
      linked: (openAlertFor(a => a.nodes.includes(node.id)) || {}).id || '—',
      cost: o.cost,
      riskCut: +(r.avar * o.cut).toFixed(1),
      rrePre: null, rrePost: null,
      rationale: `On the twin, a ${r.days}-day ${String(r.type || 'disruption').toLowerCase()} at ${node.name} leaves ${f.usdM(r.atRisk)} of sales uncovered. “${o.name}” removes ${Math.round(o.cut * 100)}% of it for ${f.usdM(o.cost)} and takes effect in ${o.time} — the best net benefit of the ${r.opts.length} options.`,
      basis: [
        `At risk = sales the cover cannot absorb over ${r.days} days at ${r.sev}% severity: ${f.usdM(r.atRisk)}.`,
        `Expected AVAR cut = scenario AVAR ${f.usdM(r.avar)} × ${Math.round(o.cut * 100)}%.`
      ]
    };
  }

  /** target: entity {type,id} · {type:'scenario', result, option} · plain text */
  function draftAction(target) {
    const d = D();
    if (typeof target === 'string') target = resolve(target) || { type: 'text', name: target };
    if (!target) return null;
    const ent = target.ref ? target : (target.type && target.id ? entity(target.type, target.id) : target);
    switch (target.type) {
      case 'scenario': return draftForScenario(target.result, target.option);
      case 'material': return draftForMaterial(ent.ref);
      case 'supplier': {
        const mats = d.materialsOf(ent.id);
        const dr = draftForMaterial(bindingMaterial(mats), ent.name);
        if (!/ with /.test(dr.title) && !/suppliers$/.test(dr.title)) dr.title += ` (${ent.name})`;
        return dr;
      }
      case 'product': {
        const p = ent.ref;
        const m = bindingMaterial(p.materials.map(d.materialById));
        const dr = draftForMaterial(m, p.name);
        dr.rationale = `The component that breaks ${p.name} first is ${lc(m.name)}. ` + dr.rationale;
        return dr;
      }
      case 'plant': {
        const pt = ent.ref;
        const mats = pt.materials.map(d.materialById).filter(m => m.gap > 0);
        if (!mats.length) return Object.assign(draftForMaterial(bindingMaterial(pt.materials.map(d.materialById)), pt.name), { owner: OWNER_BY_SITE[pt.id] || 'SC Site Leader' });
        const m = bindingMaterial(mats);
        const city = pt.name.split(',')[0];
        return Object.assign(draftForMaterial(m, pt.name), {
          title: `Raise ${lc(m.name)} cover at ${city} from ${m.tts} to ${m.ttr} days`,
          type: 'Inventory buffer',
          owner: OWNER_BY_SITE[pt.id] || 'SC Site Leader',
          rationale: `${pt.name} can be stopped by ${mats.length} inbound component${mats.length === 1 ? '' : 's'}; ${lc(m.name)} is the tightest — ${m.tts} days of cover against ${m.ttr} days to recover. A site buffer is the fastest lever the site controls.`
        });
      }
      case 'dc': {
        const dc = ent.ref;
        return {
          subject: dc.name, title: `Pre-approve alternate routing for ${dc.name}`, type: 'Re-routing',
          owner: 'Logistics Director', due: addDays(d.asOf, 21), linked: '—',
          cost: 0.2, riskCut: +(dc.avar * 0.6).toFixed(1), rrePre: null, rrePost: null,
          rationale: `${dc.name} serves ${dc.marketsServed} market${dc.marketsServed === 1 ? '' : 's'} (${F().usdM(dc.nts)} NTS). A pre-approved diversion via a sister DC takes recovery from ${dc.ttr} days to days.`,
          basis: [`Expected AVAR cut = DC AVAR ${F().usdM(dc.avar)} × 60% for a pre-approved re-route.`]
        };
      }
      case 'alert': {
        const a = ent.ref;
        const m = (a.mats || []).map(d.materialById).filter(Boolean)[0];
        if (m) return Object.assign(draftForMaterial(m, a.title), { linked: a.id });
        return {
          subject: a.title, title: `Resolve ${a.id}: ${a.type}`, type: a.type === 'Missing data' ? 'Data quality' : 'Supplier improvement',
          owner: a.owner, due: addDays(d.asOf, 14), linked: a.id, cost: 0.1, riskCut: +(a.exposure * 0.2).toFixed(1),
          rrePre: null, rrePost: null, rationale: a.detail, basis: []
        };
      }
      default:
        return {
          subject: target.name || 'this item', title: String(target.name || 'Mitigation action'), type: typeFromText(target.name),
          owner: 'Unassigned', due: addDays(d.asOf, 30), linked: '—', cost: 0.2, riskCut: 0, rrePre: null, rrePost: null,
          rationale: 'Drafted from your request. Add the owner and expected reduction before it goes to the tracker.', basis: []
        };
    }
  }

  /** The action sheet: the agent drafts every field, the human confirms. */
  function openSheet(target, opts) {
    opts = opts || {};
    const dr = target && target.title && target.type && target.owner ? target : draftAction(target);
    if (!dr) return;
    const d = D(), f = F();
    const openAlerts = d.alerts.filter(a => a.status !== 'closed');
    const types = ACTION_TYPES.includes(dr.type) ? ACTION_TYPES : [dr.type].concat(ACTION_TYPES);
    SCR.ui.modal('New mitigation action', `
      <div class="ai-note"><span class="ai-mark">${SPARK}</span>
        <div><strong style="color:var(--ink)">Drafted by the Mitigation Strategist Agent.</strong> ${esc(dr.rationale)}
        Adjust anything before it goes on the tracker.</div></div>
      <form class="form-grid" id="actSheet">
        <div class="form-field full"><label for="afTitle">Action</label><input class="fld" id="afTitle" name="title" value="${esc(dr.title)}" required /></div>
        <div class="form-field"><label for="afType">Type</label>
          <select class="fld fld-select" id="afType" name="type">${types.map(t => `<option ${t === dr.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
        <div class="form-field"><label for="afOwner">Owner</label><input class="fld" id="afOwner" name="owner" value="${esc(dr.owner)}" /></div>
        <div class="form-field"><label for="afDue">Due</label><input class="fld" id="afDue" type="date" name="due" value="${esc(dr.due)}" /></div>
        <div class="form-field"><label for="afLinked">Linked alert</label>
          <select class="fld fld-select" id="afLinked" name="linked"><option value="—">None</option>${
            openAlerts.map(a => `<option value="${esc(a.id)}" ${a.id === dr.linked ? 'selected' : ''}>${esc(a.id)} · ${esc(a.type)}</option>`).join('')}</select></div>
        <div class="form-field"><label for="afCost">Estimated cost ($M)</label><input class="fld" id="afCost" type="number" step="0.1" min="0" name="cost" value="${dr.cost}" /></div>
        <div class="form-field"><label for="afCut">Expected AVAR cut ($M)</label><input class="fld" id="afCut" type="number" step="0.1" min="0" name="riskCut" value="${dr.riskCut}" /></div>
        ${dr.basis && dr.basis.length ? `<details class="working form-field full"><summary>How the agent sized this</summary><ul>${dr.basis.map(b => `<li>${esc(b)}</li>`).join('')}</ul></details>` : ''}
        <div class="form-foot form-field full" style="flex-direction:row">
          <span class="muted">${dr.rrePre != null ? `Residual risk ${f.rre(dr.rrePre)} → ${f.rre(dr.rrePost)} expected` : 'Goes to the owner for acceptance'}</span>
          <button type="button" class="btn" data-cancel>Cancel</button>
          <button type="submit" class="btn btn-primary">Create action</button>
        </div>
      </form>`);
    const form = document.getElementById('actSheet');
    form.querySelector('[data-cancel]').addEventListener('click', () => SCR.ui.closeModal());
    setTimeout(() => { const t = document.getElementById('afTitle'); if (t) t.focus(); }, 60);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = n => form.elements[n].value;
      const act = createAction({
        title: v('title').trim() || dr.title, type: v('type'), owner: v('owner').trim() || 'Unassigned',
        due: v('due') || dr.due, linked: v('linked'), cost: parseFloat(v('cost')) || 0, riskCut: parseFloat(v('riskCut')) || 0,
        rrePre: dr.rrePre, rrePost: dr.rrePost
      });
      SCR.ui.closeModal();
      SCR.ui.toast('Action created', `<strong>${esc(act.id)}</strong> is on the tracker — owned by ${esc(act.owner)}, due ${esc(act.due)}.`, 'good',
        { label: 'View in tracker', run: () => goToTracker() });
      if (opts.onCreated) opts.onCreated(act);
    });
  }

  function goToTracker() {
    SCR.navigate('actions');
    setTimeout(() => { const n = document.getElementById('actTrack'); if (n) SCR.ui.scrollToCard(n); }, 120);
  }

  /** Single-source plan → real proposals in the approval queue (not a toast). */
  function proposeAlternates(limit) {
    const d = D(), f = F();
    const covered = new Set();
    d.recommendations.filter(r => r.status === 'pending').forEach(r => {
      const a = d.alertById(r.linked);
      (a && a.mats || []).forEach(m => covered.add(m));
      if (r.material) covered.add(r.material);
    });
    const risky = d.materials.filter(m => m.singleSource && m.score >= 2.8 && !covered.has(m.id))
      .sort((a, b) => b.avar - a.avar).slice(0, limit || 3);
    return risky.map(m => {
      const dr = draftForMaterial(m);
      const alert = openAlertFor(a => (a.mats || []).includes(m.id));
      return addRecommendation({
        linked: alert ? alert.id : '—', material: m.id,
        title: dr.title,
        detail: dr.rationale,
        cost: '+' + f.usdM(dr.cost) + ' qualification',
        riskCut: '−' + Math.round((dr.riskCut / (m.avar || 1)) * 100) + '% AVAR',
        exposure: m.var,
        approvers: 'Category Leader'
      });
    });
  }

  /** Pending proposals, best first: protection per $ of cost, weighted up
      for critical (×1.5) and high (×1.2) alerts. Every surface uses this. */
  function rankRecommendations() {
    const d = D();
    const sevW = { critical: 1.5, high: 1.2, medium: 1, low: 0.8 };
    return d.recommendations.filter(r => r.status === 'pending').map(r => {
      const a = d.alertById(r.linked);
      const cost = Math.max(0.1, parseMoney(r.cost));
      const protect = (r.exposure || 0) * parsePct(r.riskCut);
      return { r, a, cost, protect, score: protect / cost * (a ? sevW[a.sev] || 1 : 1) };
    }).sort((x, y) => y.score - x.score);
  }

  SCR.work = { createAction, addRecommendation, approve, draftAction, openSheet, proposeAlternates, goToTracker, rankRecommendations, ACTION_TYPES, parseMoney, parsePct, addDays };

  /* ================= Briefing ("For you today") ================= */
  const TONE = { critical: 'var(--status-critical)', high: 'var(--status-serious)', watch: 'var(--status-warning)', good: 'var(--status-good)', info: 'var(--accent)' };

  function ask(text) { if (SCR.copilot && SCR.copilot.ask) SCR.copilot.ask(text, { open: true }); }

  function itemsFor(pid) {
    const d = D(), f = F(), k = d.kpis;
    const ranked = rankRecommendations();
    const gapMats = d.materials.filter(m => m.gap > 0);
    const tightest = gapMats.slice().sort((a, b) => a.tts - b.tts || b.var - a.var)[0];
    const overdue = d.actions.filter(a => a.status === 'Overdue');
    const items = [];

    if (pid === 'rrl') {
      const top = ranked[0];
      if (top) items.push({
        tone: TONE.critical, kicker: 'Decision waiting',
        html: `<strong>Approve ${esc(top.r.id)}</strong> — ${esc(top.r.title)}. Protects about ${f.usdM(+top.protect.toFixed(1))} for ${f.usdM(top.cost)}${top.a ? `; the alert behind it is ${esc(top.a.sev)}` : ''}.`,
        act: { label: 'Review', run: () => SCR.navigate('agents') }
      });
      if (tightest) {
        const sup = d.supplierById(tightest.suppliers[0]);
        items.push({
          tone: TONE.high, kicker: 'Shortest cover',
          html: `<strong>${esc(tightest.name)}: ${tightest.tts} days of cover</strong> against a ${tightest.ttr}-day recovery at ${esc(sup.name)} — ${tightest.depProducts.length} SKUs, ${f.usdM(tightest.var)} at risk.`,
          act: { label: 'Simulate', run: () => ask(`What if ${sup.name} fails for 30 days?`) }
        });
      }
      items.push({
        tone: k.riDelta >= 0 ? TONE.good : TONE.watch, kicker: 'Trend',
        html: `Enterprise RI is <strong>${k.enterpriseRI}%</strong> (${f.signed(k.riDelta, ' pts')} on June) with ${f.usdM(k.mitigatedYtd)} of AVAR retired this year${overdue.length ? `; <strong>${overdue.length} action${overdue.length === 1 ? ' is' : 's are'} overdue</strong>` : ''}.`,
        act: { label: 'Draft brief', run: () => ask('Draft the executive brief') }
      });
    } else if (pid === 'vsl') {
      const fragile = d.products.slice().sort((a, b) => a.ri - b.ri)[0];
      const fm = bindingMaterial(fragile.materials.map(d.materialById));
      items.push({
        tone: TONE.critical, kicker: 'Most fragile SKU',
        html: `<strong>${esc(fragile.name)}</strong> sits at RI ${f.ri(fragile.ri)} with ${fragile.gapCount} component${fragile.gapCount === 1 ? '' : 's'} short of cover${fm.gap > 0 ? ` — ${esc(lc(fm.name))} is ${fm.gap} days short` : ''}.`,
        act: { label: 'What breaks it', run: () => ask(`What breaks ${fragile.name} first?`) }
      });
      const growth = d.products.filter(p => p.growth >= 15 && p.gapMax > 0).sort((a, b) => b.growth - a.growth)[0];
      if (growth) items.push({
        tone: TONE.high, kicker: 'Growth outpacing cover',
        html: `<strong>${esc(growth.name)}</strong> is growing ${f.signed(growth.growth, '%')} while its worst component is ${growth.gapMax} days short of cover.`,
        act: { label: 'Open SKU', run: () => SCR.ui.openProduct(growth.id) }
      });
      const topSup = d.suppliers.slice().sort((a, b) => b.avar - a.avar)[0];
      items.push({
        tone: TONE.info, kicker: 'Exposure',
        html: `<strong>${k.gapProducts} of ${k.products} SKUs</strong> are exposed through TTR &gt; TTS; the node behind the most AVAR is ${esc(topSup.name)} (${f.usdM(topSup.avar)}).`,
        act: { label: 'Simulate', run: () => ask(`What if ${topSup.name} fails for 30 days?`) }
      });
    } else if (pid === 'cat') {
      const risky = d.materials.filter(m => m.singleSource && m.score >= 2.8).sort((a, b) => b.avar - a.avar);
      items.push({
        tone: TONE.critical, kicker: 'Single-source risk',
        html: `<strong>${risky.length} sole-sourced materials</strong> sit above the 2.8 risk threshold — ${risky.slice(0, 3).map(m => esc(lc(m.name))).join(', ')} lead on AVAR.`,
        act: { label: 'Draft plan', run: () => ask('Mitigation plan for single-source materials') }
      });
      const topSup = d.suppliers.slice().sort((a, b) => b.avar - a.avar)[0];
      const dims = Object.keys(topSup.dims).sort((a, b) => topSup.dims[b] - topSup.dims[a]);
      const DN = { fin: 'financial', qual: 'quality', rel: 'reliability', geo: 'geopolitical', cyb: 'cyber', clim: 'climate' };
      items.push({
        tone: TONE.high, kicker: 'Supplier to watch',
        html: `<strong>${esc(topSup.name)}</strong> carries ${f.usdM(topSup.avar)} AVAR, driven by ${DN[dims[0]]} and ${DN[dims[1]]} risk.`,
        act: { label: 'Why?', run: () => ask(`Why is ${topSup.name} critical?`) }
      });
      const shift = d.alerts.find(a => a.status !== 'closed' && a.type === 'Supplier risk shift') ||
        d.alerts.find(a => a.status !== 'closed' && a.type === 'External event');
      const shiftSup = shift && shift.nodes.length ? d.supplierById(shift.nodes[0]) : null;
      if (shift && shiftSup) items.push({
        tone: TONE.watch, kicker: 'Changed this week',
        html: `${esc(shift.title)}.`,
        act: { label: 'Draft email', run: () => ask(`Draft an email to ${shiftSup.name}`) }
      });
    } else {
      const pt = d.plants.slice().sort((a, b) => a.ttsMin - b.ttsMin || b.criticalMats - a.criticalMats)[0];
      const ptMats = pt.materials.map(d.materialById);
      // the component that sets the site's minimum cover
      const m = ptMats.slice().sort((a, b) => a.tts - b.tts || b.gap - a.gap)[0];
      const city = pt.name.split(',')[0];
      items.push({
        tone: TONE.critical, kicker: 'Shortest cover',
        html: `<strong>${esc(city)}</strong> has ${pt.ttsMin} days of cover on ${esc(lc(m.name))}; ${pt.criticalMats} inbound components can stop the site.`,
        act: { label: 'Open site', run: () => SCR.navigate('site', { site: pt.id }) }
      });
      const busy = d.plants.slice().sort((a, b) => b.utilization - a.utilization)[0];
      items.push({
        tone: TONE.high, kicker: 'Little headroom',
        html: `<strong>${esc(busy.name.split(',')[0])}</strong> runs at ${busy.utilization}% utilisation, so a sister plant can absorb little of its volume.`,
        act: { label: 'Simulate', run: () => ask(`What if ${busy.name.split(',')[0]} plant goes down for 21 days?`) }
      });
      const od = overdue[0];
      if (od) items.push({
        tone: TONE.watch, kicker: 'Overdue',
        html: `<strong>${esc(od.id)}</strong> — ${esc(od.title)} — was due ${esc(od.due)} (owner ${esc(od.owner)}).`,
        act: { label: 'Review', run: () => goToTracker() }
      });
    }
    return items.slice(0, 3);
  }

  function signalsLine() {
    const d = D();
    const sensing = (d.agents || []).find(a => a.key === 'sensing');
    const signals = sensing ? sensing.stats[0][1] : 0;
    const latest = (d.feed.find(x => !x.fresh) || d.feed[0] || {}).time || '';
    return `Summarised from ${signals} signals and ${d.alerts.filter(a => a.status !== 'closed').length} open alerts${latest ? ' · ' + latest + ' UTC' : ''}`;
  }

  /** "For you today" card. opts.wide lays the three items side by side. */
  function card(pid, opts) {
    opts = opts || {};
    const items = itemsFor(pid);
    const node = SCR.ui.el(`<section class="ai-card ai-ring ${opts.wide ? 'wide' : ''}">
      <div class="ai-head">
        <span class="ai-mark">${SPARK}</span>
        <div class="ai-titles">
          <div class="ai-title">For you today</div>
          <div class="ai-cap">${esc(signalsLine())}</div>
        </div>
      </div>
      <ol class="ai-list"></ol>
      <button class="ai-ask" type="button">${SPARK}<span>Ask a follow-up about today…</span><span class="kbd">⌘K</span></button>
    </section>`);
    const list = node.querySelector('.ai-list');
    items.forEach((it, i) => {
      const li = SCR.ui.el(opts.wide
        ? `<li class="ai-item" style="--tone:${it.tone}">
            <div class="ai-item-top"><span class="ai-dot">${i + 1}</span><span class="ai-item-kicker">${esc(it.kicker)}</span></div>
            <div class="ai-item-text">${it.html}</div>
            <button class="btn btn-sm">${esc(it.act.label)}</button>
          </li>`
        : `<li class="ai-item" style="--tone:${it.tone}">
            <span class="ai-dot">${i + 1}</span>
            <div class="ai-item-text"><span class="ai-item-kicker">${esc(it.kicker)}</span><br/>${it.html}</div>
            <button class="btn btn-sm">${esc(it.act.label)}</button>
          </li>`);
      li.querySelector('.btn').addEventListener('click', e => { e.stopPropagation(); it.act.run(); });
      list.appendChild(li);
    });
    node.querySelector('.ai-ask').addEventListener('click', () => {
      if (SCR.copilot) { SCR.copilot.open(); SCR.copilot.focusInput(); }
    });
    return node;
  }

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }
  function asOfLong() {
    const d = new Date(D().asOf + 'T05:00:00Z');
    return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  /** One paragraph over the alert stack, like a notification summary. */
  function notificationSummary() {
    const d = D(), f = F();
    const open = d.alerts.filter(a => a.status !== 'closed');
    const crit = open.filter(a => a.sev === 'critical');
    const high = open.filter(a => a.sev === 'high');
    const top = open.slice().sort((a, b) => b.exposure - a.exposure).slice(0, 2);
    const exposure = +open.reduce((a, x) => a + x.exposure, 0).toFixed(1);
    const overdue = d.actions.filter(a => a.status === 'Overdue').length;
    const short = t => esc(t.split(/[:—]/)[0].trim());
    return `<strong>${crit.length} critical and ${high.length} high</strong> alerts are open, carrying ${f.usdM(exposure)} of exposure.
      ${top.length ? `${short(top[0].title)}${top[1] ? ' and ' + short(top[1].title).toLowerCase() : ''} lead.` : ''}
      ${overdue ? `${overdue} mitigation action${overdue === 1 ? ' is' : 's are'} overdue.` : ''}`;
  }

  SCR.brief = { itemsFor, card, greeting, asOfLong, notificationSummary };
})();
