"use strict";

/* ============================================================
   Suffix Trie — step-by-step educational explainer
   ============================================================ */

// ── DOM refs ──────────────────────────────────────────────────
const setupForm      = document.getElementById('setupForm');
const baseWordInput  = document.getElementById('baseWordInput');
const queryWordInput = document.getElementById('queryWordInput');
const setupError     = document.getElementById('setupError');

const constructSection  = document.getElementById('constructSection');
const constructSvg      = document.getElementById('constructSvg');
const constructCounter  = document.getElementById('constructCounter');
const constructExplain  = document.getElementById('constructExplain');
const constructProgress = document.getElementById('constructProgress');
const cPrev = document.getElementById('cPrev');
const cNext = document.getElementById('cNext');

const traverseSection  = document.getElementById('traverseSection');
const traverseSvg      = document.getElementById('traverseSvg');
const traverseCounter  = document.getElementById('traverseCounter');
const traverseExplain  = document.getElementById('traverseExplain');
const traverseProgress = document.getElementById('traverseProgress');
const wordTrack        = document.getElementById('wordTrack');
const searchStatus     = document.getElementById('searchStatus');
const tPrev = document.getElementById('tPrev');
const tNext = document.getElementById('tNext');

// ── Module-level state ────────────────────────────────────────
let cSteps = [], cIndex = 0, cPositions = {};
let tSteps = [], tIndex = 0;
let savedFinalNodes = [];

// ── Helpers ───────────────────────────────────────────────────
const sanitize  = s => s.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8);
const cloneNode = n => ({
  id: n.id,
  depth: n.depth,
  parent: n.parent,
  parentChar: n.parentChar,
  children: { ...n.children },
  isEnd: n.isEnd,
  suffixIndices: n.suffixIndices ? [...n.suffixIndices] : [],
});
const cloneArr = arr => arr.map(cloneNode);

// ── Tree layout: DFS post-order, leaves fill unique Y slots ───
// Uses the structure of the final trie so positions stay stable
// across all intermediate snapshots.
function computeLayout(nodes) {
  const PAD_X = 55, COL_W = 100, ROW_H = 70, PAD_Y = 40;
  let ySlot = 0;

  // We need a DFS order using the children object.
  // Children are stored as {char: nodeId}; sort by char for determinism.
  function assignSlot(id) {
    const node = nodes[id];
    const childIds = Object.keys(node.children)
      .sort()
      .map(ch => node.children[ch]);

    if (childIds.length === 0) {
      node._slot = ySlot++;
    } else {
      childIds.forEach(cid => assignSlot(cid));
      const slots = childIds.map(cid => nodes[cid]._slot);
      node._slot = (Math.min(...slots) + Math.max(...slots)) / 2;
    }
  }

  // Clear stale slots before re-computing
  nodes.forEach(n => delete n._slot);
  assignSlot(0);

  const positions = {};
  for (const n of nodes) {
    if (n._slot !== undefined) {
      positions[n.id] = {
        x: PAD_X + n.depth * COL_W,
        y: PAD_Y + n._slot * ROW_H,
      };
    }
  }
  return positions;
}

function svgDimensionsFromPositions(positions) {
  const vals = Object.values(positions);
  if (!vals.length) return { w: 300, h: 180 };
  return {
    w: Math.max(300, Math.max(...vals.map(p => p.x)) + 70),
    h: Math.max(180, Math.max(...vals.map(p => p.y)) + 60),
  };
}

// ── Draw a straight arrow between two node centres ────────────
function drawArrow(p1, p2, R, lineClass, markerId, label) {
  const dx   = p2.x - p1.x, dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy) || 0.01;
  const nx   = dx / dist, ny = dy / dist;

  const sx = p1.x + nx * R;
  const sy = p1.y + ny * R;
  const ex = p2.x - nx * (R + 6);
  const ey = p2.y - ny * (R + 6);

  const lx = (sx + ex) / 2;
  const ly = (sy + ey) / 2;

  // Perpendicular offset for label so it doesn't sit on the line
  const offx = -ny * 11, offy = nx * 11;

  let gml = `<g class="${lineClass}">`;
  gml += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" marker-end="url(#${markerId})"/>`;
  if (label) {
    gml += `<text x="${(lx + offx).toFixed(1)}" y="${(ly + offy).toFixed(1)}">${label}</text>`;
  }
  gml += '</g>';
  return gml;
}

