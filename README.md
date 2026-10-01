# SCR — Supply Chain Resilience Command Center

A frontend-only demo of the **new-age SCR** described in the product blueprint: not a
filter-and-table BI dashboard, but a **persona-driven resilience intelligence platform**
for CPG and manufacturing — visual analytics, a supply-chain digital twin, disruption
simulation and an agentic AI layer in one product.

Demo company: **Veridia Group** — a global CPG & light-manufacturing group
(Beverages · Foods & Snacks · Home & Personal Care · Appliances & Devices; 8 plants,
6 DCs, 32 suppliers, 28 materials, 24 SKUs, 13 markets). All data is synthetic but
**derived from one resilience engine**, so every number reconciles across pages:

| Anchor | Value |
|---|---|
| NTS in scope | **$4.01B** |
| Value at risk (VAR) | **$373M** · AVAR **$143M** |
| Enterprise resilience index | **75%** (Stable) |
| TTR > TTS components | **14** (18 products exposed) |
| Single-source materials | **13** (8 risky) |
| AVAR mitigated YTD | **$46M** — equals the bridge's "Mitigated" step |

The engine (in `js/data.js`) computes, from BOM/supplier/inventory primitives:
**TTS** (survive) · **TTR** (recover) · **VAR** = dependent NTS × uncovered gap / 365 ·
**AVAR** = VAR × severity-scaled probability · **RRE** (residual risk 0–1) ·
**RI** (composite 0–100, higher = stronger).

## Run it

No build step, no dependencies (ECharts is vendored):

```bash
cd SCR
node serve.js 4190          # or: python3 -m http.server 4190
# open http://127.0.0.1:4190
```

Opening `index.html` directly from the filesystem also works (no ES modules).

## Two ways in: mobile and web

As in the HCCB hub, the root (`index.html`) is a **chooser**: pick a role, then the
**mobile app** (`mobile.html`) or the **web application** (`web.html`). Both run on the
same data, agents and copilot, and the role carries across (`?as=rrl|vsl|cat|site` links
open either one as a given role). A role map on the chooser explains what each role does
and where.

**The mobile app** is a phone build on a presentation stage — highlighted large titles that
collapse into a blurred nav bar, push navigation, bottom sheets, an ink tab dock with a
yellow active tab, a live-signal strip under the headline, confirmations in the Dynamic
Island and a yellow radar rim while the copilot thinks. Over the phone the pointer becomes a
fingertip.
It is tailored per role: five tabs — **Today**, the role's own list, **Alerts**,
**Simulate**, **Ask** — where the second tab is *Decisions* (Risk & Resilience Leader),
*Products* (Value Chain Leader), *Suppliers* (Category Leader) or *Sites* (Site Leader).
Today carries the role's headline, the "For you today" briefing, four role shortcuts and a
watchlist; alerts default to the ones routed to that role. Approving, creating actions,
what-ifs and the copilot work exactly as on the web.

**The guide** explains the product as you use it: point at any control and it is ringed,
a curved arrow is drawn to it and a card says what it does for the current role — beside
the element on the web, in the gutter next to the phone on mobile. The web app's **?**
button lists the role's three jobs with links to where they happen; the explanations can be
switched off on every screen.

## Pages × personas × charts

| Page | Persona / purpose | Chart forms |
|---|---|---|
| **Executive Summary** | Risk & Resilience Leader — enterprise exposure, top nodes, mitigation posture | **Waterfall** (AVAR bridge), **Donut** (AVAR by sector), ranked bars (top-10 nodes, AVAR/VAR/sales switch), **Area** (cumulative mitigated), **Mekko** (NTS by region × sector) |
| **Value Streams** | Value Chain / Stream Leader — product & market risk | **Column + line** (NTS + Wtd AVAR columns with RI on an aligned panel — no dual axis), **Bubble** (growth × margin × NTS), **Waterfall** (revenue bridge FY25→FY26), **Heat map** (market × month exposure), TTS-vs-TTR gap bars, missing TTR/TTS/RRE strip |
| **Category & Suppliers** | Category / Procurement Leader — sourcing risk | **Bubble** (spend × risk × AVAR), **Tree map** (spend by category → sub-category), node data summary, risk-driver profile, alternate-sourcing worklist |
| **Site Resilience** | SC Site Leader — plant/DC continuity | Threshold bars (which material stops production first), **Area** (inventory runway), risk-factor panel, playbook tracker |
| **Network Explorer** | Digital twin | **Sankey dependency trace** (supplier → material → plant → DC → market; ribbon width = NTS carried, red = single-source), enterprise value flow by material category (three stages, thin flows folded away), single-points-of-failure list |
| **Scenario Studio** | What-if simulation with live recompute | Compare tiles, **Waterfall** (exposed → inventory cover → mitigation → residual), ranked mitigation options |
| **Alerts & Actions** | Exception management | **Funnel** (signal → executed action), **Gantt** (resilience programs), action tracker with RRE before/after |
| **Recommendations** | The agentic layer | Approval queue, agent activity feed, daily digest |
| **Data Quality** | Governance | Completeness bars, coverage by sector, missing-data worklist, refresh log |

