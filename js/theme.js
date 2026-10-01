/* ============================================================
   SCR · theme.js
   Design tokens → chart bridge for the Supply Chain Resilience
   Command Center. Reads CSS custom properties at render time so
   every chart re-themes on light/dark toggle. All chart code
   must pull colors from here — never hardcode.

   Categorical palette ("Signal", fixed order, never cycled):
   ink → yellow → coral → slate → teal → violet → blue → sand
   ============================================================ */
window.SCR = window.SCR || {};

/* Page registry — defined here (first script) so page modules can
   self-register regardless of load order; app.js consumes it. */
SCR.pages = SCR.pages || {};
SCR.registerPage = SCR.registerPage || function (key, page) { SCR.pages[key] = page; };

(function () {
  /* Montserrat (loaded from Google Fonts) carries the whole system; the
     fallbacks keep a geometric feel until it arrives or when offline. */
  const FONT = 'Montserrat, "Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif';

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
      // sequential signal ramp (pale → deep amber reads low → high)
      seq: isDark
        ? ['#2b2614', '#3f3513', '#5c4b0f', '#82680a', '#b08b05', '#e0b000', '#fac400', '#ffdd66']
        : ['#fff7d6', '#ffeda8', '#ffe074', '#ffd23d', '#fac400', '#e0a800', '#b58600', '#7f5e00'],
      // ordinal ramp for funnels / tiers (wide → narrow deepens toward ink)
      ordinal: isDark
        ? ['#6b5200', '#a37d00', '#d9a400', '#fac400', '#ffe58f']
        : ['#ffe58f', '#fac400', '#d9a400', '#9e7700', '#5e4700'],
      font: FONT
    };
  }

  /** Base ECharts option fragments shared by every chart. */
  function baseOption() {
    const t = tokens();
    return {
      color: t.series,
      textStyle: { fontFamily: FONT, color: t.ink2 },
      // marks grow in one after another, then settle
      animationDuration: 1000,
      animationEasing: 'cubicInOut',
      animationDelay: idx => Math.min(idx * 22, 440),
      animationDurationUpdate: 600,
      animationEasingUpdate: 'cubicInOut',
      tooltip: {
        // an ink card with a yellow edge — the house tooltip
        backgroundColor: t.isDark ? 'rgba(29, 28, 33, 0.97)' : 'rgba(17, 16, 19, 0.95)',
        borderColor: 'transparent',
        borderWidth: 0,
        padding: [10, 14],
        textStyle: { color: '#f4f3f0', fontSize: 13, fontFamily: FONT, fontWeight: 500 },
        extraCssText: 'border-radius:10px;border-left:3px solid #fac400;' +
          'box-shadow:0 18px 40px -14px rgba(0,0,0,' + (t.isDark ? '.8' : '.45') + ');line-height:1.55;'
      },
      legend: {
        textStyle: { color: t.ink2, fontSize: 12.5, fontFamily: FONT, fontWeight: 500 },
        itemWidth: 10, itemHeight: 10, icon: 'roundRect', itemGap: 18
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
      axisLabel: { color: t.ink3, fontSize: 12, fontFamily: FONT, fontWeight: 500 }
    }, extra);
  }

  /** Value axis (y) with hairline grid. */
  function valAxis(extra) {
    const t = tokens();
    return mergeAxis({
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t.ink3, fontSize: 12, fontFamily: FONT, fontWeight: 500 },
      splitLine: { lineStyle: { color: t.grid, width: 1, type: [3, 4] } }
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

  /** Readable text colour on a solid fill: ink on light fills, white on dark. */
  function onColor(c) {
    const t = tokens();
    let hex = String(c || '').trim();
    if (hex.startsWith('var(')) hex = cssVar(hex.slice(4, -1).trim());
    const m = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return t.isDark ? '#111013' : '#ffffff';
    let h = m[1];
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    const ch = i => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
    return L > 0.19 ? "#111013" : "#ffffff";
  }

  /* Canvas text only uses Montserrat once it has loaded: re-draw once it lands. */
  if (document.fonts && document.fonts.load) {
    const ready = () => { try { return document.fonts.check('600 12px Montserrat'); } catch (_) { return true; } };
    if (!ready()) {
      document.fonts.load('600 12px Montserrat').then(() => {
        if (ready() && SCR.charts && SCR.charts.rerenderAll) SCR.charts.rerenderAll();
      }).catch(() => {});
    }
  }

  SCR.theme = { tokens, baseOption, catAxis, valAxis, onColor };
  SCR.fmt = fmt;
  SCR.risk = { ratingOf, ratingClass, ratingColor, scoreColor, riBand, riClass, riColor };
})();
