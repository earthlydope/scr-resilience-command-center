/* ============================================================
   SCR · landing.js — the entry chooser.
   Two ways into the same command center (as in the HCCB hub):
   pick a role, then the mobile app or the web application. The
   previews, copy and links follow the chosen role, and a role
   map explains what each role does and where.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const D = () => SCR.data;
  const esc = s => SCR.ui.esc(s);
  const usd = v => SCR.fmt.usdM(v);
  const $ = id => document.getElementById(id);
  let pid = SCR.personas.stored();

  SCR.persona = { current: () => pid, get: () => SCR.personas.byId(pid), list: () => SCR.personas.list(), set: id => choose(id) };

  /** The headline each role sees first on its phone. */
  function headline(p) {
    const d = D(), k = d.kpis;
    if (p.id === 'rrl') return { label: 'Adjusted value at risk', value: usd(k.totalAVAR) };
    if (p.id === 'vsl') return { label: 'SKUs exposed', value: `${d.products.filter(x => x.gapMax > 0).length} of ${d.products.length}` };
    if (p.id === 'cat') return { label: 'Sole-sourced at risk', value: `${d.materials.filter(m => m.singleSource && m.score >= 2.8).length} materials` };
    const pt = d.plants.slice().sort((a, b) => a.ttsMin - b.ttsMin || b.criticalMats - a.criticalMats)[0];
    return { label: 'Runs out first', value: `${pt.name.split(',')[0]} · ${pt.ttsMin}d` };
  }

  const NAV = { executive: 'Executive Summary', valuestream: 'Value Streams', category: 'Category & Suppliers', site: 'Site Resilience' };

  function renderRoles() {
    $('lzRoles').innerHTML = SCR.personas.list().map(p => `
      <button type="button" class="lz-role ${p.id === pid ? 'on' : ''}" role="radio" aria-checked="${p.id === pid}" data-role="${p.id}" style="--av:${p.color}">
        <span class="lz-av">${esc(SCR.personas.initials(p.name))}</span>
        <span><b>${esc(p.name)}</b><small>${esc(p.tag)}</small></span>
      </button>`).join('');
    $('lzRoles').querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => choose(b.dataset.role)));
  }

  function renderDevices() {
    const p = SCR.personas.byId(pid);
    const h = headline(p);
    const items = SCR.brief.itemsFor(p.id);
    $('lzLens').innerHTML = `<span class="lz-av sm" style="--av:${p.color}">${esc(SCR.personas.initials(p.name))}</span>“${esc(p.lens)}”`;
    $('lzMobile').href = 'mobile.html?as=' + p.id;
    $('lzWeb').href = 'web.html?as=' + p.id;
    $('lzMobileText').textContent = p.mobile.focus;
    $('lzWebText').textContent = 'The full command center: ' + p.web.focus.charAt(0).toLowerCase() + p.web.focus.slice(1);
    $('lzMobileFeat').innerHTML = ['Today briefing', p.mobile.tab.label, 'Simulate', 'Ask Copilot'].map(f => `<span>${esc(f)}</span>`).join('');
    $('lzWebFeat').innerHTML = [NAV[p.home], 'Scenario Studio', 'Hover guide', 'AI insights'].map(f => `<span>${esc(f)}</span>`).join('');

    // mini phone: the role's Today
    $('lzPhone').innerHTML = `
      <div class="mp-island"></div>
      <div class="mp-bar"><span>9:41</span><i></i></div>
      <div class="mp-body">
        <small class="mp-date">FRIDAY 10 JULY</small>
        <div class="mp-title"><b>Today</b><span class="mp-av" style="--av:${p.color}">${esc(SCR.personas.initials(p.name))}</span></div>
        <div class="mp-hero" style="--tone:${p.color}"><span>${esc(h.label)}</span><b>${esc(h.value)}</b></div>
        <div class="mp-brief"><span class="mp-brief-h"><i></i>For you today</span>
          ${items.slice(0, 3).map((it, i) => `<div class="mp-item" style="--tone:${it.tone}"><em>${i + 1}</em><span><u>${esc(it.kicker)}</u><i class="w${70 - i * 12}"></i></span></div>`).join('')}
        </div>
      </div>
      <div class="mp-tabs">${['Today', p.mobile.tab.label, 'Alerts', 'Simulate', 'Ask'].map((t, i) => `<span class="${i === 0 ? 'on' : ''}"><i></i>${esc(t)}</span>`).join('')}</div>`;

    // mini browser: the role's cockpit
    $('lzBrowser').innerHTML = `
      <div class="mw-bar"><i class="dot r"></i><i class="dot y"></i><i class="dot g"></i><span>scr-resilience-command-center.vercel.app/web</span></div>
      <div class="mw-body">
        <div class="mw-side">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>
        <div class="mw-main">
          <div class="mw-head"><b>${esc(NAV[p.home])}</b><span class="mw-pill" style="--av:${p.color}">${esc(p.short)}</span></div>
          <div class="mw-grid">
            <div class="mw-tile brief"><span><i></i>For you today</span>${items.slice(0, 3).map((it, i) => `<em style="--tone:${it.tone}" class="w${80 - i * 14}"></em>`).join('')}</div>
            <div class="mw-tile"><span>${esc(h.label)}</span><b>${esc(h.value)}</b></div>
            <div class="mw-tile chart"><u style="height:46%"></u><u style="height:72%"></u><u style="height:58%"></u><u style="height:88%"></u><u style="height:64%"></u><u style="height:40%"></u></div>
          </div>
        </div>
      </div>`;

    document.querySelectorAll('.lz-role-card').forEach(c => c.classList.toggle('on', c.dataset.role === pid));
  }

  function renderRoleMap() {
    $('lzRoleMap').innerHTML = SCR.personas.list().map(p => `
      <article class="lz-role-card ${p.id === pid ? 'on' : ''}" data-role="${p.id}" style="--av:${p.color}">
        <div class="lz-rc-head"><span class="lz-av">${esc(SCR.personas.initials(p.name))}</span><span><b>${esc(p.name)}</b><small>${esc(p.tag)}</small></span></div>
        <p class="lz-rc-lens">${esc(p.lens)}</p>
        <ol>${p.tasks.map(t => `<li><b>${esc(t.t)}</b><span>${esc(t.d)}</span><em>${esc(t.where)}</em></li>`).join('')}</ol>
        <div class="lz-rc-go">
          <a href="mobile.html?as=${p.id}" data-pick="${p.id}">Open mobile</a>
          <a href="web.html?as=${p.id}" data-pick="${p.id}">Open web</a>
        </div>
      </article>`).join('');
    $('lzRoleMap').querySelectorAll('[data-pick]').forEach(a => a.addEventListener('click', () => SCR.personas.remember(a.dataset.pick)));
  }

  function choose(id) {
    pid = SCR.personas.byId(id).id;
    SCR.personas.remember(pid);
    renderRoles();
    renderDevices();
    if (SCR.guide) SCR.guide.refresh();
  }

  function stats() {
    const d = D(), k = d.kpis;
    $('lzStats').innerHTML = [
      [usd(k.totalNTS), 'Sales in scope'],
      [usd(k.totalAVAR), 'Adjusted value at risk'],
      [String(k.nodes), 'Nodes monitored'],
      [String((d.agents || []).length), 'AI agents on watch']
    ].map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  }

  function initTheme() {
    let t = null;
    try { t = localStorage.getItem('scr-theme'); } catch (_) { t = null; }
    if (t) document.body.setAttribute('data-theme', t);
    $('lzTheme').addEventListener('click', () => {
      const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', next);
      try { localStorage.setItem('scr-theme', next); } catch (_) { /* private mode */ }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    stats();
    renderRoles();
    renderRoleMap();
    renderDevices();
    SCR.guide.init({ mode: 'landing' });
  });
})();
