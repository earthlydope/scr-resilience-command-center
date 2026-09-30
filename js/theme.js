/* ============================================================
   SCR · theme.js
   Design tokens → chart bridge for the Supply Chain Resilience
   Command Center. Reads CSS custom properties at render time so
   every chart re-themes on light/dark toggle. All chart code
   must pull colors from here — never hardcode.

   Categorical palette (Apple system hues, fixed order, never cycled):
   teal → purple → orange → blue → pink → green → indigo → brown
   ============================================================ */
window.SCR = window.SCR || {};

/* Page registry — defined here (first script) so page modules can
   self-register regardless of load order; app.js consumes it. */
SCR.pages = SCR.pages || {};
SCR.registerPage = SCR.registerPage || function (key, page) { SCR.pages[key] = page; };

(function () {
  /* SF Pro first: -apple-system resolves to SF Pro Text/Display with optical
     sizing on Apple platforms; Inter is the cross-platform stand-in. */
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, system-ui, sans-serif';

  function cssVar(name) {
    return getComputedStyle(document.body || document.documentElement)
      .getPropertyValue(name).trim();
  }

  /** Live design tokens — call at chart render time (theme may have toggled). */
  function tokens() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    return {
      isDark,
      surface: cssVar('--surface'),
      surface2: cssVar('--surface-2'),
      surface3: cssVar('--surface-3'),
      ink: cssVar('--ink'),
      ink2: cssVar('--ink-2'),
      ink3: cssVar('--ink-3'),
      grid: cssVar('--grid'),
      axis: cssVar('--axis'),
      accent: cssVar('--accent'),
      border: cssVar('--border-strong'),
      // categorical series — fixed order, never cycled
      series: [1, 2, 3, 4, 5, 6, 7, 8].map(i => cssVar('--series-' + i)),
      status: {
        good: cssVar('--status-good'),
        warning: cssVar('--status-warning'),
        serious: cssVar('--status-serious'),
        critical: cssVar('--status-critical')
      },
      // sequential single-hue blue ramp (light→dark reads low→high)
      seq: isDark
        ? ['#0b2a4d', '#0e3a6b', '#11508f', '#1466b8', '#1f7fe0', '#4a9bf5', '#7ab6fb', '#a9d0ff']
        : ['#e6f1ff', '#cce3ff', '#a3ccff', '#74b0ff', '#4593f5', '#1a78e6', '#0a62c7', '#0a4c9a'],
      // ordinal ramp for funnels / tiers (mid steps for contrast on both surfaces)
      ordinal: isDark
        ? ['#1466b8', '#1f7fe0', '#4a9bf5', '#7ab6fb', '#a9d0ff']
        : ['#a3ccff', '#74b0ff', '#4593f5', '#1a78e6', '#0a62c7'],
      font: FONT
    };
  }

  /** Base ECharts option fragments shared by every chart. */
  function baseOption() {
    const t = tokens();
    return {
      color: t.series,
      textStyle: { fontFamily: FONT, color: t.ink2 },
      // settle like UIKit: quick start, long soft landing
      animationDuration: 850,
      animationEasing: 'quarticOut',
      animationDurationUpdate: 520,
      animationEasingUpdate: 'quarticOut',
      tooltip: {
        // a glass popover rather than a boxed label
        backgroundColor: t.isDark ? 'rgba(44, 44, 46, 0.78)' : 'rgba(255, 255, 255, 0.80)',
        borderColor: 'transparent',
        borderWidth: 0,
        padding: [10, 14],
        textStyle: { color: t.ink, fontSize: 13.5, fontFamily: FONT },
        extraCssText: 'backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);' +
          'border-radius:14px;box-shadow:0 0 0 .5px ' + (t.isDark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)') +
          ',0 10px 32px rgba(0,0,0,' + (t.isDark ? '.5' : '.14') + ');line-height:1.5;'
      },
      legend: {
        textStyle: { color: t.ink2, fontSize: 13, fontFamily: FONT },
        itemWidth: 9, itemHeight: 9, icon: 'circle', itemGap: 16
      },
      grid: { left: 8, right: 14, top: 34, bottom: 4, containLabel: true }
    };
  }

  /* Axis overrides merge one level deep, so a page that only sets a
     formatter keeps the themed label colour, size and face. */
  function mergeAxis(base, extra) {
    const out = Object.assign({}, base, extra || {});
    ['axisLabel', 'axisLine', 'axisTick', 'splitLine'].forEach(k => {
      if (base[k] && extra && extra[k]) out[k] = Object.assign({}, base[k], extra[k]);
    });
    return out;
  }

  /** Category axis (x) with recessive styling. */
  function catAxis(data, extra) {
    const t = tokens();
    return mergeAxis({
      type: 'category',
      data,
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
      axisLabel: { color: t.ink3, fontSize: 12.5, fontFamily: FONT }
    }, extra);
  }

  /** Value axis (y) with hairline grid. */
  function valAxis(extra) {
    const t = tokens();
    return mergeAxis({
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.ink3, fontSize: 12.5, fontFamily: FONT },
      splitLine: { lineStyle: { color: t.grid, width: 1 } }
    }, extra);
  }

  /* ---------------- Formatters ---------------- */
  const fmt = {
    /** $ millions → compact string. 1234 => $1.23B, 42.3 => $42.3M, 0.31 => $310K */
    usdM(v) {
      if (v == null || isNaN(v)) return '–';
      const abs = Math.abs(v);
      if (abs >= 1000) return '$' + (v / 1000).toFixed(2).replace(/\.?0+$/, '') + 'B';
      if (abs >= 10) return '$' + Math.round(v) + 'M';
      if (abs >= 1) return '$' + v.toFixed(1) + 'M';
      return '$' + Math.round(v * 1000) + 'K';
    },
    num(v) { return v == null ? '–' : v.toLocaleString('en-US'); },
    pct(v, d) { return v == null ? '–' : v.toFixed(d == null ? 1 : d) + '%'; },
    score(v) { return v == null ? '–' : Number(v).toFixed(2); },
    days(v) { return v == null ? '–' : v + 'd'; },
    ri(v) { return v == null ? '–' : Math.round(v) + '%'; },
    rre(v) { return v == null ? '–' : Number(v).toFixed(2); },
    signed(v, unit) {
      const s = v > 0 ? '+' : '';
      return s + v + (unit || '');
    }
  };

  /* ---------------- Risk helpers ---------------- */
  /** Map a 0–5 node risk score to rating bucket. */
  function ratingOf(score) {
    if (score >= 4.0) return 'Critical';
    if (score >= 3.0) return 'High';
    if (score >= 2.0) return 'Medium';
    return 'Low';
  }
  function ratingClass(rating) { return String(rating).toLowerCase(); }
  function ratingColor(rating) {
    const t = tokens();
    return {
      Low: t.status.good, Medium: t.status.warning,
      High: t.status.serious, Critical: t.status.critical
    }[rating] || t.ink3;
  }
  function scoreColor(score) { return ratingColor(ratingOf(score)); }

  /** Resilience Index (0–100, higher is stronger). */
  function riBand(ri) {
    if (ri >= 85) return 'Strong';
    if (ri >= 70) return 'Stable';
    if (ri >= 55) return 'Stressed';
    return 'Fragile';
  }
  function riClass(ri) {
    return { Strong: 'low', Stable: 'medium', Stressed: 'high', Fragile: 'critical' }[riBand(ri)];
  }
  function riColor(ri) {
    const t = tokens();
    return {
      Strong: t.status.good, Stable: t.status.warning,
      Stressed: t.status.serious, Fragile: t.status.critical
    }[riBand(ri)];
  }

  SCR.theme = { tokens, baseOption, catAxis, valAxis };
  SCR.fmt = fmt;
  SCR.risk = { ratingOf, ratingClass, ratingColor, scoreColor, riBand, riClass, riColor };
})();