// ── Render the trie into an SVG element ───────────────────────
function renderGraph(svgEl, nodes, positions, hl = {}) {
  const { newNodes = [], modNodes = [], curNode = -1, activeEdge = null } = hl;
  const R = 20;

  // Only show positions for nodes that exist in this snapshot
  const visiblePos = {};
  for (const n of nodes) {
    if (positions[n.id]) visiblePos[n.id] = positions[n.id];
  }
  if (!Object.keys(visiblePos).length) return;

  const { w, h } = svgDimensionsFromPositions(visiblePos);
  svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svgEl.style.width  = `${w}px`;
  svgEl.style.height = `${h}px`;

  let mk = `<defs>
    <marker id="ah"     viewBox="0 0 10 7" markerWidth="7" markerHeight="5" refX="8" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7"/></marker>
    <marker id="ah-new" viewBox="0 0 10 7" markerWidth="7" markerHeight="5" refX="8" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7"/></marker>
    <marker id="ah-mod" viewBox="0 0 10 7" markerWidth="7" markerHeight="5" refX="8" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7"/></marker>
    <marker id="ah-hot" viewBox="0 0 10 7" markerWidth="7" markerHeight="5" refX="8" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7"/></marker>
  </defs>
  <style>
    #ah polygon     { fill: var(--edge-color); }
    #ah-new polygon { fill: var(--new-color); }
    #ah-mod polygon { fill: var(--mod-color); }
    #ah-hot polygon { fill: var(--hot); }
  </style>`;

  // Draw edges (parent → child)
  for (const n of nodes) {
    if (!visiblePos[n.id]) continue;
    for (const [ch, childId] of Object.entries(n.children)) {
      if (!visiblePos[childId]) continue;
      const p1 = visiblePos[n.id], p2 = visiblePos[childId];
      const isActive = activeEdge && activeEdge.from === n.id && activeEdge.to === childId;
      const isNew    = newNodes.includes(childId);
      const cls  = isActive ? 's-edge active-trav' : isNew ? 's-edge new' : 's-edge';
      const mid  = isActive ? 'ah-hot' : isNew ? 'ah-new' : 'ah';
      mk += drawArrow(p1, p2, R, cls, mid, ch);
    }
  }

  // Draw nodes on top
  for (const n of nodes) {
    const pos = visiblePos[n.id];
    if (!pos) continue;
    const isNewN = newNodes.includes(n.id);
    const isModN = modNodes.includes(n.id);
    const isCur  = curNode === n.id;
    const classes = ['s-node',
      isNewN ? 'new' : isModN ? 'mod' : isCur ? 'cur' : '',
      n.isEnd ? 'leaf' : '',
    ].filter(Boolean).join(' ');

    mk += `<g class="${classes}">
      <circle cx="${pos.x}" cy="${pos.y}" r="${R}"/>
      ${n.isEnd ? `<circle class="leaf-inner" cx="${pos.x}" cy="${pos.y}" r="${R - 4}"/>` : ''}
      <text x="${pos.x}" y="${pos.y}">${n.id}</text>
    </g>`;
  }

  svgEl.innerHTML = mk;
}

