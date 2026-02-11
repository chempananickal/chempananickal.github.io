const baseWordInput = document.getElementById("baseWord");
const queryWordInput = document.getElementById("queryWord");
const startGameButton = document.getElementById("startGame");
const setupError = document.getElementById("setupError");
const gameArea = document.getElementById("gameArea");

const tabButtons = document.querySelectorAll(".tab");
const tabPanels = document.querySelectorAll(".tab-panel");

const buildScore = document.getElementById("buildScore");
const buildAccuracy = document.getElementById("buildAccuracy");
const buildStep = document.getElementById("buildStep");
const stepHint = document.getElementById("stepHint");
const buildProgressBar = document.getElementById("buildProgressBar");
const buildFeedback = document.getElementById("buildFeedback");
const spawnStateButton = document.getElementById("spawnState");
const spawnCloneButton = document.getElementById("spawnClone");
const autoStepButton = document.getElementById("autoStep");
const currentRune = document.getElementById("currentRune");
const buildMode = document.getElementById("buildMode");
const buildBoard = document.getElementById("buildBoard");

const traversalScore = document.getElementById("traversalScore");
const currentMatch = document.getElementById("currentMatch");
const lcsValue = document.getElementById("lcsValue");
const wordTrack = document.getElementById("wordTrack");
const currentLetter = document.getElementById("currentLetter");
const skipLetter = document.getElementById("skipLetter");
const restartTraversal = document.getElementById("restartTraversal");
const traversalFeedback = document.getElementById("traversalFeedback");
const traverseBoard = document.getElementById("traverseBoard");

const gameState = {
  baseWord: "",
  queryWord: "",
  buildSteps: [],
  expectedStates: [],
  playerStates: [],
  playerPositions: {},
  expectedPositions: {},
  stepIndex: 0,
  score: 0,
  attempts: 0,
  correct: 0,
  traversalIndex: 0,
  traversalState: 0,
  traversalScore: 0,
  traversalLength: 0,
  bestLength: 0,
  bestSubstring: "",
  targetLcs: "",
  decoys: [],
  pawnId: null,
  activeTool: null,
  dragState: null,
};

const sanitizeWord = (word) => word.toLowerCase().replace(/[^a-z]/g, "");

const makeState = (id, len = 0, link = -1) => ({
  id,
  len,
  link,
  next: {},
});

const cloneState = (source, id, len) => ({
  id,
  len,
  link: source.link,
  next: { ...source.next },
});

const generateBuildSteps = (word) => {
  const states = [makeState(0)];
  let last = 0;
  const steps = [];

  for (const ch of word) {
    const cur = states.length;
    states.push(makeState(cur, states[last].len + 1));
    steps.push({ type: "create_state", id: cur, len: states[cur].len, letter: ch });

    let p = last;
    while (p !== -1 && states[p].next[ch] === undefined) {
      states[p].next[ch] = cur;
      steps.push({ type: "add_transition", from: p, to: cur, letter: ch });
      p = states[p].link;
    }

    if (p === -1) {
      states[cur].link = 0;
      steps.push({ type: "set_link", from: cur, to: 0 });
    } else {
      const q = states[p].next[ch];
      if (states[p].len + 1 === states[q].len) {
        states[cur].link = q;
        steps.push({ type: "set_link", from: cur, to: q });
      } else {
        const clone = states.length;
        states.push(cloneState(states[q], clone, states[p].len + 1));
        steps.push({ type: "create_clone", id: clone, cloneOf: q, len: states[clone].len });

        while (p !== -1 && states[p].next[ch] === q) {
          states[p].next[ch] = clone;
          steps.push({ type: "redirect_transition", from: p, to: clone, letter: ch });
          p = states[p].link;
        }

        states[q].link = clone;
        steps.push({ type: "set_link", from: q, to: clone });
        states[cur].link = clone;
        steps.push({ type: "set_link", from: cur, to: clone });
      }
    }

    last = cur;
  }

  return { steps, states };
};

const layoutPositions = (count, width = 800, height = 400) => {
  const positions = {};
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2.6;

  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / Math.max(1, count);
    const jitter = (i % 3) * 10;
    positions[i] = {
      x: centerX + Math.cos(angle) * (radius + jitter),
      y: centerY + Math.sin(angle) * (radius + jitter),
    };
  }

  positions[0] = { x: centerX - radius * 0.3, y: centerY + radius * 0.3 };
  return positions;
};

