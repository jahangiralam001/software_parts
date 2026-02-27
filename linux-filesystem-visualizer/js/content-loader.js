import { getDirectoryByPath, loadAllData } from "./data.js";
import { filterTreeItems, renderTree } from "./tree.js";
import { initThemeToggle } from "./theme.js";

const REVISION_HISTORY_KEY = "linuxFsRevisionHistory";

function loadRevisionHistory() {
  const fallback = {
    bestStreak: 0,
    lastSessionAccuracy: null,
    totalAttempted: 0,
    totalCorrect: 0
  };

  try {
    const raw = localStorage.getItem(REVISION_HISTORY_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    return {
      bestStreak: Number.isFinite(parsed.bestStreak) ? parsed.bestStreak : 0,
      lastSessionAccuracy: Number.isFinite(parsed.lastSessionAccuracy) ? parsed.lastSessionAccuracy : null,
      totalAttempted: Number.isFinite(parsed.totalAttempted) ? parsed.totalAttempted : 0,
      totalCorrect: Number.isFinite(parsed.totalCorrect) ? parsed.totalCorrect : 0
    };
  } catch {
    return fallback;
  }
}

function saveRevisionHistory(history) {
  try {
    localStorage.setItem(REVISION_HISTORY_KEY, JSON.stringify(history));
  } catch {
    return;
  }
}

function arrayToList(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function commandsToBlocks(commands) {
  return commands.map((command) => `<code>${command}</code>`).join("");
}

function renderOverview(container, entry) {
  const pagesPrefix = document.body.dataset.page === "directory" ? "../pages" : "./pages";
  const targetPage = entry.path === "/" ? "root-filesystem" : entry.path.slice(1);
  container.innerHTML = `
    <h2>${entry.path} • ${entry.title}</h2>
    <p>${entry.what}</p>
    <p><strong>Need:</strong> ${entry.why}</p>
    <p><a class="quick-link" href="${pagesPrefix}/${targetPage}.html">Open focused page</a></p>
  `;
}

function renderDetail(container, entry, examples) {
  const practicalExamples = examples[entry.path] || ["No custom examples yet for this directory."];

  container.innerHTML = `
    <div class="grid">
      <article class="card">
        <h3>1) What is this directory?</h3>
        <p>${entry.what}</p>
      </article>
      <article class="card">
        <h3>2) Why does Linux need it?</h3>
        <p>${entry.why}</p>
      </article>
      <article class="card">
        <h3>3) Real files inside it</h3>
        ${arrayToList(entry.realFiles)}
      </article>
      <article class="card">
        <h3>4) Commands to explore it</h3>
        ${commandsToBlocks(entry.commands)}
      </article>
      <article class="card">
        <h3>5) What happens if you delete it?</h3>
        <p class="danger-note">${entry.deleteImpact}</p>
      </article>
      <article class="card">
        <h3>6) Difference from similar directory</h3>
        <p>${entry.difference}</p>
      </article>
      <article class="card">
        <h3>7) Modern Linux changes</h3>
        <p>${entry.modern}</p>
      </article>
      <article class="card">
        <h3>Practical use examples</h3>
        ${arrayToList(practicalExamples)}
      </article>
    </div>
  `;
}

function renderComparisonRows(rows) {
  if (!rows || !rows.length) {
    return "<p>No comparison added yet for this directory.</p>";
  }

  const content = rows.map((row) => `
    <tr>
      <td>${row.with}</td>
      <td>${row.focus}</td>
      <td>${row.difference}</td>
    </tr>
  `).join("");

  return `
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Compared with</th>
          <th>Focus</th>
          <th>Difference</th>
        </tr>
      </thead>
      <tbody>${content}</tbody>
    </table>
  `;
}

function renderQuiz(container, entry, quizzes, onAnswered) {
  const quiz = quizzes[entry.path];
  const quizHtml = !quiz
    ? "<p>No quiz question yet for this directory.</p>"
    : `
      <p class="quiz-q">${quiz.question}</p>
      <div class="quiz-options">
        ${quiz.options.map((option) => `<button class="quiz-option" data-answer="${option}" data-correct="${quiz.answer}">${option}</button>`).join("")}
      </div>
      <p id="quizFeedback" class="quiz-feedback" aria-live="polite"></p>
    `;

  container.insertAdjacentHTML("beforeend", `
    <div class="grid extra-grid">
      <article class="card">
        <h3>Quick comparison</h3>
        ${renderComparisonRows(container._comparisonRows || [])}
      </article>
      <article class="card">
        <h3>Quiz mode</h3>
        ${quizHtml}
      </article>
    </div>
  `);

  if (!quiz) return;

  const feedback = container.querySelector("#quizFeedback");
  const options = container.querySelectorAll(".quiz-option");
  let isAnswered = false;

  options.forEach((button) => {
    button.addEventListener("click", () => {
      if (isAnswered) return;

      const picked = button.getAttribute("data-answer");
      const correct = button.getAttribute("data-correct");
      const isCorrect = picked === correct;

      isAnswered = true;
      options.forEach((optionButton) => {
        optionButton.disabled = true;
      });

      if (isCorrect) {
        feedback.textContent = `Correct. ${quiz.explanation}`;
        feedback.className = "quiz-feedback ok";
      } else {
        feedback.textContent = `Not quite. Correct answer: ${correct}. ${quiz.explanation}`;
        feedback.className = "quiz-feedback bad";
      }

      if (typeof onAnswered === "function") {
        onAnswered({ path: entry.path, isCorrect });
      }
    });
  });
}

function renderSubtreeExplanations(container, activePath, nestedChildren) {
  if (!nestedChildren.length) return;

  container.insertAdjacentHTML("beforeend", `
    <article class="card subtree-card">
      <h3>Inside ${activePath} (explained)</h3>
      <ul class="subtree-list">
        ${nestedChildren.map((item) => `<li><strong>${item.name}</strong> — ${item.description}</li>`).join("")}
      </ul>
    </article>
  `);
}

function renderAllSubtreesMap(rootChildren, subtrees, activePath) {
  return `
    <div class="subtree-map" aria-label="Horizontal subtree map">
      ${rootChildren.map((item) => {
        const path = item.path;
        const children = subtrees[path] || [];
        return `
          <section class="subtree-group${path === activePath ? " active" : ""}">
            <h4>${path}</h4>
            <div class="subtree-group-children">
              ${children.length
                ? children.map((child) => `<span class="subtree-chip">${child.name}</span>`).join("")
                : "<span class=\"subtree-empty\">(no common child list)</span>"}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderHierarchy(container, filesystem, subtrees, activePath, onSelect, renderOptions = {}) {
  const rootChildren = (subtrees["/"] || []).map((entry) => ({
    name: entry.name,
    path: `/${entry.name}`,
    description: entry.description
  }));
  const nestedChildren = subtrees[activePath] || [];

  container.insertAdjacentHTML("afterbegin", `
    <article class="card hierarchy-card">
      <h3>Filesystem Hierarchy (Bird's-eye view)</h3>
      <p>Click any top-level node; all subtree groups are shown horizontally below.</p>
      <div class="hierarchy-visual" aria-label="Filesystem hierarchy visual">
        <div class="hierarchy-root-wrap">
          <button class="hierarchy-node-btn hierarchy-root${activePath === "/" ? " active" : ""}" data-path="/">/</button>
        </div>
        <div class="hierarchy-children">
          ${rootChildren.map((item) => `<button class="hierarchy-node-btn hierarchy-node${activePath === item.path ? " active" : ""}" data-path="${item.path}">/${item.name}</button>`).join("")}
        </div>
      </div>
      ${renderAllSubtreesMap(rootChildren, subtrees, activePath)}
    </article>
  `);

  const hierarchyButtons = container.querySelectorAll(".hierarchy-node-btn");
  hierarchyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const path = button.getAttribute("data-path");
      if (path && typeof onSelect === "function") {
        onSelect(path);
      }
    });
  });

  const topScroller = container.querySelector(".hierarchy-children");
  const mapScroller = container.querySelector(".subtree-map");
  if (topScroller && Number.isFinite(renderOptions.topScrollLeft)) {
    topScroller.scrollLeft = renderOptions.topScrollLeft;
  }
  if (mapScroller && Number.isFinite(renderOptions.mapScrollLeft)) {
    mapScroller.scrollLeft = renderOptions.mapScrollLeft;
  }

  const shouldAnimate = renderOptions.animate !== false;
  const activeTopNode = container.querySelector(".hierarchy-node-btn.active");
  const activeSubtreeGroup = container.querySelector(".subtree-group.active");

  if (shouldAnimate) {
    requestAnimationFrame(() => {
      if (activeTopNode) {
        activeTopNode.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
      }

      if (activeSubtreeGroup) {
        activeSubtreeGroup.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
      }
    });
  }

  if (activePath === "/") {
    container.insertAdjacentHTML("beforeend", `
      <article class="card subtree-card">
        <h3>Top-level directories explained</h3>
        <ul class="subtree-list">
          ${rootChildren.map((item) => `<li><strong>${item.path}</strong> — ${item.description}</li>`).join("")}
        </ul>
      </article>
    `);
    return;
  }

  renderSubtreeExplanations(container, activePath, nestedChildren);
}

