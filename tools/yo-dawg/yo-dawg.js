"use strict";

/* ============================================================
   Suffix Automaton (DAWG) — step-by-step educational explainer
   ============================================================ */

// ── DOM refs ──────────────────────────────────────────────────
const setupForm       = document.getElementById('setupForm');
const baseWordInput   = document.getElementById('baseWordInput');
const queryWordInput  = document.getElementById('queryWordInput');
const setupError      = document.getElementById('setupError');

const constructSection   = document.getElementById('constructSection');
const constructSvg       = document.getElementById('constructSvg');
const constructCounter   = document.getElementById('constructCounter');
const constructExplain   = document.getElementById('constructExplain');
const constructProgress  = document.getElementById('constructProgress');
const cPrev = document.getElementById('cPrev');
const cNext = document.getElementById('cNext');

const traverseSection    = document.getElementById('traverseSection');
const traverseSvg        = document.getElementById('traverseSvg');
const traverseCounter    = document.getElementById('traverseCounter');
const traverseExplain    = document.getElementById('traverseExplain');
const traverseProgress   = document.getElementById('traverseProgress');
const wordTrack          = document.getElementById('wordTrack');
const lcsValue           = document.getElementById('lcsValue');
const lcsLen             = document.getElementById('lcsLen');
const tPrev = document.getElementById('tPrev');
const tNext = document.getElementById('tNext');

const querySection = document.getElementById('querySection');
const queryForm    = document.getElementById('queryForm');
const queryError   = document.getElementById('queryError');
const cFit         = document.getElementById('cFit');
const tFit         = document.getElementById('tFit');

// ── Module-level state ────────────────────────────────────────
let cSteps = [], cIndex = 0, cPositions = {};
let tSteps = [], tIndex = 0, tPositions = {};
let savedFinalStates = [];

// ── Helpers ───────────────────────────────────────────────────
const sanitize   = (s) => s.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
const cloneState = (s) => ({ id: s.id, len: s.len, link: s.link, next: { ...s.next } });
const cloneArr   = (arr) => arr.map(cloneState);

// ── Layout: columns = len value, rows = states sharing that len ─
function layoutPositions(states) {
  const maxLen  = states.reduce((m, s) => Math.max(m, s.len), 0);
  const byLen   = {};
  for (const s of states) (byLen[s.len] = byLen[s.len] || []).push(s.id);

  const COL_W   = 155;
  const ROW_H   = 95;
  const PAD_X   = 60;
  const PAD_Y   = 50;
  const maxRows = Math.max(...Object.values(byLen).map(a => a.length), 1);
  const svgH    = maxRows * ROW_H + PAD_Y * 2;

  const pos = {};
  for (let len = 0; len <= maxLen; len++) {
    const col    = byLen[len] || [];
    const colH   = col.length * ROW_H;
    const startY = (svgH - colH) / 2 + ROW_H / 2;
    col.forEach((id, i) => {
      pos[id] = { x: PAD_X + len * COL_W, y: startY + i * ROW_H };
    });
  }
  return pos;
}

function svgDimensionsFromPositions(positions) {
  const xs = Object.values(positions).map(p => p.x);
  const ys = Object.values(positions).map(p => p.y);
  return {
    w: Math.max(300, Math.max(...xs) + 65),
    h: Math.max(120, Math.max(...ys) + 55),
  };
}

// ── Zoom/pan viewport controller ──────────────────────────────
class ViewportController {
  constructor(svgEl, fitBtn) {
    this.svg  = svgEl;
    this._tx  = 0;
    this._ty  = 0;
    this._s   = 1;
    this._cw  = 300;
    this._ch  = 200;
    this._setupEvents(fitBtn);
  }

  _g() { return this.svg.querySelector('.content-g'); }

  _apply() {
    const g = this._g();
    if (g) g.setAttribute('transform',
      `translate(${this._tx.toFixed(2)},${this._ty.toFixed(2)}) scale(${this._s.toFixed(5)})`);
  }

  autoFit(cw, ch) {
    this._cw = cw;
    this._ch = ch;
    const { width: sw, height: sh } = this.svg.getBoundingClientRect();
    if (!sw || !sh) return;
    const pad = 20;
    const s   = Math.min((sw - pad * 2) / cw, (sh - pad * 2) / ch);
    this._s   = Math.max(0.05, s);
    this._tx  = (sw - cw * this._s) / 2;
    this._ty  = (sh - ch * this._s) / 2;
    this._apply();
  }

