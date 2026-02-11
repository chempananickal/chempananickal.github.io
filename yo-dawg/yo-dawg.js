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
const actionType = document.getElementById("actionType");
const fromStateSelect = document.getElementById("fromState");
const toStateSelect = document.getElementById("toState");
const letterInput = document.getElementById("letterInput");
const submitAction = document.getElementById("submitAction");
const autoStep = document.getElementById("autoStep");
const buildFeedback = document.getElementById("buildFeedback");
const buildProgressBar = document.getElementById("buildProgressBar");
const automatonSvg = document.getElementById("automatonSvg");
const stateList = document.getElementById("stateList");

const traversalScore = document.getElementById("traversalScore");
const currentMatch = document.getElementById("currentMatch");
const lcsValue = document.getElementById("lcsValue");
const wordTrack = document.getElementById("wordTrack");
const currentLetter = document.getElementById("currentLetter");
const skipLetter = document.getElementById("skipLetter");
const restartTraversal = document.getElementById("restartTraversal");
const traversalFeedback = document.getElementById("traversalFeedback");
const stateBoard = document.getElementById("stateBoard");

const gameState = {
  baseWord: "",
  queryWord: "",
  buildSteps: [],
  expectedStates: [],
  playerStates: [],
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
    steps.push({ type: "create_state", id: cur, len: states[cur].len, note: `Create state ${cur} for '${ch}'.` });

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
    stepHint.textContent = "Build complete! Switch to traversal for the next challenge.";
    return;
  }
  if (step.type === "create_state") {
    stepHint.textContent = `Create new state ${step.id} (length ${step.len}).`;
  } else if (step.type === "add_transition") {
    stepHint.textContent = `Add transition '${step.letter}' from ${step.from} → ${step.to}.`;
  } else if (step.type === "set_link") {
    stepHint.textContent = `Set suffix link of ${step.from} to ${step.to}.`;
  } else if (step.type === "create_clone") {
    stepHint.textContent = `Create clone ${step.id} from state ${step.cloneOf}.`;
  } else if (step.type === "redirect_transition") {
    stepHint.textContent = `Redirect '${step.letter}' from ${step.from} to clone ${step.to}.`;
  }
};

const refreshStateOptions = () => {
  const maxId = Math.max(
    ...gameState.playerStates.map((state) => state.id),
    gameState.buildSteps[gameState.stepIndex]?.id ?? 0
  );

  const options = [];
  for (let i = 0; i <= maxId; i += 1) {
    options.push(`<option value="${i}">State ${i}</option>`);
  }

  fromStateSelect.innerHTML = options.join("");
  toStateSelect.innerHTML = options.join("");
};

const renderStateList = () => {
  stateList.innerHTML = gameState.playerStates
    .map((state) => {
      const transitions = Object.entries(state.next)
        .map(([letter, target]) => `${letter}→${target}`)
        .join(", ");
      return `
        <div class="state-card ${gameState.traversalState === state.id ? "state-card--current" : ""}">
          <h4>State ${state.id}</h4>
          <p>len: ${state.len}, link: ${state.link}</p>
          <p>${transitions || "No transitions yet"}</p>
        </div>
      `;
    })
    .join("");
};