const toSvgPoint = (svg, event) => {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
};

const setActiveTool = (tool) => {
  gameState.activeTool = tool;
  spawnStateButton.classList.toggle("btn--active", tool === "spawn_state");
  spawnCloneButton.classList.toggle("btn--active", tool === "spawn_clone");

  if (tool === "spawn_state") {
    buildMode.textContent = "Tap the board to place your new orb.";
  } else if (tool === "spawn_clone") {
    buildMode.textContent = "Tap the board to place the mirror orb.";
  } else {
    buildMode.textContent = "Drag between orbs to draw paths or links.";
  }
};

const updateTabState = (panelId) => {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === panelId;
    button.classList.toggle("tab--active", isActive);
  });

  tabPanels.forEach((panel) => {
    panel.classList.toggle("tab-panel--active", panel.id === panelId);
  });
};

const updateBuildStats = () => {
  buildScore.textContent = gameState.score;
  const accuracy = gameState.attempts === 0 ? 100 : Math.max(0, Math.round((gameState.correct / gameState.attempts) * 100));
  buildAccuracy.textContent = `${accuracy}%`;
  buildStep.textContent = `${gameState.stepIndex} / ${gameState.buildSteps.length}`;
  buildProgressBar.style.width = `${(gameState.stepIndex / gameState.buildSteps.length) * 100}%`;
};

const updateBuildHint = () => {
  const step = gameState.buildSteps[gameState.stepIndex];
  if (!step) {
    stepHint.textContent = "Build complete! Time to jump the graph.";
    currentRune.textContent = "—";
    return;
  }

  if (step.type === "create_state") {
    stepHint.textContent = `Forge a new orb for rune "${step.letter}".`;
  } else if (step.type === "add_transition") {
    stepHint.textContent = `Draw a path for rune "${step.letter}" from orb ${step.from} to orb ${step.to}.`;
  } else if (step.type === "set_link") {
    stepHint.textContent = `Tether orb ${step.from} back to orb ${step.to}.`;
  } else if (step.type === "create_clone") {
    stepHint.textContent = `Mirror orb ${step.cloneOf}. Place clone orb ${step.id}.`;
  } else if (step.type === "redirect_transition") {
    stepHint.textContent = `Redirect rune "${step.letter}" from orb ${step.from} to clone ${step.to}.`;
  }

  currentRune.textContent = step.letter || "link";
};

const setFeedback = (element, message, type) => {
  element.textContent = message;
  element.classList.remove("success", "error");
  if (type) element.classList.add(type);
};

const applyStep = (step) => {
  if (!step) return;

  if (step.type === "create_state") {
    gameState.playerStates.push(makeState(step.id, step.len));
  } else if (step.type === "create_clone") {
    const source = gameState.playerStates[step.cloneOf];
    gameState.playerStates.push(cloneState(source, step.id, step.len));
  } else if (step.type === "add_transition" || step.type === "redirect_transition") {
    gameState.playerStates[step.from].next[step.letter] = step.to;
  } else if (step.type === "set_link") {
    gameState.playerStates[step.from].link = step.to;
  }
};

const advanceBuild = (valid, message) => {
  gameState.attempts += 1;

  if (valid) {
    gameState.correct += 1;
    gameState.score += 5;
    gameState.stepIndex += 1;
    setFeedback(buildFeedback, message || "Nice move!", "success");
  } else {
    gameState.score = Math.max(0, gameState.score - 3);
    setFeedback(buildFeedback, message || "That move doesn't match the mission.", "error");
  }

  updateBuildStats();
  updateBuildHint();
  renderBuildBoard();

  if (gameState.stepIndex >= gameState.buildSteps.length) {
    const traverseTab = document.querySelector('[data-tab="traverse"]');
    traverseTab.classList.remove("tab--disabled");
    setFeedback(buildFeedback, "Build complete! Switch to traversal mode.", "success");
  }
};

const handleAutoStep = () => {
  const step = gameState.buildSteps[gameState.stepIndex];
  if (!step) return;

  gameState.score = Math.max(0, gameState.score - 2);
  applyStep(step);
  advanceBuild(true, "Auto assist placed the correct move.");
};

