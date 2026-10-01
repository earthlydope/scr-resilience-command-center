/* ============================================================
   SCR · guide.js
   Hover guide — the same idea as the HCCB hub: point at a
   control, it is ringed, a curved arrow is drawn to it and an
   explanation card says what it does and why, for the current
   role. Any element with data-hint="<id>" takes part.
   · web / landing: the card sits beside the element.
   · stage (mobile): the card sits in the gutter beside the
     phone, so it never covers the screen you are using.
   Copy is computed at hover time from live data. An element
   can also carry its own copy in data-hint-title/-body.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const KEY = 'scr-guide';
  let enabled = readEnabled();
  let mode = 'web';
  let stage = null;            // stage mode: the element the gutter belongs to
  let device = null;           // stage mode: the phone, so cards stay outside it
  let layer = null;
  let hold = null;

  function readEnabled() { try { return localStorage.getItem(KEY) !== '0'; } catch (_) { return true; } }

  /* ---------------- copy ---------------- */
  const D = () => SCR.data;
  const usd = v => (SCR.fmt ? SCR.fmt.usdM(v) : '$' + v + 'M');
  function persona() {
    if (SCR.persona && SCR.persona.get) return SCR.persona.get();
    return SCR.personas.byId(SCR.personas.stored());
  }
  const NAV = {
    executive: 'Enterprise exposure in one page: the AVAR bridge, exposure by sector and region, top nodes and the mitigation posture.',
    valuestream: 'Products and value streams: which SKUs are fragile, the node overview drill and market exposure.',
    category: 'Suppliers and materials: spend against risk, single-source concentration and the alternate-sourcing worklist.',
    site: 'Plants and DCs: which inbound material stops production first, inventory runway and playbooks.',
    network: 'The digital twin: trace a product supplier → material → plant → DC → market; red ribbons are single-source.',
    scenario: 'Fail any node on the twin and see exposed sales, what cover absorbs, residual risk and the best plan.',
    actions: 'Exceptions and the mitigation portfolio: alert inbox, the signal-to-action funnel, programmes and the action tracker.',
    agents: 'The agentic layer: proposals awaiting approval, ranked by protection per dollar, and the live agent feed.',
    quality: 'Governance: missing TTR, TTS and RRE inputs, coverage by sector and the data-owner worklist.'
  };
  const NAV_LABEL = {
    executive: 'Executive Summary', valuestream: 'Value Streams', category: 'Category & Suppliers', site: 'Site Resilience',
    network: 'Network Explorer', scenario: 'Scenario Studio', actions: 'Alerts & Actions', agents: 'Recommendations', quality: 'Data Quality'
  };
  const MOBILE_HERO = {
    rrl: 'Adjusted value at risk across the enterprise, the resilience index and what has been retired this year — the three numbers this role answers for.',
    vsl: 'How many SKUs are exposed through components that recover slower than they survive, and the most fragile one.',
    cat: 'Sole-sourced materials above the risk threshold and the supplier carrying the most adjusted exposure.',
    site: 'The site that runs out first and how many inbound components can stop it.'
  };
  const MOBILE_WATCH = {
    rrl: 'The five nodes carrying the most adjusted value at risk. Tap one for its 360°.',
    vsl: 'Products ranked weakest first by resilience index. Tap one to see what breaks it.',
    cat: 'Suppliers ranked by adjusted exposure. Tap one for drivers, materials and outreach.',
    site: 'Plants ranked by days of cover on their tightest component.'
  };
  const MOBILE_TAB = {
    decisions: 'Proposals ranked by protection per dollar. Approving one puts a tracked action on the board.',
    products: 'Every SKU with its resilience index. Filter to the gapped or the weakest.',
    suppliers: 'Every supplier by adjusted exposure. Filter to sole sources or critical ratings.',
    sites: 'Plants and DCs by cover and resilience — tap through to what can stop each one.'
  };

  function table(id) {
    const p = persona();
    const d = D();
    const k = d ? d.kpis : {};
    const pending = d ? d.recommendations.filter(r => r.status === 'pending').length : 0;
    const crit = d ? d.alerts.filter(a => a.status !== 'closed' && a.sev === 'critical').length : 0;
    const T = {
      /* ---------- chooser ---------- */
      'lz-role': { title: 'Choose a role', body: 'Each role lands on its own cockpit, briefing and copilot suggestions. The choice carries into both the mobile and the web experience.' },
      'lz-mobile': { title: 'Mobile app', body: `For the ${p.name} on the move: ${p.mobile.focus}` },
      'lz-web': { title: 'Web application', body: `The full command center for the ${p.name}: ${p.web.focus}` },
      'lz-stats': { title: 'One resilience engine', body: 'Every figure on every screen — web or mobile — reconciles to this one model of products, materials, suppliers, sites and markets.' },
      'lz-roles': { title: 'What each role does here', body: 'The day-to-day job of each role and the screen where it happens. Pick “Open” on a card to enter as that role.' },
      'lz-guide': { title: 'Guide', body: 'Turns these explanations on or off on every screen. Your choice is remembered.' },

      /* ---------- web shell ---------- */
      'w-brand': { title: 'Supply Chain Resilience', body: 'Value at risk across every product, material, supplier, plant, DC and market, with an agentic layer that senses, simulates and proposes.' },
      'w-side-toggle': { title: 'Sidebar', body: 'Collapse to icons for more room. The choice is remembered.' },
      'w-crumbs': { title: 'Where you are', body: 'The page and its live scope. Every number on the page is a slice of this scope.' },
      'w-search': { title: 'Search or ask', body: 'Type a name to open its 360°; type a question and the copilot answers it. Press / from anywhere.' },
      'w-persona': { title: `Viewing as ${p.name}`, body: `${p.lens} Switching re-lenses the sidebar, the landing cockpit, the briefing and the copilot.` },
      'w-refresh': { title: 'Data freshness', body: 'Weekly full recalculation; external risk feeds refresh daily at 03:00 UTC.' },
      'w-theme': { title: 'Appearance', body: 'Light or dark. Charts re-theme instantly.' },
      'w-alerts': { title: 'Alerts', body: `${crit} critical open. The panel opens with a written summary of the whole stack, ranked by impact × urgency.` },
      'w-guide': { title: 'Guide', body: 'Your role’s jobs and where they happen, plus these hover explanations — switch them off here.' },
      'w-mobile': { title: 'Mobile app', body: `Same data, same agents, tailored for a phone: ${p.mobile.focus}` },
      'w-chooser': { title: 'Chooser', body: 'Back to the start: pick a different role or device.' },
      'w-copilot': { title: 'Resilience Copilot', body: 'Follows what you are looking at, so “what if it fails for 6 weeks?” needs no names. Runs what-ifs, creates actions, drafts emails. ⌘K.' },
      'w-agents-live': { title: 'Agents live', body: 'Six agents sense, quantify, simulate and propose continuously. People approve the moves that matter.' },

      /* ---------- web pages ---------- */
      'w-today': { title: 'Today', body: 'The greeting and the six numbers that define enterprise exposure right now. The headline names the adjusted value at risk.' },
      'w-brief': { title: 'For you today', body: `Three priorities ranked for the ${p.name} from live alerts, proposals and cover — each with a one-tap next step.` },
      'w-filters': { title: 'Scope', body: 'Narrow the page. KPI tiles, charts, AI insights and the copilot’s answers all follow this scope.' },
      'w-summarize': { title: 'Summarize this view', body: 'The Impact & VAR Agent writes a read-out of the current scope: concentration, gaps and pending decisions.' },
      'w-insight': { title: 'AI insights', body: 'The agent that owns this card reads it against the live filters and says what matters and where to go next. Ask a follow-up to continue in the copilot.' },
      'w-d-act': { title: 'Create mitigation action', body: 'The Mitigation Strategist drafts the type, owner, due date, cost and expected AVAR cut. You confirm and it lands on the tracker.' },
      'w-d-sim': { title: 'Simulate', body: 'Runs the digital twin here: sales in the path, what cover absorbs, what is left at risk and the best plan.' },
      'w-d-ask': { title: 'Ask Copilot', body: 'This becomes the copilot’s subject, so you can ask “what if it fails?” or “who else can supply it?”.' },
      'w-cp-context': { title: 'Context', body: 'What the copilot treats as “this”. Tap × to ask about the whole enterprise instead.' },
      'w-cp-suggests': { title: 'Suggestions', body: 'Tuned to what is open and to your role.' },
      'w-cp-input': { title: 'Ask in plain English', body: '“What if Taicang fails for 6 weeks at 50%?”, “compare Pune and Atlanta”, “draft an email to CapForm”. ↑ recalls your last question.' },
      'w-cp-new': { title: 'New conversation', body: 'Clears the thread and the copilot’s memory of what “it” refers to.' },
      'w-sc-node': { title: 'Node to disrupt', body: 'Any supplier, plant or DC on the twin.' },
      'w-sc-type': { title: 'Disruption type', body: 'Labels the scenario for the playbook; severity and duration drive the maths.' },
      'w-sc-days': { title: 'Duration', body: 'Exposure grows once the outage outlasts the cover of the binding component.' },
      'w-sc-sev': { title: 'Severity', body: 'Share of the node’s capacity lost. Partial outages scale every figure.' },
      'w-sc-presets': { title: 'Presets', body: 'The live cases from the alert inbox, ready to run.' },
      'w-sc-save': { title: 'Save as playbook', body: 'Stores the scenario with its best plan; the Scenario Twin Agent re-validates it weekly.' },
      'w-sc-create': { title: 'Create action', body: 'Turns this mitigation option into a drafted action — cost, AVAR cut and due date sized from the scenario.' },
      'w-inbox-seg': { title: 'Severity filter', body: 'Critical means a node is already failing or will inside its time to survive.' },
      'w-al-ack': { title: 'Acknowledge', body: 'Marks the alert as seen by its owner.' },
      'w-al-assign': { title: 'Assign', body: 'Routes the alert to its owner with a draft action attached.' },
      'w-tracker': { title: 'Action tracker', body: 'Every mitigation with owner, due date, cost, AVAR cut and residual risk before → after. New actions from the copilot are highlighted.' },
      'w-reco-approve': { title: 'Approve', body: 'Creates a tracked action on the tracker with owner and due date, and logs it to the agent feed.' },
      'w-reco-dismiss': { title: 'Dismiss', body: 'Archives the proposal; the agent asks for your rationale.' },
      'w-feed': { title: 'Agent activity', body: 'The attribution trail behind every alert and proposal. Click a row for that agent’s 360°.' },

      /* ---------- mobile ---------- */
      'st-web': { title: 'Web application', body: 'Same role, same data — the full command center on a desktop.' },
      'st-chooser': { title: 'Chooser', body: 'Back to the start: pick a different role or device.' },
      'st-guide': { title: 'Guide', body: 'Turns these explanations on or off.' },
      'm-island': { title: 'Live activity', body: 'Confirmations — an action created, a proposal approved — appear here, like the Dynamic Island.' },
      'm-avatar': { title: `Viewing as ${p.name}`, body: 'Switch role or appearance. Each role gets its own tabs, Today and copilot suggestions.' },
      'm-hero': { title: 'Your headline', body: MOBILE_HERO[p.id] },
      'm-brief': { title: 'For you today', body: `Three priorities ranked for the ${p.name}. Each button does the next step — review, simulate, draft.` },
      'm-watch': { title: 'Watchlist', body: MOBILE_WATCH[p.id] },
      'm-quick': { title: 'Shortcuts', body: `The four jobs a ${p.name} does most on a phone.` },
      'm-ask-cta': { title: 'Ask about today', body: 'Opens the copilot with today as the context.' },
      'm-tab-today': { title: 'Today', body: 'Your briefing, headline numbers and watchlist.' },
      'm-tab-role': { title: p.mobile.tab.label, body: MOBILE_TAB[p.mobile.tab.key] },
      'm-tab-alerts': { title: 'Alerts', body: `Exceptions routed to the ${p.owner} first; switch to All for the whole inbox.` },
      'm-tab-sim': { title: 'Simulate', body: 'Fail a node on the digital twin and get the best plan — the same engine as the Scenario Studio.' },
      'm-tab-ask': { title: 'Ask', body: 'The Resilience Copilot. It knows what you last opened, so “what if it fails?” needs no names.' },
      'm-seg': { title: 'Filter', body: 'Narrows the list; counts update as you switch.' },
      'm-search': { title: 'Search', body: 'Filters by name, city or brand as you type.' },
      'm-reco': { title: 'Proposal', body: 'What it protects, what it costs and the risk it removes. Ranked by protection per dollar, weighted for alert severity.' },
      'm-reco-approve': { title: 'Approve', body: 'Creates the tracked action with owner and due date — confirmed in the Dynamic Island.' },
      'm-alert-row': { title: 'Alert', body: 'Severity, owner and exposure. Tap for what the agents found and what to do.' },
      'm-al-ack': { title: 'Acknowledge', body: 'Marks it as seen.' },
      'm-al-assign': { title: 'Assign', body: 'Routes it to its owner with a draft action attached.' },
      'm-al-act': { title: 'Create action', body: 'The Mitigation Strategist drafts it from the alert’s binding material — you confirm.' },
      'm-al-ask': { title: 'Ask Copilot', body: 'How to resolve this alert, with the proposal already waiting for it.' },
      'm-sim-node': { title: 'Node', body: 'The supplier, plant or DC to fail. Tap to choose another.' },
      'm-sim-type': { title: 'Disruption', body: 'Labels the scenario; duration and severity drive the maths.' },
      'm-sim-days': { title: 'Duration', body: 'Exposure appears once the outage outlasts the cover of the binding component.' },
      'm-sim-sev': { title: 'Severity', body: 'Share of capacity lost. Every figure scales with it.' },
      'm-sim-result': { title: 'Result', body: 'Sales in the path, what cover absorbs, what is left at risk and the hit to the resilience index.' },
      'm-sim-sens': { title: 'Outage length', body: 'How the sales at risk grow with the duration — the current run is highlighted.' },
      'm-sim-act': { title: 'Create action from best plan', body: 'Owner, cost, AVAR cut and due date are sized from this scenario. You confirm.' },
      'm-ask-context': { title: 'Context', body: 'What the copilot treats as “this”. Tap to switch it off and ask about the whole enterprise.' },
      'm-ask-suggests': { title: 'Suggestions', body: 'Tuned to your role and to what you last opened.' },
      'm-ask-input': { title: 'Ask', body: 'Plain English: “what if Pune floods for 3 weeks?”, “who else can supply closures?”.' },
      'm-ask-new': { title: 'New conversation', body: 'Clears the thread and what “it” refers to.' },
      'm-d-facts': { title: 'Key figures', body: 'Computed live from the resilience engine — the same numbers as the web 360°.' },
      'm-d-act': { title: 'Create mitigation action', body: 'Drafted by the agent with owner, due date, cost and AVAR cut. Confirm and it is tracked.' },
      'm-d-sim': { title: 'Simulate', body: 'Opens Simulate with this node loaded.' },
      'm-d-ask': { title: 'Ask Copilot', body: 'Makes this the copilot’s subject.' },
      'm-d-email': { title: 'Draft an email', body: 'Continuity outreach grounded in the actual gap and the risk drivers — ready to copy.' },
      'm-back': { title: 'Back', body: 'Returns to the previous screen.' },
      'm-pending': { title: `${pending} awaiting approval`, body: 'Open the queue, best proposal first.' }
    };
    return T[id] || null;
  }

  /** Copy for an element: its own data-hint-title/-body, else the table. */
  function copyFor(el) {
    const id = el.dataset.hint;
    if (el.dataset.hintTitle) return { title: el.dataset.hintTitle, body: el.dataset.hintBody || '' };
    const m = /^nav-(.+)$/.exec(id || '');
    if (m && NAV[m[1]]) {
      const p = persona();
      const home = p.home === m[1];
      return { title: NAV_LABEL[m[1]] + (home ? ' · your cockpit' : ''), body: NAV[m[1]] };
    }
    try { return table(id); } catch (_) { return null; }
  }

  /* ---------------- painting ---------------- */
  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement('div');
    layer.className = 'gd-layer' + (mode === 'stage' ? ' in-stage' : '');
    layer.setAttribute('aria-hidden', 'true');
    (mode === 'stage' && stage ? stage : document.body).appendChild(layer);
    return layer;
  }

  function clear() {
    hold = null;
    if (layer) layer.innerHTML = '';
  }

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const SVGNS = 'http://www.w3.org/2000/svg';

  function paint(el) {
    const copy = copyFor(el);
    if (!copy || !copy.title) { clear(); return; }
    const L = ensureLayer();
    L.innerHTML = '';
    const origin = mode === 'stage' && stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const r = el.getBoundingClientRect();
    const t = { left: r.left - origin.left, top: r.top - origin.top, width: r.width, height: r.height };
    t.right = t.left + t.width; t.bottom = t.top + t.height;
    const vw = origin.width, vh = origin.height;

    // ring
    const ring = document.createElement('div');
    ring.className = 'gd-ring';
    const radius = parseFloat(getComputedStyle(el).borderRadius) || 10;
    Object.assign(ring.style, { left: (t.left - 3) + 'px', top: (t.top - 3) + 'px', width: (t.width + 6) + 'px', height: (t.height + 6) + 'px', borderRadius: (radius + 3) + 'px' });
    L.appendChild(ring);

    // card (measured before placing)
    const card = document.createElement('div');
    card.className = 'gd-card';
    const b = document.createElement('b'); b.textContent = copy.title;
    const sp = document.createElement('span'); sp.textContent = copy.body;
    card.appendChild(b); card.appendChild(sp);
    card.style.visibility = 'hidden';
    L.appendChild(card);

    let cardW, cardX, cardY, d;
    if (mode === 'stage' && device) {
      // gutter beside the phone, on the side nearest the element
      const dv = device.getBoundingClientRect();
      const dl = dv.left - origin.left, dr = dv.right - origin.left;
      const gutterL = dl - 28, gutterR = vw - dr - 28;
      const side = (t.left + t.width / 2) < dl + (dr - dl) / 2 ? (gutterL >= 170 ? 'left' : 'right') : (gutterR >= 170 ? 'right' : 'left');
      cardW = clamp((side === 'left' ? gutterL : gutterR) - 8, 170, 260);
      card.style.width = cardW + 'px';
      const cardH = card.offsetHeight;
      cardX = side === 'left' ? dl - 28 - cardW : dr + 28;
      cardY = clamp(t.top + t.height / 2 - cardH / 2, 16, vh - cardH - 16);
      const sx = side === 'left' ? cardX + cardW - 4 : cardX + 4;
      const sy = cardY + Math.min(34, cardH / 2);
      const ex = side === 'left' ? t.left - 8 : t.right + 8;
      const ey = t.top + t.height / 2;
      const span = ex - sx;
      const bow = clamp(Math.abs(span) * 0.42, 40, 96);
      const lift = (ey < vh / 2 ? 1 : -1) * bow;
      d = `M ${sx} ${sy} C ${sx + span * 0.3} ${sy + lift}, ${ex - span * 0.15} ${ey + lift * 0.35}, ${ex} ${ey}`;
    } else {
      cardW = 272;
      card.style.width = cardW + 'px';
      const cardH = card.offsetHeight;
      const GAP = 54, EDGE = 14;
      const fits = {
        right: t.right + GAP + cardW <= vw - EDGE,
        left: t.left - GAP - cardW >= EDGE,
        below: t.bottom + GAP + cardH <= vh - EDGE,
        above: t.top - GAP - cardH >= EDGE
      };
      const wide = t.width > vw * 0.42;
      const order = wide ? ['below', 'above', 'right', 'left'] : ['right', 'left', 'below', 'above'];
      const side = order.find(o => fits[o]) || 'below';
      const cx = t.left + t.width / 2, cy = t.top + t.height / 2;
      if (side === 'right' || side === 'left') {
        cardX = side === 'right' ? t.right + GAP : t.left - GAP - cardW;
        cardY = clamp(cy - cardH / 2, EDGE, vh - cardH - EDGE);
        const sx = side === 'right' ? cardX + 6 : cardX + cardW - 6;
        const sy = cardY + cardH / 2;
        const ex = side === 'right' ? t.right + 9 : t.left - 9;
        const ey = clamp(cy, cardY + 8, cardY + cardH - 8);
        const span = ex - sx;
        const bow = clamp(Math.abs(span) * 0.45, 26, 70);
        const lift = (ey < vh / 2 ? 1 : -1) * bow;
        d = `M ${sx} ${sy} C ${sx + span * 0.32} ${sy + lift}, ${ex - span * 0.18} ${ey + lift * 0.34}, ${ex} ${ey}`;
      } else {
        cardX = clamp(cx - cardW / 2, EDGE, vw - cardW - EDGE);
        cardY = side === 'below' ? t.bottom + GAP : t.top - GAP - cardH;
        const sx = clamp(cx, cardX + 18, cardX + cardW - 18);
        const sy = side === 'below' ? cardY + 6 : cardY + cardH - 6;
        const ex = sx;
        const ey = side === 'below' ? t.bottom + 9 : t.top - 9;
        const span = ey - sy;
        const bow = clamp(Math.abs(span) * 0.6, 24, 64) * (cx < vw / 2 ? 1 : -1);
        d = `M ${sx} ${sy} C ${sx + bow} ${sy + span * 0.3}, ${ex + bow} ${ey - span * 0.25}, ${ex} ${ey}`;
      }
    }
    Object.assign(card.style, { left: cardX + 'px', top: cardY + 'px', visibility: '' });

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'gd-svg');
    svg.setAttribute('width', vw); svg.setAttribute('height', vh);
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    svg.innerHTML = `<defs><marker id="gd-head" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 Z" class="gd-head"/></marker></defs>
      <path class="gd-curve" pathLength="1" d="${d}" marker-end="url(#gd-head)"/>`;
    L.insertBefore(svg, card);
  }

  /* ---------------- events ---------------- */
  function hintTarget(n) {
    if (!(n instanceof Element)) return null;
    const el = n.closest('[data-hint]');
    if (!el || !el.dataset.hint) return null;
    if (mode === 'stage' && stage && !stage.contains(el)) return null;
    return el;
  }

  function onOver(e) {
    if (!enabled) return;
    const el = hintTarget(e.target);
    if (el && el !== hold) { hold = el; paint(el); }
  }
  function onOut(e) {
    if (!enabled) return;
    const from = hintTarget(e.target);
    const to = hintTarget(e.relatedTarget);
    if (from && from !== to) {
      if (to) { hold = to; paint(to); } else clear();
    }
  }
  function onMove() {
    if (!hold) return;
    if (!hold.isConnected) return clear();
    const r = hold.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || r.width === 0) return clear();
    paint(hold);
  }

  function syncToggles() {
    document.querySelectorAll('[data-guide-toggle]').forEach(b => {
      b.classList.toggle('on', enabled);
      b.setAttribute('aria-pressed', String(enabled));
      const lbl = b.querySelector('[data-guide-label]');
      if (lbl) lbl.textContent = enabled ? 'Guide on' : 'Guide off';
    });
  }

  function setEnabled(on) {
    enabled = !!on;
    try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (_) { /* private mode */ }
    if (!enabled) clear();
    syncToggles();
  }

  /** opts: { mode: 'web' | 'landing' | 'stage', stage, device } */
  function init(opts) {
    opts = opts || {};
    mode = opts.mode || 'web';
    stage = opts.stage || null;
    device = opts.device || null;
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    // a click usually changes the screen under the pointer
    document.addEventListener('click', () => setTimeout(() => { if (hold && !hold.isConnected) clear(); }, 60), true);
    document.querySelectorAll('[data-guide-toggle]').forEach(b => b.addEventListener('click', e => {
      if (b.dataset.guideToggle === 'menu') return; // the web toolbar opens a role guide instead
      e.preventDefault();
      setEnabled(!enabled);
    }));
    syncToggles();
  }

  SCR.guide = { init, setEnabled, enabled: () => enabled, clear, copyFor, refresh: () => { if (hold) paint(hold); } };
})();