  _zoom(f, cx, cy) {
    const ns = Math.max(0.05, Math.min(20, this._s * f));
    const fr = ns / this._s;
    this._tx = cx + (this._tx - cx) * fr;
    this._ty = cy + (this._ty - cy) * fr;
    this._s  = ns;
    this._apply();
  }

  _setupEvents(fitBtn) {
    const svg = this.svg;
    if (fitBtn) fitBtn.addEventListener('click', () => this.autoFit(this._cw, this._ch));

    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        this._zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
      } else {
        const m = e.deltaMode === 1 ? 20 : 1;
        this._tx -= e.deltaX * m;
        this._ty -= e.deltaY * m;
        this._apply();
      }
    }, { passive: false });

    let drag = false, lastX = 0, lastY = 0;
    svg.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      drag = true; lastX = e.clientX; lastY = e.clientY;
      svg.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      this._tx += e.clientX - lastX;
      this._ty += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      this._apply();
    });
    window.addEventListener('mouseup', () => {
      drag = false; svg.style.cursor = 'grab';
    });

    let lastT = null;
    svg.addEventListener('touchstart', e => {
      e.preventDefault();
      lastT = [...e.touches].map(t => ({ x: t.clientX, y: t.clientY }));
    }, { passive: false });
    svg.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = [...e.touches].map(t => ({ x: t.clientX, y: t.clientY }));
      if (!lastT) { lastT = t; return; }
      const r = svg.getBoundingClientRect();
      if (t.length >= 2 && lastT.length >= 2) {
        const d0  = Math.hypot(lastT[1].x - lastT[0].x, lastT[1].y - lastT[0].y);
        const d1  = Math.hypot(t[1].x - t[0].x, t[1].y - t[0].y);
        const lmx = (lastT[0].x + lastT[1].x) / 2 - r.left;
        const lmy = (lastT[0].y + lastT[1].y) / 2 - r.top;
        const mx  = (t[0].x + t[1].x) / 2 - r.left;
        const my  = (t[0].y + t[1].y) / 2 - r.top;
        if (d0 > 1) {
          const f  = d1 / d0;
          const ns = Math.max(0.05, Math.min(20, this._s * f));
          const fr = ns / this._s;
          this._tx = mx + (this._tx - lmx) * fr;
          this._ty = my + (this._ty - lmy) * fr;
          this._s  = ns;
        } else {
          this._tx += mx - lmx;
          this._ty += my - lmy;
        }
        this._apply();
      } else if (t.length === 1) {
        this._tx += t[0].x - lastT[0].x;
        this._ty += t[0].y - lastT[0].y;
        this._apply();
      }
      lastT = t;
    }, { passive: false });
    svg.addEventListener('touchend', e => {
      lastT = [...e.touches].map(t => ({ x: t.clientX, y: t.clientY }));
    }, { passive: false });

    window.addEventListener('resize', () => this.autoFit(this._cw, this._ch));
  }
}

const cViewport = new ViewportController(constructSvg, cFit);
const tViewport = new ViewportController(traverseSvg, tFit);

// ── Draw one arrow between two circles ───────────────────────
// Returns SVG markup string for a <g> containing a <path> and optional <text>
function drawArrow(p1, p2, R, lineClass, markerId, label, curveDir) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy) || 0.01;
  const nx = dx / dist, ny = dy / dist; // unit vector

  // Perpendicular offset for curve (positive = "below/right", negative = "above/left")
  const cpOff = curveDir !== undefined ? curveDir : 0;

  // Midpoint + perpendicular offset
  const mx  = (p1.x + p2.x) / 2 - ny * cpOff;
  const my  = (p1.y + p2.y) / 2 + nx * cpOff;

  // Tangent at start ≈ (mx - p1.x, my - p1.y), normalised
  const t0x = mx - p1.x, t0y = my - p1.y;
  const t0l = Math.hypot(t0x, t0y) || 0.01;
  const sx  = p1.x + (t0x / t0l) * R;
  const sy  = p1.y + (t0y / t0l) * R;

  // Tangent at end ≈ (p2.x - mx, p2.y - my), normalised
  const t1x = p2.x - mx, t1y = p2.y - my;
  const t1l = Math.hypot(t1x, t1y) || 0.01;
  const ex  = p2.x - (t1x / t1l) * (R + 7); // +7 for arrowhead clearance
  const ey  = p2.y - (t1y / t1l) * (R + 7);

  // Label at bezier t=0.5
  const lx = 0.25 * sx + 0.5 * mx + 0.25 * ex;
  const ly = 0.25 * sy + 0.5 * my + 0.25 * ey;

  let gml = `<g class="${lineClass}">`;
  gml += `<path d="M${sx.toFixed(1)},${sy.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" marker-end="url(#${markerId})" />`;
  if (label !== null && label !== undefined) {
    gml += `<text x="${lx.toFixed(1)}" y="${(ly - 7).toFixed(1)}">${label}</text>`;
  }
  gml += '</g>';
  return gml;
}