function getBasePath() {
  if (document.body.dataset.page === "directory") {
    return "..";
  }
  return ".";
}

function getInitialPath() {
  const fromData = document.body.dataset.dir;
  const fromHash = decodeURIComponent(window.location.hash.replace("#", ""));

  if (fromData) return fromData;
  if (fromHash) return fromHash;
  return "/";
}

async function init() {
  initThemeToggle();

  const basePath = getBasePath();
  const { filesystem, examples, comparisons, quizzes, subtrees } = await loadAllData(basePath);

  const treeContainer = document.getElementById("treeContainer");
  const searchInput = document.getElementById("treeSearch");
  const contentContainer = document.getElementById("contentContainer");
  const overviewCard = document.getElementById("overviewCard");
  const revisionControls = document.getElementById("revisionControls");
  const revisionToggle = document.getElementById("revisionToggle");
  const revisionNext = document.getElementById("revisionNext");
  const revisionReset = document.getElementById("revisionReset");
  const revisionSeconds = document.getElementById("revisionSeconds");
  const revisionTimer = document.getElementById("revisionTimer");
  const revisionScore = document.getElementById("revisionScore");
  const revisionBestStreak = document.getElementById("revisionBestStreak");
  const revisionLastAccuracy = document.getElementById("revisionLastAccuracy");
  const revisionLifetime = document.getElementById("revisionLifetime");

  if (!treeContainer || !searchInput || !contentContainer || !overviewCard) {
    return;
  }

  let activePath = getInitialPath();
  let filtered = filesystem;
  let update;
  const hierarchyScrollState = {
    topScrollLeft: 0,
    mapScrollLeft: 0
  };

  const revisionState = {
    running: false,
    intervalId: null,
    tickId: null,
    secondsPerDirectory: 20,
    countdown: 20,
    streak: 0,
    attempted: 0,
    correct: 0
  };

  const revisionHistory = loadRevisionHistory();

  function refreshRevisionUi() {
    if (!revisionControls) return;

    if (revisionToggle) {
      revisionToggle.textContent = revisionState.running ? "Pause" : "Start";
    }
    if (revisionTimer) {
      revisionTimer.textContent = revisionState.running
        ? `Timer: ${revisionState.countdown}s`
        : "Timer: --";
    }
    if (revisionScore) {
      revisionScore.textContent = `Score: ${revisionState.correct}/${revisionState.attempted}`;
    }
    if (revisionBestStreak) {
      revisionBestStreak.textContent = `Best streak: ${revisionHistory.bestStreak}`;
    }
    if (revisionLastAccuracy) {
      const accuracy = revisionHistory.lastSessionAccuracy;
      revisionLastAccuracy.textContent = Number.isFinite(accuracy)
        ? `Last session: ${accuracy}%`
        : "Last session: --";
    }
    if (revisionLifetime) {
      revisionLifetime.textContent = `Lifetime: ${revisionHistory.totalCorrect}/${revisionHistory.totalAttempted}`;
    }
  }

  function stopRevision() {
    if (revisionState.intervalId) {
      clearInterval(revisionState.intervalId);
      revisionState.intervalId = null;
    }
    if (revisionState.tickId) {
      clearInterval(revisionState.tickId);
      revisionState.tickId = null;
    }

    if (revisionState.attempted > 0) {
      const accuracy = Math.round((revisionState.correct / revisionState.attempted) * 100);
      revisionHistory.lastSessionAccuracy = accuracy;
      saveRevisionHistory(revisionHistory);
    }

    revisionState.running = false;
    refreshRevisionUi();
  }

  function nextDirectory() {
    if (!filtered.length) return;

    const index = filtered.findIndex((entry) => entry.path === activePath);
    const nextIndex = index >= 0 ? (index + 1) % filtered.length : 0;
    update(filtered[nextIndex].path);
    window.location.hash = encodeURIComponent(filtered[nextIndex].path);
  }

  function startRevision() {
    if (!revisionControls) return;

    const parsed = Number.parseInt(revisionSeconds?.value ?? "20", 10);
    const seconds = Number.isFinite(parsed) ? Math.min(120, Math.max(5, parsed)) : 20;

    revisionState.secondsPerDirectory = seconds;
    revisionState.countdown = seconds;
    revisionState.streak = 0;
    revisionState.attempted = 0;
    revisionState.correct = 0;
    revisionState.running = true;

    refreshRevisionUi();

    revisionState.intervalId = setInterval(() => {
      nextDirectory();
      revisionState.countdown = revisionState.secondsPerDirectory;
      refreshRevisionUi();
    }, revisionState.secondsPerDirectory * 1000);

    revisionState.tickId = setInterval(() => {
      if (revisionState.countdown > 0) {
        revisionState.countdown -= 1;
      }
      refreshRevisionUi();
    }, 1000);
  }

  update = function update(path, options = {}) {
    const oldTopScroller = contentContainer.querySelector(".hierarchy-children");
    const oldMapScroller = contentContainer.querySelector(".subtree-map");
    if (oldTopScroller) {
      hierarchyScrollState.topScrollLeft = oldTopScroller.scrollLeft;
    }
    if (oldMapScroller) {
      hierarchyScrollState.mapScrollLeft = oldMapScroller.scrollLeft;
    }

    activePath = path;
    const selected = getDirectoryByPath(filesystem, activePath) || filesystem[0];

    renderOverview(overviewCard, selected);
    renderDetail(contentContainer, selected, examples);
    renderHierarchy(contentContainer, filesystem, subtrees, selected.path, (nextPath) => {
      update(nextPath);
      window.location.hash = encodeURIComponent(nextPath);
    }, {
      topScrollLeft: hierarchyScrollState.topScrollLeft,
      mapScrollLeft: hierarchyScrollState.mapScrollLeft,
      animate: options.animate !== false
    });
    contentContainer._comparisonRows = comparisons[selected.path] || [];
    renderQuiz(contentContainer, selected, quizzes, ({ path: answeredPath, isCorrect }) => {
      if (!revisionState.running || answeredPath !== activePath) {
        return;
      }

      revisionState.attempted += 1;
      if (isCorrect) {
        revisionState.correct += 1;
        revisionState.streak += 1;
      } else {
        revisionState.streak = 0;
      }

      revisionHistory.totalAttempted += 1;
      if (isCorrect) {
        revisionHistory.totalCorrect += 1;
      }
      if (revisionState.streak > revisionHistory.bestStreak) {
        revisionHistory.bestStreak = revisionState.streak;
      }

      saveRevisionHistory(revisionHistory);
      refreshRevisionUi();
    });
    renderTree({
      items: filtered,
      activePath: selected.path,
      container: treeContainer,
      onSelect: (nextPath) => {
        update(nextPath);
        window.location.hash = encodeURIComponent(nextPath);
      }
    });
  };

  if (revisionToggle && revisionNext && revisionSeconds) {
    revisionToggle.addEventListener("click", () => {
      if (revisionState.running) {
        stopRevision();
      } else {
        startRevision();
      }
    });

    revisionNext.addEventListener("click", () => {
      nextDirectory();
      if (revisionState.running) {
        revisionState.countdown = revisionState.secondsPerDirectory;
      }
      refreshRevisionUi();
    });

    revisionSeconds.addEventListener("change", () => {
      if (!revisionState.running) return;

      stopRevision();
      startRevision();
    });

    if (revisionReset) {
      revisionReset.addEventListener("click", () => {
        revisionState.streak = 0;
        revisionState.attempted = 0;
        revisionState.correct = 0;

        revisionHistory.bestStreak = 0;
        revisionHistory.lastSessionAccuracy = null;
        revisionHistory.totalAttempted = 0;
        revisionHistory.totalCorrect = 0;

        saveRevisionHistory(revisionHistory);
        refreshRevisionUi();
      });
    }
  }

  searchInput.addEventListener("input", (event) => {
    const term = event.target.value;
    filtered = filterTreeItems(filesystem, term);
    if (!filtered.length) {
      treeContainer.innerHTML = "<p>No directory matches this search.</p>";
      return;
    }

    if (!filtered.find((entry) => entry.path === activePath)) {
      activePath = filtered[0].path;
    }

    if (revisionState.running) {
      revisionState.countdown = revisionState.secondsPerDirectory;
    }
    update(activePath);
    refreshRevisionUi();
  });

  refreshRevisionUi();
  update(activePath, { animate: false });
}

init();
