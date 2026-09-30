/* ============================================================
   SCR · pages/actions.js
   Alerts & Actions — exception management and mitigation
   tracking. Alert inbox with acknowledge / assign / snooze ·
   mitigation pipeline funnel · resilience program Gantt ·
   action tracker with RRE before/after.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
  const state = { sevFilter: 'all' };

  function render(host) {
    const D = SCR.data, F = SCR.fmt, U = SCR.ui;

    /* ===== KPI strip ===== */
    const open = D.alerts.filter(a => a.status !== 'closed');
    const openExposure = +open.reduce((a, x) => a + x.exposure, 0).toFixed(1);
    // Assigned once the inbox exists; a KPI click can then re-filter it, not
    // merely scroll past it.
    let setSev = () => {};
    /* Every tile lands on the card that answers it and says why it landed there. */
    const goTo = (id, title, body) => () => {
      U.scrollToCard(document.getElementById(id));
      U.toast(title, body, '');
    };
    const goSev = (sev, title, body) => () => {
      setSev(sev);
      U.scrollToCard(document.getElementById('actInbox'));
      U.toast(title, body, '');
    };
    host.appendChild(U.kpiStrip([
      {
        icon: 'risk', color: 5, label: 'Open alerts', value: open.length,
        sub: D.kpis.criticalAlerts + ' critical', subClass: 'bad',
        onClick: goSev('all', 'All open alerts', `Inbox filtered to <strong>All</strong> — ${open.length} unresolved exceptions, most severe and highest exposure first.`),
        subOnClick: () => goSev('critical', 'Critical alerts only',
          `Inbox filtered to <strong>Critical</strong> — ${D.kpis.criticalAlerts} alerts where a node is already failing or will inside its TTS.`)(),
        subTitle: 'Filter the inbox to critical alerts only'
      },
      {
        icon: 'dollar', color: 3, label: 'Exposure across open alerts', value: F.usdM(openExposure), sub: 'VAR linked',
        onClick: goTo('actInbox', 'Exposure across open alerts',
          `${F.usdM(openExposure)} is the summed VAR of the nodes named in the ${open.length} open alerts — the sales at risk if none are actioned.`)
      },
      {
        icon: 'gap', color: 1, label: 'Actions in flight', value: D.kpis.openActions,
        sub: D.kpis.overdueActions + ' overdue', subClass: D.kpis.overdueActions ? 'bad' : 'good',
        onClick: goTo('actTrack', 'Action tracker', `${D.kpis.openActions} mitigations are in flight, each showing residual risk before and after it lands.`),
        subOnClick: () => goTo('actTrack', 'Overdue actions',
          `${D.kpis.overdueActions} action${D.kpis.overdueActions === 1 ? ' is' : 's are'} past due — shown in red in the Due column below.`)(),
        subTitle: 'Jump to the tracker and highlight overdue work'
      },
      {
        icon: 'gauge', color: 2, label: 'AVAR mitigated YTD', value: F.usdM(D.kpis.mitigatedYtd), sub: '66 actions executed', subClass: 'good',
        onClick: goTo('actGantt', 'AVAR mitigated YTD', `${F.usdM(D.kpis.mitigatedYtd)} of adjusted value at risk retired so far this year — the programs below are what delivered it.`)
      },
      {
        icon: 'globe', color: 0, label: 'Mean detection lead', value: D.kpis.detectionLeadDays + 'd', sub: 'signal → alert',
        onClick: goTo('actFunnel', 'Detection lead time', `${D.kpis.detectionLeadDays} days is the average gap between a signal arriving and an alert being raised — the funnel below shows where signals drop out.`)
      }
    ]));

    const grid = U.el('<div class="grid grid-12"></div>');
    host.appendChild(grid);

    /* ===== Alert inbox ===== */
    const segSev = U.el(`<div class="seg">
      <button data-s="all" class="${state.sevFilter === 'all' ? 'active' : ''}">All</button>
      <button data-s="critical" class="${state.sevFilter === 'critical' ? 'active' : ''}">Critical</button>
      <button data-s="high" class="${state.sevFilter === 'high' ? 'active' : ''}">High</button>
      <button data-s="medium" class="${state.sevFilter === 'medium' ? 'active' : ''}">Med / Low</button>
    </div>`);
    const inboxCard = U.card({
      title: 'Alert inbox', sub: 'persona-routed exceptions · acknowledge, assign or snooze',
      cols: 7, actions: [segSev],
      insight: () => {
        const openA = D.alerts.filter(a => a.status !== 'closed');
        const crit = openA.filter(a => a.sev === 'critical');
        const byType = {};
        openA.forEach(a => { byType[a.type] = (byType[a.type] || 0) + 1; });
        const domType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
        const top = openA.slice().sort((a, b) => b.exposure - a.exposure)[0];
        return {
          agent: 'Network Sensing Agent',
          reads: [
            { label: 'Open', value: openA.length },
            { label: 'Critical', value: crit.length, tone: crit.length ? 'bad' : 'good' },
            { label: 'Exposure', value: F.usdM(+openA.reduce((a, x) => a + x.exposure, 0).toFixed(1)), tone: 'bad' }
          ],
          points: [
            `${openA.length} exceptions are unresolved and routed to owners by persona, so each one already has someone accountable rather than sitting in a shared queue.`,
            domType ? `Most common driver right now is <strong>${U.esc(domType[0])}</strong> (${domType[1]} alert${domType[1] === 1 ? '' : 's'}) — a cluster in one type usually means a systemic cause rather than bad luck.` : '',
            top ? `Highest exposure is <strong>${U.esc(top.title)}</strong> at ${F.usdM(top.exposure)}, owned by ${U.esc(top.owner)}.` : ''
          ].filter(Boolean),
          actions: [
            { label: 'Show critical only', onClick: () => setSev('critical') },
            top ? { label: 'Open ' + top.id, onClick: () => U.openAlert(top.id) } : null
          ].filter(Boolean)
        };
      }
    });
    inboxCard.id = 'actInbox';
    grid.appendChild(inboxCard);
    const inboxBody = inboxCard.querySelector('.card-body');

    const sevColor = { critical: 'var(--status-critical)', high: 'var(--status-serious)', medium: 'var(--status-warning)', low: 'var(--ink-3)' };

    function renderInbox() {
      const rows = D.alerts
        .filter(a => state.sevFilter === 'all' ? true : state.sevFilter === 'medium' ? (a.sev === 'medium' || a.sev === 'low') : a.sev === state.sevFilter)
        .slice().sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || sevRank[a.sev] - sevRank[b.sev] || b.exposure - a.exposure);
      inboxBody.innerHTML = '';
      rows.forEach(a => {
        const row = U.el(`<div class="alert-row ${a.status === 'closed' ? 'closed' : ''}">
          <span class="a-sev" style="background:${sevColor[a.sev]}"></span>
          <div class="a-main">
            <div class="a-title" style="cursor:pointer">${U.esc(a.title)}</div>
            <div class="a-sub">${U.esc(a.type)} · ${U.esc(a.owner)} · ${U.esc(a.time)}${a.exposure ? ' · ' + F.usdM(a.exposure) + ' exposure' : ''}</div>
          </div>
          <div class="a-side">
            ${U.statusBadge(a.status)}
            <div class="flex gap8">
              ${a.status === 'open' ? `<button class="btn btn-sm" data-op="ack">Acknowledge</button>
              <button class="btn btn-sm btn-primary" data-op="assign">Assign</button>` :
              a.status !== 'closed' ? `<button class="btn btn-sm btn-good" data-op="close">Close</button>` : ''}
            </div>
          </div>
        </div>`);
        row.querySelector('.a-title').addEventListener('click', () => U.openAlert(a.id));
        row.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => {
          const op = b.dataset.op;
          if (op === 'ack') { a.status = 'ack'; U.toast('Alert acknowledged', `${a.id} marked as acknowledged.`, ''); }
          if (op === 'assign') { a.status = 'assigned'; U.toast('Alert assigned', `${a.id} routed to <strong>${U.esc(a.owner)}</strong> with a draft action attached.`, 'good'); }
          if (op === 'close') { a.status = 'closed'; U.toast('Alert closed', `${a.id} closed with resolution note.`, 'good'); }
          renderInbox();
        }));
        inboxBody.appendChild(row);
      });
      if (!rows.length) inboxBody.innerHTML = '<div class="empty">No alerts in this bucket.</div>';
    }
    renderInbox();
    segSev.querySelectorAll('button').forEach(b => b.addEventListener('click', () => setSev(b.dataset.s)));
    // Now that the inbox exists, the KPI tiles above can drive its filter.
    setSev = sev => {
      state.sevFilter = sev;
      segSev.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.dataset.s === sev));
      renderInbox();
    };

    /* ===== Funnel ===== */
    const funnelCard = U.card({
      title: 'Mitigation pipeline', sub: 'FY26 YTD — from sensed signal to executed action',
      cols: 5, chartClass: 'chart-lg',
      insight: () => {
        const f = D.funnel || [];
        const first = f[0], last = f[f.length - 1];
        let worstDrop = null;
        for (let i = 1; i < f.length; i++) {
          const d = f[i - 1].value - f[i].value;
          if (!worstDrop || d > worstDrop.d) worstDrop = { d, from: f[i - 1], to: f[i] };
        }
        return {
          agent: 'Execution & Workflow Agent',
          reads: [
            { label: 'Signals sensed', value: first ? first.value : '—' },
            { label: 'Actions executed', value: last ? last.value : '—', tone: 'good' },
            { label: 'Conversion', value: first && last ? ((last.value / first.value) * 100).toFixed(0) + '%' : '—' }
          ],
          points: [
            first && last ? `${first.value} signals were sensed year to date and ${last.value} became executed actions — a ${((last.value / first.value) * 100).toFixed(0)}% conversion.` : 'No funnel data.',
            worstDrop ? `The biggest fall-off is <strong>${U.esc(worstDrop.from.stage)} → ${U.esc(worstDrop.to.stage)}</strong>, losing ${worstDrop.d}. That stage is where the pipeline actually leaks.` : '',
            'Narrowing is expected and healthy — not every signal deserves an action. What matters is whether the drop happens at triage or at execution.'
          ].filter(Boolean),
          actions: [{ label: 'Open the tracker', onClick: () => U.scrollToCard(document.getElementById('actTrack')) }]
        };
      }
    });
    funnelCard.id = 'actFunnel';
    grid.appendChild(funnelCard);
    /* Let the funnel absorb whatever height the inbox column sets,
       so the card never shows dead space below its content. */
    const funnelBody = funnelCard.querySelector('.card-body');
    funnelBody.style.display = 'flex';
    funnelBody.style.flexDirection = 'column';
    funnelCard._chartEl.style.cssText = 'flex:1;height:auto;min-height:370px';
    SCR.charts.mount(funnelCard._chartEl, () => {
      const t = SCR.theme.tokens();
      const ord = t.ordinal;
      return Object.assign(SCR.theme.baseOption(), {
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, {
          formatter: p => {
            const first = D.funnel[0].value;
            return `<strong>${p.name}</strong><br/>${F.num(p.value)} · ${(p.value / first * 100).toFixed(1)}% of signals`;
          }
        }),
        legend: { show: false },
        series: [{
          type: 'funnel',
          left: 0, right: 148, top: 8, bottom: 8,
          sort: 'descending', gap: 3,
          minSize: '12%',
          label: { color: t.ink, fontSize: 13, formatter: p => `${p.name}  ·  ${F.num(p.value)}` },
          labelLine: { lineStyle: { color: t.axis } },
          itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 4 },
          data: D.funnel.map((f, i) => ({
            name: f.stage, value: f.value,
            itemStyle: { color: ord[Math.min(i, ord.length - 1)] }
          }))
        }]
      });
    });

    /* Pipeline health — conversion facts, stage-to-stage rates and
       the approval hand-off, filling the column under the funnel. */
    const fn = D.funnel;
    const stageConv = fn.slice(1).map((s, i) => ({
      label: `${fn[i].stage} → ${s.stage}`,
      counts: `${F.num(fn[i].value)} → ${F.num(s.value)}`,
      pct: Math.round(s.value / fn[i].value * 100)
    }));
    const pending = D.recommendations.filter(r => r.status === 'pending');
    const pendingExposure = pending.reduce((a, r) => a + r.exposure, 0);
    const health = U.el(`<div style="margin-top:4px">
      <div class="facts">
        <div class="fact"><div class="f-label">Signal → executed</div><div class="f-value">${(fn[fn.length - 1].value / fn[0].value * 100).toFixed(1)}%</div></div>
        <div class="fact"><div class="f-label">Approved, in execution</div><div class="f-value">${F.num(fn[fn.length - 2].value - fn[fn.length - 1].value)}</div></div>
        <div class="fact"><div class="f-label">AVAR mitigated YTD</div><div class="f-value">${F.usdM(D.kpis.mitigatedYtd)}</div></div>
      </div>
      <div style="font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);font-weight:600;margin:16px 0 4px">Stage conversion</div>
      ${stageConv.map(c => `<div class="flex aic gap12" style="margin:8px 0">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${U.esc(c.label)}</div>
          <div style="font-size:12px;color:var(--ink-3)">${c.counts}</div>
        </div>
        <span class="meter" style="width:150px">
          <span class="meter-track"><span class="meter-fill" style="width:${c.pct}%;background:var(--accent)"></span></span>
          <span class="meter-val">${c.pct}%</span>
        </span>
      </div>`).join('')}
      <div class="flex aic gap8" style="margin-top:14px;padding:11px 13px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)">
        <div style="flex:1;font-size:14px;color:var(--ink-2)"><strong style="color:var(--ink)">${pending.length} proposals awaiting approval</strong> — protects ${F.usdM(pendingExposure)} if executed</div>
        <button class="btn btn-sm btn-primary">Review</button>
      </div>
    </div>`);
    health.style.flexShrink = '0';
    health.querySelector('.btn').addEventListener('click', () => SCR.navigate('agents'));
    funnelBody.appendChild(health);

    /* ===== Gantt ===== */
    grid.appendChild(U.el('<div class="section-title col-12">Resilience programs</div>'));
    const ganttCard = U.card({
      title: 'Program timeline', sub: 'assessment → design → build → testing → rollout · dashed line = today',
      cols: 12, chartClass: 'chart-md',
      insight: () => ({
        agent: 'Execution & Workflow Agent',
        reads: [
          { label: 'Programs', value: (D.gantt || []).length },
          { label: 'AVAR mitigated YTD', value: F.usdM(D.kpis.mitigatedYtd), tone: 'good' },
          { label: 'Actions in flight', value: D.kpis.openActions }
        ],
        points: [
          'Each bar is a resilience program with its phase breakdown; the dashed line is today, so anything to its left that is not complete is genuinely behind rather than merely planned.',
          `These programs are what delivered the ${F.usdM(D.kpis.mitigatedYtd)} reduction shown as the bridge\u2019s mitigated step on the Executive Summary.`,
          'Programs overlapping the same phase window compete for the same qualification and testing capacity — a practical constraint the bridge does not show.'
        ],
        actions: [{ label: 'See the AVAR bridge', onClick: () => SCR.navigate('executive') }]
      })
    });
    ganttCard.id = 'actGantt';
    grid.appendChild(ganttCard);
    SCR.charts.gantt(ganttCard._chartEl, D.gantt);

    /* ===== Action tracker ===== */
    const trackCard = U.card({
      title: 'Mitigation action tracker', sub: 'owner, due date, expected AVAR reduction and residual risk before/after',
      cols: 12, flush: true,
      insight: () => {
        const acts = D.actions || [];
        const overdue = acts.filter(a => a.status === 'Overdue');
        const byBenefit = acts.slice().sort((a, b) => (b.riskCut || 0) - (a.riskCut || 0));
        return {
          agent: 'Execution & Workflow Agent',
          reads: [
            { label: 'Actions tracked', value: acts.length },
            { label: 'Overdue', value: overdue.length, tone: overdue.length ? 'bad' : 'good' },
            { label: 'AVAR they remove', value: F.usdM(+acts.reduce((a, x) => a + (x.riskCut || 0), 0).toFixed(1)), tone: 'good' }
          ],
          points: [
            `${acts.length} actions are tracked with residual risk before and after, so each one can be judged on risk removed rather than on activity.`,
            overdue.length ? `${overdue.length} ${overdue.length === 1 ? 'is' : 'are'} past due: ${overdue.slice(0, 3).map(a => U.esc(a.id)).join(', ')} — shown in red in the Due column.` : 'Nothing is currently overdue.',
            byBenefit.length ? `Largest single reduction on the books is <strong>${U.esc(byBenefit[0].title || byBenefit[0].id)}</strong> at ${F.usdM(byBenefit[0].riskCut || 0)}.` : ''
          ].filter(Boolean),
          actions: [{ label: 'Open Recommendations', onClick: () => SCR.navigate('agents') }]
        };
      }
    });
    trackCard.id = 'actTrack';
    grid.appendChild(trackCard);
    trackCard.querySelector('.card-body').appendChild(U.table([
      { h: 'Action', cell: a => `<span class="cell-main">${U.esc(a.title)}</span><span class="cell-sub">${U.esc(a.id)} · linked ${U.esc(a.linked)}</span>` },
      { h: 'Type', cell: a => `<span class="badge neutral plain">${U.esc(a.type)}</span>` },
      { h: 'Owner', cell: a => U.esc(a.owner) },
      { h: 'Due', cell: a => `<span style="white-space:nowrap;${a.status === 'Overdue' ? 'color:var(--crit-text);font-weight:700' : ''}">${U.esc(a.due)}</span>` },
      { h: 'Cost', cls: 'num', cell: a => F.usdM(a.cost) },
      { h: 'AVAR cut', cls: 'num', cell: a => a.riskCut ? `<span style="color:var(--status-good);font-weight:700">−${F.usdM(a.riskCut)}</span>` : '–' },
      { h: 'RRE pre → post', cls: 'num', cell: a => a.rrePre != null ? `${a.rrePre.toFixed(2)} → <strong>${a.rrePost.toFixed(2)}</strong>` : '–' },
      { h: 'Status', cell: a => U.statusBadge(a.status) }
    ], D.actions, a => {
      const alert = D.alertById(a.linked);
      if (alert) U.openAlert(alert.id);
    }, { rowClass: a => a.fresh ? 'row-sel' : '' }));
  }

  SCR.registerPage('actions', {
    context: () => ({ scope: state.sevFilter === 'all' ? 'All alerts' : state.sevFilter + ' alerts', filters: Object.assign({}, state) }),
    title: 'Alerts & Actions',
    crumb: 'Exception management · mitigation portfolio',
    render
  });
})();