const updatePositions = () => {
  const count = Math.max(gameState.playerStates.length, 1);
  if (Object.keys(gameState.playerPositions).length === 0) {
    gameState.playerPositions = layoutPositions(count);
  } else if (Object.keys(gameState.playerPositions).length < count) {
    const extra = layoutPositions(count);
    for (let i = 0; i < count; i += 1) {
      if (!gameState.playerPositions[i]) {
        gameState.playerPositions[i] = extra[i];
      }
    }
  }
};

const renderEdges = (svg, states, positions, includeLinks = false, highlightLetter = null) => {
  const edges = [];

  states.forEach((state) => {
    Object.entries(state.next).forEach(([letter, target]) => {
      const fromPos = positions[state.id];
      const toPos = positions[target];
      if (fromPos && toPos) {
        edges.push({ from: state.id, to: target, letter });
      }
    });

    if (includeLinks && state.link !== -1 && positions[state.link]) {
      edges.push({ from: state.id, to: state.link, letter: "link", isLink: true });
    }
  });

  const edgeMarkup = edges
    .map((edge) => {
      const from = positions[edge.from];
      const to = positions[edge.to];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const mx = from.x + dx / 2;
      const my = from.y + dy / 2;
      const isActive = highlightLetter && edge.letter === highlightLetter && !edge.isLink;
      const classes = [
        "edge",
        isActive ? "edge--active" : "",
        edge.isLink ? "edge--link" : "",
      ].filter(Boolean).join(" ");

      return `
        <line class="${classes}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />
        ${edge.isLink ? "" : `<text class="edge__label" x="${mx}" y="${my - 6}">${edge.letter}</text>`}
      `;
    })
    .join("");

  svg.insertAdjacentHTML("beforeend", edgeMarkup);
};

const renderNodes = (svg, states, positions, options = {}) => {
  const { current = null, choices = [], decoys = [] } = options;
  const nodeMarkup = states
    .map((state) => {
      const pos = positions[state.id];
      const isCurrent = current === state.id;
      const isChoice = choices.includes(state.id);
      const isDecoy = decoys.includes(state.id);
      const classes = [
        "node",
        isCurrent ? "node--current" : "",
        isChoice ? "node--choice" : "",
        isDecoy ? "node--decoy" : "",
      ].filter(Boolean).join(" ");

      return `
        <g class="${classes}" data-id="${state.id}">
          <circle class="node__circle" cx="${pos.x}" cy="${pos.y}" r="22"></circle>
          <text class="node__label" x="${pos.x}" y="${pos.y + 4}" text-anchor="middle">Orb ${state.id}</text>
        </g>
      `;
    })
    .join("");

  svg.insertAdjacentHTML("beforeend", nodeMarkup);
};

const renderBuildBoard = () => {
  updatePositions();
  const states = gameState.playerStates;
  buildBoard.innerHTML = "";

  renderEdges(buildBoard, states, gameState.playerPositions, true);

  renderNodes(buildBoard, states, gameState.playerPositions, {
    current: gameState.playerStates.at(-1)?.id ?? 0,
  });

  if (gameState.dragState?.line) {
    buildBoard.appendChild(gameState.dragState.line);
  }
};

const renderTraversalBoard = () => {
  const states = gameState.expectedStates;
  traverseBoard.innerHTML = "";

  renderEdges(traverseBoard, states, gameState.expectedPositions, false, gameState.queryWord[gameState.traversalIndex]);

  const validTargets = [];
  const current = gameState.expectedStates[gameState.traversalState];
  const currentLetterValue = gameState.queryWord[gameState.traversalIndex];

  if (current && currentLetterValue && current.next[currentLetterValue] !== undefined) {
    validTargets.push(current.next[currentLetterValue]);
  }

  renderNodes(traverseBoard, states, gameState.expectedPositions, {
    current: gameState.traversalState,
    choices: validTargets,
    decoys: gameState.decoys,
  });

  const pawnPos = gameState.expectedPositions[gameState.traversalState];
  if (pawnPos) {
    const pawnMarkup = `
      <g class="pawn" id="pawn">
        <circle cx="${pawnPos.x}" cy="${pawnPos.y - 30}" r="10"></circle>
      </g>
    `;
    traverseBoard.insertAdjacentHTML("beforeend", pawnMarkup);
    gameState.pawnId = "pawn";
  }
};

