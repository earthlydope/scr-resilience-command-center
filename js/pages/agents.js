/* ============================================================
   SCR · pages/agents.js
   Recommendations — the agentic layer's output. Approval queue
   for agent recommendations · full activity feed (rows open the
   agent's 360° drawer) · daily digest generator.
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  'use strict';

  /* What each agent watches, and the moves it can hand off. */
  const AGENT_DETAIL = {
    sensing: {
      watches: 'External risk feeds (weather, geopolitical, financial, cyber, labour, logistics) plus every node threshold. Matches signals to the graph, scores severity and escalates breaches to the owning persona.',
      actions: [
        { label: 'Open Alerts inbox', go: () => SCR.navigate('actions') },
        { label: 'Open Network Explorer', go: () => SCR.navigate('network') }
      ]
    },
    impact: {
      watches: 'Recomputes VAR / AVAR whenever inventory, demand, BOM or a node score moves, and traces the product → market path so exposure is always attributed to real revenue.',
      actions: [
        { label: 'Open Executive Summary', go: () => SCR.navigate('executive') },
        { label: 'Open Value Streams', go: () => SCR.navigate('valuestream') }
      ]
    },
    inventory: {
      watches: 'Tracks inventory cover (TTS) against recovery time (TTR) on every component, flags TTR > TTS the moment it appears and raises cover alerts before a safety floor is breached.',
      actions: [
        { label: 'Open Site Resilience', go: () => SCR.navigate('site') },
        { label: 'Open Data Quality', go: () => SCR.navigate('quality') }
      ]
    },
    mitigation: {
      watches: 'Ranks mitigation options by cost, time-to-effect and residual-risk reduction, then proposes the best plan for each open risk. Approving one hands off to Execution & Workflow.',
      actions: [
        { label: 'Review pending recommendations', go: () => { SCR.ui.closeDrawer(); const c = document.getElementById('agQueue'); SCR.ui.scrollToCard(c); } },
        { label: 'Open Scenario Studio', go: () => SCR.navigate('scenario') }
      ]
    },
    workflow: {
      watches: 'Turns approved actions into tickets, POs, contract changes and notifications across 7 connected systems, then re-scores RRE once the action lands.',
      actions: [
        { label: 'Open action tracker', go: () => SCR.navigate('actions') }
      ]
    },
    scenario: {
      watches: 'Runs node-failure simulations on the digital twin before disruption hits — impacted SKUs, revised value at risk and the cheapest recovery plan — and stores the winners as continuity playbooks.',
      actions: [
        { label: 'Open Scenario Studio', go: () => SCR.navigate('scenario') },
        { label: 'Open Network Explorer', go: () => SCR.navigate('network') }
      ]
    }
  };

  function openAgent(a) {
    const D = SCR.data, F = SCR.fmt, U = SCR.ui;
    const det = AGENT_DETAIL[a.key] || { watches: a.role, actions: [] };
    const acts = D.feed.filter(f => f.agent === a.key);
    U.openDrawer('AI agent · live', a.name, body => {
      body.innerHTML = `
        <div class="drawer-section">
          <div class="flex aic gap8" style="margin-bottom:12px">
            <span class="agent-status"><span class="pulse"></span>LIVE</span>
            <span class="muted" style="font-size:13px">${U.esc(a.role)}</span>
          </div>
          <div class="facts">
            ${a.stats.map(([l, v]) => `<div class="fact"><div class="f-label">${U.esc(l)}</div><div class="f-value">${typeof v === 'number' && v % 1 !== 0 ? v.toFixed(1) : F.num(v)}</div></div>`).join('')}
          </div>
        </div>
        <div class="drawer-section">
          <h3>What this agent does</h3>
          <div class="sim-out-note">${U.esc(det.watches)}</div>
        </div>
        <div class="drawer-section">
          <h3>Recent activity</h3>
          ${acts.length ? `<div class="feed">${acts.map(f => `<div class="feed-item">
            <span style="width:9px;height:9px;border-radius:50%;background:var(--series-${a.color});flex-shrink:0;margin-top:6px"></span>
            <div class="feed-body"><div class="f-text">${f.text}</div></div>
            <span class="feed-time">${U.esc(f.time)} UTC</span>
          </div>`).join('')}</div>` : '<div class="muted" style="font-size:14.5px">No activity in the last 3 hours.</div>'}
        </div>
        <div class="drawer-section">
          <h3>Jump to</h3>
          <div class="flex gap8" style="flex-wrap:wrap" id="agActs"></div>
        </div>`;
      const wrap = body.querySelector('#agActs');
      det.actions.forEach((ac, i) => {
        const b = U.el(`<button class="btn btn-sm ${i === 0 ? 'btn-primary' : ''}">${U.esc(ac.label)}</button>`);
        b.addEventListener('click', () => { if (ac.go) ac.go(); });
        wrap.appendChild(b);
      });
    });
  }

  function openDigest() {
    const D = SCR.data, F = SCR.fmt, esc = SCR.ui.esc;
    const pending = D.recommendations.filter(r => r.status === 'pending');
    const h4 = 'font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin:15px 0 6px';
    SCR.ui.modal('Daily resilience digest — ' + D.asOf, `
      <div style="font-size:15px;line-height:1.62;color:var(--ink-2)">
        <p style="margin:0">Overnight, the sensing layer processed <strong>231 signals</strong>, matched 42 to network
        nodes and escalated 6. The twin recomputed AVAR on ${F.usdM(52.7)} of exposure and ran 11 scenarios.</p>
        <h4 style="${h4}">Needs a human decision</h4>
        <ul style="margin:0;padding-left:18px">
          ${pending.map(r => `<li style="margin:3px 0"><strong style="color:var(--ink)">${esc(r.title)}</strong>
            — protects ${F.usdM(r.exposure)} · ${esc(r.cost)} · approvers: ${esc(r.approvers)}</li>`).join('')}
        </ul>
        <h4 style="${h4}">What changed since yesterday</h4>
        <ul style="margin:0;padding-left:18px">
          <li>Closures cover at Pune recalculated 7d → <strong>6d</strong> (AL-301)</li>
          <li>Indonesia levy probability raised 35% → <strong>55%</strong></li>
          <li>Program G3 (enzyme buffer) build phase reached <strong>58%</strong></li>
          <li>OJ concentrate breached its 20-day safety floor — expedite overdue</li>
        </ul>
        <h4 style="${h4}">Agent health</h4>
        <p style="margin:0">All 6 agents nominal. 7 connected systems · last full graph rebuild 05:00 UTC · weekly recalc complete.</p>
      </div>`);
  }

  function render(host) {
    const D = SCR.data, F = SCR.fmt, U = SCR.ui;

    const grid = U.el('<div class="grid grid-12"></div>');
    host.appendChild(grid);

    /* ===== Approval queue ===== */
    const queueCard = U.card({
      title: 'Recommendations awaiting approval',
      sub: 'proposed by the Mitigation Strategist Agent · approving hands off to Execution & Workflow',
      cols: 7,
      insight: () => {
        const q = (D.recommendations || []).filter(r => r.status === 'pending');
        const byExp = q.slice().sort((a, b) => (b.exposure || 0) - (a.exposure || 0));
        return {
          agent: 'Mitigation Strategist Agent',
          reads: [
            { label: 'Awaiting approval', value: q.length },
            { label: 'Exposure addressed', value: F.usdM(+q.reduce((a, r) => a + (r.exposure || 0), 0).toFixed(1)), tone: 'bad' },
            { label: 'Actions in flight', value: D.kpis.openActions }
          ],
          points: [
            `${q.length} recommendation${q.length === 1 ? '' : 's'} ${q.length === 1 ? 'is' : 'are'} queued, together addressing ${F.usdM(+q.reduce((a, r) => a + (r.exposure || 0), 0).toFixed(1))} of exposure. Each was generated from a specific alert, so approving one creates a tracked action rather than a note.`,
            byExp.length ? `Largest by exposure is <strong>${U.esc(byExp[0].title)}</strong> — ${U.esc(byExp[0].riskCut)} for ${U.esc(byExp[0].cost)}.` : 'The queue is empty — every recommendation has been actioned.',
            'Approval hands off to the Execution & Workflow Agent, which is what puts it on the tracker with an owner and a due date.'
          ],
          actions: [{ label: 'Open Alerts & Actions', onClick: () => SCR.navigate('actions') }]
        };
      }
    });
    queueCard.id = 'agQueue';
    grid.appendChild(queueCard);
    const qBody = queueCard.querySelector('.card-body');
    function renderQueue() {
      qBody.innerHTML = '';
      D.recommendations.forEach(r => {
        const node = U.el(`<div class="reco ${r.status !== 'pending' ? 'done' : ''} ${r.fresh && r.status === 'pending' ? 'new' : ''}">
          <div class="reco-head">
            <span class="reco-title">${U.esc(r.title)}</span>
            <span class="badge neutral plain" style="cursor:pointer" data-alert="${U.esc(r.linked)}">${U.esc(r.linked)}</span>
          </div>
          <div style="font-size:14px;color:var(--ink-3);margin-top:4px">${U.esc(r.detail)}</div>
          <div class="reco-meta">
            <span class="rm">Protects<strong>${F.usdM(r.exposure)}</strong></span>
            <span class="rm">Risk cut<strong class="good">${U.esc(r.riskCut)}</strong></span>
            <span class="rm">Cost<strong>${U.esc(r.cost)}</strong></span>
            <span class="rm">Approvers<strong style="font-size:13px">${U.esc(r.approvers)}</strong></span>
          </div>
          <div class="reco-actions">
            ${r.status === 'pending'
              ? '<button class="btn btn-sm btn-good" data-op="approve">Approve</button><button class="btn btn-sm btn-ghost" data-op="dismiss">Dismiss</button>'
              : r.status === 'approved'
                ? `<span class="approved-tag">✓ Approved — ${r.actionId ? U.esc(r.actionId) + ' is on the tracker' : 'execution ticket created'}</span>`
                : '<span class="dismissed-tag">Dismissed</span>'}
          </div>
        </div>`);
        const linkBadge = node.querySelector('[data-alert]');
        if (linkBadge) linkBadge.addEventListener('click', e => { e.stopPropagation(); U.openAlert(linkBadge.dataset.alert); });
        node.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => {
          if (b.dataset.op === 'approve') {
            const act = SCR.work.approve(r);
            U.toast('Recommendation approved',
              `Execution & Workflow Agent opened <strong>${U.esc(act ? act.id : r.id)}</strong> on the tracker, notified approvers and scheduled the RRE re-score.`, 'good',
              { label: 'View in tracker', run: () => SCR.work.goToTracker() });
          } else {
            r.status = 'dismissed';
            U.toast('Recommendation dismissed', `${r.id} archived with your rationale requested.`, '');
          }
          if (qBody.isConnected) renderQueue(); // approval re-renders the page itself
        }));
        qBody.appendChild(node);
      });
    }
    renderQueue();

    /* ===== Live feed ===== */
    const btnDigest = U.el('<button class="btn btn-sm btn-primary">Generate daily digest</button>');
    btnDigest.addEventListener('click', openDigest);
    const feedCard = U.card({
      title: 'Agent activity — last 3 hours', sub: 'what the layer sensed, computed and executed · click a row to open its agent',
      cols: 5, actions: [btnDigest],
      insight: () => {
        const feed = D.feed || [];
        const byAgent = {};
        const nameOf = k => { const a = (D.agents || []).find(x => x.key === k); return a ? a.name : k; };
        feed.forEach(f => { const n = nameOf(f.agent); byAgent[n] = (byAgent[n] || 0) + 1; });
        const busiest = Object.entries(byAgent).sort((a, b) => b[1] - a[1])[0];
        return {
          agent: 'Resilience Copilot',
          reads: [
            { label: 'Events (3h)', value: feed.length },
            { label: 'Agents active', value: Object.keys(byAgent).length },
            { label: 'Busiest', value: busiest ? busiest[1] + ' events' : '—' }
          ],
          points: [
            `${feed.length} events in the last three hours across ${Object.keys(byAgent).length} agents — this is the attribution trail behind every alert and recommendation in the product.`,
            busiest ? `<strong>${U.esc(busiest[0])}</strong> is most active with ${busiest[1]} events, which usually signals where conditions are changing fastest.` : '',
            'Selecting any row opens that agent, with its live stats, what it watches and where to act on it.'
          ].filter(Boolean),
          actions: [{ label: 'Back to Executive Summary', onClick: () => SCR.navigate('executive') }]
        };
      }
    });
    grid.appendChild(feedCard);
    const feedWrap = U.el('<div class="feed"></div>');
    D.feed.forEach(f => {
      const a = D.agents.find(x => x.key === f.agent) || { name: f.agent, color: 1 };
      const item = U.el(`<div class="feed-item ${f.fresh ? 'fresh' : ''}" style="cursor:pointer">
        <span style="width:9px;height:9px;border-radius:50%;background:var(--series-${a.color});flex-shrink:0;margin-top:6px"></span>
        <div class="feed-body">
          <span class="f-agent" style="color:var(--series-${a.color})">${U.esc(a.name)}</span>
          <div class="f-text">${f.text}</div>
        </div>
        <span class="feed-time">${U.esc(f.time)} UTC</span>
      </div>`);
      if (AGENT_DETAIL[f.agent]) item.addEventListener('click', () => openAgent(a));
      feedWrap.appendChild(item);
    });
    feedCard.querySelector('.card-body').appendChild(feedWrap);
  }

  SCR.registerPage('agents', {
    title: 'Recommendations',
    render
  });
})();
