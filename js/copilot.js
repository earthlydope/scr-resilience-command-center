/* ============================================================
   SCR · copilot.js
   Resilience Copilot — a conversational layer over the live
   model that knows what you are looking at.
   · Context-aware: the page, its live filters and the entity
     open in the drawer are the default subject of a question,
     so "what if it fails for 6 weeks?" needs no names.
   · Answers in place: what-ifs run on the digital twin inside
     the thread, with duration sensitivity and the best plan.
   · Acts: creates tracked actions and queued proposals, drafts
     supplier emails and executive briefs.
   · Shows its working: computed figures expand into the
     formula and inputs behind them.
   Every answer is computed from SCR.data at ask time and
   attributed to the agent that owns the capability.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const D = () => SCR.data;
  const F = () => SCR.fmt;
  const esc = s => SCR.ui.esc(s);
  const el = h => SCR.ui.el(h);
  const usd = v => SCR.fmt.usdM(v);

  let panel, thread, input, ctxBox;
  let useContext = true;           // the chip's × detaches context until it next changes
  let lastAsked = '';
  let ctxChangedAt = 0;
  const memory = { entity: null, at: 0, sim: null, card: null };

  const AGENTS = {
    sensing: 'Network Sensing Agent',
    impact: 'Impact & VAR Agent',
    inventory: 'TTS Watch Agent',
    mitigation: 'Mitigation Strategist Agent',
    workflow: 'Execution & Workflow Agent',
    scenario: 'Scenario Twin Agent',
    copilot: 'Resilience Copilot'
  };

  const DIM_NAMES = { fin: 'Financial', qual: 'Quality', rel: 'Reliability', geo: 'Geopolitical', cyb: 'Cyber', clim: 'Climate' };
  const DIM_W = { fin: 0.24, qual: 0.16, rel: 0.20, geo: 0.16, cyb: 0.12, clim: 0.12 };

  const DEFAULT_SUGGESTS = [
    'What needs my attention today?',
    'Top 5 risk nodes by AVAR',
    'Which products have TTR > TTS?',
    'What if CapForm fails for 30 days?',
    'Mitigation plan for single-source materials',
    'Draft the executive brief'
  ];
  let personaSuggests = DEFAULT_SUGGESTS.slice();

  const PRONOUN = /\b(this|that|it|its|it's|here|them|they|these|those|this one|same)\b/;

  /* ================= Small builders ================= */
  function factsHtml(list) {
    if (!list || !list.length) return '';
    return `<div class="ans-facts">${list.map(f =>
      `<div class="ans-fact"><div class="af-l">${esc(f.l)}</div><div class="af-v ${f.tone || ''}">${f.v}</div></div>`).join('')}</div>`;
  }
  function workingHtml(lines) {
    if (!lines || !lines.length) return '';
    return `<details class="working"><summary>Show working</summary><ol>${lines.map(l => `<li>${l}</li>`).join('')}</ol></details>`;
  }
  const crit = s => `<span style="color:var(--crit-text);font-weight:600">${s}</span>`;
  /** Lower-case a name for use mid-sentence, leaving acronyms (MCU, BOPP, HEPA) alone. */
  const lc = s => String(s).replace(/\b([A-Z])([a-z])/g, (m, a, b) => a.toLowerCase() + b);
  const good = s => `<span style="color:var(--good-text);font-weight:600">${s}</span>`;
  const plural = (n, one, many) => n === 1 ? one : (many || one + 's');

  function bindingMaterial(mats) {
    return mats.slice().sort((a, b) =>
      (b.gap > 0) - (a.gap > 0) || (b.singleSource - a.singleSource) || b.gap - a.gap || b.avar - a.avar)[0];
  }
  function remember(ent) { if (ent) { memory.entity = ent; memory.at = Date.now(); } }
  function markDone(chip, label) {
    if (!chip) return;
    chip.textContent = label;
    chip.classList.remove('primary');
    chip.classList.add('done');
  }
  function copyText(text, chip) {
    const done = () => markDone(chip, '✓ Copied');
    try {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text) && done());
    } catch (_) { if (fallbackCopy(text)) done(); }
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  }

  /* ================= Thread rendering ================= */
  function scrollBottom() { requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; }); }

  function appendUser(text) {
    thread.appendChild(el(`<div class="msg user"><div class="bubble">${esc(text)}</div></div>`));
    scrollBottom();
  }

  /** a: { tag, html, facts, working, actions:[{label, go(chip), primary}], followUps:[text], after } */
  function appendBot(a) {
    const node = el(`<div class="msg bot">
      <span class="agent-tag"><i></i>${esc(a.tag || AGENTS.copilot)}</span>
      <div class="bubble">${a.lead || ''}${a.lead ? factsHtml(a.facts) : ''}${a.html || ''}${a.lead ? '' : factsHtml(a.facts)}${a.tail || ''}${workingHtml(a.working)}</div>
    </div>`);
    if (a.actions && a.actions.length) {
      const row = el('<div class="msg-actions"></div>');
      a.actions.filter(Boolean).forEach(ac => {
        const b = el(`<button class="chip ${ac.primary ? 'primary' : ''}">${esc(ac.label)}</button>`);
        b.addEventListener('click', () => ac.go(b));
        row.appendChild(b);
      });
      node.appendChild(row);
    }
    if (a.followUps && a.followUps.length) {
      const row = el('<div class="dym"></div>');
      a.followUps.filter(Boolean).slice(0, 3).forEach(q => {
        const b = el(`<button class="chip" style="font-size:12.5px;padding:4px 11px;color:var(--ink-2)">${esc(q)}</button>`);
        b.addEventListener('click', () => ask(q));
        row.appendChild(b);
      });
      node.appendChild(row);
    }
    thread.appendChild(node);
    scrollBottom();
    if (a.after) a.after();
  }

  function ask(text, opts) {
    opts = opts || {};
    if (opts.open) open();
    text = String(text || '').trim();
    if (!text || !thread) return;
    lastAsked = text;
    appendUser(text);
    syncFabDot();
    let answer;
    try { answer = route(text); } catch (err) {
      answer = { tag: AGENTS.copilot, html: '<p>Something went wrong computing that answer. Try rephrasing, or name the supplier, material, product or site.</p>' };
    }
    const typing = el(`<div class="msg bot"><div class="bubble typing"><i></i><i></i><i></i></div>
      <span class="typing-label">${esc(answer.thinking || (answer.tag || AGENTS.copilot) + ' is thinking…')}</span></div>`);
    thread.appendChild(typing);
    scrollBottom();
    panel.classList.add('thinking');
    setTimeout(() => {
      typing.remove();
      panel.classList.remove('thinking');
      appendBot(answer);
    }, answer.delay || 620 + Math.random() * 380);
  }

  /* ================= Context ================= */
  function context() {
    const c = SCR.ai.get();
    if (!useContext) { c.focus = null; c.view = {}; c.detached = true; }
    return c;
  }

  const ICON_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg>';
  const ICON_VIEW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M17 7 7 17M7 7l10 10"/></svg>';
  const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>';

  function renderContext() {
    if (!ctxBox) return;
    const c = SCR.ai.get();
    const d = SCR.ai.describe(c);
    const text = d.entity ? `${d.kind} · ${d.text}` : d.text;
    ctxBox.innerHTML = '';
    const chip = el(`<span class="ctx-chip ${useContext ? '' : 'off'}"
      title="${useContext ? 'Questions are about this unless you name something else. Tap × to ask about the whole enterprise.' : 'Context detached — answers cover the whole enterprise.'}">
      ${d.entity ? ICON_PIN : ICON_VIEW}<span>${esc(text)}</span>
      <button class="ctx-x" type="button" aria-label="${useContext ? 'Detach context' : 'Use this context'}">${useContext ? ICON_X : ICON_PLUS}</button>
    </span>`);
    chip.querySelector('.ctx-x').addEventListener('click', () => { useContext = !useContext; renderContext(); renderSuggests(); });
    ctxBox.appendChild(chip);
  }

  function contextSuggests(c) {
    const d = D();
    const s = SCR.ai.subject(c);
    if (s) {
      switch (s.type) {
        case 'supplier': return [`Why is ${s.name} critical?`, `What if ${s.name} fails for 30 days?`, `Draft an email to ${s.name}`, `Create an action for ${s.name}`];
        case 'material': {
          const sup = d.supplierById(s.ref.suppliers[0]);
          return [`Who else can supply ${s.name}?`, `What if ${sup.name} fails for 30 days?`, `Which products use ${s.name}?`, `Create an action for ${s.name}`];
        }
        case 'product': return [`What breaks ${s.name} first?`, `How do I protect ${s.name}?`, `What if its top supplier fails for 45 days?`, `Create an action for ${s.name}`];
        case 'plant': {
          const city = s.name.split(',')[0];
          return [`Status of ${city}`, `What if ${city} plant goes down for 21 days?`, `Create an action for ${city} plant`];
        }
        case 'dc': return [`Status of ${s.name}`, `What if ${s.name} is disrupted for 14 days?`];
        case 'alert': return [`How do I resolve ${s.id}?`, `Create an action for ${s.id}`, 'What needs my attention today?'];
        case 'card': return ['Explain this card simply', 'What should I do about it?'];
        default: break;
      }
    }
    switch (c.pageKey) {
      case 'executive': return ['Summarize this view', 'What should I approve first?', 'Draft the executive brief', 'Top 5 risk nodes by AVAR'];
      case 'valuestream': return ['Summarize this view', 'Most fragile products', 'Which products have TTR > TTS?'];
      case 'category': return ['Summarize this view', 'Mitigation plan for single-source materials', 'Top 5 suppliers by AVAR'];
      case 'site': return ['Summarize this view', 'Which plant has the shortest cover?', 'What if Pune plant goes down for 21 days?'];
      case 'network': return ['Summarize this view', 'Top 5 risk nodes by AVAR'];
      case 'scenario': return ['Explain this scenario', 'What if it runs for 60 days?', 'Create an action from the best plan'];
      case 'actions': return ['What is overdue?', 'What needs my attention today?', 'Summarize this view'];
      case 'agents': return ['What should I approve first?', 'Summarize this view'];
      case 'quality': return ['Where are the data gaps?', 'Summarize this view'];
      default: return [];
    }
  }

  function renderSuggests() {
    const sug = document.getElementById('copilotSuggests');
    if (!sug) return;
    const c = context();
    const list = [];
    contextSuggests(c).concat(personaSuggests).forEach(q => { if (!list.includes(q)) list.push(q); });
    sug.innerHTML = '';
    list.slice(0, 7).forEach(q => {
      const chip = el(`<button class="chip">${esc(q)}</button>`);
      chip.addEventListener('click', () => ask(q));
      sug.appendChild(chip);
    });
  }

  /** Persona lens: swap the suggestion chips (called by the persona switcher). */
  function setSuggests(list) {
    personaSuggests = (list && list.length ? list : DEFAULT_SUGGESTS).slice();
    renderSuggests();
  }

  /* ================= Parsing ================= */
  function parseDays(q) {
    let m;
    const W = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
    if ((m = /(\d+(?:\.\d+)?)\s*-?\s*(days?|d)\b/.exec(q))) return Math.round(+m[1]);
    if ((m = /(\d+(?:\.\d+)?)\s*-?\s*(weeks?|wks?|w)\b/.exec(q))) return Math.round(+m[1] * 7);
    if ((m = /(\d+(?:\.\d+)?)\s*-?\s*(months?|mos?)\b/.exec(q))) return Math.round(+m[1] * 30);
    if ((m = /\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(days?|weeks?|months?)\b/.exec(q)))
      return W[m[1]] * (/week/.test(m[2]) ? 7 : /month/.test(m[2]) ? 30 : 1);
    if (/\b(a|one)\s+week\b/.test(q)) return 7;
    if (/\bfortnight\b/.test(q)) return 14;
    if (/\b(a|one)\s+month\b/.test(q)) return 30;
    if (/\b(a|one)\s+quarter\b/.test(q)) return 90;
    return null;
  }
  function parseSev(q) {
    let m;
    if ((m = /(\d{1,3})\s*%\s*severity/.exec(q)) || (m = /severity\s*(?:of\s*)?(\d{1,3})\s*%?/.exec(q))) return clampSev(+m[1]);
    if ((m = /(?:runs?|running|operat\w*)\s+at\s+(\d{1,3})\s*%/.exec(q))) return clampSev(100 - +m[1]);
    if ((m = /(?:loses?|losing|lose|cut|drop|down)\s+(?:by\s+)?(\d{1,3})\s*%/.exec(q))) return clampSev(+m[1]);
    if ((m = /\bat\s+(\d{1,3})\s*%/.exec(q))) return clampSev(+m[1]);
    if (/\b(partial|partly|half)\b/.test(q)) return 50;
    if (/\b(full|total|complete)\b/.test(q)) return 100;
    return null;
  }
  const clampSev = v => Math.max(10, Math.min(100, Math.round(v / 5) * 5));
  const TYPE_PHRASE = {
    'Supplier failure': 'supplier failure', 'Plant outage': 'plant outage', 'Port / lane disruption': 'port or lane disruption',
    'Material shortage': 'material shortage', 'Quality recall': 'quality recall', 'Cyber incident': 'cyber incident',
    'Extreme weather': 'extreme-weather event', 'Demand spike': 'demand spike'
  };
  function parseType(q, nodeType) {
    if (/\b(port|lane|shipping|customs|export|canal|border)s?\b/.test(q)) return 'Port / lane disruption';
    if (/\b(flood|storm|typhoon|monsoon|frost|weather|hurricane|cyclone|earthquake|heat ?wave|drought)(s|ing|ed)?\b/.test(q)) return 'Extreme weather';
    if (/\b(cyber|ransomware|hack|outage of systems|it outage)\b/.test(q)) return 'Cyber incident';
    if (/\b(recall|quality|contaminat)\w*/.test(q)) return 'Quality recall';
    if (/\bshortage\b/.test(q)) return 'Material shortage';
    if (/\b(strike|fire|bankrupt|insolven)\w*/.test(q)) return nodeType === 'plant' ? 'Plant outage' : 'Supplier failure';
    return nodeType === 'plant' ? 'Plant outage' : nodeType === 'dc' ? 'Port / lane disruption' : 'Supplier failure';
  }
  function parseN(q, def) {
    const m = /\b(?:top|best|worst|biggest|largest)\s+(\d{1,2})\b/.exec(q) || /\b(\d{1,2})\s+(?:riskiest|worst|most|biggest|largest|top)\b/.exec(q);
    return m ? Math.max(1, Math.min(12, +m[1])) : def;
  }

  /** The entity a question is about: a named one, else "this"/"it", else the context subject. */
  function pickEntity(text, c, types, need) {
    const named = SCR.ai.scan(text, types ? { types } : undefined)
      .filter(e => !['sector', 'category', 'stream', 'market'].includes(e.type) || (types && types.includes(e.type)));
    if (named.length) return named[0];
    const q = text.toLowerCase();
    const okType = e => e && (!types || types.includes(e.type));
    const subj = SCR.ai.subject(c);
    const mem = memory.entity;
    const memFresh = mem && memory.at > ctxChangedAt;
    if (PRONOUN.test(q)) {
      if (memFresh && okType(mem)) return mem;
      if (okType(subj) && subj.type !== 'card') return subj;
      if (okType(mem)) return mem;
    }
    if (need) {
      if (okType(subj) && subj.type !== 'card') return subj;
      if (okType(mem)) return mem;
    }
    return null;
  }

  function scopeFrom(text) {
    const found = SCR.ai.scan(text, { types: ['sector', 'stream', 'market', 'category'] });
    return found[0] || null;
  }
  function productsInScope(scope) {
    const d = D();
    if (!scope) return d.products.slice();
    switch (scope.type) {
      case 'sector': return d.products.filter(p => p.sector === scope.id);
      case 'stream': return d.products.filter(p => p.stream === scope.id);
      case 'market': return d.products.filter(p => p.markets.includes(scope.id));
      case 'category': {
        const mats = new Set(d.materials.filter(m => m.cat === scope.id).map(m => m.id));
        return d.products.filter(p => p.materials.some(m => mats.has(m)));
      }
      default: return d.products.slice();
    }
  }
  function marketShare(p, mkId) {
    const d = D();
    const tot = p.markets.reduce((a, id) => a + d.marketById(id).nts, 0);
    return p.markets.includes(mkId) ? d.marketById(mkId).nts / tot : 0;
  }

  /* ================= Business KPI registry =================
     Every headline number the product displays is answerable here, both as a
     value ("what is NTS in scope") and as a definition ("how is AVAR
     calculated"). `aliases` are matched longest-first so "value at risk" wins
     over the bare "var" inside it. */
  function KPIS() {
    const d = D(), k = d.kpis, f = F();
    return [
      {
        key: 'nts', label: 'NTS in scope', value: () => usd(k.totalNTS),
        aliases: ['nts in scope', 'net trade sales', 'net sales', 'nts', 'turnover', 'top line', 'revenue in scope'],
        what: 'Net trade sales — the revenue carried by every product currently inside your filter scope. It is the denominator for everything else: exposure only means something relative to the sales it threatens.',
        how: 'Summed product NTS across the products in scope.',
        go: { label: 'Open Value Streams', run: () => SCR.navigate('valuestream') }
      },
      {
        key: 'var', label: 'Value at risk (VAR)', value: () => usd(k.totalVAR),
        aliases: ['value at risk', 'gross exposure', 'var'],
        what: 'The sales that would be lost if a dependency failed and could not be recovered before cover ran out. It is the gross, worst-case number — before any judgement about how likely the event is.',
        how: 'For each material: dependent NTS × uncovered days ÷ 365 (uncovered days = TTR − TTS, floored at zero), plus a small allocation-risk term that rises with the risk score.',
        go: { label: 'Open Executive Summary', run: () => SCR.navigate('executive') }
      },
      {
        key: 'avar', label: 'Weighted AVAR', value: () => usd(k.totalAVAR),
        aliases: ['weighted avar', 'wtd avar', 'wtd. avar', 'wavar', 'adjusted value at risk', 'probability adjusted', 'avar'],
        what: 'Value at risk after weighting for how likely the disruption actually is. This is the number to prioritise and fund against, because it reflects expected loss rather than worst case.',
        how: 'VAR × disruption probability, where P = min(55%, 10% + 9% × risk score). It is always lower than VAR — the gap is the part of the risk that is improbable rather than absent.',
        go: { label: 'Open Executive Summary', run: () => SCR.navigate('executive') }
      },
      {
        key: 'ri', label: 'Enterprise resilience index', value: () => k.enterpriseRI + '%',
        aliases: ['enterprise resilience index', 'resilience index', 'enterprise ri', 'resilience score', 'ri'],
        what: 'A composite 0–100 score where higher is stronger. It blends how much exposure is covered, how fast the network recovers, and how concentrated the dependencies are.',
        how: 'NTS-weighted mean of product RIs. Each product starts at 97 and loses points for its largest recovery gap, gapped components, risky sole-sourcing, residual risk and worst supplier severity.',
        go: { label: 'RI matrix guide', run: () => SCR.ui.riMatrixGuide() }
      },
      {
        key: 'gap', label: 'TTR > TTS components', value: () => String(k.gapMaterials),
        aliases: ['ttr > tts', 'ttr>tts', 'uncovered components', 'recovery gap', 'gap components', 'uncovered days'],
        what: 'Components that take longer to recover than they can survive on hand. These are the only components that can actually convert a disruption into lost sales — everything else is absorbed by cover.',
        how: 'Count of components where TTR exceeds TTS. ' + k.gapProducts + ' products are exposed through them.',
        go: { label: 'Open Value Streams', run: () => SCR.navigate('valuestream') }
      },
      {
        key: 'mitigated', label: 'AVAR mitigated YTD', value: () => usd(k.mitigatedYtd),
        aliases: ['avar mitigated', 'mitigated ytd', 'risk removed', 'risk retired', 'mitigated'],
        what: 'Adjusted value at risk removed by mitigations that have actually landed this year — not planned, delivered.',
        how: 'Sum of realised AVAR reduction across executed actions. It is the same figure as the "Mitigated" step in the AVAR bridge.',
        go: { label: 'Open Alerts & Actions', run: () => SCR.navigate('actions') }
      },
      {
        key: 'detection', label: 'Mean detection lead', value: () => k.detectionLeadDays + ' days',
        aliases: ['mean detection lead', 'detection lead', 'detection time', 'signal to alert', 'lead time'],
        what: 'Average time between a signal arriving and an alert being raised. Detection lead is time you get to spend on mitigation instead of firefighting.',
        how: 'Mean elapsed time from sensed signal to raised alert across the funnel.',
        go: { label: 'Open Alerts & Actions', run: () => SCR.navigate('actions') }
      },
      {
        key: 'single', label: 'Single-source materials', value: () => k.singleSourceCount + ' (' + k.singleSourceRisky + ' risky)',
        aliases: ['single source materials', 'single-source', 'sole source', 'sole sourced'],
        what: 'Materials with exactly one qualified supplier. If that supplier stops, the material stops — there is no second source to switch to.',
        how: 'Count of materials with one qualified supplier; "risky" additionally score 2.8 or above.',
        go: { label: 'Open Category & Suppliers', run: () => SCR.navigate('category') }
      },
      {
        key: 'alerts', label: 'Open alerts', value: () => k.openAlerts + ' (' + k.criticalAlerts + ' critical)',
        aliases: ['open alerts', 'critical alerts', 'alerts'],
        what: 'Unresolved exceptions raised by the sensing layer, each routed to a named owner.',
        how: 'Alerts not yet closed; critical means a node is already failing or will inside its TTS.',
        go: { label: 'Open Alerts & Actions', run: () => SCR.navigate('actions') }
      },
      {
        key: 'actions', label: 'Actions in flight', value: () => k.openActions + ' (' + k.overdueActions + ' overdue)',
        aliases: ['actions in flight', 'open actions', 'overdue actions', 'actions'],
        what: 'Mitigations currently being executed, each tracked with residual risk before and after.',
        how: 'Actions not yet completed; overdue means past their due date.',
        go: { label: 'Open Alerts & Actions', run: () => SCR.navigate('actions') }
      },
      {
        key: 'nodes', label: 'Nodes monitored', value: () => k.nodes + ' (' + k.supplierNodes + ' suppliers, ' + k.siteNodes + ' plants & DCs)',
        aliases: ['nodes monitored', 'how many nodes', 'nodes', 'high risk nodes'],
        what: 'Every supplier, plant and distribution centre in the digital twin. ' + k.highRiskNodes + ' currently sit below an RI of 60.',
        how: 'Suppliers + plants + DCs across the modelled network.',
        go: { label: 'Open Network Explorer', run: () => SCR.navigate('network') }
      },
      {
        key: 'scope', label: 'Scope', value: () => k.products + ' products across ' + k.countries + ' markets',
        aliases: ['how many products', 'products in scope', 'how many markets', 'how many countries'],
        what: 'The products and markets currently modelled.',
        how: 'Counted from the product and market master.',
        go: { label: 'Open Value Streams', run: () => SCR.navigate('valuestream') }
      },
      {
        key: 'tts', label: 'TTS — time to survive', concept: true, value: () => 'measured per component',
        aliases: ['time to survive', 'tts'],
        what: 'How long production can keep running on the inventory and cover already in hand, with no resupply.',
        how: 'Days of cover from on-hand and in-transit stock at planned consumption.',
        go: { label: 'Open Site Resilience', run: () => SCR.navigate('site') }
      },
      {
        key: 'ttr', label: 'TTR — time to recover', concept: true, value: () => 'measured per node',
        aliases: ['time to recover', 'ttr'],
        what: 'How long it takes to restore supply after a node fails — including qualifying or switching to an alternate.',
        how: 'Assessed recovery time per node, from the supplier and site master.',
        go: { label: 'Open Network Explorer', run: () => SCR.navigate('network') }
      },
      {
        key: 'rre', label: 'RRE — residual risk exposure', concept: true, value: () => 'scored 0–1 per node',
        aliases: ['residual risk exposure', 'residual risk', 'rre'],
        what: 'How much risk remains after the mitigations already in place. A high RRE beside a high VAR is the combination that matters: real money exposed, and the current plan is not holding it.',
        how: 'Normalised 0–1 from the driver scores, net of mitigations in place.',
        go: { label: 'Open Category & Suppliers', run: () => SCR.navigate('category') }
      }
    ].map(x => Object.assign(x, { _f: f }));
  }

  function matchKpi(q) {
    let best = null, bestLen = 0;
    KPIS().forEach(def => def.aliases.forEach(a => {
      // whole-token match so "var" doesn't fire inside "variance"
      const re = new RegExp('(^|[^a-z0-9])' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)');
      if (re.test(q) && a.length > bestLen) { best = def; bestLen = a.length; }
    }));
    return best;
  }

  const isDefinitional = q =>
    /(what|whats|what's|which)\s+(is|are|does|do)\b|^what'?s\b|\bdefine\b|\bdefinition\b|\bmeaning\b|\bmeans?\b|\bexplain\b|how (is|are|do you|does).*(calculat|comput|derive|work|measur)|\bhow do you get\b/.test(q);

  function kpiAnswer(def) {
    return {
      tag: AGENTS.impact,
      html: `<p><strong>${esc(def.label)}</strong> — ${def.concept ? esc(def.value()) : `currently <strong>${def.value()}</strong>`}.</p>
        <p>${def.what}</p>`,
      working: [esc(def.how)],
      actions: [{ label: def.go.label, go: def.go.run }]
    };
  }

  function kpiBoard() {
    const rows = KPIS().filter(d => !d.concept)
      .map(d => `<tr><td>${esc(d.label)}</td><td style="text-align:right"><strong>${d.value()}</strong></td></tr>`).join('');
    return {
      tag: AGENTS.impact,
      html: `<p>Every headline number I track, on the current data:</p>
        <table><thead><tr><th>KPI</th><th style="text-align:right">Now</th></tr></thead><tbody>${rows}</tbody></table>
        <p>Ask about any one by name for what it means and how it is derived.</p>`,
      actions: [{ label: 'Executive Summary', go: () => SCR.navigate('executive') }]
    };
  }

  /* ================= Intent router ================= */
  function route(text) {
    const q = text.toLowerCase().trim();
    const c = context();

    // small talk & capabilities
    if (/^(hi|hello|hey|good (morning|afternoon|evening)|yo)\b/.test(q) && q.length < 40) return greetingAnswer(c);
    if (/^(thanks|thank you|cheers|great|perfect|ok|okay)\b/.test(q) && q.length < 30)
      return { tag: AGENTS.copilot, html: '<p>Anytime. Ask a follow-up, or tap a suggestion below.</p>', delay: 300 };
    if (/\b(what can you do|help me|how do i use|capabilit|what do you know)\b|^help$/.test(q)) return capabilities(c);

    // persona lens
    const lens = /\b(view|switch|look|see)\s+(?:this\s+)?(?:as|to)\s+(?:an?\s+|the\s+)?(risk|resilience|value (?:chain|stream)|vsl|category|site)/.exec(q);
    if (lens) return switchPersona(lens[2]);

    const kpi = matchKpi(q);
    const named = SCR.ai.scan(text);
    const nodeNamed = named.find(e => ['supplier', 'material', 'product', 'plant', 'dc', 'alert'].includes(e.type));

    // writing: the brief, then supplier emails
    if (/\b(draft|write|prepare|compose|generate)\b.*\b(brief|update|summary|memo|report)\b|\b(executive|exec|daily|morning|resilience)\s+(brief|digest)\b|\bdigest\b/.test(q)) return execBrief();
    if (/\b(draft|write|compose|prepare)\b.*\b(e-?mail|mail|message|note|letter)\b|\b(e-?mail|write to|reach out to)\b/.test(q)) {
      const s = pickEntity(text, c, ['supplier', 'material', 'alert'], true);
      const sup = s && (s.type === 'supplier' ? s : s.type === 'material' ? SCR.ai.entity('supplier', s.ref.suppliers[0]) : s.type === 'alert' && s.ref.nodes[0] ? SCR.ai.entity('supplier', s.ref.nodes[0]) : null);
      if (sup) return emailAnswer(sup.ref);
      return { tag: AGENTS.copilot, html: '<p>Which supplier should I write to? Name one — for example “Draft an email to CapForm” — or open a supplier and ask again.</p>', followUps: ['Draft an email to CapForm Industries', 'Draft an email to Taicang MicroControls'] };
    }

    // create an action
    if (/\b(create|raise|open|log|add|make|start|draft)\b.*\b(action|ticket|task)\b/.test(q)) {
      if (/best plan|this scenario|from the scenario/.test(q) || (c.pageKey === 'scenario' && !nodeNamed)) {
        const sim = scenarioFromContext(c);
        if (sim) return createActionAnswer({ type: 'scenario', result: sim.r, option: sim.r.opts[0] }, sim.r.node.name);
      }
      const e = pickEntity(text, c, ['supplier', 'material', 'product', 'plant', 'dc', 'alert'], true);
      if (e) return createActionAnswer(e, e.name);
      return { tag: AGENTS.workflow, html: '<p>What should the action protect? Name a supplier, material, product or site, or open one and ask again.</p>' };
    }

    // navigation ("open CapForm" opens its 360; "go to scenario studio" navigates)
    if (/^(open|go to|goto|take me to|navigate to|jump to|show me the)\b/.test(q)) {
      const nav = navigateAnswer(text, q);
      if (nav) return nav;
    }

    // "what is NTS" / "how is AVAR calculated" — definition beats value, unless an entity is named
    if (kpi && isDefinitional(q) && !nodeNamed) return kpiAnswer(kpi);
    if (/\b(kpis?|metrics?|scorecard|all the numbers|headline numbers)\b/.test(q) && !nodeNamed) return kpiBoard();

    // card follow-ups (from an AI-insights drawer)
    const subj = SCR.ai.subject(c);
    if (/\b(this|the) card\b|explain (it|this) simply|what should i do about (it|this)/.test(q) && (memory.card || (subj && subj.type === 'card')))
      return cardAnswer(memory.card || { title: subj.name, spec: subj.spec }, /should i do/.test(q) ? 'act' : 'explain');

    // summarise the view
    if (/\b(summari[sz]e|summary|tl;?dr|what am i looking at|explain (this|the) (view|page|screen|scenario)|overview of (this|the) (view|page))\b/.test(q))
      return summarizeView(c);

    // refine the last simulation: "and at 50%?", "what about 8 weeks?"
    if (memory.sim && !nodeNamed && q.length < 70 &&
        /(severity|\d+\s*%|\bdays?\b|\bweeks?\b|\bmonths?\b|\blonger\b|\bshorter\b|\bfull\b|\bhalf\b)/.test(q) &&
        /^(and|what about|how about|at|for|with|try|make it|if it|it|same)\b|\bruns? for\b/.test(q))
      return simulateAnswer(memory.sim.node, q);

    // what-if on the twin, answered in place
    if (/\b(what if|what happens if|simulate|simulation|scenario|stress[- ]test)\b|\b(fails?|failure|goes down|go down|outage|shut ?down|offline|disrupted|disruption|stops?|strikes?|floods?|flooding|closes?)\b/.test(q) &&
        !/\b(which|list)\b.*\b(fail)/.test(q)) {
      const e = pickEntity(text, c, ['supplier', 'plant', 'dc', 'material', 'product', 'alert'], true);
      if (e) return simulateAnswer(e, q);
      if (/\b(what if|simulate)\b/.test(q)) return scenarioPresets();
    }

    // compare two things
    if (/\b(compare|versus|vs\.?|difference between)\b/.test(q)) {
      const ents = named.filter(e => ['supplier', 'material', 'product', 'plant', 'dc'].includes(e.type));
      if (ents.length >= 2) return compareAnswer(ents[0], ents[1]);
      if (ents.length === 1) {
        const other = SCR.ai.subject(c) || memory.entity;
        if (other && other.id !== ents[0].id) return compareAnswer(other, ents[0]);
      }
    }

    // sourcing & dependency questions
    if (/\b(who else|alternates?|alternatives?|second source|other suppliers?|substitut\w*|who supplies|who makes|dual[- ]source)\b/.test(q)) {
      const e = pickEntity(text, c, ['material', 'supplier', 'product'], true);
      if (e && e.type === 'material') return materialAnswer(e.ref, 'sourcing');
      if (e && e.type === 'supplier') return supplierAnswer(e.ref, 'sourcing');
      if (e && e.type === 'product') return productAnswer(e.ref, 'breaks');
    }
    if (/\b(which|what) (products?|skus?) (use|uses|need|depend)|\bwhat depends on\b|\bwho depends on\b|\bdependen/.test(q)) {
      const e = pickEntity(text, c, ['material', 'supplier', 'plant'], true);
      if (e) return dependencyAnswer(e);
    }
    if (/\b(what|which component) (breaks|stops|kills|hurts)\b|\bweakest link\b|\bbreaks .* first\b|\bprotect\b|\bmake .* (more )?resilient\b/.test(q)) {
      const e = pickEntity(text, c, ['product'], true);
      if (e) return productAnswer(e.ref, /protect|resilient/.test(q) ? 'protect' : 'breaks');
    }
    if (/\bhow (do i|can i|to|should i|should we) (resolve|fix|close|handle)\b/.test(q)) {
      const e = pickEntity(text, c, ['alert', 'supplier', 'material', 'product', 'plant'], true);
      if (e && e.type === 'alert') return alertAnswer(e.ref);
      if (e) return createActionAnswer(e, e.name);
    }

    // queues and work
    if (/\b(approve|approval|recommendations?|proposals?|decisions?)\b/.test(q) && !nodeNamed) return approvalsAnswer();
    if (/\b(overdue|late|behind|due soon|slipping|my actions|open actions|action tracker)\b/.test(q) && !nodeNamed) return workAnswer();
    if (/\b(attention|urgent|priorit\w*|focus on|worry about|on fire|today)\b/.test(q) && !nodeNamed) return urgentAnswer();
    if (/\b(data gaps?|data quality|missing data|coverage)\b/.test(q)) return dataQualityAnswer();

    // rankings
    if (/\b(top|rank|ranking|riskiest|most fragile|weakest|worst|largest|biggest|highest|lowest)\b/.test(q) &&
        /\b(nodes?|suppliers?|vendors?|products?|skus?|materials?|components?|plants?|sites?|dcs?|markets?|countries)\b/.test(q))
      return rankingAnswer(q, text);
    if (/\bshortest (cover|tts)\b|\bleast cover\b|\bruns out first\b/.test(q)) return coverAnswer(q, text);

    // the classics, now scope-aware
    if (/ttr\s*>\s*tts|recover(s|y)? slower|\bgaps?\b|short of cover/.test(q) && (!kpi || /\b(which|list|show|name)\b/.test(q))) return gapAnswer(scopeFrom(text));
    if (/single[- ]source|sole[- ]source/.test(q) && /\b(plan|mitigat|fix|address|reduce)\b/.test(q)) return mitigationPlan();
    if (/single[- ]source|sole[- ]source/.test(q)) return singleSource(scopeFrom(text));
    if (/(biggest|largest|highest|worst|most|right now|where)/.test(q) && /(risk|exposure|var|avar)/.test(q) && !nodeNamed) return biggestVar(scopeFrom(text));

    // a bare metric question ("NTS in scope", "wtd avar", "enterprise RI")
    if (kpi && !nodeNamed) return kpiAnswer(kpi);

    // an entity on its own → its profile
    const e = named[0] || pickEntity(text, c, null, PRONOUN.test(q) || /\b(status|how is|how's|tell me|about|why)\b/.test(q));
    if (e) return profile(e, q);

    if (/value at risk|avar|\bvar\b|exposure/.test(q)) return biggestVar(null);
    return fallback(text, c);
  }

  function profile(e, q) {
    switch (e.type) {
      case 'supplier': return supplierAnswer(e.ref);
      case 'material': return materialAnswer(e.ref, /\b(who|alternat|source)/.test(q || '') ? 'sourcing' : 'profile');
      case 'product': return productAnswer(e.ref, /protect|resilient/.test(q || '') ? 'protect' : 'breaks');
      case 'plant': case 'dc': return siteAnswer(e);
      case 'alert': return alertAnswer(e.ref);
      case 'market': case 'sector': case 'stream': case 'category': return scopeAnswer(e);
      case 'card': return cardAnswer({ title: e.name, spec: e.spec }, 'explain');
      default: return fallback(e.name, context());
    }
  }

  /* ================= Answers ================= */
  function greetingAnswer(c) {
    const p = c.persona;
    const items = SCR.brief.itemsFor(p ? p.id : 'rrl');
    return {
      tag: AGENTS.copilot,
      html: `<p>${SCR.brief.greeting()}. The first thing on your list today:</p>
        <p>${items[0] ? items[0].html : 'Nothing urgent — exposure is stable.'}</p>`,
      actions: items[0] ? [{ label: items[0].act.label, primary: true, go: items[0].act.run }] : [],
      followUps: ['What needs my attention today?', 'Summarize this view']
    };
  }

  function capabilities(c) {
    const s = SCR.ai.subject(c);
    return {
      tag: AGENTS.copilot,
      html: `<p>I work on the live model and I know what you are looking at${s ? ` — right now that is <strong>${esc(s.name)}</strong>` : ''}. I can:</p>
        <ul>
          <li><strong>Explain</strong> any supplier, material, product, plant, DC, market or KPI — with the working behind the numbers.</li>
          <li><strong>Run what-ifs</strong> on the digital twin here in the chat: “what if Taicang fails for 6 weeks at 50%?”</li>
          <li><strong>Rank and compare</strong>: “top 5 suppliers by AVAR in packaging”, “compare Pune and Atlanta”.</li>
          <li><strong>Act</strong>: draft a mitigation action onto the tracker, queue alternate-sourcing proposals, tell you what to approve first.</li>
          <li><strong>Write</strong>: supplier outreach emails and the executive brief, ready to copy.</li>
        </ul>`,
      followUps: contextSuggests(c).slice(0, 3)
    };
  }

  function switchPersona(word) {
    const map = { risk: 'rrl', resilience: 'rrl', 'value chain': 'vsl', 'value stream': 'vsl', vsl: 'vsl', category: 'cat', site: 'site' };
    const id = map[word] || 'rrl';
    const p = SCR.persona.list().find(x => x.id === id);
    return {
      tag: AGENTS.copilot,
      html: `<p>Switching the lens to <strong>${esc(p.name)}</strong> — ${esc(p.lens)}</p>`,
      after: () => setTimeout(() => SCR.persona.set(id, { toast: true }), 400)
    };
  }

  const PAGES = [
    [/executive|summary|cockpit/, 'executive'], [/value ?streams?|vsl/, 'valuestream'], [/category|suppliers? page|sourcing/, 'category'],
    [/site resilience|sites?|plants? page/, 'site'], [/network|explorer|twin|sankey/, 'network'], [/scenario|studio|simulat/, 'scenario'],
    [/alerts?|actions?|tracker|inbox/, 'actions'], [/recommendations?|approvals?|queue|agents?/, 'agents'], [/data quality|quality|governance/, 'quality']
  ];
  function navigateAnswer(text, q) {
    const e = SCR.ai.resolve(text, { types: ['supplier', 'material', 'product', 'plant', 'dc', 'alert'] });
    if (e) {
      const opener = { supplier: SCR.ui.openSupplier, material: SCR.ui.openMaterial, product: SCR.ui.openProduct, plant: SCR.ui.openSite, dc: SCR.ui.openSite, alert: SCR.ui.openAlert }[e.type];
      return { tag: AGENTS.copilot, html: `<p>Opening the 360° view of <strong>${esc(e.name)}</strong>.</p>`, delay: 300, after: () => opener(e.id) };
    }
    const hit = PAGES.find(([re]) => re.test(q));
    if (!hit) return null;
    const page = SCR.pages[hit[1]];
    return { tag: AGENTS.copilot, html: `<p>Taking you to <strong>${esc(page.title)}</strong>.</p>`, delay: 300, after: () => SCR.navigate(hit[1]) };
  }

  /* ---------- supplier ---------- */
  function peerSupplier(s) {
    return D().suppliers.filter(x => x.cat === s.cat && x.id !== s.id).sort((a, b) => b.avar - a.avar)[0];
  }
  function supplierAnswer(s, mode) {
    const d = D(), f = F();
    const ent = SCR.ai.entity('supplier', s.id);
    remember(ent);
    const dims = Object.keys(s.dims).map(k => ({ k, name: DIM_NAMES[k], v: s.dims[k] })).sort((a, b) => b.v - a.v);
    const mats = d.materialsOf(s.id);
    const singles = mats.filter(m => m.singleSource);
    const gapped = mats.filter(m => m.gap > 0).sort((a, b) => b.gap - a.gap);
    const al = d.alerts.filter(a => a.nodes.includes(s.id) && a.status !== 'closed');
    const peer = peerSupplier(s);
    if (mode === 'sourcing') {
      const m = bindingMaterial(mats);
      return materialAnswer(m, 'sourcing');
    }
    const html = `<p><strong>${esc(s.name)}</strong> (${esc(s.city)}, ${esc(s.country)} · tier ${s.tier} ${esc(lc(s.catName))}) is rated
        ${SCR.ui.badge(s.rating)} at ${SCR.ui.scoreSpan(s.score)}.</p>
      <p>It is driven by <strong>${dims[0].name.toLowerCase()}</strong> (${dims[0].v.toFixed(1)}) and <strong>${dims[1].name.toLowerCase()}</strong> (${dims[1].v.toFixed(1)}) risk.
        ${gapped.length
          ? `The exposure is real because ${gapped.length === 1 ? `${esc(gapped[0].name)} recovers` : `${gapped.length} of its materials recover`} slower than cover lasts: ${gapped.map(m => `${esc(m.name)} — ${m.tts}d cover vs ${m.ttr}d recovery`).join('; ')}.`
          : 'Cover outlasts recovery on everything it supplies, so today this is risk on paper rather than lost sales.'}</p>
      ${singles.length ? `<p>${singles.length} of ${mats.length} ${plural(mats.length, 'material')} ${singles.length === 1 ? 'is' : 'are'} single-sourced here — there is no second supplier to switch to.</p>` : ''}
      ${al.length ? `<p><strong>Open alert ${esc(al[0].id)}:</strong> ${esc(al[0].title)}</p>` : ''}`;
    return {
      tag: AGENTS.sensing,
      html,
      facts: [
        { l: 'AVAR', v: usd(s.avar), tone: 'bad' },
        { l: 'Value at risk', v: usd(s.var) },
        { l: 'Sales linked', v: usd(s.depNTS) },
        { l: 'Recovery (TTR)', v: s.ttr + 'd' }
      ],
      working: [
        `Risk score = Σ weight × driver = ${Object.keys(DIM_W).map(k => `${DIM_W[k]}×${s.dims[k]}`).join(' + ')} = <strong>${s.score.toFixed(2)}</strong> → ${s.rating}.`,
        `VAR attributed = Σ material VAR ÷ its supplier count: ${mats.map(m => `${esc(m.name)} ${usd(m.var)}${m.suppliers.length > 1 ? ' ÷ ' + m.suppliers.length : ''}`).join(' + ')} = <strong>${usd(s.var)}</strong>.`,
        `AVAR = VAR × disruption probability per material (${mats.map(m => Math.round(m.prob * 100) + '%').join(', ')}), attributed the same way = <strong>${usd(s.avar)}</strong>.`
      ],
      actions: [
        { label: 'Create action', primary: true, go: chip => SCR.work.openSheet({ type: 'supplier', id: s.id }, { onCreated: a => markDone(chip, '✓ ' + a.id + ' created') }) },
        { label: 'Simulate 30 days', go: () => ask(`What if ${s.name} fails for 30 days?`) },
        { label: 'Draft an email', go: () => ask(`Draft an email to ${s.name}`) },
        { label: 'Supplier 360', go: () => SCR.ui.openSupplier(s.id) }
      ],
      followUps: [
        gapped[0] ? `Who else can supply ${lc(gapped[0].name)}?` : null,
        peer ? `Compare ${s.name} and ${peer.name}` : null
      ]
    };
  }

  /* ---------- material ---------- */
  function materialAnswer(m, mode) {
    const d = D(), f = F();
    remember(SCR.ai.entity('material', m.id));
    const sups = m.suppliers.map(d.supplierById);
    const gapTxt = m.gap > 0 ? crit(m.gap + ' days uncovered') : good(-m.gap + ' days of slack');
    let body = `<p><strong>${esc(m.name)}</strong> (${esc(lc(m.catName))} · ${esc(lc(m.sub))}) has <strong>${m.tts} days of cover</strong>
      and takes <strong>${m.ttr} days to recover</strong> — ${gapTxt}.</p>
      <p>Sourced from ${sups.map(s => `<strong>${esc(s.name)}</strong> (${esc(s.country)}, risk ${s.score.toFixed(2)})`).join(' and ')}${m.singleSource ? ' — a <strong>single source</strong>' : ''}.
      ${m.depProducts.length} SKUs depend on it (${usd(m.depNTS)} NTS).</p>`;
    if (mode === 'sourcing') {
      const peers = d.suppliers.filter(x => x.cat === m.cat && !m.suppliers.includes(x.id)).sort((a, b) => a.score - b.score).slice(0, 3);
      body += m.singleSource
        ? `<p>There is <strong>no qualified alternate</strong> today. Substitution: ${esc(m.substitution)}.
            Lower-risk ${esc(lc(m.catName))} suppliers the agents would screen first: ${peers.map(x => `${esc(x.name)} (${esc(x.country)}, ${x.score.toFixed(2)})`).join(', ')} — candidates, not yet qualified.</p>`
        : `<p>A second source is already qualified, so the lever is <strong>volume allocation and cover</strong>, not qualification. Substitution: ${esc(m.substitution)}.</p>`;
    } else {
      body += `<p>Substitution: ${esc(m.substitution)}.</p>`;
    }
    const gapDays = Math.max(0, m.gap);
    return {
      tag: mode === 'sourcing' ? AGENTS.mitigation : AGENTS.inventory,
      html: body,
      facts: [
        { l: 'Value at risk', v: usd(m.var), tone: m.gap > 0 ? 'bad' : '' },
        { l: 'AVAR', v: usd(m.avar) },
        { l: 'P(disruption)', v: Math.round(m.prob * 100) + '%' },
        { l: 'Residual (RRE)', v: f.rre(m.rre) }
      ],
      working: [
        `Uncovered days = TTR ${m.ttr} − TTS ${m.tts} = ${gapDays}${m.gap <= 0 ? ' (floored at zero)' : ''}.`,
        `VAR = dependent NTS ${usd(m.depNTS)} × ${gapDays} ÷ 365 + allocation risk ${usd(m.depNTS)} × 0.8% × ${m.score}/5 = <strong>${usd(m.var)}</strong>.`,
        `P(disruption) = min(55%, 10% + 9% × risk ${m.score}) = ${Math.round(m.prob * 100)}% → AVAR = <strong>${usd(m.avar)}</strong>.`
      ],
      actions: [
        { label: m.singleSource ? 'Queue alternate qualification' : 'Create action', primary: true,
          go: chip => SCR.work.openSheet({ type: 'material', id: m.id }, { onCreated: a => markDone(chip, '✓ ' + a.id + ' created') }) },
        { label: `Simulate ${sups[0].name.split(' ')[0]} failing`, go: () => ask(`What if ${sups[0].name} fails for 30 days?`) },
        { label: 'Material 360', go: () => SCR.ui.openMaterial(m.id) }
      ],
      followUps: [`Which products use ${lc(m.name)}?`, mode === 'sourcing' ? null : `Who else can supply ${lc(m.name)}?`]
    };
  }

  /* ---------- product ---------- */
  function productRiTerms(p) {
    return 97 - Math.max(0, p.gapMax) * 0.48 - p.gapCount * 1.4 - p.singleRisky * 2.8 - p.avgRre * 10 - Math.max(0, p.maxScore - 2) * 3.2;
  }
  function productAnswer(p, mode) {
    const d = D(), f = F();
    remember(SCR.ai.entity('product', p.id));
    const mats = p.materials.map(d.materialById);
    const b = bindingMaterial(mats);
    const sup = d.supplierById(b.suppliers[0]);
    const gapped = mats.filter(m => m.gap > 0).sort((x, y) => y.gap - x.gap);
    let html = `<p>The first thing to break <strong>${esc(p.name)}</strong> is <strong>${esc(b.name)}</strong> from ${esc(sup.name)}:
      ${b.tts} days of cover against ${b.ttr} days to recover${b.singleSource ? ', single-sourced' : ''}.</p>
      <p>${gapped.length ? `${gapped.length} of ${mats.length} components are short of cover: ${gapped.map(m => `${esc(m.name)} (${crit('−' + m.gap + 'd')})`).join(', ')}.` : 'Every component has cover beyond its recovery time — this SKU absorbs a single failure.'}
      RI ${f.ri(p.ri)} (${p.riBand.toLowerCase()}) on ${usd(p.nts)} NTS, growing ${f.signed(p.growth, '%')}.</p>`;
    if (mode === 'protect') {
      const steps = (gapped.length ? gapped : [b]).slice(0, 3).map(m => SCR.work.draftAction({ type: 'material', id: m.id }));
      html += `<p><strong>Plan to protect it</strong>, cheapest risk removed first:</p><ol>${
        steps.sort((x, y) => (y.riskCut / Math.max(0.1, y.cost)) - (x.riskCut / Math.max(0.1, x.cost)))
          .map(st => `<li>${esc(st.title)} — cuts ~${usd(st.riskCut)} AVAR for ~${usd(st.cost)}.</li>`).join('')}</ol>`;
    }
    const raw = productRiTerms(p);
    return {
      tag: mode === 'protect' ? AGENTS.mitigation : AGENTS.impact,
      html,
      facts: [
        { l: 'NTS', v: usd(p.nts) },
        { l: 'AVAR', v: usd(p.avar), tone: 'bad' },
        { l: 'Resilience', v: f.ri(p.ri), tone: p.ri < 60 ? 'bad' : '' },
        { l: 'Worst gap', v: p.gapMax > 0 ? p.gapMax + 'd' : 'none', tone: p.gapMax > 0 ? 'bad' : 'good' }
      ],
      working: [
        `RI = 97 − 0.48 × worst gap ${Math.max(0, p.gapMax)} − 1.4 × gapped components ${p.gapCount} − 2.8 × risky sole-sourced ${p.singleRisky} − 10 × mean RRE ${p.avgRre} − 3.2 × (worst node ${p.maxScore.toFixed(2)} − 2) = ${raw.toFixed(1)}${Math.abs(raw - p.ri) > 0.05 ? ` → bounded to <strong>${p.ri}</strong>` : ` = <strong>${p.ri}</strong>`}.`,
        `Binding component = the one with a gap, single-sourced first, then the largest gap: ${esc(b.name)}.`,
        `Product AVAR = Σ component AVAR × this SKU's share of each component's dependent NTS = <strong>${usd(p.avar)}</strong>.`
      ],
      actions: [
        { label: 'Create action', primary: true, go: chip => SCR.work.openSheet({ type: 'product', id: p.id }, { onCreated: a => markDone(chip, '✓ ' + a.id + ' created') }) },
        { label: `Simulate ${sup.name.split(' ')[0]} failing`, go: () => ask(`What if ${sup.name} fails for 30 days?`) },
        { label: 'Trace on the network', go: () => SCR.navigate('network', { product: p.id }) },
        { label: 'SKU 360', go: () => SCR.ui.openProduct(p.id) }
      ],
      followUps: [mode === 'protect' ? null : `How do I protect ${p.name}?`, `Who else can supply ${lc(b.name)}?`]
    };
  }

  /* ---------- plant / DC ---------- */
  function siteAnswer(e) {
    const d = D(), f = F();
    remember(e);
    if (e.type === 'dc') {
      const dc = e.ref;
      const mk = dc.markets.map(id => d.marketById(id).name);
      return {
        tag: AGENTS.sensing,
        html: `<p><strong>${esc(dc.name)}</strong> distributes to ${mk.map(esc).join(', ')} — ${usd(dc.nts)} of NTS across ${dc.products.length} SKUs.
          Recovery after a disruption is <strong>${dc.ttr} days</strong>, RI ${f.ri(dc.ri)}.</p>`,
        facts: [{ l: 'NTS served', v: usd(dc.nts) }, { l: 'AVAR', v: usd(dc.avar), tone: 'bad' }, { l: 'TTR', v: dc.ttr + 'd' }, { l: 'Markets', v: dc.marketsServed }],
        actions: [
          { label: 'Simulate 14 days', primary: true, go: () => ask(`What if ${dc.name} is disrupted for 14 days?`) },
          { label: 'Create action', go: chip => SCR.work.openSheet({ type: 'dc', id: dc.id }, { onCreated: a => markDone(chip, '✓ ' + a.id + ' created') }) },
          { label: 'DC 360', go: () => SCR.ui.openSite(dc.id) }
        ]
      };
    }
    const pt = e.ref;
    const critMats = pt.materials.map(d.materialById).filter(m => m.gap > 0).sort((a, b) => b.gap - a.gap);
    const city = pt.name.split(',')[0];
    return {
      tag: AGENTS.sensing,
      html: `<p><strong>${esc(pt.name)}</strong> (${esc(lc(pt.focus))}) serves ${usd(pt.nts)} NTS across ${pt.markets} markets at
        <strong>${pt.utilization}% utilisation</strong>. Site recovery after an outage: ${pt.ttr} days.</p>
        <p>Shortest cover is <strong>${pt.ttsMin} days</strong>; ${critMats.length} inbound ${plural(critMats.length, 'component recovers', 'components recover')} slower than the site can survive${
          critMats.length ? ` — worst ${esc(critMats[0].name)} (${critMats[0].tts}d cover vs ${critMats[0].ttr}d)` : ''}.</p>`,
      facts: [
        { l: 'NTS served', v: usd(pt.nts) },
        { l: 'Resilience', v: f.ri(pt.ri), tone: pt.ri < 60 ? 'bad' : '' },
        { l: 'Min cover', v: pt.ttsMin + 'd', tone: pt.ttsMin < 10 ? 'bad' : '' },
        { l: 'Utilisation', v: pt.utilization + '%' }
      ],
      working: [`Site RI = 96 − 2.6 × critical components ${pt.criticalMats} − 0.34 × (utilisation ${pt.utilization} − 70) − 0.22 × TTR ${pt.ttr} = <strong>${pt.ri}</strong>.`],
      actions: [
        { label: 'Simulate 21 days', primary: true, go: () => ask(`What if ${city} plant goes down for 21 days?`) },
        { label: 'Create action', go: chip => SCR.work.openSheet({ type: 'plant', id: pt.id }, { onCreated: a => markDone(chip, '✓ ' + a.id + ' created') }) },
        { label: 'Site view', go: () => SCR.navigate('site', { site: pt.id }) }
      ],
      followUps: ['Which plant has the shortest cover?']
    };
  }

  /* ---------- alert ---------- */
  function alertAnswer(a) {
    const d = D();
    remember(SCR.ai.entity('alert', a.id));
    const acts = d.actions.filter(x => x.linked === a.id);
    const recos = d.recommendations.filter(r => r.linked === a.id && r.status === 'pending');
    const m = (a.mats || []).map(d.materialById).filter(Boolean)[0];
    const draft = SCR.work.draftAction({ type: 'alert', id: a.id });
    return {
      tag: AGENTS.mitigation,
      html: `<p><strong>${esc(a.id)} · ${esc(a.type)}</strong> — ${esc(a.title)}.</p>
        <p>${esc(a.detail)}</p>
        <p>${acts.length ? `${acts.length} ${plural(acts.length, 'action is', 'actions are')} already in flight (${acts.map(x => esc(x.id) + ' ' + esc(x.status.toLowerCase())).join(', ')}).` : 'No action is in flight yet.'}
        ${recos.length ? ` <strong>${esc(recos[0].id)}</strong> is waiting for approval: ${esc(recos[0].title)}.` : ` My proposal: <strong>${esc(draft.title)}</strong> — cuts ~${usd(draft.riskCut)} AVAR for ~${usd(draft.cost)}.`}</p>`,
      facts: [{ l: 'Exposure', v: usd(a.exposure), tone: 'bad' }, { l: 'Owner', v: esc(a.owner) }, m ? { l: 'Cover vs recovery', v: `${m.tts}d / ${m.ttr}d` } : null].filter(Boolean),
      actions: [
        recos.length
          ? { label: `Approve ${recos[0].id}`, primary: true, go: chip => { const act = SCR.work.approve(recos[0]); markDone(chip, act ? `✓ Approved · ${act.id}` : '✓ Approved'); } }
          : { label: 'Create this action', primary: true, go: chip => SCR.work.openSheet(draft, { onCreated: x => markDone(chip, '✓ ' + x.id + ' created') }) },
        a.nodes[0] ? { label: 'Simulate the node', go: () => ask(`What if ${SCR.ai.nodeEntity(a.nodes[0]).name} fails for 30 days?`) } : null,
        { label: 'Alert detail', go: () => SCR.ui.openAlert(a.id) }
      ]
    };
  }

  /* ---------- market / sector / stream / category ---------- */
  function scopeAnswer(e) {
    const d = D(), f = F();
    const prods = productsInScope(e);
    const share = p => e.type === 'market' ? marketShare(p, e.id) : 1;
    const nts = prods.reduce((a, p) => a + p.nts * share(p), 0);
    const avar = prods.reduce((a, p) => a + p.avar * share(p), 0);
    const ri = prods.length ? prods.reduce((a, p) => a + p.ri * p.nts * share(p), 0) / Math.max(1, nts) : 0;
    const top = prods.slice().sort((a, b) => b.avar * share(b) - a.avar * share(a)).slice(0, 3);
    const supAvar = {};
    prods.forEach(p => p.materials.forEach(mid => {
      const m = d.materialById(mid);
      m.suppliers.forEach(sid => { supAvar[sid] = (supAvar[sid] || 0) + m.avar * (p.nts / m.depNTS) * share(p) / m.suppliers.length; });
    }));
    const topSup = Object.entries(supAvar).sort((a, b) => b[1] - a[1])[0];
    const s = topSup ? d.supplierById(topSup[0]) : null;
    const label = SCR.ai.TYPE_LABEL[e.type].toLowerCase();
    return {
      tag: AGENTS.impact,
      html: `<p><strong>${esc(e.name)}</strong> (${label}) carries ${usd(avar)} of adjusted value at risk on ${usd(nts)} of NTS${e.type === 'market' ? ' attributed to it' : ''} — ${prods.length} SKUs, NTS-weighted RI ${ri.toFixed(1)}%.</p>
        <p>Most exposed: ${top.map(p => `${esc(p.name)} (${usd(p.avar * share(p))})`).join(', ')}.${s ? ` The node behind the most of it is <strong>${esc(s.name)}</strong> (${usd(topSup[1])}).` : ''}</p>`,
      facts: [{ l: 'AVAR', v: usd(avar), tone: 'bad' }, { l: 'NTS', v: usd(nts) }, { l: 'SKUs', v: prods.length }, { l: 'RI', v: ri.toFixed(1) + '%' }],
      working: e.type === 'market'
        ? [`Each SKU's exposure is attributed to ${esc(e.name)} by its share of the SKU's market NTS (market NTS ÷ Σ NTS of the markets it serves).`]
        : [`Sums the AVAR and NTS of the ${prods.length} SKUs in this ${label}; RI is NTS-weighted.`],
      actions: [
        s ? { label: `Why ${s.name.split(' ')[0]}?`, go: () => ask(`Why is ${s.name} critical?`) } : null,
        top[0] ? { label: `What breaks ${top[0].brand}?`, go: () => ask(`What breaks ${top[0].name} first?`) } : null,
        e.type === 'sector' ? { label: 'Open in Value Streams', go: () => SCR.navigate('valuestream', { sector: e.id }) } : null
      ]
    };
  }

  /* ---------- what-if on the twin ---------- */
  function nodeFor(e) {
    const d = D();
    if (['supplier', 'plant', 'dc'].includes(e.type)) return { node: e, note: '' };
    if (e.type === 'material') {
      const m = e.ref;
      const s = SCR.ai.entity('supplier', m.suppliers[0]);
      return { node: s, note: `Running it as a failure of ${esc(s.name)}, ${m.singleSource ? 'the sole supplier' : 'the primary supplier'} of ${esc(m.name)}.` };
    }
    if (e.type === 'product') {
      const b = bindingMaterial(e.ref.materials.map(d.materialById));
      const s = SCR.ai.entity('supplier', b.suppliers[0]);
      return { node: s, note: `Failing ${esc(s.name)}, which supplies ${esc(b.name)} — the component that breaks ${esc(e.name)} first.` };
    }
    if (e.type === 'alert' && e.ref.nodes[0]) {
      const n = SCR.ai.nodeEntity(e.ref.nodes[0]);
      return { node: n, note: `Failing ${esc(n.name)}, the node behind ${esc(e.id)}.` };
    }
    return { node: null, note: '' };
  }

  function simulateAnswer(e, q) {
    const f = F(), k = D().kpis;
    const { node, note } = nodeFor(e);
    if (!node) {
      return { tag: AGENTS.scenario, html: `<p>The twin fails <strong>nodes</strong> — suppliers, plants and DCs. Name one, or a material or product and I will fail the node behind it.</p>`, followUps: ['What if CapForm fails for 30 days?', 'What if Pune plant goes down for 21 days?'] };
    }
    const last = memory.sim && memory.sim.node.id === node.id ? memory.sim : null;
    const days = parseDays(q) || (last ? last.days : 30);
    const sev = parseSev(q) || (last ? last.sev : 100);
    const type = parseType(q, node.type);
    const r = SCR.scenario.simulate(node.id, { days, sev, type });
    memory.sim = { node, days, sev, type, r };
    remember(node);

    const durations = [7, 14, 30, 45, 60, 90];
    if (!durations.includes(days)) durations.push(days);
    durations.sort((a, b) => a - b);
    const sens = durations.map(dd => ({ dd, v: SCR.scenario.simulate(node.id, { days: dd, sev, type }).atRisk }));
    const max = Math.max(...sens.map(x => x.v), 0.1);
    const best = r.opts[0];
    const top = r.rows.slice(0, 3);
    const isSup = node.type === 'supplier';
    const bm = r.bindingMat;

    const lead = `${note ? `<p style="color:var(--ink-3)">${note}</p>` : ''}
      <p>A <strong>${days}-day ${esc(TYPE_PHRASE[type] || type.toLowerCase())}</strong> at <strong>${esc(node.name)}</strong>${sev < 100 ? ` at ${sev}% severity` : ''}
        puts ${usd(r.exposed)} of sales in the path. Cover absorbs ${usd(r.covered)}, leaving ${crit(usd(r.atRisk) + ' at risk')}.</p>`;
    const html = `${isSup && bm ? `<p>Binding constraint: <strong>${esc(bm.name)}</strong> — ${bm.tts} days of cover against a ${days}-day outage.</p>` : ''}
      ${top.length ? `<p>Hit hardest: ${top.map(x => `${esc(x.p.name)} (${usd(+x.loss.toFixed(1))})`).join(', ')}.</p>` : '<p>No SKU loses sales — cover outlasts this disruption.</p>'}
      ${best && r.atRisk > 0 ? `<p><strong>Best plan:</strong> ${esc(best.name)} — removes ${Math.round(best.cut * 100)}% (${usd(+(r.atRisk * best.cut).toFixed(1))}) for ${usd(best.cost)}, effective in ${esc(best.time)}. Residual ${usd(r.residual)}.</p>` : ''}`;
    const tail = `<div style="font-size:12.5px;font-weight:600;color:var(--ink-3);margin-top:4px">Sales at risk by outage length</div>
      <div class="ans-bars">${sens.map(x => `<div class="ans-bar ${x.dd === days ? 'cur' : ''}"><span>${x.dd}d</span><i style="width:${Math.max(1.5, x.v / max * 100)}%"></i><b>${x.v < 0.05 ? 'none' : usd(+x.v.toFixed(1))}</b></div>`).join('')}</div>`;
    const working = [
      `In the path = Σ dependent NTS × ${days} ÷ 365 × ${sev}% severity = ${usd(r.exposed)}.`,
      isSup
        ? `At risk = per material: dependent NTS × max(0, ${days} − TTS) ÷ 365 × severity × share (100% if single-sourced, 45% where an alternate exists)${bm ? `; ${esc(bm.name)}: ${usd(bm.depNTS)} × (${days} − ${bm.tts}) ÷ 365` : ''} → ${usd(r.atRisk)}.`
        : `At risk = each SKU's share of site NTS × max(0, ${days} − 12-day finished-goods buffer) ÷ 365 × severity → ${usd(r.atRisk)}.`,
      `Scenario AVAR = at risk × (0.35 + 0.4 × severity) = ${usd(r.avar)}; enterprise RI ${k.enterpriseRI}% → ${r.riNew}%.`,
      `Options ranked by net benefit (cut × at risk − cost): ${r.opts.map(o => `${esc(o.name)} ${usd(+(r.atRisk * o.cut - o.cost).toFixed(1))}`).join(' · ')}.`
    ];
    return {
      tag: AGENTS.scenario,
      thinking: 'Scenario Twin Agent is running the twin…',
      delay: 1100,
      lead,
      html,
      facts: [
        { l: 'In the path', v: usd(r.exposed) },
        { l: 'Absorbed', v: usd(r.covered), tone: 'good' },
        { l: 'At risk', v: usd(r.atRisk), tone: 'bad' },
        { l: 'Enterprise RI', v: `${k.enterpriseRI}→${r.riNew}%`, tone: r.riNew < k.enterpriseRI ? 'bad' : '' }
      ],
      tail,
      working,
      actions: [
        best && r.atRisk > 0 ? { label: 'Create action from best plan', primary: true, go: chip => SCR.work.openSheet({ type: 'scenario', result: r, option: best }, { onCreated: a => markDone(chip, '✓ ' + a.id + ' created') }) } : null,
        { label: 'Open in Scenario Studio', go: () => SCR.scenario.openStudio(node.id, { days, sev }) },
        isSup ? { label: 'Draft an email', go: () => ask(`Draft an email to ${node.name}`) } : null
      ],
      followUps: [`What if it runs for ${days >= 60 ? 30 : days * 2} days?`, sev === 100 ? 'And at 50% severity?' : 'And at full severity?']
    };
  }

  function scenarioFromContext(c) {
    if (c.pageKey === 'scenario' && c.view && c.view.scenario) {
      const s = c.view.scenario;
      return { r: SCR.scenario.simulate(s.node, { days: s.days, sev: s.sev, type: s.type }) };
    }
    if (memory.sim) return { r: memory.sim.r };
    return null;
  }

  function scenarioPresets() {
    return {
      tag: AGENTS.scenario,
      html: `<p>I can fail any supplier, plant or DC on the digital twin and answer right here — sales in the path, what cover absorbs, what is left at risk, the revised RI and the best plan. Name a node and a duration, or try one of these:</p>`,
      followUps: ['What if CapForm fails for 30 days?', 'What if Taicang MicroControls is disrupted for 6 weeks?', 'What if Pune plant goes down for 21 days at 75%?']
    };
  }

  /* ---------- compare ---------- */
  function compareAnswer(a, b) {
    const d = D(), f = F();
    const rowsFor = {
      supplier: s => [['Risk score', s.score.toFixed(2)], ['Resilience', f.ri(s.ri)], ['TTR', s.ttr + 'd'], ['VAR', usd(s.var)], ['AVAR', usd(s.avar)], ['Sales linked', usd(s.depNTS)], ['Materials', s.materialsCount + (s.singleCount ? ` (${s.singleCount} sole)` : '')]],
      material: m => [['TTS / TTR', `${m.tts}d / ${m.ttr}d`], ['Gap', m.gap > 0 ? '−' + m.gap + 'd' : 'none'], ['VAR', usd(m.var)], ['AVAR', usd(m.avar)], ['RRE', f.rre(m.rre)], ['Sourcing', m.singleSource ? 'single' : m.suppliers.length + ' suppliers']],
      product: p => [['NTS', usd(p.nts)], ['Growth', f.signed(p.growth, '%')], ['VAR', usd(p.var)], ['AVAR', usd(p.avar)], ['Resilience', f.ri(p.ri)], ['Worst gap', p.gapMax > 0 ? p.gapMax + 'd' : 'none']],
      plant: s => [['NTS served', usd(s.nts)], ['Resilience', f.ri(s.ri)], ['TTR', s.ttr + 'd'], ['Min cover', s.ttsMin + 'd'], ['Critical comps', s.criticalMats], ['Utilisation', s.utilization + '%']],
      dc: s => [['NTS served', usd(s.nts)], ['Resilience', f.ri(s.ri)], ['TTR', s.ttr + 'd'], ['AVAR', usd(s.avar)], ['Markets', s.marketsServed]]
    };
    const nodeTypes = ['supplier', 'plant', 'dc'];
    let rowsA, rowsB;
    if (a.type === b.type && rowsFor[a.type]) { rowsA = rowsFor[a.type](a.ref); rowsB = rowsFor[b.type](b.ref); }
    else if (nodeTypes.includes(a.type) && nodeTypes.includes(b.type)) {
      const na = d.nodeById(a.id), nb = d.nodeById(b.id);
      const g = n => [['Type', n.type], ['VAR', usd(n.var)], ['AVAR', usd(n.avar)], ['Sales', usd(n.sales)], ['Resilience', f.ri(n.ri)]];
      rowsA = g(na); rowsB = g(nb);
    } else {
      return { tag: AGENTS.impact, html: `<p>I can compare two suppliers, materials, products or sites. <strong>${esc(a.name)}</strong> and <strong>${esc(b.name)}</strong> are different kinds of thing — try two of the same kind.</p>` };
    }
    const avarOf = e => e.ref.avar != null ? e.ref.avar : (d.nodeById(e.id) || {}).avar || 0;
    const riskier = avarOf(a) >= avarOf(b) ? a : b;
    const safer = riskier === a ? b : a;
    const ratio = avarOf(safer) > 0 ? avarOf(riskier) / avarOf(safer) : null;
    remember(riskier);
    return {
      tag: AGENTS.impact,
      html: `<table><thead><tr><th></th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>${
        rowsA.map((r, i) => `<tr><td class="cell-sub" style="font-size:12.5px">${r[0]}</td><td><strong>${r[1]}</strong></td><td><strong>${rowsB[i][1]}</strong></td></tr>`).join('')}</tbody></table>
        <p><strong>${esc(riskier.name)}</strong> is the bigger problem${ratio && ratio > 1.05 ? ` — ${ratio.toFixed(1)}× the adjusted exposure of ${esc(safer.name)}` : ', though the two are close on adjusted exposure'}.</p>`,
      actions: [
        { label: `Why ${riskier.name.split(/[ ,]/)[0]}?`, go: () => ask(`Tell me about ${riskier.name}`) },
        nodeTypes.includes(riskier.type) ? { label: `Simulate ${riskier.name.split(/[ ,]/)[0]}`, go: () => ask(`What if ${riskier.name} fails for 30 days?`) } : null
      ]
    };
  }

  /* ---------- dependencies ---------- */
  function dependencyAnswer(e) {
    const d = D();
    remember(e);
    let prods = [], lead = '';
    if (e.type === 'material') { prods = d.productsUsing(e.id); lead = `${prods.length} SKUs use <strong>${esc(e.name)}</strong>`; }
    else if (e.type === 'supplier') { prods = d.productsOf(e.id); lead = `${prods.length} SKUs depend on <strong>${esc(e.name)}</strong> through ${d.materialsOf(e.id).map(m => esc(m.name)).join(', ')}`; }
    else if (e.type === 'plant') { prods = e.ref.products.map(d.productById); lead = `${prods.length} SKUs run through <strong>${esc(e.name)}</strong>`; }
    prods = prods.slice().sort((a, b) => b.nts - a.nts);
    return {
      tag: AGENTS.impact,
      html: `<p>${lead} — ${usd(prods.reduce((a, p) => a + p.nts, 0))} of NTS:</p>
        <table><thead><tr><th>SKU</th><th style="text-align:right">NTS</th><th style="text-align:right">RI</th></tr></thead><tbody>${
          prods.slice(0, 8).map(p => `<tr><td>${esc(p.name)}<span class="cell-sub">${esc(p.sectorName)}</span></td><td style="text-align:right">${usd(p.nts)}</td><td style="text-align:right">${SCR.fmt.ri(p.ri)}</td></tr>`).join('')}</tbody></table>
        ${prods.length > 8 ? `<p class="muted">…and ${prods.length - 8} more.</p>` : ''}`,
      actions: prods[0] ? [{ label: `What breaks ${prods[0].brand}?`, go: () => ask(`What breaks ${prods[0].name} first?`) }] : []
    };
  }

  /* ---------- rankings ---------- */
  function rankingAnswer(q, text) {
    const d = D(), f = F();
    const n = parseN(q, 5);
    const scope = scopeFrom(text);
    const metric = /\b(ri|resilien|fragile|weakest)\b/.test(q) ? 'ri'
      : /\b(sales|nts|revenue)\b/.test(q) ? 'sales'
      : /\bavar\b|adjusted/.test(q) ? 'avar'
      : /\b(var|value at risk)\b/.test(q) ? 'var'
      : /\b(score|riskiest|risk score)\b/.test(q) ? 'score'
      : 'avar';
    const kind = /\bproducts?|skus?\b/.test(q) ? 'product'
      : /\bmaterials?|components?\b/.test(q) ? 'material'
      : /\bsuppliers?|vendors?\b/.test(q) ? 'supplier'
      : /\bplants?|sites?\b/.test(q) ? 'plant'
      : /\bdcs?\b/.test(q) ? 'dc'
      : /\bmarkets?|countries\b/.test(q) ? 'market'
      : 'node';
    let list = [];
    const prodScope = productsInScope(scope);
    const prodIds = new Set(prodScope.map(p => p.id));
    if (kind === 'product') list = prodScope.map(p => ({ id: p.id, type: 'product', name: p.name, sub: p.sectorName, var: p.var, avar: p.avar, ri: p.ri, sales: p.nts, score: p.maxScore }));
    else if (kind === 'material') list = d.materials.filter(m => !scope || (scope.type === 'category' ? m.cat === scope.id : m.depProducts.some(id => prodIds.has(id))))
      .map(m => ({ id: m.id, type: 'material', name: m.name, sub: m.singleSource ? 'single source' : m.suppliers.length + ' suppliers', var: m.var, avar: m.avar, ri: null, sales: m.depNTS, score: m.score }));
    else if (kind === 'supplier') list = d.suppliers.filter(s => !scope || (scope.type === 'category' ? s.cat === scope.id : d.productsOf(s.id).some(p => prodIds.has(p.id))))
      .map(s => ({ id: s.id, type: 'supplier', name: s.name, sub: s.city + ', ' + s.country, var: s.var, avar: s.avar, ri: s.ri, sales: s.depNTS, score: s.score }));
    else if (kind === 'plant') list = d.plants.map(p => ({ id: p.id, type: 'plant', name: p.name, sub: p.focus, var: p.var, avar: p.avar, ri: p.ri, sales: p.nts, score: null }));
    else if (kind === 'dc') list = d.dcs.map(p => ({ id: p.id, type: 'dc', name: p.name, sub: p.region, var: p.var, avar: p.avar, ri: p.ri, sales: p.nts, score: null }));
    else if (kind === 'market') list = d.markets.map(mk => {
      const prods = d.products.filter(p => p.markets.includes(mk.id));
      const avar = prods.reduce((a, p) => a + p.avar * marketShare(p, mk.id), 0);
      const vr = prods.reduce((a, p) => a + p.var * marketShare(p, mk.id), 0);
      return { id: mk.id, type: 'market', name: mk.name, sub: mk.region, var: +vr.toFixed(1), avar: +avar.toFixed(1), ri: null, sales: mk.nts, score: mk.riskIdx };
    });
    else list = d.nodes.map(x => ({ id: x.id, type: x.type === 'Supplier' ? 'supplier' : x.type === 'Plant' ? 'plant' : 'dc', name: x.name, sub: x.type + ' · ' + x.sub, var: x.var, avar: x.avar, ri: x.ri, sales: x.sales, score: null }));
    const m = metric === 'ri' && !list.some(x => x.ri != null) ? 'avar' : metric;
    list = list.filter(x => x[m] != null).sort((a, b) => m === 'ri' ? a.ri - b.ri : b[m] - a[m]).slice(0, n);
    const fmtM = { avar: v => usd(v), var: v => usd(v), sales: v => usd(v), ri: v => f.ri(v), score: v => (+v).toFixed(2) }[m];
    const label = { avar: 'AVAR', var: 'VAR', sales: 'Sales', ri: 'RI', score: 'Risk' }[m];
    const kindLabel = { product: 'products', material: 'materials', supplier: 'suppliers', plant: 'plants', dc: 'DCs', market: 'markets', node: 'nodes' }[kind];
    const openers = { product: SCR.ui.openProduct, material: SCR.ui.openMaterial, supplier: SCR.ui.openSupplier, plant: SCR.ui.openSite, dc: SCR.ui.openSite };
    const total = list.reduce((a, x) => a + (m === 'ri' || m === 'score' ? 0 : x[m]), 0);
    if (list[0] && list[0].type !== 'market') remember(SCR.ai.entity(list[0].type, list[0].id));
    return {
      tag: AGENTS.impact,
      html: `<p>${m === 'ri' ? `The ${list.length} weakest ${kindLabel} by resilience`
          : m === 'score' ? `The ${list.length} ${kindLabel} with the highest risk scores`
          : m === 'sales' ? `The ${list.length} ${kindLabel} with the most sales behind them`
          : `The ${list.length} ${kindLabel} carrying the most ${label}`}${scope ? ` in <strong>${esc(scope.name)}</strong>` : ''}:</p>
        <table><thead><tr><th>${kindLabel[0].toUpperCase() + kindLabel.slice(1, -1)}</th><th style="text-align:right">${label}</th></tr></thead><tbody>${
          list.map(x => `<tr><td>${esc(x.name)}<span class="cell-sub">${esc(x.sub)}</span></td><td style="text-align:right"><strong>${fmtM(x[m])}</strong></td></tr>`).join('')}</tbody></table>
        ${total && (m === 'avar' || m === 'var') && kind === 'node' ? `<p>Together they hold ${usd(+total.toFixed(1))} of the ${usd(D().kpis['total' + label])} enterprise ${label}.</p>` : ''}`,
      actions: list[0] && openers[list[0].type] ? [
        { label: `Why ${list[0].name.split(/[ ,]/)[0]}?`, primary: true, go: () => ask(`Tell me about ${list[0].name}`) },
        ['supplier', 'plant', 'dc'].includes(list[0].type) ? { label: `Simulate ${list[0].name.split(/[ ,]/)[0]}`, go: () => ask(`What if ${list[0].name} fails for 30 days?`) } : null,
        { label: 'Open 360', go: () => openers[list[0].type](list[0].id) }
      ] : [],
      followUps: list[1] && list[0].type !== 'market' ? [`Compare ${list[0].name} and ${list[1].name}`] : []
    };
  }

  function coverAnswer(q) {
    const d = D();
    if (/\bplants?|sites?\b/.test(q)) {
      const pts = d.plants.slice().sort((a, b) => a.ttsMin - b.ttsMin || b.criticalMats - a.criticalMats || b.nts - a.nts).slice(0, 4);
      const pt = pts[0];
      const tied = pts.filter(x => x !== pt && x.ttsMin === pt.ttsMin);
      const tight = pt.materials.map(d.materialById).sort((a, b) => a.tts - b.tts)[0];
      remember(SCR.ai.entity('plant', pt.id));
      return {
        tag: AGENTS.inventory,
        html: `<p><strong>${esc(pt.name)}</strong> runs out first — ${pt.ttsMin} days of cover on ${esc(lc(tight.name))}${tied.length ? ` (tied with ${tied.map(x => esc(x.name.split(',')[0])).join(' and ')}, but it has more components that can stop the line)` : ''}; ${pt.criticalMats} of its inbound components recover slower than they can be covered.</p>
          <table><thead><tr><th>Plant</th><th style="text-align:right">Min cover</th><th style="text-align:right">Critical</th></tr></thead><tbody>${
            pts.map(p => `<tr><td>${esc(p.name)}</td><td style="text-align:right">${p.ttsMin}d</td><td style="text-align:right">${p.criticalMats}</td></tr>`).join('')}</tbody></table>`,
        actions: [{ label: `Status of ${pt.name.split(',')[0]}`, primary: true, go: () => ask(`Status of ${pt.name.split(',')[0]}`) }]
      };
    }
    const mats = d.materials.filter(m => m.gap > 0).sort((a, b) => a.tts - b.tts).slice(0, 5);
    remember(SCR.ai.entity('material', mats[0].id));
    return {
      tag: AGENTS.inventory,
      html: `<p>Shortest cover among components that cannot recover in time:</p>
        <table><thead><tr><th>Component</th><th style="text-align:right">Cover</th><th style="text-align:right">Recover</th></tr></thead><tbody>${
          mats.map(m => `<tr><td>${esc(m.name)}<span class="cell-sub">${esc(d.supplierById(m.suppliers[0]).name)}</span></td><td style="text-align:right">${m.tts}d</td><td style="text-align:right">${m.ttr}d</td></tr>`).join('')}</tbody></table>`,
      actions: [{ label: `Who else can supply ${mats[0].name}?`, go: () => ask(`Who else can supply ${mats[0].name}?`) }]
    };
  }

  /* ---------- classics ---------- */
  function gapAnswer(scope) {
    const d = D();
    const prods = productsInScope(scope);
    const ids = new Set(prods.map(p => p.id));
    const gaps = d.materials.filter(m => m.gap > 0 && m.depProducts.some(id => ids.has(id))).sort((a, b) => b.gap - a.gap);
    const exposed = prods.filter(p => p.gapMax > 0);
    const items = gaps.slice(0, 5).map(m => {
      const s = d.supplierById(m.suppliers[0]);
      return `<li><strong>${esc(m.name)}</strong> — survives ${m.tts}d, recovers in ${m.ttr}d (${crit('−' + m.gap + 'd')}) · ${esc(s.name)}${m.singleSource ? ' · single source' : ''}</li>`;
    }).join('');
    return {
      tag: AGENTS.inventory,
      html: `<p>${gaps.length} components recover slower than inventory survives (TTR &gt; TTS)${scope ? ` in <strong>${esc(scope.name)}</strong>` : ''}, exposing
        <strong>${exposed.length} products</strong>. The worst gaps:</p>
        <ul>${items}</ul>
        <p>For these, replenishment ordered on the day of failure arrives after the line stops — they need buffers or alternates, not faster POs.</p>`,
      actions: [
        { label: 'Plan alternates', primary: true, go: () => ask('Mitigation plan for single-source materials') },
        { label: 'Open Value Streams', go: () => SCR.navigate('valuestream') }
      ],
      followUps: gaps[0] ? [`Who else can supply ${gaps[0].name}?`] : []
    };
  }

  function singleSource(scope) {
    const d = D();
    const prods = productsInScope(scope);
    const ids = new Set(prods.map(p => p.id));
    const singles = d.materials.filter(m => m.singleSource && (!scope || (scope.type === 'category' ? m.cat === scope.id : m.depProducts.some(id => ids.has(id)))))
      .sort((a, b) => b.avar - a.avar);
    const rows = singles.slice(0, 7).map(m => `<tr>
      <td>${esc(m.name)}<span class="cell-sub">${esc(d.supplierById(m.suppliers[0]).name)}</span></td>
      <td style="text-align:right">${m.gap > 0 ? crit('−' + m.gap + 'd') : 'OK'}</td>
      <td style="text-align:right">${usd(m.avar)}</td>
    </tr>`).join('');
    return {
      tag: AGENTS.impact,
      html: `<p>${singles.length} materials are single-sourced${scope ? ` in <strong>${esc(scope.name)}</strong>` : ''}. Ranked by adjusted value at risk:</p>
        <table><thead><tr><th>Material</th><th style="text-align:right">Gap</th><th style="text-align:right">AVAR</th></tr></thead><tbody>${rows}</tbody></table>`,
      actions: [
        { label: 'Queue a plan', primary: true, go: () => ask('Mitigation plan for single-source materials') },
        { label: 'Category & Suppliers', go: () => SCR.navigate('category') }
      ]
    };
  }

  function biggestVar(scope) {
    const d = D();
    const prods = productsInScope(scope);
    const ids = new Set(prods.map(p => p.id));
    const mats = d.materials.filter(m => !scope || m.depProducts.some(id => ids.has(id))).sort((a, b) => b.var - a.var).slice(0, 3);
    const items = mats.map(m => {
      const s = d.supplierById(m.suppliers[0]);
      return `<li><strong>${esc(m.name)}</strong> — ${usd(m.var)} VAR / ${usd(m.avar)} AVAR · ${m.depProducts.length} SKUs · ${esc(s.name)}</li>`;
    }).join('');
    remember(SCR.ai.entity('material', mats[0].id));
    const sup0 = d.supplierById(mats[0].suppliers[0]);
    return {
      tag: AGENTS.impact,
      html: `<p>${scope ? `In <strong>${esc(scope.name)}</strong>, the` : `Total enterprise exposure is <strong>${usd(d.kpis.totalVAR)} VAR</strong>
        (${usd(d.kpis.totalAVAR)} probability-adjusted). The`} three largest concentrations:</p>
        <ul>${items}</ul>`,
      actions: [
        { label: `Simulate ${sup0.name.split(' ')[0]}`, primary: true, go: () => ask(`What if ${sup0.name} fails for 30 days?`) },
        { label: 'Category & Suppliers', go: () => SCR.navigate('category') }
      ],
      followUps: [`Who else can supply ${mats[0].name}?`]
    };
  }

  /** Real proposals land in the approval queue. */
  function mitigationPlan() {
    const d = D();
    const risky = d.materials.filter(m => m.singleSource && m.score >= 2.8).sort((a, b) => b.avar - a.avar);
    const pendingBefore = d.recommendations.filter(r => r.status === 'pending').length;
    const created = SCR.work.proposeAlternates(3);
    const steps = risky.slice(0, 3).map((m, i) => {
      const s = d.supplierById(m.suppliers[0]);
      const feas = (m.substitution.split('—')[0] || '').trim().toLowerCase();
      const act = feas.indexOf('low') === 0
        ? 'substitution is hard — start alternate qualification now and build buffer to cover the full recovery'
        : feas.indexOf('medium') === 0
          ? 'activate the secondary option and pre-book capacity'
          : 'shift volume to qualified alternates';
      return `<li><strong>${esc(m.name)}</strong> (${esc(s.name)}, gap ${m.gap > 0 ? '−' + m.gap + 'd' : 'none'}): ${esc(act)}.</li>`;
    }).join('');
    return {
      tag: AGENTS.mitigation,
      thinking: 'Mitigation Strategist Agent is drafting proposals…',
      delay: 1000,
      html: `<p>${risky.length} single-source materials sit above the 2.8 risk threshold. Sequence for the three most exposed:</p>
        <ol>${steps}</ol>
        <p>${created.length
          ? `<strong>${created.length} ${plural(created.length, 'proposal')} added to the approval queue</strong> (${created.map(r => esc(r.id)).join(', ')}), sized from each material's AVAR.`
          : `These are already covered by proposals in the queue — ${pendingBefore} pending.`}</p>`,
      actions: [{ label: 'Review in the queue', primary: true, go: () => SCR.navigate('agents') }],
      followUps: ['What should I approve first?']
    };
  }

  /* ---------- queues & work ---------- */
  function approvalsAnswer() {
    const d = D(), f = F();
    const ranked = SCR.work.rankRecommendations();
    if (!ranked.length) return { tag: AGENTS.mitigation, html: '<p>The approval queue is empty — every proposal has been actioned.</p>', followUps: ['Mitigation plan for single-source materials'] };
    const top = ranked[0];
    const m = top.a && top.a.mats && top.a.mats[0] ? d.materialById(top.a.mats[0]) : null;
    return {
      tag: AGENTS.mitigation,
      html: `<p><strong>Approve ${esc(top.r.id)} first</strong> — ${esc(top.r.title)}. It protects about ${usd(+top.protect.toFixed(1))} for ${usd(top.cost)}
        (${Math.round(top.protect / top.cost)}× return)${top.a ? `, and the alert behind it is ${esc(top.a.sev)}` : ''}${m ? ` with ${m.tts} days of cover left` : ''}.</p>
        <table><thead><tr><th>Proposal</th><th style="text-align:right">Protects</th><th style="text-align:right">Cost</th></tr></thead><tbody>${
          ranked.map(x => `<tr><td>${esc(x.r.id)}<span class="cell-sub">${esc(x.r.title.length > 64 ? x.r.title.slice(0, 62) + '…' : x.r.title)}</span></td><td style="text-align:right">${usd(+x.protect.toFixed(1))}</td><td style="text-align:right">${usd(x.cost)}</td></tr>`).join('')}</tbody></table>`,
      working: ['Protects = exposure × the proposal’s risk cut; ranked by protection per $ of cost, weighted up for critical (×1.5) and high (×1.2) alerts.'],
      actions: [
        { label: `Approve ${top.r.id}`, primary: true, go: chip => { const act = SCR.work.approve(top.r); markDone(chip, act ? `✓ Approved · ${act.id} on tracker` : '✓ Approved'); } },
        { label: 'Review the queue', go: () => SCR.navigate('agents') }
      ]
    };
  }

  function workAnswer() {
    const d = D();
    const open = d.actions.filter(a => a.status !== 'Completed');
    const overdue = open.filter(a => a.status === 'Overdue');
    const soon = open.filter(a => a.status !== 'Overdue').slice().sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
    return {
      tag: AGENTS.workflow,
      html: `<p>${open.length} actions are in flight; <strong>${overdue.length} ${plural(overdue.length, 'is', 'are')} overdue</strong>.</p>
        ${overdue.length ? `<ul>${overdue.map(a => `<li><strong>${esc(a.id)}</strong> — ${esc(a.title)} · ${esc(a.owner)}, was due ${esc(a.due)}${a.riskCut ? ` · ${usd(a.riskCut)} AVAR waiting on it` : ''}</li>`).join('')}</ul>` : ''}
        <p>Next due:</p>
        <table><thead><tr><th>Action</th><th style="text-align:right">Due</th></tr></thead><tbody>${
          soon.map(a => `<tr><td>${esc(a.id)}<span class="cell-sub">${esc(a.title)} · ${esc(a.owner)}</span></td><td style="text-align:right">${esc(a.due)}</td></tr>`).join('')}</tbody></table>`,
      actions: [{ label: 'Open the tracker', primary: true, go: () => SCR.work.goToTracker() }]
    };
  }

  function urgentAnswer() {
    const d = D();
    const pid = SCR.persona ? SCR.persona.current() : 'rrl';
    const items = SCR.brief.itemsFor(pid);
    const crits = d.alerts.filter(a => a.status !== 'closed' && a.sev === 'critical').sort((a, b) => b.exposure - a.exposure);
    return {
      tag: AGENTS.sensing,
      html: `<p>For your lens, in order:</p>
        <ol>${items.map(it => `<li><span style="color:${it.tone};font-weight:600">${esc(it.kicker)}</span> — ${it.html}</li>`).join('')}</ol>
        ${crits.length ? `<p>${crits.length} critical ${plural(crits.length, 'alert is', 'alerts are')} open: ${crits.map(a => `<strong>${esc(a.id)}</strong>`).join(', ')}.</p>` : ''}`,
      actions: items.map((it, i) => ({ label: it.act.label, primary: i === 0, go: it.act.run })),
      followUps: ['What should I approve first?', 'What is overdue?']
    };
  }

  function dataQualityAnswer() {
    const d = D(), dq = d.dataQuality;
    const worst = dq.domains.slice().sort((a, b) => a.pct - b.pct).slice(0, 3);
    const sec = dq.bySector.slice().sort((a, b) => a.ttr - b.ttr)[0];
    return {
      tag: AGENTS.copilot,
      html: `<p><strong>${dq.missingTTR} components are missing TTR</strong> and ${dq.missingRRE} are missing RRE out of ${dq.componentsTotal.toLocaleString('en-US')}.
        Weakest domains: ${worst.map(w => `${esc(w.name)} (${w.pct}%)`).join(', ')}. ${esc(sec.sector)} has the lowest TTR coverage at ${sec.ttr}%.</p>
        <p>Why it matters: a missing TTR is read as “recovers instantly”, so these components can hide real gaps from every VAR figure.</p>`,
      actions: [{ label: 'Open Data Quality', primary: true, go: () => SCR.navigate('quality') }]
    };
  }

  /* ---------- drafting ---------- */
  function emailAnswer(s) {
    const d = D(), f = F();
    remember(SCR.ai.entity('supplier', s.id));
    const mats = d.materialsOf(s.id);
    const m = bindingMaterial(mats);
    const dims = Object.keys(s.dims).sort((a, b) => s.dims[b] - s.dims[a]).slice(0, 2).map(k => DIM_NAMES[k].toLowerCase());
    const al = d.alerts.find(a => a.nodes.includes(s.id) && a.status !== 'closed');
    const persona = SCR.persona ? SCR.persona.get() : { name: 'Supply Chain Resilience' };
    const by = SCR.work.addDays(d.asOf, 14);
    const byTxt = new Date(by + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    const subject = `Supply continuity review — ${mats.slice(0, 2).map(x => x.name).join(' and ')}`;
    const body =
`Hello ${s.name} team,

We are reviewing supply continuity for the ${mats.length === 1 ? lc(m.name) : 'materials'} you supply to ${d.company}${mats.length > 1 ? ` (${mats.map(x => lc(x.name)).join(', ')})` : ''}.

Our planning currently assumes ${m.ttr} days to restore supply after a disruption at ${s.city}, against ${m.tts} days of cover at our plants.${m.gap > 0 ? ' We would like to close that gap together.' : ''} Could you share, by ${byTxt}:

1. Capacity headroom and lead times for the next two quarters.
2. Whether a second line or site could qualify to our specifications.
3. Your continuity plan for ${dims.join(' and ')} risk, which our monitoring flags as the main exposures.
${al ? `\nWe are also tracking this: ${al.title.charAt(0).toLowerCase() + al.title.slice(1)}. Your view on it would help.\n` : ''}
Could we set up 30 minutes next week?

Kind regards,
${persona.name}
${d.company} · Supply Chain Resilience`;
    const full = `Subject: ${subject}\n\n${body}`;
    return {
      tag: AGENTS.copilot,
      thinking: 'Resilience Copilot is drafting…',
      html: `<p>Here is a draft to <strong>${esc(s.name)}</strong>, grounded in the ${m.gap > 0 ? `${m.gap}-day gap on ${esc(lc(m.name))}` : 'current cover and risk drivers'}:</p>
        <div class="draft"><b>Subject:</b> ${esc(subject)}

${esc(body)}</div>`,
      actions: [
        { label: 'Copy draft', primary: true, go: chip => copyText(full, chip) },
        { label: 'Log as outreach action', go: chip => {
          const a = SCR.work.createAction({ title: `Supplier outreach: continuity review with ${s.name}`, type: 'Supplier outreach', owner: persona.name, due: by, linked: al ? al.id : '—', cost: 0, riskCut: 0 });
          markDone(chip, '✓ ' + a.id + ' logged');
        } }
      ],
      followUps: [`What if ${s.name} fails for 30 days?`]
    };
  }

  function execBrief() {
    const d = D(), f = F(), k = d.kpis;
    const secs = d.sectors.map(sec => {
      const prods = d.products.filter(p => p.sector === sec.key);
      const nts = prods.reduce((a, p) => a + p.nts, 0);
      return { name: sec.name, avar: prods.reduce((a, p) => a + p.avar, 0), ri: prods.reduce((a, p) => a + p.ri * p.nts, 0) / nts, gaps: prods.filter(p => p.gapMax > 0).length, n: prods.length };
    }).sort((a, b) => b.avar - a.avar);
    const crits = d.alerts.filter(a => a.status !== 'closed' && a.sev === 'critical');
    const pending = d.recommendations.filter(r => r.status === 'pending').slice().sort((a, b) => b.exposure - a.exposure);
    const overdue = d.actions.filter(a => a.status === 'Overdue');
    const text =
`Resilience brief — ${SCR.brief.asOfLong()}

Exposure: ${usd(k.totalVAR)} value at risk (${usd(k.totalAVAR)} probability-adjusted) on ${usd(k.totalNTS)} of NTS. Enterprise RI is ${k.enterpriseRI}% (${f.signed(k.riDelta, ' pts')} on June); ${k.gapMaterials} components still recover slower than cover lasts.

Where it concentrates
${secs.slice(0, 3).map(s => `• ${s.name}: ${usd(+s.avar.toFixed(1))} AVAR · RI ${s.ri.toFixed(1)}% · ${s.gaps} of ${s.n} SKUs gapped`).join('\n')}

Critical now
${crits.map(a => `• ${a.title}`).join('\n') || '• None'}

Decisions needed
${pending.slice(0, 3).map(r => `• ${r.id} — ${r.title} (protects ${usd(r.exposure)}, ${r.cost.replace(/^\+/, '')})`).join('\n') || '• None pending'}

Delivery: ${usd(k.mitigatedYtd)} of AVAR retired this year; ${overdue.length} ${plural(overdue.length, 'action')} overdue${overdue[0] ? ` (${overdue.map(a => a.id).join(', ')})` : ''}.`;
    return {
      tag: AGENTS.impact,
      thinking: 'Impact & VAR Agent is writing the brief…',
      delay: 1000,
      html: `<p>Executive brief, written from the live model:</p><div class="draft">${esc(text)}</div>`,
      actions: [
        { label: 'Copy brief', primary: true, go: chip => copyText(text, chip) },
        { label: 'Executive Summary', go: () => SCR.navigate('executive') }
      ],
      followUps: ['What should I approve first?']
    };
  }

  function createActionAnswer(target, name) {
    const dr = SCR.work.draftAction(target);
    return {
      tag: AGENTS.mitigation,
      html: `<p>Proposed action for <strong>${esc(name)}</strong>:</p>
        <p><strong>${esc(dr.title)}</strong> · ${esc(dr.type.toLowerCase())}, owner ${esc(dr.owner)}, due ${esc(dr.due)}.</p>
        <p>${esc(dr.rationale)}</p>`,
      facts: [
        { l: 'AVAR cut', v: usd(dr.riskCut), tone: 'good' },
        { l: 'Est. cost', v: usd(dr.cost) },
        dr.rrePre != null ? { l: 'Residual risk', v: `${F().rre(dr.rrePre)}→${F().rre(dr.rrePost)}` } : null
      ].filter(Boolean),
      working: dr.basis,
      actions: [
        { label: 'Review & create', primary: true, go: chip => SCR.work.openSheet(dr, { onCreated: a => markDone(chip, '✓ ' + a.id + ' created') }) },
        { label: 'Create as drafted', go: chip => {
          const a = SCR.work.createAction(dr);
          markDone(chip, '✓ ' + a.id + ' on tracker');
          SCR.ui.toast('Action created', `<strong>${esc(a.id)}</strong> is on the tracker — owned by ${esc(a.owner)}.`, 'good', { label: 'View in tracker', run: () => SCR.work.goToTracker() });
        } }
      ]
    };
  }

  /* ---------- the current view ---------- */
  function summarizeView(c) {
    const d = D(), f = F();
    if (c.focus && c.focus.type === 'card') return cardAnswer({ title: c.focus.name, spec: c.focus.spec }, 'explain');
    if (c.focus) return profile(c.focus, '');
    const v = c.view || {};
    if (v.entity && !['scenario', 'executive', 'category'].includes(c.pageKey)) return profile(v.entity, '');
    const scopeTxt = v.scope ? ` (${esc(v.scope)})` : '';
    switch (c.pageKey) {
      case 'executive':
      case 'valuestream': {
        const prods = v.products && v.products.length ? v.products : d.products;
        const nts = prods.reduce((a, p) => a + p.nts, 0);
        const avar = prods.reduce((a, p) => a + p.avar, 0);
        const ri = prods.reduce((a, p) => a + p.ri * p.nts, 0) / nts;
        const worst = prods.slice().sort((a, b) => b.avar - a.avar);
        const share = worst.slice(0, 3).reduce((a, p) => a + p.avar, 0) / Math.max(0.1, avar) * 100;
        const gapped = prods.filter(p => p.gapMax > 0);
        const weak = prods.filter(p => p.ri < 60);
        return {
          tag: AGENTS.impact,
          html: `<p>You are looking at <strong>${prods.length} products</strong>${scopeTxt} — ${usd(nts)} of NTS carrying ${usd(+avar.toFixed(1))} AVAR, NTS-weighted RI ${ri.toFixed(1)}%.</p>
            <ul>
              <li>Concentration: the top three SKUs hold <strong>${share.toFixed(0)}%</strong> of the adjusted exposure — ${worst.slice(0, 3).map(p => esc(p.name)).join(', ')}.</li>
              <li>${gapped.length} of ${prods.length} have a component that recovers slower than it survives; the worst gap is ${Math.max(0, ...prods.map(p => p.gapMax))} days.</li>
              <li>${weak.length ? `${weak.length} ${plural(weak.length, 'product sits', 'products sit')} below RI 60: ${weak.slice(0, 3).map(p => esc(p.name)).join(', ')}.` : 'Nothing in scope sits below RI 60.'}</li>
            </ul>`,
          actions: [
            { label: `What breaks ${worst[0].brand}?`, primary: true, go: () => ask(`What breaks ${worst[0].name} first?`) },
            { label: 'Draft the executive brief', go: () => ask('Draft the executive brief') }
          ]
        };
      }
      case 'category': {
        const mats = v.materials && v.materials.length ? v.materials : d.materials;
        const singles = mats.filter(m => m.singleSource);
        const gapped = mats.filter(m => m.gap > 0);
        const top = mats.slice().sort((a, b) => b.avar - a.avar)[0];
        const sups = v.suppliers || [];
        const topSup = sups.slice().sort((a, b) => b.avar - a.avar)[0];
        return {
          tag: AGENTS.impact,
          html: `<p>This view covers <strong>${mats.length} materials</strong> from ${sups.length || '—'} suppliers${scopeTxt}: ${usd(+mats.reduce((a, m) => a + m.spend, 0).toFixed(0))} of spend, ${usd(+mats.reduce((a, m) => a + m.avar, 0).toFixed(1))} AVAR.</p>
            <ul>
              <li>${singles.length} ${plural(singles.length, 'is', 'are')} single-sourced and ${gapped.length} recover slower than cover lasts.</li>
              <li>Largest adjusted exposure: <strong>${esc(top.name)}</strong> (${usd(top.avar)}).</li>
              ${topSup ? `<li>Supplier carrying the most: <strong>${esc(topSup.name)}</strong> (${usd(topSup.avar)} AVAR, risk ${topSup.score.toFixed(2)}).</li>` : ''}
            </ul>`,
          actions: [
            { label: 'Plan alternates', primary: true, go: () => ask('Mitigation plan for single-source materials') },
            topSup ? { label: `Why ${topSup.name.split(' ')[0]}?`, go: () => ask(`Why is ${topSup.name} critical?`) } : null
          ]
        };
      }
      case 'site': return coverAnswer('plants');
      case 'scenario': {
        const sim = scenarioFromContext(c);
        if (sim) {
          const st = c.view.scenario;
          return simulateAnswer(SCR.ai.nodeEntity(st.node), `${st.days} days at ${st.sev}% severity ${st.type}`);
        }
        return scenarioPresets();
      }
      case 'actions': return workAnswer();
      case 'agents': return approvalsAnswer();
      case 'quality': return dataQualityAnswer();
      default: return urgentAnswer();
    }
  }

  /* ---------- AI-insight card hand-off ---------- */
  function cardAnswer(card, mode) {
    const spec = card.spec || {};
    const pts = (spec.points || []).slice(0, mode === 'act' ? 1 : 3);
    return {
      tag: spec.agent || AGENTS.copilot,
      html: mode === 'act'
        ? `<p>On <strong>${esc(card.title)}</strong>, the next move:</p><p>${pts[0] || 'Open the detail behind the largest figure and act on its binding component.'}</p>`
        : `<p>In plain terms, <strong>${esc(card.title)}</strong> says:</p><ul>${pts.map(p => `<li>${p}</li>`).join('')}</ul>`,
      facts: (spec.reads || []).slice(0, 4).map(r => ({ l: r.label, v: r.value, tone: r.tone })),
      actions: (spec.actions || []).slice(0, 3).map((a, i) => ({ label: a.label, primary: i === 0, go: () => { SCR.ui.closeDrawer(); a.onClick && a.onClick(); } })),
      followUps: mode === 'act' ? ['Explain this card simply'] : ['What should I do about it?']
    };
  }

  /** Called from an AI-insights drawer: bring the card into the conversation. */
  function discuss(card) {
    memory.card = card;
    open();
    appendBot(Object.assign(cardAnswer(card, 'explain'), {
      html: `<p>Let’s talk about <strong>${esc(card.title)}</strong>. The short version:</p><ul>${((card.spec && card.spec.points) || []).slice(0, 2).map(p => `<li>${p}</li>`).join('')}</ul>`
    }));
    focusInput();
  }

  function fallback(text, c) {
    const near = SCR.ai.suggest(text);
    if (near.length) {
      const fix = n => text.replace(new RegExp('\\b' + n.token + '\\b', 'i'), n.name);
      return {
        tag: AGENTS.copilot,
        html: `<p>I couldn't match that exactly. Did you mean ${near.map(n => `<strong>${esc(n.name)}</strong>`).join(' or ')}?</p>`,
        followUps: near.slice(0, 3).map(fix)
      };
    }
    const sugg = contextSuggests(c).concat(personaSuggests).filter((x, i, a) => a.indexOf(x) === i).slice(0, 4);
    return {
      tag: AGENTS.copilot,
      html: `<p>I couldn't map that to the model yet. I answer from live data about suppliers, materials, products, plants, DCs, markets and KPIs — and I can run what-ifs, rank, compare, draft and create actions.</p>
        <p>Try one of these, or name something specific:</p>`,
      followUps: sugg
    };
  }

  /* ================= Panel lifecycle ================= */
  function open() {
    panel.classList.add('open');
    document.body.classList.add('copilot-open');
    renderContext();
    renderSuggests();
    setTimeout(() => input.focus(), 260);
  }
  function close() {
    panel.classList.remove('open');
    document.body.classList.remove('copilot-open');
  }
  function toggle() { if (panel.classList.contains('open')) close(); else open(); }
  function focusInput() { setTimeout(() => input && input.focus(), 280); }

  function welcome() {
    const d = D();
    const p = SCR.persona ? SCR.persona.get() : null;
    appendBot({
      tag: AGENTS.copilot,
      html: `<p>${SCR.brief.greeting()}${p ? `, ${esc(p.name)}` : ''}. I watch <strong>${d.nodes.length} nodes</strong>, <strong>${d.materials.length} materials</strong>
        and <strong>${d.products.length} products</strong> — ${usd(d.kpis.totalVAR)} of value at risk, enterprise resilience <strong>${d.kpis.enterpriseRI}%</strong>.</p>
        <p>I follow what you open, so you can ask about <em>this</em> without naming it. I can also run what-ifs, create actions and draft emails.</p>`
    });
  }

  function reset() {
    if (!thread) return;
    thread.innerHTML = '';
    memory.entity = null; memory.sim = null; memory.card = null;
    welcome();
    syncFabDot();
  }

  function syncFabDot() {
    const fab = document.getElementById('copilotBtn');
    if (fab) fab.classList.toggle('has-chat', thread && thread.querySelectorAll('.msg.user').length > 0 && !panel.classList.contains('open'));
  }

  /** Persona lens hand-off from the switcher: header line, suggestions, fresh thread. */
  function personaChanged(p) {
    const line = document.getElementById('copilotPersona');
    if (line) line.textContent = 'Viewing as ' + p.name;
    setSuggests(p.suggests);
    reset();
  }

  function init() {
    panel = document.getElementById('copilot');
    thread = document.getElementById('copilotThread');
    input = document.getElementById('copilotText');
    ctxBox = document.getElementById('copilotContext');

    document.getElementById('copilotBtn').addEventListener('click', open);
    document.getElementById('copilotClose').addEventListener('click', () => { close(); syncFabDot(); });
    document.getElementById('copilotReset').addEventListener('click', reset);
    document.getElementById('copilotForm').addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      ask(text);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' && !input.value && lastAsked) { input.value = lastAsked; e.preventDefault(); }
    });

    SCR.ai.onChange(() => {
      ctxChangedAt = Date.now();
      useContext = true;
      renderContext();
      renderSuggests();
    });

    setSuggests(personaSuggests);
    welcome();
  }

  // `route` is exported for diagnostics: it lets the intent layer be exercised
  // without the typing delay or the DOM.
  SCR.copilot = { init, open, close, toggle, ask, discuss, focusInput, setSuggests, personaChanged, reset, route };
})();