Cross-cutting:

- **Persona lens** (Terova pattern) — a "Viewing as" switcher in the app bar re-lenses
  the product per persona: the collapsible left sidebar (subtle width animation,
  persisted) shows only that persona's features (nav-as-metadata with per-item persona
  visibility), landing jumps to their cockpit ("MY VIEW"), and the copilot's sample
  questions re-tune per persona. R&R Leader sees everything; VSL, Category and Site
  leaders get focused sidebars. The Executive Summary opens with a "Today" hero: a
  greeting, the headline numbers and the agents' briefing side by side.
- **Resilience Copilot** — a floating glass panel (⌘K) that knows what you are looking
  at; see *Intelligence that acts* below. Every business KPI is answerable by name — NTS
  in scope, VAR, weighted AVAR, enterprise RI, TTR > TTS components, AVAR mitigated YTD,
  detection lead, single-source count, alerts and actions — as a value ("NTS in scope")
  or a definition ("how is AVAR calculated"), plus TTS/TTR/RRE concepts and a full KPI
  board on "show me all KPIs". Data freshness lives in the sidebar footer and behind the
  refresh icon (weekly recalc + daily external feeds).
- **360° drawers** — click any supplier / material / product / site / alert anywhere
  for a detail drawer with facts, 12-month trends, TTS-vs-TTR bars and cross-links.
- **Global search**, **alert center**, **dark mode** (fully re-themed charts), toasts,
  approve/dismiss workflow on agent recommendations, executive brief & daily digest
  generators, blueprint-faithful presets (the bottle-caps TTS 7d / TTR 21d case is
  the flagship scenario).

## Intelligence that acts

The AI layer (`js/intelligence.js` + `js/copilot.js`) is built to be useful in the moment,
not just conversational. Everything is computed from the live model at ask time.