// ── Dynamic edge-curve computation ──────────────────────────
// Assigns a perpendicular offset (curveDir) to every transition arc and
// suffix-link arc so that:
//   1. Parallel arcs between the same node-pair spread without crossing.
//   2. Every arc bows away from intermediate nodes it would otherwise pass
//      through, by sampling the actual quadratic bezier and nudging.
//
// Convention (matches drawArrow): positive curveDir bows the arc downward;
// negative bows it upward.
//
// Transitions: right-going → bow UP (negative); left-going → bow DOWN (positive).
// Suffix links: placed on the OPPOSITE side from same-pair transitions; when
//   no transitions share the pair they use a distance-scaled bow instead.
function computeEdgeCurves(positions, transMap, linkEdges) {
  const R_NODE         = 22;   // must match renderGraph's R
  const NODE_CLEARANCE = R_NODE + 10;  // required clearance from arc to any non-endpoint node centre
  const NUDGE_STEP     = 12;   // px to increase offset per iteration
  const MAX_NUDGES     = 40;   // safety cap on iterations

  const MIN_CURVE  = 26;   // minimum bow for a single isolated arc (px)
  const LANE_FRAC  = 0.22; // lane width as fraction of inter-node pixel distance
  const MIN_LANE   = 42;   // floor for lane width (px)
  const LINK_EXTRA = 44;   // gap beyond outermost same-side transition for a suffix link
  const LINK_FRAC  = 0.40; // fallback arc fraction when no co-transitions exist
  const LINK_MAX   = 115;  // cap on that fallback arc (px)

  const curves    = {};  // edgeKey → curveDir
  const outermost = {};  // `${minId}-${maxId}` → { pos: 0, neg: 0 }  (max magnitude per sign-side)

  const pairKey    = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;
  const ensurePair = pk => { if (!outermost[pk]) outermost[pk] = { pos: 0, neg: 0 }; };
  const trackOuter = (pk, val) => {
    if (val >= 0) outermost[pk].pos = Math.max(outermost[pk].pos,  val);
    else          outermost[pk].neg = Math.max(outermost[pk].neg, -val);
  };

  // All node positions for intersection checking (built once).
  const allPositions = Object.entries(positions).map(([id, pos]) => ({ id: Number(id), pos }));

  // ── Sample a quadratic bezier (centred on node-centres) at `samples` points
  //    and return the minimum distance from point q to the curve.
  function minBezierDist(p1, p2, cpOff, q, samples = 32) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y, d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    // Control point: midpoint shifted perpendicularly by cpOff.
    const mx = (p1.x + p2.x) / 2 - ny * cpOff;
    const my = (p1.y + p2.y) / 2 + nx * cpOff;
    let minD = Infinity;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples, u = 1 - t;
      const bx = u*u*p1.x + 2*t*u*mx + t*t*p2.x;
      const by = u*u*p1.y + 2*t*u*my + t*t*p2.y;
      const dist = Math.hypot(bx - q.x, by - q.y);
      if (dist < minD) minD = dist;
    }
    return minD;
  }

  // ── Starting from `initOffset`, nudge its magnitude outward (preserving sign)
  //    until the bezier from p1→p2 clears all nodes except fromId and toId.
  function nudgeForNodes(p1, p2, fromId, toId, initOffset) {
    let off  = initOffset;
    const sign = off >= 0 ? 1 : -1;
    for (let iter = 0; iter < MAX_NUDGES; iter++) {
      let blocked = false;
      for (const { id, pos } of allPositions) {
        if (id === fromId || id === toId) continue;
        if (minBezierDist(p1, p2, off, pos) < NODE_CLEARANCE) { blocked = true; break; }
      }
      if (!blocked) break;
      off += sign * NUDGE_STEP;
    }
    return off;
  }

  // ── Pass 1: transitions ──
  for (const { from, to, chs } of Object.values(transMap)) {
    const p1 = positions[from], p2 = positions[to];
    if (!p1 || !p2) continue;
    const dist    = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const lw      = Math.max(MIN_LANE, dist * LANE_FRAC);
    const goRight = p2.x >= p1.x;
    const pk      = pairKey(from, to);
    ensurePair(pk);

    [...chs].sort().forEach((ch, i) => {
      const raw    = MIN_CURVE + i * lw;
      const sign   = goRight ? -1 : 1;
      const nudged = nudgeForNodes(p1, p2, from, to, sign * raw);
      curves[`${from}\u2192${to}\u2192${ch}`] = nudged;
      trackOuter(pk, nudged);
    });
  }

  // ── Pass 2: suffix links ──
  // Suffix links are placed on the OPPOSITE sign-side from same-pair transitions.
  for (const { from, to } of linkEdges) {
    const p1 = positions[from], p2 = positions[to];
    if (!p1 || !p2) continue;
    const dist    = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const goRight = p2.x >= p1.x;
    const pk      = pairKey(from, to);
    // Transitions on this edge go right → negative offset; suffix link → use positive side.
    // Transitions go left → positive offset; suffix link → use negative side.
    const linkSign   = goRight ? 1 : -1;
    const oppSideMax = goRight
      ? (outermost[pk] ? outermost[pk].pos : 0)   // transitions are neg, link goes pos
      : (outermost[pk] ? outermost[pk].neg : 0);  // transitions are pos, link goes neg
    const base    = oppSideMax > 0
      ? oppSideMax + LINK_EXTRA
      : Math.min(Math.max(MIN_CURVE, dist * LINK_FRAC), LINK_MAX);
    const nudged  = nudgeForNodes(p1, p2, from, to, linkSign * base);
    curves[`link:${from}\u2192${to}`] = nudged;
  }

  return curves;
}