const renderAutomaton = () => {
  const states = gameState.playerStates;
  if (states.length === 0) return;

  const cols = Math.ceil(Math.sqrt(states.length));
  const spacingX = 160;
  const spacingY = 120;
  const positions = states.map((state, index) => ({
    id: state.id,
    x: 80 + (index % cols) * spacingX,
    y: 80 + Math.floor(index / cols) * spacingY,
  }));

  const edges = [];
  states.forEach((state) => {
    Object.entries(state.next).forEach(([letter, target]) => {
      const fromPos = positions.find((pos) => pos.id === state.id);
      const toPos = positions.find((pos) => pos.id === target);
      if (fromPos && toPos) {
        edges.push({ from: fromPos, to: toPos, letter });
      }
    });
  });

  const edgeMarkup = edges
    .map((edge) => {
      const dx = edge.to.x - edge.from.x;
      const dy = edge.to.y - edge.from.y;
      const mx = edge.from.x + dx / 2;
      const my = edge.from.y + dy / 2;
      return `
        <line x1="${edge.from.x}" y1="${edge.from.y}" x2="${edge.to.x}" y2="${edge.to.y}" stroke="#6ae1ff" stroke-width="1.5" />
        <text x="${mx}" y="${my - 6}" fill="#9f7bff" font-size="12">${edge.letter}</text>
      `;
    })
    .join("");

  const nodeMarkup = positions
    .map(
      (pos) => `
        <circle cx="${pos.x}" cy="${pos.y}" r="20" fill="#141a2e" stroke="#6ae1ff" stroke-width="2"></circle>
        <text x="${pos.x}" y="${pos.y + 4}" text-anchor="middle" fill="#f7f7ff" font-size="12">${pos.id}</text>
      `
    )
    .join("");

  automatonSvg.innerHTML = `${edgeMarkup}${nodeMarkup}`;
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

const handleAction = (auto = false) => {
  const step = gameState.buildSteps[gameState.stepIndex];
  if (!step) return;

  let valid = false;
  if (auto) {
    valid = true;
  } else {
    const selectedType = actionType.value;
    const fromState = Number(fromStateSelect.value);
    const toState = Number(toStateSelect.value);
    const letter = letterInput.value.toLowerCase();

    if (selectedType === step.type) {
      if (step.type === "create_state" || step.type === "create_clone") {
        valid = toState === step.id;
      } else if (step.type === "add_transition" || step.type === "redirect_transition") {
        valid = fromState === step.from && toState === step.to && letter === step.letter;
      } else if (step.type === "set_link") {
        valid = fromState === step.from && toState === step.to;
      }
    }
  }

  gameState.attempts += 1;

  if (valid) {
    gameState.correct += 1;
    gameState.score += auto ? -2 : 5;
    applyStep(step);
    gameState.stepIndex += 1;
    setFeedback(buildFeedback, "Nice move! Automaton updated.", "success");
  } else {
    gameState.score = Math.max(0, gameState.score - 3);
    setFeedback(buildFeedback, "That move doesn't match the next required step.", "error");
  }

  updateBuildStats();
  updateBuildHint();
  refreshStateOptions();
  renderAutomaton();
  renderStateList();

  if (gameState.stepIndex >= gameState.buildSteps.length) {
    const traverseTab = document.querySelector('[data-tab="traverse"]');
    traverseTab.classList.remove("tab--disabled");
    setFeedback(buildFeedback, "Build complete! Switch to traversal mode.", "success");
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

  updateBuildStats();
  updateBuildHint();
  refreshStateOptions();
  renderAutomaton();
  renderStateList();
};

const computeLcs = (word, query, states) => {
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
  wordTrack.innerHTML = "";
  stateBoard.innerHTML = "";

  gameState.targetLcs = computeLcs(gameState.baseWord, gameState.queryWord, gameState.expectedStates);

  gameState.queryWord.split("").forEach((letter, index) => {
    const span = document.createElement("span");
    span.textContent = letter;
    if (index === 0) span.classList.add("active");
    wordTrack.appendChild(span);
  });

  updateTraversalUI();
};

const updateTraversalUI = () => {
  const letters = wordTrack.querySelectorAll("span");
  letters.forEach((span, index) => {
    span.classList.toggle("active", index === gameState.traversalIndex);
    span.classList.toggle("done", index < gameState.traversalIndex);
  });

  const letter = gameState.queryWord[gameState.traversalIndex] || "—";
  currentLetter.textContent = letter;

  const currentState = gameState.expectedStates[gameState.traversalState];
  const transitions = Object.entries(currentState.next);

  stateBoard.innerHTML = `
    <div class="state-card state-card--current">
      <h4>Current state: ${currentState.id}</h4>
      <p>len: ${currentState.len}, link: ${currentState.link}</p>
      <div>
        ${transitions
          .map(([label, target]) => {
            const enabled = label === letter;
            return `<button data-target="${target}" data-letter="${label}" ${enabled ? "" : "disabled"}>${label} → ${target}</button>`;
          })
          .join("") || "<p>No transitions</p>"}
      </div>
    </div>
  `;
};

const advanceTraversal = (matched, targetState) => {
  if (matched) {
    gameState.traversalState = targetState;
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

  updateTraversalUI();
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

submitAction.addEventListener("click", () => handleAction(false));
autoStep.addEventListener("click", () => handleAction(true));

stateBoard.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-target]");
  if (!button) return;

  const target = Number(button.dataset.target);
  const letter = button.dataset.letter;
  const expectedLetter = gameState.queryWord[gameState.traversalIndex];

  if (letter === expectedLetter) {
    setFeedback(traversalFeedback, "Good move!", "success");
    advanceTraversal(true, target);
  }
});

skipLetter.addEventListener("click", () => {
  setFeedback(traversalFeedback, "Skipped this letter. Resetting to state 0.", "error");
  advanceTraversal(false, 0);
});

restartTraversal.addEventListener("click", () => setupTraversal());

refreshStateOptions();
updateBuildStats();
updateBuildHint();