// ── BUILD CONSTRUCTION STEPS ──────────────────────────────────
function buildTrieSteps(word) {
  // nodes[0] = root
  const nodes = [{
    id: 0, depth: 0, parent: -1, parentChar: '',
    children: {}, isEnd: false, suffixIndices: [],
  }];

  const steps = [];

  const suffixList = word.split('').map((_, i) => `&ldquo;${word.slice(i)}&rdquo;`).join(', ');
  steps.push({
    snapshot: cloneArr(nodes),
    hl: { newNodes: [0] },
    html: `<p>We start with a single <strong>root node (node&nbsp;0)</strong>. It represents the
           empty string — every path through the trie begins here.</p>
           <p>We will insert all ${word.length} suffix${word.length !== 1 ? 'es' : ''}
           of <strong>&ldquo;${word}&rdquo;</strong> in order: ${suffixList}.</p>`,
  });

  for (let si = 0; si < word.length; si++) {
    const suffix = word.slice(si);

    steps.push({
      snapshot: cloneArr(nodes),
      hl: { curNode: 0 },
      html: `<p>Inserting suffix <strong>#${si + 1} of ${word.length}: &ldquo;${suffix}&rdquo;</strong>
             (the suffix starting at position&nbsp;${si} in &ldquo;${word}&rdquo;).</p>
             <p>Start at the root and walk each character, creating a new node whenever
             the required edge is missing.</p>`,
    });

    let cur = 0;
    for (let ci = 0; ci < suffix.length; ci++) {
      const ch = suffix[ci];

      if (nodes[cur].children[ch] !== undefined) {
        const nextId = nodes[cur].children[ch];
        steps.push({
          snapshot: cloneArr(nodes),
          hl: { modNodes: [cur, nextId], curNode: nextId, activeEdge: { from: cur, to: nextId } },
          html: `<p>Character <strong>&lsquo;${ch}&rsquo;</strong>:
                 node&nbsp;${cur} already has a child labelled &lsquo;${ch}&rsquo;
                 (node&nbsp;${nextId}).</p>
                 <p>Follow the existing edge &mdash; no new node needed here.
                 This is what makes a trie compact for shared prefixes.</p>`,
        });
        cur = nextId;

      } else {
        const newId = nodes.length;
        nodes.push({
          id: newId,
          depth: nodes[cur].depth + 1,
          parent: cur,
          parentChar: ch,
          children: {},
          isEnd: false,
          suffixIndices: [],
        });
        nodes[cur].children[ch] = newId;

        steps.push({
          snapshot: cloneArr(nodes),
          hl: { newNodes: [newId], modNodes: [cur], curNode: newId, activeEdge: { from: cur, to: newId } },
          html: `<p>Character <strong>&lsquo;${ch}&rsquo;</strong>:
                 node&nbsp;${cur} has <em>no</em> child labelled &lsquo;${ch}&rsquo;.</p>
                 <p>Create <strong>new node&nbsp;${newId}</strong> (depth&nbsp;${nodes[newId].depth})
                 and add a &lsquo;${ch}&rsquo; edge from node&nbsp;${cur}
                 to node&nbsp;${newId}.</p>`,
        });
        cur = newId;
      }
    }

    // Mark end of suffix
    nodes[cur].isEnd = true;
    nodes[cur].suffixIndices.push(si);

    steps.push({
      snapshot: cloneArr(nodes),
      hl: { modNodes: [cur], curNode: cur },
      html: `<p>&#x2705; End of suffix <strong>&ldquo;${suffix}&rdquo;</strong>.
             Mark node&nbsp;${cur} as a <strong>leaf</strong> (double circle).
             This records that the suffix starting at position&nbsp;${si}
             ends at this node.</p>
             <p>Leaves are evidence: &ldquo;any path reaching me spells
             a valid suffix of the original string.&rdquo;</p>`,
    });
  }

  // Final step
  const totalNodes = nodes.length;
  const nSquared   = word.length * word.length;
  steps.push({
    snapshot: cloneArr(nodes),
    hl: {},
    html: `<p>&#x1F3C1; <strong>Construction complete!</strong></p>
           <p>The suffix trie for <strong>&ldquo;${word}&rdquo;</strong>
           has <strong>${totalNodes}&nbsp;nodes</strong>.
           For a string of length&nbsp;${word.length}, the worst case is
           O(n&sup2;)&nbsp;=&nbsp;O(${nSquared}) nodes.</p>
           <p>Every substring of &ldquo;${word}&rdquo; can now be found in
           O(|pattern|) time by walking from the root. Scroll down to try it!
           Then visit <a href="../yo-dawg/yo-dawg.html">Yo&nbsp;DAWG</a> to see
           how to represent the same information with at most 2n&minus;1 states.</p>`,
    done: true,
  });

  return { steps, finalNodes: cloneArr(nodes) };
}

// ── BUILD SEARCH STEPS ────────────────────────────────────────
function buildSearchSteps(pattern, nodes) {
  const steps = [];
  let cur = 0;
  let foundSoFar = true;

  steps.push({
    curNode: 0,
    charIndex: -1,
    found: null,
    hl: { curNode: 0 },
    html: `<p>Searching for <strong>&ldquo;${pattern}&rdquo;</strong> in the suffix trie.</p>
           <p>Start at <strong>root (node&nbsp;0)</strong> and try to follow each character
           of the pattern in turn. If every step succeeds, the pattern is a substring of
           the original word!</p>`,
  });

  for (let i = 0; i < pattern.length && foundSoFar; i++) {
    const ch = pattern[i];
    if (nodes[cur] && nodes[cur].children[ch] !== undefined) {
      const prevCur = cur;
      cur = nodes[cur].children[ch];
      steps.push({
        curNode: cur,
        charIndex: i,
        found: null,
        hl: { curNode: cur, activeEdge: { from: prevCur, to: cur } },
        html: `<p>Character <strong>&lsquo;${ch}&rsquo;</strong> (index&nbsp;${i}):
               node&nbsp;${prevCur} has an edge labelled &lsquo;${ch}&rsquo;
               to node&nbsp;${cur}. Follow it!</p>
               <p>${i + 1 < pattern.length
                 ? `${pattern.length - i - 1} character(s) remaining&hellip;`
                 : 'That was the last character of the pattern.'}</p>`,
      });
    } else {
      foundSoFar = false;
      steps.push({
        curNode: cur,
        charIndex: i,
        found: false,
        hl: { curNode: cur },
        html: `<p>Character <strong>&lsquo;${ch}&rsquo;</strong> (index&nbsp;${i}):
               node&nbsp;${cur} has <strong>no edge labelled &lsquo;${ch}&rsquo;</strong>.
               Dead end!</p>
               <p>The pattern <strong>&ldquo;${pattern}&rdquo;</strong> is
               <strong>not</strong> a substring of the original word.</p>`,
      });
    }
  }

  if (foundSoFar) {
    steps.push({
      curNode: cur,
      charIndex: pattern.length,
      found: true,
      hl: { curNode: cur },
      html: `<p>&#x2705; <strong>Found!</strong> Every character of
             <strong>&ldquo;${pattern}&rdquo;</strong> was matched without
             hitting a dead end.</p>
             <p>The pattern is a substring of the original word. The search took
             exactly <strong>${pattern.length} step${pattern.length !== 1 ? 's' : ''}</strong>
             &mdash; O(|pattern|) time, regardless of how long the original word was.</p>`,
    });
  }

  return steps;
}

