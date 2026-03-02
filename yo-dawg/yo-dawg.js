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

  const COL_W   = 130;
  const ROW_H   = 80;
  const PAD_X   = 55;
  const PAD_Y   = 40;
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
  svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svgEl.style.width  = `${w}px`;
  svgEl.style.height = `${h}px`;

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
  const transPairs = new Set(Object.keys(transMap));
  const hasReverse = (f, t) => transPairs.has(`${t}\u2192${f}`);

  // ── Collect suffix links ──
  const linkEdges = [];
  states.forEach(s => {
    if (s.link === -1 || !positions[s.id] || !positions[s.link]) return;
    linkEdges.push({ from: s.id, to: s.link });
  });
  const linkPairs = new Set(linkEdges.map(e => `${e.from}\u2192${e.to}`));
  const sharedPair = (f, t) =>
    linkPairs.has(`${f}\u2192${t}`) || linkPairs.has(`${t}\u2192${f}`);

  // ── Draw suffix links first (underneath transitions) ──
  linkEdges.forEach(e => {
    const p1 = positions[e.from], p2 = positions[e.to];
    // Suffix links almost always go right→left; curve them well below
    // so they run under the transitions between the same pair.
    const goRight = p2.x >= p1.x;
    let curve = goRight ? 58 : -58;
    // Share a pair with a transition → push even further
    if (sharedPair(e.from, e.to)) curve += goRight ? 18 : -18;
    const enew = hlEdge(newEdges, e.from, e.to);
    const emod = hlEdge(modEdges, e.from, e.to);
    const cls = enew ? 's-slink new' : emod ? 's-slink mod' : 's-slink';
    const mid = enew ? 'ah-new' : emod ? 'ah-mod' : 'ah-lnk';
    mk += drawArrow(p1, p2, R, cls, mid, null, curve);
  });

  // ── Draw transitions ──
  Object.values(transMap).forEach(({ from, to, chs }) => {
    const p1  = positions[from], p2 = positions[to];
    const n   = chs.length;
    const goRight = p2.x >= p1.x;
    // Bidirectional transitions → push each side away from center
    const bidir   = hasReverse(from, to);
    let baseCurve = goRight ? -22 : 22;
    if (bidir) baseCurve = goRight ? -38 : 38;

    chs.forEach((ch, i) => {
      // Fan multiple transitions between the same pair
      const spread = n > 1 ? (i - (n - 1) / 2) * 30 : 0;
      const curve  = baseCurve + spread;
      const isActive = activeEdge && activeEdge.from === from && activeEdge.to === to;
      const enew = hlEdge(newEdges, from, to, ch);
      const emod = hlEdge(modEdges, from, to, ch);
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

  svgEl.innerHTML = mk;
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
    html: `<p>We start with a single <strong>root (state&nbsp;0)</strong>. Every suffix automaton
           begins here. Its <code>len = 0</code> — it represents the empty string.
           Its suffix link is &minus;1 (none), since there&rsquo;s nothing shorter to fall back to.</p>`,
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
      html: `<p>Processing character <strong>&lsquo;${ch}&rsquo;</strong> (building prefix
             &ldquo;${wordSoFar}&rdquo;).</p>
             <p>Create <strong>state&nbsp;${cur}</strong> with
             <code>len&nbsp;=&nbsp;${states[cur].len}</code>
             &nbsp;(= last.len + 1).
             This will represent all new suffixes ending here.</p>`,
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
        html: `<p>State&nbsp;${fp} has no &lsquo;${ch}&rsquo; transition.
               Add edge <strong>${fp}&nbsp;&rarr;<sup>${ch}</sup>&nbsp;${cur}</strong>.</p>
               <p>Follow suffix link from&nbsp;${fp}
               &rarr;&nbsp;${states[fp].link === -1 ? 'null (end of suffix chain)' : 'state&nbsp;' + states[fp].link}.</p>`,
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
        html: `<p>Reached the end of the suffix chain (null) without finding an existing
               &lsquo;${ch}&rsquo; &mdash; every suffix of the current prefix is brand new.</p>
               <p>Set <strong>suffix link of state&nbsp;${cur} &rarr; root (state&nbsp;0)</strong>.</p>`,
      });
    } else {
      const q = states[p].next[ch];
      if (states[p].len + 1 === states[q].len) {
        states[cur].link = q;
        steps.push({
          snapshot: cloneArr(states),
          last,
          hl: { modStates: [cur, q], newEdges: [{ from: cur, to: q, type: 'link' }] },
          html: `<p>Stopped at state&nbsp;${p} which already has &lsquo;${ch}&rsquo;&nbsp;&rarr;&nbsp;state&nbsp;${q}.</p>
                 <p>Check: <code>len(${p}) + 1 = ${states[p].len + 1} = len(${q}) = ${states[q].len}</code>. ✓
                 State&nbsp;${q} is already the correct minimal representative.</p>
                 <p>Set <strong>suffix link of state&nbsp;${cur} &rarr; state&nbsp;${q}</strong>.</p>`,
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
          html: `<p>Stopped at state&nbsp;${p} with &lsquo;${ch}&rsquo;&nbsp;&rarr;&nbsp;state&nbsp;${q}, but
                 <code>len(${p})+1 = ${states[p].len + 1} &ne; len(${q}) = ${states[q].len}</code>.</p>
                 <p>State&nbsp;${q} is too &ldquo;long&rdquo;. We must <strong>clone</strong> it:
                 new <strong>state&nbsp;${clone}</strong> gets <code>len&nbsp;=&nbsp;${states[clone].len}</code>
                 and inherits all of ${q}&rsquo;s transitions and suffix link.</p>`,
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
            html: `<p>State&nbsp;${fpp} had &lsquo;${ch}&rsquo;&nbsp;&rarr;&nbsp;state&nbsp;${q}.
                   <strong>Redirect</strong> to the clone (state&nbsp;${clone}), so paths
                   to shorter suffixes use the shorter representative.</p>
                   <p>Continue up suffix links from state&nbsp;${fpp}&hellip;</p>`,
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
          html: `<p>Set suffix link of original <strong>state&nbsp;${q}</strong> and new
                 <strong>state&nbsp;${cur}</strong> both to point to the clone
                 <strong>(state&nbsp;${clone})</strong>.</p>
                 <p>The clone now sits between them in the suffix-link tree,
                 restoring the length invariant.</p>`,
        });
      }
    }

    last = cur;
    steps.push({
      snapshot: cloneArr(states),
      last: cur,
      hl: { curState: cur },
      html: `<p>&#x2705; <strong>&lsquo;${ch}&rsquo; complete.</strong>
             State&nbsp;${cur} is the new &ldquo;last&rdquo; state — it represents
             the full prefix <strong>&ldquo;${wordSoFar}&rdquo;</strong> just read.</p>
             <p>The DAWG now accepts all substrings of <strong>&ldquo;${wordSoFar}&rdquo;</strong>.</p>`,
    });
  }

  // Final
  steps.push({
    snapshot: cloneArr(states),
    last,
    hl: {},
    html: `<p>&#x1F3C1; <strong>Construction complete!</strong></p>
           <p>The DAWG for <strong>&ldquo;${word}&rdquo;</strong> has
           <strong>${states.length}&nbsp;states</strong>. It accepts all
           ${word.length * (word.length + 1) / 2} possible substrings of the word
           using only these states. Scroll down to see the LCS traversal!</p>`,
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
    html: `<p>Begin at <strong>root (state&nbsp;0)</strong>, match length&nbsp;= 0.</p>
           <p>We will read the query word <strong>&ldquo;${query}&rdquo;</strong>
           one character at a time, following transitions where possible and
           backtracking up suffix links when stuck.</p>`,
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
        html: `<p>Character <strong>&lsquo;${ch}&rsquo;</strong> (index&nbsp;${i}):
               state&nbsp;${prevV} has a direct transition
               <strong>${prevV}&nbsp;&rarr;<sup>${ch}</sup>&nbsp;${v}</strong>. Follow it.</p>
               <p>Match length: ${l}.</p>
               ${newBest ? `<p>&#x2B50; New best run: <strong>&ldquo;${query.slice(bestEnd - bestL + 1, bestEnd + 1)}&rdquo;</strong> (length&nbsp;${bestL}).</p>` : ''}`,
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
          html: `<p>Character <strong>&lsquo;${ch}&rsquo;</strong> (index&nbsp;${i}):
                 backtracked through ${backPath.length} suffix link(s)
                 (${backPath.join('&nbsp;&rarr;&nbsp;')}&nbsp;&rarr;&nbsp;null).</p>
                 <p>No match found. Reset to state&nbsp;0, match length&nbsp;= 0.
                 This character cannot extend any common substring.</p>`,
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
          html: `<p>Character <strong>&lsquo;${ch}&rsquo;</strong> (index&nbsp;${i}):
                 backtracked ${backPath.length} step(s)
                 (${backPath.join('&nbsp;&rarr;&nbsp;')}&nbsp;&rarr;&nbsp;state&nbsp;${landV})
                 and found a &lsquo;${ch}&rsquo; transition to state&nbsp;${v}.</p>
                 <p>Match length reset to <code>len(${landV})+1 = ${l}</code>.</p>
                 ${newBest ? `<p>&#x2B50; New best: <strong>&ldquo;${query.slice(bestEnd - bestL + 1, bestEnd + 1)}&rdquo;</strong> (length&nbsp;${bestL}).</p>` : ''}`,
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
  renderGraph(constructSvg, step.snapshot, cPositions, step.hl);
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

  renderGraph(traverseSvg, savedFinalStates, tPositions, step.hl);
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