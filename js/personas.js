/* ============================================================
   SCR · personas.js
   The four roles, defined once and shared by the chooser, the
   web application and the mobile app. Each role carries what it
   is for (lens), where it lands, what it does day to day (tasks),
   how the mobile app is tailored for it, and how alerts are
   routed to it — so every surface presents the same job.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const PERSONAS = [
    {
      id: 'rrl', short: 'R&R', name: 'Risk & Resilience Leader', color: '#af52de', tag: 'Enterprise exposure',
      role: 'Enterprise-wide view of vulnerabilities across value streams, nodes and geographies.',
      lens: 'Where is the largest exposure, and which mitigation deserves investment first?',
      home: 'executive',
      owner: 'Risk & Resilience Leader',
      suggests: ['What needs my attention today?', 'What should I approve first?', 'Top 5 risk nodes by AVAR', 'Draft the executive brief'],
      tasks: [
        { t: 'Read enterprise exposure', d: 'Value at risk, adjusted VAR and resilience by sector, region and node.', where: 'Executive Summary', key: 'executive', m: 'today' },
        { t: 'Decide what to fund', d: 'Proposals ranked by protection per dollar, approved into tracked actions.', where: 'Recommendations', key: 'agents', m: 'decisions' },
        { t: 'Stress-test the network', d: 'Fail any supplier, plant or DC on the digital twin before it happens.', where: 'Scenario Studio', key: 'scenario', m: 'simulate' }
      ],
      mobile: {
        tab: { key: 'decisions', label: 'Decisions' },
        focus: 'Approve decisions, check exposure and read the brief between meetings.',
        quick: ['approvals', 'brief', 'simulate', 'critical']
      },
      web: { focus: 'Exposure, top nodes, the AVAR bridge and the whole mitigation portfolio.' }
    },
    {
      id: 'vsl', short: 'VSL', name: 'Value Chain / Stream Leader', color: '#30b0c7', tag: 'Products & value streams',
      role: 'Keeps products, brands and value streams running despite node failures.',
      lens: 'Which SKUs are fragile, and which node breaks them first?',
      home: 'valuestream',
      owner: 'Value Chain Leader',
      suggests: ['Most fragile products', 'What breaks AirPure Compact Purifier first?', 'What if Taicang MicroControls fails for 45 days?', 'Which products have TTR > TTS?'],
      tasks: [
        { t: 'Find fragile SKUs', d: 'Resilience index by product, with the components short of cover.', where: 'Value Streams', key: 'valuestream', m: 'products' },
        { t: 'Trace what breaks first', d: 'Supplier → material → plant → DC → market, with the binding component.', where: 'Network Explorer', key: 'network', m: 'products' },
        { t: 'Protect the launch quarter', d: 'Simulate the node behind a SKU and turn the best plan into an action.', where: 'Scenario Studio', key: 'scenario', m: 'simulate' }
      ],
      mobile: {
        tab: { key: 'products', label: 'Products' },
        focus: 'Check a fragile SKU, see what breaks it first and protect it on the go.',
        quick: ['breaks', 'gaps', 'simulate', 'alerts']
      },
      web: { focus: 'Product resilience, the node overview drill and dependency traces.' }
    },
    {
      id: 'cat', short: 'CAT', name: 'Category Leader', color: '#ff9500', tag: 'Suppliers & materials',
      role: 'Owns supplier and material risk — sourcing, qualification and commercial mitigation.',
      lens: 'Which materials need alternates, buffers or new contract terms?',
      home: 'category',
      owner: 'Category Leader',
      suggests: ['Mitigation plan for single-source materials', 'Top 5 suppliers by AVAR', 'Who else can supply closures?', 'Draft an email to Taicang MicroControls'],
      tasks: [
        { t: 'Spot sourcing risk', d: 'Single-source and high-risk materials, ranked by adjusted value at risk.', where: 'Category & Suppliers', key: 'category', m: 'suppliers' },
        { t: 'Plan alternates', d: 'Agent-drafted qualification proposals for the sole-sourced materials.', where: 'Recommendations', key: 'agents', m: 'decisions' },
        { t: 'Work with suppliers', d: 'Continuity outreach grounded in the actual gap and risk drivers.', where: 'Copilot', key: 'copilot', m: 'ask' }
      ],
      mobile: {
        tab: { key: 'suppliers', label: 'Suppliers' },
        focus: 'Check a supplier, plan alternates and send continuity outreach from anywhere.',
        quick: ['plan', 'email', 'approvals', 'single']
      },
      web: { focus: 'Spend, risk and AVAR by supplier and material, with the alternate-sourcing worklist.' }
    },
    {
      id: 'site', short: 'SITE', name: 'SC Site Leader', color: '#007aff', tag: 'Plant & DC continuity',
      role: 'Protects plant & DC continuity: inbound materials, capacity and outbound supply.',
      lens: 'Can my site keep running, and what is the playbook if it cannot?',
      home: 'site',
      owner: 'SC Site Leader',
      suggests: ['Which plant has the shortest cover?', 'Status of Pune plant', 'What if Pune plant goes down for 21 days?', 'What is overdue?'],
      tasks: [
        { t: 'Know what stops the line', d: 'Inbound components ranked by days of cover against recovery time.', where: 'Site Resilience', key: 'site', m: 'sites' },
        { t: 'Rehearse the outage', d: 'Take a plant or DC offline on the twin and see the best recovery.', where: 'Scenario Studio', key: 'scenario', m: 'simulate' },
        { t: 'Keep actions moving', d: 'Buffers, expedites and playbooks with owners and due dates.', where: 'Alerts & Actions', key: 'actions', m: 'actions' }
      ],
      mobile: {
        tab: { key: 'sites', label: 'Sites' },
        focus: 'See which site runs out first, rehearse an outage and chase overdue actions.',
        quick: ['actions', 'outage', 'cover', 'alerts']
      },
      web: { focus: 'Plant and DC continuity: what stops production first, inventory runway and playbooks.' }
    }
  ];
  const DEFAULT = 'rrl';

  const byId = id => PERSONAS.find(p => p.id === id) || PERSONAS[0];
  const initials = name => name.split(/[\s/&·]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  /** The stored role, with ?as=<id> in the URL taking precedence (deep links per role). */
  function stored() {
    let id = null;
    try {
      const q = new URLSearchParams(location.search).get('as');
      if (q && PERSONAS.some(p => p.id === q)) { id = q; localStorage.setItem('scr-persona', q); }
    } catch (_) { /* no URL / storage */ }
    if (!id) { try { id = localStorage.getItem('scr-persona'); } catch (_) { id = null; } }
    return PERSONAS.some(p => p.id === id) ? id : DEFAULT;
  }
  function remember(id) { try { localStorage.setItem('scr-persona', id); } catch (_) { /* private mode */ } }

  SCR.PERSONAS = PERSONAS;
  SCR.personas = { list: () => PERSONAS, byId, initials, stored, remember, DEFAULT };
})();
