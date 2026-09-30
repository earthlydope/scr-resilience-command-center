/* ============================================================
   SCR · app.js
   Router + persona lens (Terova pattern):
   · Persona registry — each persona has a role, lens, accent
     and a home cockpit.
   · Nav as metadata — every sidebar item declares which
     personas see it; the sidebar derives from the mapping.
   · "Viewing as" switcher in the app bar re-lenses the nav,
     lands on the persona's cockpit and re-tunes the copilot.
   Pages self-register on SCR.pages before this file runs.
   ============================================================ */
window.SCR = window.SCR || {};
SCR.pages = SCR.pages || {};
SCR.registerPage = function (key, page) { SCR.pages[key] = page; };

(function () {
  /* ================= Persona registry ================= */
  const PERSONAS = [
    {
      id: 'rrl', short: 'R&R', name: 'Risk & Resilience Leader', color: '#af52de', tag: 'Enterprise exposure',
      role: 'Enterprise-wide view of vulnerabilities across value streams, nodes and geographies.',
      lens: 'Where is the largest exposure, and which mitigation deserves investment first?',
      home: 'executive',
      suggests: ['What needs my attention today?', 'What should I approve first?', 'Top 5 risk nodes by AVAR', 'Draft the executive brief']
    },
    {
      id: 'vsl', short: 'VSL', name: 'Value Chain / Stream Leader', color: '#30b0c7', tag: 'Products & value streams',
      role: 'Keeps products, brands and value streams running despite node failures.',
      lens: 'Which SKUs are fragile, and which node breaks them first?',
      home: 'valuestream',
      suggests: ['Most fragile products', 'What breaks AirPure Compact Purifier first?', 'What if Taicang MicroControls fails for 45 days?', 'Which products have TTR > TTS?']
    },
    {
      id: 'cat', short: 'CAT', name: 'Category Leader', color: '#ff9500', tag: 'Suppliers & materials',
      role: 'Owns supplier and material risk — sourcing, qualification and commercial mitigation.',
      lens: 'Which materials need alternates, buffers or new contract terms?',
      home: 'category',
      suggests: ['Mitigation plan for single-source materials', 'Top 5 suppliers by AVAR', 'Who else can supply closures?', 'Draft an email to Taicang MicroControls']
    },
    {
      id: 'site', short: 'SITE', name: 'SC Site Leader', color: '#007aff', tag: 'Plant & DC continuity',
      role: 'Protects plant & DC continuity: inbound materials, capacity and outbound supply.',
      lens: 'Can my site keep running, and what is the playbook if it cannot?',
      home: 'site',
      suggests: ['Which plant has the shortest cover?', 'Status of Pune plant', 'What if Pune plant goes down for 21 days?', 'What is overdue?']
    }
  ];
  const DEFAULT_PERSONA = 'rrl';
  let currentPersona = localStorage.getItem('scr-persona') || DEFAULT_PERSONA;
  if (!PERSONAS.some(p => p.id === currentPersona)) currentPersona = DEFAULT_PERSONA;

  const getPersona = id => PERSONAS.find(p => p.id === id) || PERSONAS[0];
  const initials = name => name.split(/[\s/&·]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  /* ================= Nav as metadata =================
     `personas` omitted → visible to every lens. */
  const icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 20Z"/><path d="M9 21v-7h6v7"/></svg>',
    executive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    valuestream: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M7 12h13"/><path d="M11 18h9"/><circle cx="4" cy="12" r="1"/><circle cx="8" cy="18" r="1"/></svg>',
    category: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="M12 13 3 8"/><path d="m12 13 9-5"/><path d="M12 13v8"/></svg>',
    site: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l7-5 7 5v13"/><path d="M10 21v-6h4v6"/><path d="M21 21V11l-4-3"/><path d="M3 21h18"/></svg>',
    network: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="5" cy="6" r="2.1"/><circle cx="19" cy="6" r="2.1"/><circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="18" r="2.1"/><circle cx="19" cy="18" r="2.1"/><path d="M6.8 7.3 10 10.4M17.2 7.3 14 10.4M6.8 16.7 10 13.6M17.2 16.7 14 13.6"/></svg>',
    scenario: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 3v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
    actions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 20h20Z"/><path d="M12 9v5"/><path d="M12 17.5v.5"/></svg>',
    agents: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h1.5A2.5 2.5 0 0 1 19 6.5v12a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18.5v-12A2.5 2.5 0 0 1 7.5 4H9"/><rect x="9" y="2.5" width="6" height="3" rx="1.2"/><path d="m9 13.2 2.1 2.1 4-4.6"/></svg>',
    quality: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 20 6.5V13c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6.5Z"/><path d="m9 12 2 2 4-4.5"/></svg>'
  };

  const NAV_GROUPS = [
    {
      heading: 'My cockpit',
      items: [
        { key: 'executive', label: 'Executive Summary', personas: ['rrl'] },
        { key: 'valuestream', label: 'Value Streams', personas: ['rrl', 'vsl'] },
        { key: 'category', label: 'Category & Suppliers', personas: ['rrl', 'cat'] },
        { key: 'site', label: 'Site Resilience', personas: ['rrl', 'site', 'vsl'] }
      ]
    },
    {
      heading: 'Intelligence',
      items: [
        { key: 'network', label: 'Network Explorer' },
        { key: 'scenario', label: 'Scenario Studio' }
      ]
    },
    {
      heading: 'Act',
      items: [
        { key: 'actions', label: 'Alerts & Actions', badge: () => SCR.data.alerts.filter(a => a.sev === 'critical' && a.status !== 'closed').length },
        { key: 'agents', label: 'Recommendations', personas: ['rrl', 'vsl', 'cat'], badge: () => SCR.data.recommendations.filter(r => r.status === 'pending').length }
      ]
    },
    {
      heading: 'Govern',
      items: [
        { key: 'quality', label: 'Data Quality', personas: ['rrl', 'cat'] }
      ]
    }
  ];

  /** Groups visible to a persona (empty groups drop) — the Terova mapping. */
  function navGroupsForPersona(pid) {
    return NAV_GROUPS.map(g => ({
      heading: g.heading,
      items: g.items.filter(i => !i.personas || i.personas.includes(pid))
    })).filter(g => g.items.length > 0);
  }

  /* ================= Persona API ================= */
  function setPersona(id, opts) {
    const p = getPersona(id);
    currentPersona = p.id;
    localStorage.setItem('scr-persona', p.id);
    renderPersonaPill();
    buildNav();
    if (SCR.copilot && SCR.copilot.personaChanged) SCR.copilot.personaChanged(p);
    if (!opts || opts.navigate !== false) navigate(p.home);
    if (opts && opts.toast) {
      SCR.ui.toast('Lens switched', `Viewing as <strong>${SCR.ui.esc(p.name)}</strong> — ${SCR.ui.esc(p.lens)}`, '');
    }
  }
  SCR.persona = {
    current: () => currentPersona,
    get: () => getPersona(currentPersona),
    list: () => PERSONAS,
    set: setPersona
  };

  /* ================= Router ================= */
  let currentKey = null;
  function navigate(key, opts) {
    const page = SCR.pages[key];
    if (!page) return;
    if (SCR.ui && SCR.ui.closeDrawer) SCR.ui.closeDrawer(); // any nav closes an open 360 drawer
    document.querySelectorAll('.nav-item').forEach(n =>
      n.classList.toggle('active', n.dataset.key === key));
    SCR.setCrumbs([{ label: page.title }]); // default; pages may override
    SCR.charts.disposeAll();
    const host = document.getElementById('page');
    host.innerHTML = '';
    document.getElementById('pageScroll').scrollTop = 0;
    currentKey = key;
    page.render(host, opts || {});
    // after render, so the page's context() sees the filters it just applied
    if (SCR.ai) SCR.ai.setRoute(key, opts || {});
    requestAnimationFrame(() => SCR.charts.resizeAll());
  }
  SCR.navigate = navigate;

  /* ================= Breadcrumbs ================= */
  function setCrumbs(parts, scope) {
    const host = document.getElementById('crumbTrail');
    host.innerHTML = '';
    (parts || []).forEach((p, i) => {
      if (i) host.appendChild(SCR.ui.el('<span class="crumb-sep">/</span>'));
      if (p.key) {
        const b = SCR.ui.el(`<button class="crumb-link">${SCR.ui.esc(p.label)}</button>`);
        b.addEventListener('click', () => navigate(p.key, p.opts || {}));
        host.appendChild(b);
      } else {
        host.appendChild(SCR.ui.el(`<span class="crumb-here">${SCR.ui.esc(p.label)}</span>`));
      }
    });
    if (scope) host.appendChild(SCR.ui.el(`<span class="crumb-scope">· ${SCR.ui.esc(scope)}</span>`));
  }
  SCR.setCrumbs = setCrumbs;

  /* ================= Sidebar ================= */
  function buildNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = '';
    navGroupsForPersona(currentPersona).forEach(group => {
      if (group.heading) nav.appendChild(SCR.ui.el(`<div class="nav-section">${group.heading}</div>`));
      group.items.forEach(item => {
        const badge = item.badge ? item.badge() : 0;
        const btn = SCR.ui.el(`<button class="nav-item" data-key="${item.key}" title="${item.label}">
          ${icons[item.key] || ''}<span>${item.label}</span>
          ${badge ? `<span class="nav-badge">${badge}</span>` : ''}
        </button>`);
        btn.addEventListener('click', () => navigate(item.key));
        nav.appendChild(btn);
      });
    });
  }

  SCR.refreshNav = function () {
    buildNav();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.key === currentKey));
  };

  /* ================= Sidebar collapse ================= */
  function initSideToggle() {
    const shell = document.querySelector('.shell');
    const btn = document.getElementById('sideToggle');
    if (localStorage.getItem('scr-side') === 'collapsed') shell.classList.add('side-collapsed');
    btn.addEventListener('click', () => {
      const collapsed = shell.classList.toggle('side-collapsed');
      localStorage.setItem('scr-side', collapsed ? 'collapsed' : 'open');
      btn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
      setTimeout(() => SCR.charts.resizeAll(), 270);
    });
  }

  /* ================= Persona switcher (app bar) ================= */
  function renderPersonaPill() {
    const p = getPersona(currentPersona);
    document.getElementById('personaPill').innerHTML = `
      <span class="pp-avatar" style="background:color-mix(in srgb, ${p.color} 22%, transparent);color:${p.color}">${initials(p.name)}</span>
      <span class="pp-meta">
        <span class="pp-name">${SCR.ui.esc(p.name)}</span>
        <span class="pp-cap">Viewing as</span>
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>`;
  }

  function buildPersonaMenu() {
    const menu = document.getElementById('personaMenu');
    menu.innerHTML = '';
    PERSONAS.forEach(p => {
      const active = p.id === currentPersona;
      const opt = SCR.ui.el(`<button class="persona-opt" title="${SCR.ui.esc(p.role)}" style="${active ? `background:color-mix(in srgb, ${p.color} 9%, transparent)` : ''}">
        <span class="po-avatar" style="background:color-mix(in srgb, ${p.color} 16%, transparent);color:${p.color}">${initials(p.name)}</span>
        <span class="po-meta">
          <span class="po-name">${SCR.ui.esc(p.name)}</span>
          <span class="po-tag">${SCR.ui.esc(p.tag)}</span>
        </span>
        ${active ? `<svg class="po-check" viewBox="0 0 24 24" fill="none" stroke="${p.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>` : ''}
      </button>`);
      opt.addEventListener('click', () => {
        menu.classList.remove('open');
        if (p.id !== currentPersona) setPersona(p.id, { toast: true });
      });
      menu.appendChild(opt);
    });
  }

  function initPersonaSwitcher() {
    const pill = document.getElementById('personaPill');
    const menu = document.getElementById('personaMenu');
    renderPersonaPill();
    pill.addEventListener('click', e => {
      e.stopPropagation();
      buildPersonaMenu();
      // anchor the menu under the pill
      const r = pill.getBoundingClientRect();
      menu.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
      menu.classList.toggle('open');
    });
    document.addEventListener('click', e => {
      if (!menu.contains(e.target) && e.target !== pill) menu.classList.remove('open');
    });
  }

  /* ================= Theme ================= */
  function initTheme() {
    const saved = localStorage.getItem('scr-theme');
    if (saved) document.body.setAttribute('data-theme', saved);
    const btn = document.getElementById('themeToggle');
    const meta = document.querySelector('meta[name="theme-color"]');
    const sync = () => {
      const dark = document.body.getAttribute('data-theme') === 'dark';
      btn.querySelector('.ic-moon').style.display = dark ? 'none' : 'block';
      btn.querySelector('.ic-sun').style.display = dark ? 'block' : 'none';
      if (meta) meta.setAttribute('content', dark ? '#000000' : '#f5f5f7');
    };
    sync();
    btn.addEventListener('click', () => {
      const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', next);
      localStorage.setItem('scr-theme', next);
      sync();
      SCR.charts.rerenderAll();
    });
  }

  /* ================= Notifications ================= */
  function initNotifications() {
    const panel = document.getElementById('notifPanel');
    const sevColor = { critical: 'var(--status-critical)', high: 'var(--status-serious)', medium: 'var(--status-warning)' };
    function renderPanel() {
      panel.innerHTML = `
        <div class="notif-head">Alerts <span>ranked by impact × urgency</span></div>
        <div class="notif-summary ai-ring">
          <div class="ns-head"><span class="ai-mark">${SCR.ui.SPARK}</span>Summary · Resilience Intelligence</div>
          ${SCR.brief.notificationSummary()}
        </div>
        <div class="notif-list">${SCR.data.notifications.map(n => `
          <div class="notif-item">
            <span class="n-dot" style="background:${sevColor[n.sev] || 'var(--ink-3)'}"></span>
            <div class="n-body">${n.text}<span class="n-time">${n.time} UTC</span></div>
          </div>`).join('')}
        </div>`;
    }
    renderPanel();
    const btn = document.getElementById('notifBtn');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (!panel.classList.contains('open')) renderPanel();
      panel.classList.toggle('open');
      document.getElementById('notifDot').style.display = 'none';
    });
    document.addEventListener('click', e => {
      if (!panel.contains(e.target)) panel.classList.remove('open');
    });
  }

  /* ================= Global search ================= */
  function initSearch() {
    const input = document.getElementById('globalSearch');
    const results = document.getElementById('searchResults');
    let hits = [], kb = -1;
    const QUESTION = /^(what|why|how|which|who|where|when|is|are|can|should|show|top|compare|simulate|draft|create|list|explain|summari[sz]e)\b|\?$/;
    function highlight(i) {
      const rows = results.querySelectorAll('.search-hit');
      kb = Math.max(-1, Math.min(rows.length - 1, i));
      rows.forEach((r, j) => r.classList.toggle('kb', j === kb));
      if (rows[kb]) rows[kb].scrollIntoView({ block: 'nearest' });
    }
    function run(raw) {
      const q = raw.trim().toLowerCase();
      if (q.length < 2) { results.classList.remove('open'); return; }
      hits = [];
      SCR.data.products.forEach(p => {
        if ((p.name + p.brand + p.stream).toLowerCase().includes(q))
          hits.push({ type: 'Product', label: p.name, sub: p.sectorName + ' · ' + p.stream, go: () => SCR.ui.openProduct(p.id) });
      });
      SCR.data.suppliers.forEach(s => {
        if ((s.name + s.city + s.country).toLowerCase().includes(q))
          hits.push({ type: 'Supplier', label: s.name, sub: s.city + ', ' + s.country, go: () => SCR.ui.openSupplier(s.id) });
      });
      SCR.data.materials.forEach(m => {
        if ((m.name + m.sub).toLowerCase().includes(q))
          hits.push({ type: 'Material', label: m.name, sub: m.sub, go: () => SCR.ui.openMaterial(m.id) });
      });
      SCR.data.plants.concat(SCR.data.dcs).forEach(s => {
        if (s.name.toLowerCase().includes(q))
          hits.push({ type: 'Site', label: s.name, sub: s.focus || s.region, go: () => SCR.ui.openSite(s.id) });
      });
      SCR.data.alerts.forEach(a => {
        if ((a.title + a.type).toLowerCase().includes(q))
          hits.push({ type: 'Alert', label: a.title, sub: a.type, go: () => SCR.ui.openAlert(a.id) });
      });
      hits = hits.slice(0, 8);
      // anything can be asked: questions go to the copilot first, names still list
      const askHit = { type: 'Ask', label: raw.trim(), sub: 'Ask Resilience Copilot', go: () => SCR.copilot.ask(raw.trim(), { open: true }), ask: true };
      if (QUESTION.test(q) || !hits.length) hits.unshift(askHit); else hits.push(askHit);
      results.innerHTML = hits.map((h, i) =>
        `<button class="search-hit ${h.ask ? 'search-ask' : ''}" data-i="${i}"><span class="hit-type">${h.ask ? '✦ Ask' : h.type}</span><span>${SCR.ui.esc(h.label)}<span class="cell-sub">${SCR.ui.esc(h.sub)}</span></span></button>`
      ).join('');
      results.querySelectorAll('.search-hit').forEach((b, i) => {
        b.addEventListener('click', () => choose(i));
      });
      results.classList.add('open');
      highlight(0);
    }
    function choose(i) {
      const h = hits[i];
      if (!h) return;
      h.go();
      results.classList.remove('open');
      input.value = '';
      input.blur();
    }
    input.addEventListener('input', () => run(input.value));
    input.addEventListener('focus', () => run(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight(kb + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(kb - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(kb < 0 ? 0 : kb); }
      else if (e.key === 'Escape') { results.classList.remove('open'); input.blur(); }
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.global-search')) results.classList.remove('open');
    });
  }

  /* ================= Overlays ================= */
  function initOverlays() {
    document.getElementById('drawerClose').addEventListener('click', SCR.ui.closeDrawer);
    document.getElementById('drawerScrim').addEventListener('click', SCR.ui.closeDrawer);
    document.getElementById('modalClose').addEventListener('click', SCR.ui.closeModal);
    document.getElementById('modalScrim').addEventListener('click', e => {
      if (e.target === document.getElementById('modalScrim')) SCR.ui.closeModal();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        SCR.ui.closeDrawer(); SCR.ui.closeModal(); SCR.copilot && SCR.copilot.close();
        ['personaMenu', 'notifPanel', 'searchResults'].forEach(id => document.getElementById(id).classList.remove('open'));
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); SCR.copilot && SCR.copilot.toggle(); }
      const typing = /^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
      if (e.key === '/' && !typing) { e.preventDefault(); document.getElementById('globalSearch').focus(); }
    });
  }

  /* ================= Boot ================= */
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initPersonaSwitcher();
    initNotifications();
    initSearch();
    initOverlays();
    initSideToggle();
    if (SCR.copilot && SCR.copilot.init) SCR.copilot.init();
    setPersona(currentPersona);
  });
})();