// ── Render the automaton graph into an SVG element ────────────
function renderGraph(svgEl, states, positions, hl = {}) {
  const { newStates = [], modStates = [], curState = -1,
          newEdges = [], modEdges = [], activeEdge = null } = hl;
  const R = 22;
  const isNew  = id => newStates.includes(id);
  const isMod  = id => modStates.includes(id);
  const hlEdge = (list, f, t, ch) =>
    list.some(e => e.from === f && e.to === t && (ch === undefined || e.ch === ch));

  const { w, h } = svgDimensionsFromPositions(positions);

  let mk = `<defs>
    <marker id="ah"     viewBox="0 0 10 7" markerWidth="7" markerHeight="5" refX="8" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7"/></marker>
    <marker id="ah-lnk" viewBox="0 0 10 7" markerWidth="7" markerHeight="5" refX="8" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7"/></marker>
    <marker id="ah-new" viewBox="0 0 10 7" markerWidth="7" markerHeight="5" refX="8" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7"/></marker>
    <marker id="ah-mod" viewBox="0 0 10 7" markerWidth="7" markerHeight="5" refX="8" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7"/></marker>
    <marker id="ah-hot" viewBox="0 0 10 7" markerWidth="7" markerHeight="5" refX="8" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7"/></marker>
  </defs>
  <style>
    #ah polygon { fill: var(--edge-color); }
    #ah-lnk polygon { fill: var(--link-edge); }
    #ah-new polygon { fill: var(--new-color); }
    #ah-mod polygon { fill: var(--mod-color); }
    #ah-hot polygon { fill: var(--hot); }
  </style>`;

  // ── Collect transitions grouped by (from,to) to detect parallels ──
  const transMap = {}; // "f→t" → { from, to, chs:[] }
  states.forEach(s => {
    Object.entries(s.next).forEach(([ch, to]) => {
      if (!positions[s.id] || !positions[to]) return;
      const key = `${s.id}\u2192${to}`;
      (transMap[key] = transMap[key] || { from: s.id, to, chs: [] }).chs.push(ch);
    });
  });
  // ── Collect suffix links ──
  const linkEdges = [];
  states.forEach(s => {
    if (s.link === -1 || !positions[s.id] || !positions[s.link]) return;
    linkEdges.push({ from: s.id, to: s.link });
  });

  // ── Pre-compute all curve offsets dynamically ──
  const edgeCurves = computeEdgeCurves(positions, transMap, linkEdges);

  // ── Draw suffix links first (underneath transitions) ──
  linkEdges.forEach(e => {
    const p1   = positions[e.from], p2 = positions[e.to];
    const curve = edgeCurves[`link:${e.from}\u2192${e.to}`] ?? 60;
    const enew = hlEdge(newEdges, e.from, e.to);
    const emod = hlEdge(modEdges, e.from, e.to);
    const cls  = enew ? 's-slink new' : emod ? 's-slink mod' : 's-slink';
    const mid  = enew ? 'ah-new' : emod ? 'ah-mod' : 'ah-lnk';
    mk += drawArrow(p1, p2, R, cls, mid, null, curve);
  });

  // ── Draw transitions ──
  Object.values(transMap).forEach(({ from, to, chs }) => {
    const p1 = positions[from], p2 = positions[to];
    [...chs].sort().forEach(ch => {
      const curve    = edgeCurves[`${from}\u2192${to}\u2192${ch}`] ?? -26;
      const isActive = activeEdge && activeEdge.from === from && activeEdge.to === to;
      const enew     = hlEdge(newEdges, from, to, ch);
      const emod     = hlEdge(modEdges, from, to, ch);
      const cls  = isActive ? 's-edge active-trav' : enew ? 's-edge new' : emod ? 's-edge mod' : 's-edge';
      const mid  = isActive ? 'ah-hot' : enew ? 'ah-new' : emod ? 'ah-mod' : 'ah';
      mk += drawArrow(p1, p2, R, cls, mid, ch, curve);
    });
  });

  // ── Draw nodes on top ──
  states.forEach(s => {
    const pos = positions[s.id];
    if (!pos) return;
    const classes = ['s-node',
      isNew(s.id) ? 'new' : isMod(s.id) ? 'mod' : curState === s.id ? 'cur' : '',
    ].filter(Boolean).join(' ');
    mk += `<g class="${classes}">
      <circle cx="${pos.x}" cy="${pos.y}" r="${R}"/>
      <text x="${pos.x}" y="${pos.y}">${s.id}</text>
    </g>`;
    mk += `<text x="${pos.x}" y="${pos.y + R + 13}"
      style="fill:var(--muted);font-family:Arial,sans-serif;font-size:10px;text-anchor:middle">len=${s.len}</text>`;
  });

  svgEl.innerHTML = `<g class="content-g">${mk}</g>`;
  return { w, h };
}