const setupTraversalTrack = () => {
  wordTrack.innerHTML = "";
  gameState.queryWord.split("").forEach((letter, index) => {
    const span = document.createElement("span");
    span.textContent = letter;
    if (index === 0) span.classList.add("active");
    wordTrack.appendChild(span);
  });
};

const updateTraversalHUD = () => {
  const letters = wordTrack.querySelectorAll("span");
  letters.forEach((span, index) => {
    span.classList.toggle("active", index === gameState.traversalIndex);
    span.classList.toggle("done", index < gameState.traversalIndex);
  });

  currentLetter.textContent = gameState.queryWord[gameState.traversalIndex] || "—";
};

const computeLcs = (query, states) => {
  let v = 0;
  let l = 0;
  let best = 0;
  let bestPos = 0;

  for (let i = 0; i < query.length; i += 1) {
    const ch = query[i];
    if (states[v].next[ch] !== undefined) {
      v = states[v].next[ch];
      l += 1;
    } else {
      while (v !== -1 && states[v].next[ch] === undefined) {
        v = states[v].link;
      }
      if (v === -1) {
        v = 0;
        l = 0;
      } else {
        l = states[v].len + 1;
        v = states[v].next[ch];
      }
    }
    if (l > best) {
      best = l;
      bestPos = i;
    }
  }

  return query.slice(bestPos - best + 1, bestPos + 1);
};

const setupTraversal = () => {
  gameState.traversalIndex = 0;
  gameState.traversalState = 0;
  gameState.traversalScore = 0;
  gameState.traversalLength = 0;
  gameState.bestLength = 0;
  gameState.bestSubstring = "";
  traversalScore.textContent = "0";
  currentMatch.textContent = "0";
  lcsValue.textContent = "—";
  traversalFeedback.textContent = "";

  gameState.targetLcs = computeLcs(gameState.queryWord, gameState.expectedStates);
  gameState.decoys = [];
  const decoyCount = Math.min(3, gameState.expectedStates.length - 1);
  for (let i = 0; i < decoyCount; i += 1) {
    const candidate = Math.floor(Math.random() * gameState.expectedStates.length);
    if (candidate !== 0 && !gameState.decoys.includes(candidate)) {
      gameState.decoys.push(candidate);
    }
  }

  setupTraversalTrack();
  updateTraversalHUD();
  renderTraversalBoard();
};

const advanceTraversal = (targetId, isValid) => {
  if (isValid) {
    gameState.traversalState = targetId;
    gameState.traversalLength += 1;
    gameState.traversalScore += 4;
  } else {
    gameState.traversalState = 0;
    gameState.traversalLength = 0;
    gameState.traversalScore = Math.max(0, gameState.traversalScore - 1);
  }

  if (gameState.traversalLength > gameState.bestLength) {
    gameState.bestLength = gameState.traversalLength;
    const end = gameState.traversalIndex;
    gameState.bestSubstring = gameState.queryWord.slice(end - gameState.bestLength + 1, end + 1);
  }

  traversalScore.textContent = gameState.traversalScore;
  currentMatch.textContent = gameState.traversalLength;
  lcsValue.textContent = gameState.bestSubstring || "—";

  gameState.traversalIndex += 1;

  if (gameState.traversalIndex >= gameState.queryWord.length) {
    traversalFeedback.textContent = `Quest complete! True LCS: "${gameState.targetLcs}".`;
    currentLetter.textContent = "—";
    return;
  }

  updateTraversalHUD();
  renderTraversalBoard();
};

const handleBuildBoardClick = (event) => {
  const step = gameState.buildSteps[gameState.stepIndex];
  if (!step) return;

  const point = toSvgPoint(buildBoard, event);

  if (gameState.activeTool === "spawn_state" || gameState.activeTool === "spawn_clone") {
    const newId = gameState.playerStates.length;
    const isClone = gameState.activeTool === "spawn_clone";
    const expectedType = isClone ? "create_clone" : "create_state";

    const valid = step.type === expectedType && step.id === newId;
    if (valid) {
      applyStep(step);
      gameState.playerPositions[newId] = { x: point.x, y: point.y };
      advanceBuild(true, "Orb placed!");
      setActiveTool(null);
    } else {
      advanceBuild(false, "That orb doesn't belong here yet.");
    }
  }
};

