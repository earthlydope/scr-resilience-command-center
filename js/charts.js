/* ============================================================
   SCR · charts.js
   ECharts lifecycle (mount / resize / theme re-render) and
   builders for the non-trivial chart forms so every page
   renders them consistently: sparkline, waterfall, mekko,
   gantt, and the column+line combo (two aligned grids — the
   % line gets its own panel and axis, never a second y-axis
   on the same plot).
   ============================================================ */
window.SCR = window.SCR || {};

(function () {
  const registry = []; // { el, chart, factory }

  /* Shared finish applied to every option: plain (unstacked) bars get
     small, crisp caps. Anything a chart sets explicitly wins. */
  function polish(opt) {
    if (!opt || !opt.series) return opt;
    const yAxes = [].concat(opt.yAxis || []);
    const horizontal = yAxes.length > 0 && yAxes.every(a => a && a.type === 'category');
    [].concat(opt.series).forEach(sr => {
      if (!sr || sr.type !== 'bar' || sr.stack) return;
      sr.itemStyle = sr.itemStyle || {};
      if (sr.itemStyle.borderRadius == null) sr.itemStyle.borderRadius = horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0];
    });
    return opt;
  }

  /** Mount a chart. `factory()` returns an ECharts option — it is
      re-invoked on theme change so colors always match tokens. */
  function mount(el, factory) {
    if (!el) return null;
    const chart = echarts.init(el, null, { renderer: 'canvas' });
    chart.setOption(polish(factory()));
    const entry = { el, chart, factory };
    // A canvas keeps its last pixel size until told otherwise, so a container
    // change that isn't a window resize (sidebar collapse, layout reflow, zoom)
    // would leave it overflowing its card. Observing the box closes that class
    // instead of enumerating it. This cannot feed back: `el` is sized by layout
    // (width:100% + a fixed height class), so resizing the canvas inside it
    // never changes the box we observe. The size guard is belt-and-braces, and
    // also skips the initial delivery that fires on observe().
    if (typeof ResizeObserver !== 'undefined') {
      let lastW = Math.round(el.clientWidth), lastH = Math.round(el.clientHeight);
      entry.ro = new ResizeObserver(entries => {
        const box = entries && entries[0] && entries[0].contentRect;
        if (!box) return;
        const w = Math.round(box.width), h = Math.round(box.height);
        if (w === lastW && h === lastH) return;
        lastW = w; lastH = h;
        try { chart.resize(); } catch (_) {}
      });
      entry.ro.observe(el);
    }
    registry.push(entry);
    return chart;
  }

  function disposeAll() {
    registry.forEach(e => {
      try { if (e.ro) e.ro.disconnect(); } catch (_) {}
      try { e.chart.dispose(); } catch (_) {}
    });
    registry.length = 0;
  }

  function rerenderAll() {
    registry.forEach(e => {
      try { e.chart.setOption(polish(e.factory()), true); } catch (_) {}
    });
  }

  function resizeAll() {
    registry.forEach(e => { try { e.chart.resize(); } catch (_) {} });
  }
  window.addEventListener('resize', () => resizeAll());

  /* ---------------- Sparkline (KPI tiles) ---------------- */
  function sparkline(el, values, color, opts) {
    return mount(el, () => {
      const t = SCR.theme.tokens();
      const c = typeof color === 'function' ? color() : (color || t.accent);
      return {
        animation: false,
        grid: { left: 2, right: 2, top: 4, bottom: 2 },
        xAxis: { type: 'category', show: false, data: values.map((_, i) => i) },
        yAxis: {
          type: 'value', show: false,
          min: (opts && opts.min) != null ? opts.min : 'dataMin',
          max: (opts && opts.max) != null ? opts.max : 'dataMax'
        },
        series: [{
          type: 'line', data: values, symbol: 'none', smooth: true,
          lineStyle: { width: 2, color: c },
          areaStyle: { color: c, opacity: 0.12 }
        }]
      };
    });
  }

  /* ---------------- Waterfall ----------------
     steps: [{label, value, type: 'total'|'up'|'down'}]
     Totals are absolute; up/down are deltas.
     opts: { format, downIsGood } — in a risk bridge, decreases are good. */
  function waterfall(el, steps, opts) {
    opts = opts || {};
    steps = steps || [];
    return mount(el, () => {
      const t = SCR.theme.tokens();
      if (!steps.length) return { series: [] };
      const fmtV = opts.format || SCR.fmt.usdM;
      const labels = steps.map(s => s.label);
      const base = [], rise = [], fall = [], totals = [];
      let running = 0;
      steps.forEach(s => {
        if (s.type === 'total') {
          base.push(0); rise.push('-'); fall.push('-'); totals.push(s.value);
          running = s.value;
        } else if (s.value >= 0) {
          base.push(running); rise.push(s.value); fall.push('-'); totals.push('-');
          running += s.value;
        } else {
          running += s.value;
          base.push(running); rise.push('-'); fall.push(-s.value); totals.push('-');
        }
      });
      const barMax = 26;
      const upColor = opts.downIsGood === false ? t.status.good : t.status.serious;
      const downColor = opts.downIsGood === false ? t.status.critical : t.status.good;
      return Object.assign(SCR.theme.baseOption(), {
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, {
          trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: (params) => {
            const p = params.find(x => x.value !== '-' && x.seriesName !== 'base');
            if (!p) return '';
            const s = steps[p.dataIndex];
            const sign = s.type === 'total' ? '' : (s.value > 0 ? '+' : '−');
            return `<strong>${s.label}</strong><br/>${sign}${fmtV(Math.abs(s.value))}`;
          }
        }),
        legend: { show: false },
        grid: { left: 8, right: 14, top: 26, bottom: 4, containLabel: true },
        xAxis: SCR.theme.catAxis(labels, { axisLabel: { color: t.ink3, fontSize: 12.5, interval: 0, width: 92, overflow: 'break' } }),
        yAxis: SCR.theme.valAxis({ axisLabel: { formatter: v => fmtV(v) } }),
        series: [
          { name: 'base', type: 'bar', stack: 'wf', itemStyle: { color: 'transparent' }, emphasis: { itemStyle: { color: 'transparent' } }, tooltip: { show: false }, data: base, barMaxWidth: barMax },
          {
            name: 'increase', type: 'bar', stack: 'wf', data: rise, barMaxWidth: barMax,
            itemStyle: { color: upColor, borderRadius: [4, 4, 0, 0] },
            label: { show: true, position: 'top', fontSize: 12.5, color: t.ink2, formatter: p => p.value === '-' ? '' : '+' + fmtV(p.value) }
          },
          {
            name: 'decrease', type: 'bar', stack: 'wf', data: fall, barMaxWidth: barMax,
            itemStyle: { color: downColor, borderRadius: [4, 4, 0, 0] },
            label: { show: true, position: 'top', fontSize: 12.5, color: t.ink2, formatter: p => p.value === '-' ? '' : '−' + fmtV(p.value) }
          },
          {
            name: 'total', type: 'bar', stack: 'wf', data: totals, barMaxWidth: barMax,
            itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] },
            label: { show: true, position: 'top', fontSize: 13, fontWeight: 700, color: t.ink, formatter: p => p.value === '-' ? '' : fmtV(p.value) }
          }
        ]
      });
    });
  }

  /* ---------------- Mekko (marimekko) ----------------
     data: { cols: [names], cats: [names], values: { col: { cat: $M } } }
     Column width ∝ column total; segment height ∝ category share. */
  function mekko(el, data, opts) {
    opts = opts || {};
    return mount(el, () => {
      const t = SCR.theme.tokens();
      const fmtV = opts.format || SCR.fmt.usdM;
      const colTotals = data.cols.map(c =>
        data.cats.reduce((a, k) => a + (data.values[c][k] || 0), 0));
      const grand = colTotals.reduce((a, b) => a + b, 0);
      if (grand <= 0) return { series: [] };

      // segment rows: [x0, x1, y0(%), y1(%), col, cat, value, catIdx, colTotal]
      const rows = [];
      let x = 0;
      data.cols.forEach((c, ci) => {
        const w = colTotals[ci];
        let y = 0;
        data.cats.forEach((k, ki) => {
          const v = data.values[c][k] || 0;
          if (v <= 0) return;
          const h = (v / w) * 100;
          rows.push([x, x + w, y, y + h, c, k, v, ki, w]);
          y += h;
        });
        x += w;
      });

      return Object.assign(SCR.theme.baseOption(), {
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, {
          formatter: p => {
            const d = p.data;
            return `<strong>${d[4]} · ${d[5]}</strong><br/>${fmtV(d[6])} · ${((d[6] / d[8]) * 100).toFixed(0)}% of ${d[4]}<br/><span style="opacity:.65">${d[4]} total ${fmtV(d[8])} (${((d[8] / grand) * 100).toFixed(0)}% of all)</span>`;
          }
        }),
        legend: Object.assign(SCR.theme.baseOption().legend, { top: 0, data: data.cats }),
        grid: { left: 8, right: 8, top: 56, bottom: 26, containLabel: false },
        xAxis: { type: 'value', min: 0, max: grand, show: false },
        yAxis: { type: 'value', min: 0, max: 100, show: false },
        series: data.cats.map((k, ki) => ({
          name: k, type: 'custom',
          renderItem: (params, api) => {
            const d = rows[params.dataIndex];
            if (d[5] !== k) return null;
            const p0 = api.coord([d[0], d[3]]);
            const p1 = api.coord([d[1], d[2]]);
            const gap = 2;
            const fill = t.series[ki % t.series.length];
            const children = [{
              type: 'rect',
              shape: { x: p0[0] + gap / 2, y: p0[1] + gap / 2, width: p1[0] - p0[0] - gap, height: p1[1] - p0[1] - gap, r: 3 },
              style: { fill }
            }];
            const colW = p1[0] - p0[0];
            const colText = colW < 96 ? d[4] : `${d[4]} · ${((d[8] / grand) * 100).toFixed(0)}%`;
            // a column too narrow for its name leaves it to the tooltip
            if (d[2] === 0 && colW >= colText.length * 6.8 + 4) {
              children.push({
                type: 'text',
                style: {
                  x: (p0[0] + p1[0]) / 2, y: api.coord([0, 0])[1] + 8,
                  text: colText,
                  fill: t.ink3, font: '500 11.5px ' + t.font, textAlign: 'center'
                }
              });
            }
            const hPx = p1[1] - p0[1], wPx = p1[0] - p0[0];
            if (hPx > 18 && wPx > 46) {
              children.push({
                type: 'text',
                style: {
                  x: (p0[0] + p1[0]) / 2, y: (p0[1] + p1[1]) / 2,
                  text: ((d[6] / d[8]) * 100).toFixed(0) + '%',
                  fill: SCR.theme.onColor(fill), font: '600 11px ' + t.font,
                  textAlign: 'center', textVerticalAlign: 'middle'
                }
              });
            }
            return { type: 'group', children };
          },
          data: rows,
          encode: { x: [0, 1], y: [2, 3] }
        }))
      });
    });
  }

  /* ---------------- Gantt (resilience programs) ----------------
     programs: [{name, phases: [[phase, startISO, endISO, status]]}] */
  function gantt(el, programs, opts) {
    opts = opts || {};
    const DAY = 86400000;
    return mount(el, () => {
      const t = SCR.theme.tokens();
      const phaseColor = {
        done: t.status.good,
        active: t.series[1],
        planned: t.isDark ? 'rgba(160, 158, 170, 0.38)' : 'rgba(136, 135, 140, 0.26)'
      };
      const cats = programs.map(p => p.name);
      const rows = [];
      programs.forEach((p, pi) => {
        p.phases.forEach(ph => {
          rows.push({
            value: [pi, +new Date(ph[1]), +new Date(ph[2]), ph[0], ph[3], p.name],
            itemStyle: { color: phaseColor[ph[3]] }
          });
        });
      });
      const allDates = rows.flatMap(r => [r.value[1], r.value[2]]);
      if (!allDates.length) return { series: [] };
      const min = Math.min.apply(null, allDates) - 4 * DAY;
      const max = Math.max.apply(null, allDates) + 4 * DAY;
      const today = +new Date(SCR.data.asOf);

      return Object.assign(SCR.theme.baseOption(), {
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, {
          formatter: p => {
            const v = p.data.value;
            const f = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            const days = Math.round((v[2] - v[1]) / DAY);
            return `<strong>${v[5]}</strong><br/>${v[3]} · ${f(v[1])} → ${f(v[2])} (${days}d)<br/><span style="opacity:.65">Status: ${v[4]}</span>`;
          }
        }),
        grid: { left: 8, right: 16, top: 10, bottom: 6, containLabel: true },
        xAxis: {
          type: 'time', min, max,
          axisLine: { lineStyle: { color: t.axis } },
          axisLabel: { color: t.ink3, fontSize: 12.5, formatter: v => new Date(v).toLocaleDateString('en-GB', { month: 'short' }) },
          splitLine: { lineStyle: { color: t.grid } }
        },
        yAxis: {
          type: 'category', data: cats, inverse: true,
          axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { color: t.ink2, fontSize: 14, width: 230, overflow: 'truncate' }
        },
        series: [{
          type: 'custom',
          renderItem: (params, api) => {
            const catIdx = api.value(0);
            const start = api.coord([api.value(1), catIdx]);
            const end = api.coord([api.value(2), catIdx]);
            const h = Math.min(16, api.size([0, 1])[1] * 0.42);
            return {
              type: 'rect',
              shape: { x: start[0], y: start[1] - h / 2, width: Math.max(2, end[0] - start[0] - 2), height: h, r: h / 2 },
              style: api.style()
            };
          },
          encode: { x: [1, 2], y: 0 },
          data: rows,
          markLine: {
            symbol: 'none',
            lineStyle: { color: t.status.critical, width: 1.5, type: 'dashed' },
            label: { formatter: 'Today', color: t.status.critical, fontSize: 12, position: 'insideEndTop' },
            data: [{ xAxis: today }]
          }
        }]
      });
    });
  }

  /* ---------------- Column + line combo (two aligned panels) ----------------
     cfg: {
       labels: [...],
       bars: [{name, data, color(t)=>hex}],       // top panel, one shared $ axis
       line: {name, data, color(t)=>hex, min, max, fmt}, // bottom panel, own % axis
       barFmt
     }
     One x axis, two stacked grids — the % line never shares the $ axis. */
  function comboPanel(el, cfg) {
    cfg = cfg || {};
    return mount(el, () => {
      const t = SCR.theme.tokens();
      if (!cfg.labels || !cfg.labels.length) return { series: [] };
      const barFmt = cfg.barFmt || SCR.fmt.usdM;
      const lineFmt = (cfg.line && cfg.line.fmt) || SCR.fmt.ri;
      const lineColor = cfg.line.color ? cfg.line.color(t) : t.series[6];
      return Object.assign(SCR.theme.baseOption(), {
        axisPointer: { link: [{ xAxisIndex: 'all' }], lineStyle: { color: t.axis } },
        tooltip: Object.assign(SCR.theme.baseOption().tooltip, {
          trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: ps => {
            let h = `<strong>${ps[0].axisValue}</strong>`;
            ps.forEach(p => {
              const isLine = p.seriesName === cfg.line.name;
              h += `<br/>${p.marker} ${p.seriesName}: <strong>${isLine ? lineFmt(p.value) : barFmt(p.value)}</strong>`;
            });
            return h;
          }
        }),
        legend: Object.assign(SCR.theme.baseOption().legend, {
          top: 0, left: 'center',
          data: cfg.bars.map(b => ({ name: b.name, itemStyle: { color: b.color ? b.color(t) : undefined } }))
            .concat([{ name: cfg.line.name, itemStyle: { color: lineColor }, icon: cfg.line.dots ? 'circle' : 'roundRect' }])
        }),
        grid: [
          { left: 8, right: 14, top: 30, height: '52%', containLabel: true },
          { left: 8, right: 14, top: '72%', bottom: 6, containLabel: true }
        ],
        xAxis: [
          Object.assign(SCR.theme.catAxis(cfg.labels), { gridIndex: 0, axisLabel: { show: false }, axisTick: { show: false } }),
          Object.assign(SCR.theme.catAxis(cfg.labels), {
            gridIndex: 1,
            axisLabel: { color: t.ink3, fontSize: 11.5, interval: 0, rotate: cfg.rotate == null ? 38 : cfg.rotate, width: 86, overflow: 'truncate' }
          })
        ],
        yAxis: [
          SCR.theme.valAxis({ gridIndex: 0, axisLabel: { formatter: v => barFmt(v) } }),
          SCR.theme.valAxis({
            gridIndex: 1, min: cfg.line.min, max: cfg.line.max, splitNumber: 2,
            axisLabel: { formatter: v => lineFmt(v) }
          })
        ],
        series: [
          ...cfg.bars.map(b => ({
            name: b.name, type: 'bar', xAxisIndex: 0, yAxisIndex: 0,
            data: b.data, barMaxWidth: 16, barGap: '18%',
            itemStyle: { color: b.color ? b.color(t) : undefined, borderRadius: [3, 3, 0, 0] }
          })),
          {
            name: cfg.line.name, type: 'line', xAxisIndex: 1, yAxisIndex: 1,
            data: cfg.line.data, symbol: 'circle', symbolSize: cfg.line.dots ? 8 : 7,
            lineStyle: cfg.line.dots ? { width: 0, opacity: 0 } : { width: 2, color: lineColor },
            itemStyle: {
              color: p => cfg.line.pointColor ? cfg.line.pointColor(p.value, t) : lineColor,
              borderColor: t.surface, borderWidth: 1.5
            }
          }
        ]
      });
    });
  }

  SCR.charts = { mount, disposeAll, rerenderAll, resizeAll, sparkline, waterfall, mekko, gantt, comboPanel };
})();