// ── BUILD CONSTRUCTION STEPS ──────────────────────────────────
function buildConstructSteps(word) {
  const states = [{ id: 0, len: 0, link: -1, next: {} }];
  let last = 0;
  const steps = [];
  let wordSoFar = '';

  steps.push({
    snapshot: cloneArr(states),
    last: 0,
    hl: { newStates: [0] },
    html: `<p><strong>Root (state&nbsp;0)</strong> — the starting point.
           <code>len = 0</code> (empty string, occurs everywhere).
           Suffix link: none.</p>`,
  });

  for (const ch of word) {
    wordSoFar += ch;

    // Create new state
    const cur = states.length;
    states.push({ id: cur, len: states[last].len + 1, link: -1, next: {} });
    steps.push({
      snapshot: cloneArr(states),
      last,
      hl: { newStates: [cur] },
      html: `<p>Character <strong>&lsquo;${ch}&rsquo;</strong> → prefix &ldquo;${wordSoFar}&rdquo;.</p>
             <p>Create <strong>state&nbsp;${cur}</strong>,
             <code>len&nbsp;=&nbsp;${states[cur].len}</code>.
             Endpos starts as {${wordSoFar.length - 1}}; transitions added below will determine which strings reach it.</p>`,
    });

    // Walk up suffix links adding transitions
    let p = last;
    while (p !== -1 && states[p].next[ch] === undefined) {
      states[p].next[ch] = cur;
      const fp = p;
      steps.push({
        snapshot: cloneArr(states),
        last,
        hl: { modStates: [fp, cur], newEdges: [{ from: fp, to: cur, ch }] },
        html: `<p>State&nbsp;${fp} has no &lsquo;${ch}&rsquo; transition yet.
               Add <strong>${fp}&nbsp;&rarr;<sup>${ch}</sup>&nbsp;${cur}</strong>.
               Follow suffix link: ${fp}&nbsp;&rarr;&nbsp;${states[fp].link === -1 ? 'null' : 'state&nbsp;' + states[fp].link}.</p>`,
      });
      p = states[fp].link;
    }

    // Determine suffix link for cur
    if (p === -1) {
      states[cur].link = 0;
      steps.push({
        snapshot: cloneArr(states),
        last,
        hl: { modStates: [cur, 0], newEdges: [{ from: cur, to: 0, type: 'link' }] },
        html: `<p>Reached null — &lsquo;${ch}&rsquo; is entirely new in this word.</p>
               <p>Suffix link: state&nbsp;${cur}&nbsp;&rarr;&nbsp;root (state&nbsp;0).</p>`,
      });
    } else {
      const q = states[p].next[ch];
      if (states[p].len + 1 === states[q].len) {
        states[cur].link = q;
        steps.push({
          snapshot: cloneArr(states),
          last,
          hl: { modStates: [cur, q], newEdges: [{ from: cur, to: q, type: 'link' }] },
          html: `<p>Stopped at state&nbsp;${p} → state&nbsp;${q} via &lsquo;${ch}&rsquo;.
                 <code>len(${p})+1 = ${states[p].len + 1} = len(${q})</code>. ✓
                 State&nbsp;${q} is already the correct minimial representative — no clone needed.</p>
                 <p>Suffix link: state&nbsp;${cur}&nbsp;&rarr;&nbsp;state&nbsp;${q}.</p>`,
        });
      } else {
        // Clone
        const clone = states.length;
        states.push({
          id: clone,
          len: states[p].len + 1,
          link: states[q].link,
          next: { ...states[q].next },
        });
        steps.push({
          snapshot: cloneArr(states),
          last,
          hl: { newStates: [clone], modStates: [q] },
          html: `<p>Stopped at state&nbsp;${p} → state&nbsp;${q} via &lsquo;${ch}&rsquo;, but
                 <code>len(${p})+1 = ${states[p].len + 1} &ne; len(${q}) = ${states[q].len}</code>.</p>
                 <p>State&nbsp;${q} conflates strings of lengths ${states[p].len + 1}&ndash;${states[q].len};
                 adding the new position would wrongly merge their endpos sets.
                 <strong>Clone</strong> it: new <strong>state&nbsp;${clone}</strong>
                 (<code>len&nbsp;=&nbsp;${states[clone].len}</code>) takes ${q}&rsquo;s
                 transitions and suffix link, representing only the shorter strings.</p>`,
        });

        // Redirect transitions
        let pp = p;
        while (pp !== -1 && states[pp].next[ch] === q) {
          states[pp].next[ch] = clone;
          const fpp = pp;
          steps.push({
            snapshot: cloneArr(states),
            last,
            hl: { modStates: [fpp, clone], modEdges: [{ from: fpp, to: clone, ch }] },
            html: `<p>State&nbsp;${fpp} → state&nbsp;${q} via &lsquo;${ch}&rsquo;.
                   Strings through ${fpp} have len &le;&nbsp;${states[fpp].len}, so this edge
                   belongs to the clone (len&nbsp;${states[clone].len}).
                   <strong>Redirect</strong> ${fpp}&nbsp;&rarr;<sup>${ch}</sup>&nbsp;${clone}.
                   Continue up suffix links&hellip;</p>`,
          });
          pp = states[fpp].link;
        }

        states[q].link    = clone;
        states[cur].link  = clone;
        steps.push({
          snapshot: cloneArr(states),
          last,
          hl: { modStates: [q, cur, clone],
                newEdges: [{ from: q, to: clone, type: 'link' }, { from: cur, to: clone, type: 'link' }] },
          html: `<p>Point both suffix links at the clone:</p>
                 <ul>
                   <li>state&nbsp;${q}.link&nbsp;&rarr;&nbsp;${clone} (clone is its new shortest-suffix parent)</li>
                   <li>state&nbsp;${cur}.link&nbsp;&rarr;&nbsp;${clone} (shared length-${states[clone].len} suffix)</li>
                 </ul>
                 <p>Length invariant restored: <code>${states[clone].len} &lt; len(${q}), len(${cur})</code>.</p>`,
        });
      }
    }

    last = cur;
    steps.push({
      snapshot: cloneArr(states),
      last: cur,
      hl: { curState: cur },
      html: `<p>✅ <strong>&lsquo;${ch}&rsquo; done.</strong> State&nbsp;${cur} is the new last —
             represents prefix <strong>&ldquo;${wordSoFar}&rdquo;</strong>.
             DAWG now accepts all substrings of &ldquo;${wordSoFar}&rdquo;.</p>`,
    });
  }

  // Final
  steps.push({
    snapshot: cloneArr(states),
    last,
    hl: {},
    html: `<p>🏁 <strong>Construction complete!</strong>
           ${states.length}&nbsp;states for &ldquo;${word}&rdquo;
           (${word.length * (word.length + 1) / 2} substrings). Scroll down to query it!</p>`,
    done: true,
  });

  return { steps, finalStates: cloneArr(states) };
}