// ── RENDER CONSTRUCTION STEP ──────────────────────────────────
function renderConstruct(i) {
  cIndex = i;
  const step  = cSteps[i];
  const total = cSteps.length - 1;
  renderGraph(constructSvg, step.snapshot, cPositions, step.hl);
  constructExplain.innerHTML = step.html;
  constructCounter.textContent = `Step ${i}&nbsp;/&nbsp;${total}`;
  constructProgress.style.width = `${(i / total) * 100}%`;
  constructProgress.setAttribute('aria-valuenow', Math.round((i / total) * 100));
  cPrev.disabled = i === 0;
  cNext.disabled = i === total;
}

// ── RENDER SEARCH STEP ────────────────────────────────────────
function renderSearch(i) {
  tIndex = i;
  const step  = tSteps[i];
  const total = tSteps.length - 1;
  renderGraph(traverseSvg, savedFinalNodes, cPositions, step.hl);
  traverseExplain.innerHTML = step.html;
  traverseCounter.textContent = `Step ${i}&nbsp;/&nbsp;${total}`;
  traverseProgress.style.width = `${(i / total) * 100}%`;
  traverseProgress.setAttribute('aria-valuenow', Math.round((i / total) * 100));
  tPrev.disabled = i === 0;
  tNext.disabled = i === total;

  const chars = wordTrack.querySelectorAll('span');
  chars.forEach((span, idx) => {
    span.className = idx < step.charIndex ? 'wt-done'
                   : idx === step.charIndex ? 'wt-active'
                   : '';
  });

  if (step.found === true)  searchStatus.textContent = '\u2705 Found \u2014 it IS a substring!';
  else if (step.found === false) searchStatus.textContent = '\u274C Not found \u2014 not a substring!';
  else searchStatus.textContent = '\u2014';
}

// ── SETUP HANDLER ─────────────────────────────────────────────
setupForm.addEventListener('submit', e => {
  e.preventDefault();
  const base  = sanitize(baseWordInput.value);
  const query = sanitize(queryWordInput.value);

  if (base.length < 2) {
    setupError.textContent = 'Base word must be at least 2 letters.';
    return;
  }
  if (query.length < 1) {
    setupError.textContent = 'Search pattern must be at least 1 letter.';
    return;
  }
  setupError.textContent = '';
  baseWordInput.value  = base;
  queryWordInput.value = query;

  const { steps, finalNodes } = buildTrieSteps(base);
  cSteps          = steps;
  cIndex          = 0;
  savedFinalNodes = finalNodes;
  cPositions      = computeLayout(finalNodes);

  constructSection.classList.remove('hidden');
  renderConstruct(0);

  tSteps = buildSearchSteps(query, finalNodes);
  tIndex = 0;

  wordTrack.innerHTML = query.split('').map(c => `<span>${c}</span>`).join('');
  traverseSection.classList.remove('hidden');
  renderSearch(0);

  constructSection.scrollIntoView({ behavior: 'smooth' });
});

// ── Navigation buttons ────────────────────────────────────────
cPrev.addEventListener('click', () => { if (cIndex > 0) renderConstruct(cIndex - 1); });
cNext.addEventListener('click', () => { if (cIndex < cSteps.length - 1) renderConstruct(cIndex + 1); });
tPrev.addEventListener('click', () => { if (tIndex > 0) renderSearch(tIndex - 1); });
tNext.addEventListener('click', () => { if (tIndex < tSteps.length - 1) renderSearch(tIndex + 1); });

// ── Keyboard navigation (accessibility) ──────────────────────
document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
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