const handleDragStart = (event) => {
  const node = event.target.closest(".node");
  if (!node) return;
  const fromId = Number(node.dataset.id);
  const step = gameState.buildSteps[gameState.stepIndex];
  if (!step) return;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("class", "drag-line");
  const fromPos = gameState.playerPositions[fromId];
  line.setAttribute("x1", fromPos.x);
  line.setAttribute("y1", fromPos.y);
  line.setAttribute("x2", fromPos.x);
  line.setAttribute("y2", fromPos.y);

  gameState.dragState = { fromId, line };
  buildBoard.appendChild(line);
};

const handleDragMove = (event) => {
  if (!gameState.dragState) return;
  const point = toSvgPoint(buildBoard, event);
  gameState.dragState.line.setAttribute("x2", point.x);
  gameState.dragState.line.setAttribute("y2", point.y);
};

const handleDragEnd = (event) => {
  if (!gameState.dragState) return;
  const targetNode = event.target.closest(".node");
  const step = gameState.buildSteps[gameState.stepIndex];
  const fromId = gameState.dragState.fromId;

  gameState.dragState.line.remove();
  gameState.dragState = null;

  if (!targetNode || !step) return;
  const toId = Number(targetNode.dataset.id);

  const isTransition = step.type === "add_transition" || step.type === "redirect_transition";
  const isLink = step.type === "set_link";

  if (isTransition && step.from === fromId && step.to === toId) {
    applyStep(step);
    advanceBuild(true, "Rune path linked!");
  } else if (isLink && step.from === fromId && step.to === toId) {
    applyStep(step);
    advanceBuild(true, "Tether locked!");
  } else {
    advanceBuild(false, "That tether doesn't match the mission.");
  }
};

const handleTraversalClick = (event) => {
  const node = event.target.closest(".node");
  if (!node) return;
  const targetId = Number(node.dataset.id);
  const current = gameState.expectedStates[gameState.traversalState];
  const rune = gameState.queryWord[gameState.traversalIndex];
  const validTarget = current?.next[rune];

  if (targetId === validTarget) {
    setFeedback(traversalFeedback, "Clean jump!", "success");
    advanceTraversal(targetId, true);
  } else {
    setFeedback(traversalFeedback, "You fell off the path!", "error");
    advanceTraversal(targetId, false);
  }
};

const resetBuild = () => {
  const buildData = generateBuildSteps(gameState.baseWord);
  gameState.buildSteps = buildData.steps;
  gameState.expectedStates = buildData.states;
  gameState.playerStates = [makeState(0)];
  gameState.stepIndex = 0;
  gameState.score = 0;
  gameState.attempts = 0;
  gameState.correct = 0;

  gameState.playerPositions = layoutPositions(1);
  gameState.expectedPositions = layoutPositions(gameState.expectedStates.length);

  updateBuildStats();
  updateBuildHint();
  renderBuildBoard();
};

startGameButton.addEventListener("click", () => {
  const baseWord = sanitizeWord(baseWordInput.value);
  const queryWord = sanitizeWord(queryWordInput.value);

  if (!baseWord || !queryWord) {
    setupError.textContent = "Please provide both words (letters only).";
    return;
  }

  setupError.textContent = "";
  gameState.baseWord = baseWord;
  gameState.queryWord = queryWord;

  resetBuild();
  setupTraversal();

  gameArea.classList.remove("hidden");
  updateTabState("build");
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.classList.contains("tab--disabled")) return;
    updateTabState(button.dataset.tab);
  });
});

spawnStateButton.addEventListener("click", () => setActiveTool("spawn_state"));
spawnCloneButton.addEventListener("click", () => setActiveTool("spawn_clone"));
autoStepButton.addEventListener("click", handleAutoStep);

buildBoard.addEventListener("click", handleBuildBoardClick);
buildBoard.addEventListener("pointerdown", handleDragStart);
buildBoard.addEventListener("pointermove", handleDragMove);
buildBoard.addEventListener("pointerup", handleDragEnd);

traverseBoard.addEventListener("click", handleTraversalClick);

skipLetter.addEventListener("click", () => {
  setFeedback(traversalFeedback, "Skipped the rune. Resetting to start.", "error");
  advanceTraversal(0, false);
});

restartTraversal.addEventListener("click", setupTraversal);

updateBuildStats();
updateBuildHint();