// ── BUILD TRAVERSAL STEPS ─────────────────────────────────────
function buildTraverseSteps(query, states) {
  const steps = [];
  let v = 0, l = 0, bestL = 0, bestEnd = -1;

  steps.push({
    v: 0, l: 0, bestL: 0, bestEnd: -1,
    charIndex: -1,
    hl: { curState: 0 },
    html: `<p>At <strong>root (state&nbsp;0)</strong>, match length&nbsp;= 0.
           Reading <strong>&ldquo;${query}&rdquo;</strong> character by character.</p>`,
  });

  for (let i = 0; i < query.length; i++) {
    const ch = query[i];

    if (states[v] && states[v].next[ch] !== undefined) {
      const prevV = v;
      v = states[v].next[ch];
      l++;
      const newBest = l > bestL;
      if (newBest) { bestL = l; bestEnd = i; }
      steps.push({
        v, l, bestL, bestEnd,
        charIndex: i,
        hl: { curState: v, activeEdge: { from: prevV, to: v } },
        html: `<p><strong>&lsquo;${ch}&rsquo;</strong> [${i}]: follow
               <strong>${prevV}&nbsp;&rarr;<sup>${ch}</sup>&nbsp;${v}</strong>.
               Match length: ${l}.
               ${newBest ? `&#x2B50; New best: <strong>&ldquo;${query.slice(bestEnd - bestL + 1, bestEnd + 1)}&rdquo;</strong> (${bestL}).` : ''}</p>`,
      });
    } else {
      // Backtrack
      const backPath = [];
      while (v !== -1 && (!states[v] || states[v].next[ch] === undefined)) {
        backPath.push(v);
        v = (states[v] && states[v].link !== undefined) ? states[v].link : -1;
      }
      if (v === -1) {
        v = 0; l = 0;
        steps.push({
          v, l, bestL, bestEnd,
          charIndex: i,
          hl: { curState: 0 },
          html: `<p><strong>&lsquo;${ch}&rsquo;</strong> [${i}]: backtracked
                 ${backPath.join('&nbsp;&rarr;&nbsp;')}&nbsp;&rarr;&nbsp;null.
                 &lsquo;${ch}&rsquo; not in base word. Reset to root, match length = 0.</p>`,
        });
      } else {
        const landV = v;
        l = states[v].len + 1;
        v = states[v].next[ch];
        const newBest = l > bestL;
        if (newBest) { bestL = l; bestEnd = i; }
        steps.push({
          v, l, bestL, bestEnd,
          charIndex: i,
          hl: { curState: v, activeEdge: { from: landV, to: v } },
          html: `<p><strong>&lsquo;${ch}&rsquo;</strong> [${i}]: backtracked
                 ${backPath.join('&nbsp;&rarr;&nbsp;')}&nbsp;&rarr;&nbsp;state&nbsp;${landV},
                 found &lsquo;${ch}&rsquo;&nbsp;&rarr;&nbsp;state&nbsp;${v}.
                 Match length: <code>len(${landV})+1 = ${l}</code>
                 (state&nbsp;${landV} guarantees ${states[landV] ? states[landV].len : '?'} matching chars, plus &lsquo;${ch}&rsquo;).
                 ${newBest ? `&#x2B50; New best: <strong>&ldquo;${query.slice(bestEnd - bestL + 1, bestEnd + 1)}&rdquo;</strong> (${bestL}).` : ''}</p>`,
        });
      }
    }
  }

  const lcs = bestEnd >= 0 ? query.slice(bestEnd - bestL + 1, bestEnd + 1) : '';
  steps.push({
    v, l, bestL, bestEnd,
    charIndex: query.length,
    hl: {},
    html: `<p>&#x1F3C1; <strong>Traversal complete!</strong></p>
           <p>The <strong>Longest Common Substring</strong> is
           <strong>&ldquo;${lcs || '(none)' }&rdquo;</strong>
           (length&nbsp;${bestL}).</p>
           <p>Algorithm ran in O(|query|) time — one pass through the automaton.</p>`,
    done: true,
  });

  return steps;
}