- **Context-aware.** The copilot follows the page, its live filters and the entity open in
  a 360° drawer. A chip above the composer shows the context ("Supplier · CapForm
  Industries"); tap × to ask about the whole enterprise instead. "What if it fails for
  8 weeks?" needs no names. Suggestions re-tune to what is open.
- **What-ifs answered in the chat.** Duration, severity and disruption type are parsed
  from plain English ("6 weeks at 50%", "floods", "port"), run on the same twin the Studio
  uses, and returned with sales in the path, cover absorbed, sales at risk, RI impact, the
  binding component, worst-hit SKUs, the best plan and a duration-sensitivity chart.
  Follow-ups refine the last run ("and at full severity?").
- **It acts.** "Create action", "Create action from best plan" and every drawer's *Create
  mitigation action* open a sheet the Mitigation Strategist has already filled in (type,
  owner, due date sized to cover, linked alert, cost, expected AVAR cut, residual risk
  before → after). Confirming puts a real row on the action tracker, logs it to the agent
  feed and updates the counts. "Mitigation plan for single-source materials" queues real
  proposals; approving a proposal (in the queue or the chat) creates its tracked action.
- **It prioritises.** "For you today" on each persona cockpit ranks three things to do,
  each with a one-tap action. Proposals are ranked once — protection per $ of cost,
  weighted for alert severity — and every surface uses that ranking. The alert centre opens
  with a written summary of the stack.
- **It shows its working.** Computed answers expand into the formula and inputs behind
  them (risk score weights, VAR and AVAR maths, RI terms, scenario steps).
- **It writes.** Supplier outreach emails grounded in the actual gap and risk drivers, and
  the executive brief, both ready to copy.
- **It understands the model.** Suppliers, materials, products, plants, DCs, markets,
  sectors, value streams and categories are resolved from names, brands, cities and
  aliases ("MCU", "caps", "Pune plant"), tolerant of typos with "did you mean". Rankings
  ("top 3 suppliers by AVAR in packaging"), comparisons ("compare Pune and Atlanta"),
  sourcing ("who else can supply closures?"), dependencies and "what breaks X first".
- **Everywhere.** Global search hands questions to the copilot; every card's *AI insights*
  drawer has "Ask a follow-up" that carries the card into the conversation.

## The 6 agents

Network Sensing · Impact & VAR · TTS Watch · Mitigation Strategist ·
Execution & Workflow · Scenario Twin — surfaced in the live feed, the approval
queue, alerts and the copilot's attributed answers.

## Structure

```
index.html            the chooser: role → mobile app or web application
web.html              web application shell (sidebar, toolbar, drawers, copilot, modal)
mobile.html           mobile app shell (stage, iPhone frame, tab bar, sheets)
css/styles.css        design system "Signal" (light/dark via CSS custom properties)
css/mobile.css        the phone app: stage, device, navigation, lists, sheets, tab dock
css/landing.css       the chooser
css/guide.css         the hover guide (shared)
js/theme.js           design tokens → ECharts bridge, formatters, TTR/TTS/RI helpers
js/motion.js          motion layer: arrivals, count-ups, highlighter, marquee, pointer, tilt
js/data.js            synthetic dataset + the resilience engine (single source of truth)
js/charts.js          chart lifecycle + waterfall/mekko/gantt/sparkline/combo builders
js/components.js      shared UI + the 360° detail drawers
js/intelligence.js    context, entity resolution, action/proposal engine, daily briefing
js/copilot.js         Resilience Copilot (intent router + answers)
js/pages/*.js         one module per page (self-registering)
js/personas.js        the four roles, shared by every surface (lens, tasks, mobile tailoring)
js/guide.js           hover guide engine + role-aware explanations
js/mobile.js          the mobile app (screens, navigation, sheets, copilot host)
js/landing.js         the chooser
js/app.js             web router, lens switcher, sidebar nav, search, role guide
vendor/echarts.min.js Apache ECharts 5.5 (vendored; Montserrat loads from Google Fonts and
                      falls back to system fonts offline)
```

## Navigation

An ink sidebar (persona-filtered, collapsible from the toolbar) beside a translucent toolbar
that content scrolls beneath; a yellow route line runs under it on every navigation:
**My cockpit** (Executive Summary · Value Streams · Category & Suppliers · Site
Resilience) · **Intelligence** (Network Explorer · Scenario Studio) · **Act** (Alerts &
Actions · Recommendations) · **Govern** (Data Quality). An always-visible filter bar scopes
each persona page. Press `/` to search and `⌘K` for the copilot. Signature elements modernized
from the original screenshots: KPI strips with a "Summarize this view" tile, grouped-header
tables, the Node Overview drill (product list → Node
AVAR vs Sales Impacted with AVAR/SALES toggle and in-cell bars), the Category node data
summary (multi-measure in-row bars) and the Node Risk Summary heat matrix.

**Simulations answer in place.** "Simulate this site", "Simulate top node failure" and
"Simulate losing its supplier" run the digital twin in a drawer where you asked, showing
exposed sales, cover absorbed, residual risk, worst-hit SKUs and the best mitigation —
without navigating away and losing the context you asked from. The full Scenario Studio
stays one click away. Links labelled "Open X" still navigate, because that is what they say.

**AI agent insights everywhere.** Every card carries an "AI insights" button top-right
that opens an agent-attributed drawer: the live readings behind that card, what the agent
sees in them, and where to go next. Content is computed at click time, so it reflects
whatever filters are active.

**Every KPI tile is a drill.** Each icon-chip tile in a strip either scrolls-and-highlights
the section that explains it (e.g. Nodes → the Top-10 ranking, Spend → the spend tree map)
or routes to another persona cockpit (Supplier/EM → Category, Plants & DCs → Site). The
RI tiles open the RI Matrix guide. **The agentic layer is functional**: any row in the
activity feed opens a 360° drawer with that agent's live stats, what it does, its recent
activity and jump-to actions into the relevant dashboard; the approval queue
approves/dismisses recommendations (handing off to Execution & Workflow), and the
daily-digest generator composes a live brief.

## Design language

"Signal" — editorial ink on paper with one loud colour, inspired by StatusNeo's site:

- **Type** — Montserrat throughout: semibold display with tight tracking, medium-weight body,
  tabular figures.
- **Colour** — ink (`#111013`) leads and signal yellow (`#fac400`) answers. Yellow marks what
  matters: a highlighter under the key phrase of a heading, the active nav item and tab, focus,
  hover wipes and the agentic layer. Severity uses a warm ramp kept apart from the brand yellow
  (green → amber → orange → red) with text-safe variants for small type. Charts use a fixed
  order — ink → yellow → coral → slate → teal → violet → blue → sand — and labels on filled
  marks pick ink or white for contrast.
- **Surfaces** — a paper canvas with white cards on hairlines, an ink sidebar, and dark
  "liquid chrome" panels (curved light ridges drifting over ink) for the moments that set the
  scene: the Executive hero, the phone's headline card, the chooser's "how it works" and
  closing bands.
- **Intelligence** — the agents wear the signal: an ink tile with a yellow spark, a yellow arc
  that sweeps round the briefing like radar, and a yellow rim with a warm edge glow while the
  copilot thinks.
- **Motion** (`js/motion.js`) — blocks rise in as they reach the viewport, headline figures
  count up, highlighters sweep under headings and section titles end in a yellow full stop.
  Primary buttons fill with a yellow wipe while their ↗ slips out and back; live signals run
  in marquees that pause on hover; chooser cards lean toward the pointer; a dot-and-ring
  pointer companion opens on anything clickable and becomes a fingertip over the phone; a
  yellow line marks each navigation. All of it stands down under *Reduce Motion*.
- **Layout** — KPI tiles with a tinted glyph and a big figure (a highlighter sweeps under the
  figure when a tile drills); the one place a % line meets $ columns, the line gets its own
  aligned panel and axis — never a second y-axis on the same plot. Light and dark themes are
  both first-class.