// ── RENDER CONSTRUCTION STEP ──────────────────────────────────
function renderConstruct(i) {
  cIndex = i;
  const step = cSteps[i];
  const total = cSteps.length - 1;

  // Positions are pre-computed from the final states (stable layout throughout)
  const { w, h } = renderGraph(constructSvg, step.snapshot, cPositions, step.hl);
  cViewport.autoFit(w, h);
  constructExplain.innerHTML = step.html;
  constructCounter.textContent = `Step ${i} / ${total}`;
  constructProgress.style.width = `${(i / total) * 100}%`;
  constructProgress.setAttribute('aria-valuenow', Math.round((i / total) * 100));
  cPrev.disabled = i === 0;
  cNext.disabled = i === total;
}

// ── RENDER TRAVERSAL STEP ─────────────────────────────────────
function renderTraverse(i) {
  tIndex = i;
  const step  = tSteps[i];
  const total = tSteps.length - 1;

  const { w: tw, h: th } = renderGraph(traverseSvg, savedFinalStates, tPositions, step.hl);
  tViewport.autoFit(tw, th);
  traverseExplain.innerHTML = step.html;
  traverseCounter.textContent = `Step ${i} / ${total}`;
  traverseProgress.style.width = `${(i / total) * 100}%`;
  traverseProgress.setAttribute('aria-valuenow', Math.round((i / total) * 100));
  tPrev.disabled = i === 0;
  tNext.disabled = i === total;

  // Update word track
  const query = queryWordInput.value; // always the sanitized word
  const chars = wordTrack.querySelectorAll('span');
  chars.forEach((span, idx) => {
    span.className = idx < step.charIndex ? 'wt-done'
                   : idx === step.charIndex ? 'wt-active'
                   : '';
  });

  // Update LCS display
  const lcs = step.bestEnd >= 0
    ? query.slice(step.bestEnd - step.bestL + 1, step.bestEnd + 1)
    : '';
  lcsValue.textContent = lcs || '\u2014';
  lcsLen.textContent   = step.bestL;
}

// ── SETUP HANDLER ─────────────────────────────────────────────
setupForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const base = sanitize(baseWordInput.value);

  if (base.length < 2) {
    setupError.textContent = 'Base word must be at least 2 letters.';
    return;
  }
  setupError.textContent = '';
  baseWordInput.value = base;

  // ── Build construction ──
  const { steps, finalStates } = buildConstructSteps(base);
  cSteps           = steps;
  cIndex           = 0;
  cPositions       = layoutPositions(finalStates);   // stable len-based layout
  savedFinalStates = finalStates;

  // Reset traverse section in case of re-build
  traverseSection.classList.add('hidden');
  constructSection.classList.remove('hidden');
  querySection.classList.remove('hidden');
  renderConstruct(0);

  constructSection.scrollIntoView({ behavior: 'smooth' });
});

// ── QUERY HANDLER ─────────────────────────────────────────────
queryForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = sanitize(queryWordInput.value);

  if (query.length < 1) {
    queryError.textContent = 'Query must be at least 1 letter.';
    return;
  }
  queryError.textContent = '';
  queryWordInput.value = query;

  // ── Build traversal ──
  tSteps     = buildTraverseSteps(query, savedFinalStates);
  tIndex     = 0;
  tPositions = layoutPositions(savedFinalStates);   // same layout for traversal

  // Populate word track
  wordTrack.innerHTML = query.split('').map(c => `<span>${c}</span>`).join('');

  traverseSection.classList.remove('hidden');
  renderTraverse(0);

  traverseSection.scrollIntoView({ behavior: 'smooth' });
});

// ── Navigation buttons ────────────────────────────────────────
cPrev.addEventListener('click', () => { if (cIndex > 0) renderConstruct(cIndex - 1); });
cNext.addEventListener('click', () => { if (cIndex < cSteps.length - 1) renderConstruct(cIndex + 1); });
tPrev.addEventListener('click', () => { if (tIndex > 0) renderTraverse(tIndex - 1); });
tNext.addEventListener('click', () => { if (tIndex < tSteps.length - 1) renderTraverse(tIndex + 1); });

// ── Keyboard navigation (accessibility) ──────────────────────
document.addEventListener('keydown', (e) => {
  const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (inInput) return;
  if (e.key === 'ArrowRight') {
    if (!constructSection.classList.contains('hidden') && cIndex < cSteps.length - 1) {
      renderConstruct(cIndex + 1);
    }
  }
  if (e.key === 'ArrowLeft') {
    if (!constructSection.classList.contains('hidden') && cIndex > 0) {
      renderConstruct(cIndex - 1);
    }
  }
});

// ── Theme toggle ──────────────────────────────────────────────
const themeToggle = document.getElementById('themeToggle');
function applyTheme(theme) {
  document.documentElement.classList.remove('theme-light', 'theme-dark');
  document.documentElement.classList.add('theme-' + theme);
  themeToggle.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  localStorage.setItem('theme', theme);
}
themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.classList.contains('theme-dark');
  applyTheme(isDark ? 'light' : 'dark');
});
const _initTheme = localStorage.getItem('theme') ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
applyTheme(_initTheme);