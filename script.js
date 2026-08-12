const MODULE_FILES = [
  "data/modulo-1.json",
  "data/modulo-2.json",
  "data/modulo-3.json"
];
const ANALYSIS_FILE = "data/analisis-estudio.json";
const STORAGE_KEY = "biofisica-progress-v4";
const QUESTIONS_PER_MODULE = 5;

const state = {
  modules: [],
  analysis: null,
  currentModule: null,
  queue: [],
  currentIndex: 0,
  answers: [],
  lastErrors: []
};

const el = {
  moduleCards: document.querySelector("#moduleCards"),
  template: document.querySelector("#moduleCardTemplate"),
  quizPanel: document.querySelector("#quizPanel"),
  resultsPanel: document.querySelector("#resultsPanel"),
  studySummary: document.querySelector("#studySummary"),
  moduleLabel: document.querySelector("#moduleLabel"),
  questionCounter: document.querySelector("#questionCounter"),
  questionType: document.querySelector("#questionType"),
  questionPrompt: document.querySelector("#questionPrompt"),
  optionsForm: document.querySelector("#optionsForm"),
  feedback: document.querySelector("#feedback"),
  checkBtn: document.querySelector("#checkBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  exitBtn: document.querySelector("#exitBtn"),
  resetProgressBtn: document.querySelector("#resetProgressBtn"),
  progressBar: document.querySelector("#progressBar"),
  progressText: document.querySelector("#progressText"),
  resultTitle: document.querySelector("#resultTitle"),
  resultStats: document.querySelector("#resultStats"),
  retryErrorsBtn: document.querySelector("#retryErrorsBtn"),
  backModulesBtn: document.querySelector("#backModulesBtn")
};

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
function normalizeSet(arr) {
  return [...arr].map(Number).sort((a, b) => a - b);
}
function sameSet(a, b) {
  const aa = normalizeSet(a);
  const bb = normalizeSet(b);
  return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}
function moduleHistoricalGrade(moduleNumber) {
  return state.analysis?.modules?.find(m => m.module === moduleNumber)?.grade_percent ?? null;
}


function shuffleQuestions(questions) {
  const copy = [...questions];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function selectQuestionsForAttempt(mod) {
  return shuffleQuestions(mod.questions).slice(0, Math.min(QUESTIONS_PER_MODULE, mod.questions.length));
}

async function init() {
  try {
    const [modules, analysis] = await Promise.all([
      Promise.all(MODULE_FILES.map(url => fetch(url).then(r => {
        if (!r.ok) throw new Error(`No se pudo cargar ${url}`);
        return r.json();
      }))),
      fetch(ANALYSIS_FILE).then(r => r.ok ? r.json() : null)
    ]);
    state.modules = modules;
    state.analysis = analysis;
    renderModules();
    renderStudySummary();
  } catch (error) {
    el.moduleCards.innerHTML = `<p>No se pudieron cargar los datos. Abrí esta página desde un servidor local o GitHub Pages.<br><small>${error.message}</small></p>`;
  }
}

function renderModules() {
  const progress = loadProgress();
  el.moduleCards.innerHTML = "";

  state.modules.forEach(mod => {
    const node = el.template.content.cloneNode(true);
    const btn = node.querySelector(".module-card");
    const local = progress[`m${mod.module}`];
    const historical = moduleHistoricalGrade(mod.module);

    node.querySelector(".module-number").textContent = mod.module;
    node.querySelector(".module-title").textContent = mod.title;
    node.querySelector(".module-meta").textContent = `${QUESTIONS_PER_MODULE} preguntas por intento · banco de ${mod.questions.length}`;
    node.querySelector(".module-score").textContent =
      local ? `Tu último intento: ${local.percent}%` :
      historical != null ? `Referencia previa: ${historical}%` : "Sin intento guardado";

    btn.addEventListener("click", () => startModule(mod));
    el.moduleCards.appendChild(node);
  });
}

function renderStudySummary() {
  const blocks = state.analysis?.review_topics;
  if (!blocks) return;

  el.studySummary.innerHTML = Object.entries(blocks).map(([key, block]) => {
    const mod = Number(key.split("_")[1]);
    const topics = block.topics.filter(t => !t.strength).slice(0, 4);
    const priorityClass = block.priority.includes("alta") ? "priority-high"
      : block.priority.includes("media") ? "priority-medium"
      : "priority-low";
    return `
      <article class="study-card">
        <p class="eyebrow">Módulo ${mod}</p>
        <h3 class="${priorityClass}">Prioridad ${block.priority}</h3>
        <ul>${topics.map(t => `<li>${escapeHtml(t.topic)}</li>`).join("")}</ul>
      </article>
    `;
  }).join("");
}

function startModule(mod, customQueue = null) {
  state.currentModule = mod;
  state.queue = customQueue || selectQuestionsForAttempt(mod);
  state.currentIndex = 0;
  state.answers = [];
  state.lastErrors = [];
  el.resultsPanel.classList.add("hidden");
  el.quizPanel.classList.remove("hidden");
  renderQuestion();
  el.quizPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderQuestion() {
  const q = state.queue[state.currentIndex];
  const isSingle = q.correct_option_indices.length === 1;
  const inputType = isSingle ? "radio" : "checkbox";

  el.moduleLabel.textContent = `Módulo ${state.currentModule.module}`;
  el.questionCounter.textContent = `Pregunta ${state.currentIndex + 1} de ${state.queue.length}`;
  el.questionType.textContent = isSingle ? "Elegí una opción" : "Puede haber más de una respuesta correcta";
  el.questionPrompt.textContent = q.prompt;
  el.optionsForm.innerHTML = "";
  el.feedback.className = "feedback hidden";
  el.feedback.textContent = "";
  el.checkBtn.classList.remove("hidden");
  el.nextBtn.classList.add("hidden");

  q.options.forEach((option, index) => {
    const label = document.createElement("label");
    label.className = "option";
    label.dataset.index = index;
    label.innerHTML = `
      <input type="${inputType}" name="answer" value="${index}">
      <span>${escapeHtml(option)}</span>
    `;
    el.optionsForm.appendChild(label);
  });

  const pct = ((state.currentIndex) / state.queue.length) * 100;
  el.progressBar.style.width = `${pct}%`;
  el.progressText.textContent = `${state.currentIndex}/${state.queue.length}`;
}

function selectedIndices() {
  return [...el.optionsForm.querySelectorAll("input:checked")].map(i => Number(i.value));
}

function checkAnswer() {
  const q = state.queue[state.currentIndex];
  const selected = selectedIndices();
  if (!selected.length) {
    el.feedback.className = "feedback bad";
    el.feedback.textContent = "Elegí al menos una opción antes de corregir.";
    return;
  }

  const correct = normalizeSet(q.correct_option_indices);
  const isCorrect = sameSet(selected, correct);

  [...el.optionsForm.querySelectorAll(".option")].forEach(label => {
    const index = Number(label.dataset.index);
    const input = label.querySelector("input");
    input.disabled = true;
    if (correct.includes(index)) label.classList.add("correct");
    if (selected.includes(index) && !correct.includes(index)) label.classList.add("incorrect");
  });

  state.answers.push({
    questionId: q.id,
    selected,
    correct,
    isCorrect
  });

  if (!isCorrect) state.lastErrors.push(q);

  el.feedback.className = `feedback ${isCorrect ? "ok" : "bad"}`;
  el.feedback.innerHTML = isCorrect
    ? "<strong>✓ Correcto.</strong>"
    : `<strong>Revisá esta.</strong> La respuesta correcta queda marcada en verde.`;

  el.checkBtn.classList.add("hidden");
  el.nextBtn.classList.remove("hidden");
}

function nextQuestion() {
  state.currentIndex += 1;
  if (state.currentIndex >= state.queue.length) {
    finishModule();
  } else {
    renderQuestion();
  }
}

function finishModule() {
  const total = state.answers.length;
  const correct = state.answers.filter(a => a.isCorrect).length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const progress = loadProgress();
  progress[`m${state.currentModule.module}`] = {
    percent,
    correct,
    total,
    date: new Date().toISOString()
  };
  saveProgress(progress);

  el.quizPanel.classList.add("hidden");
  el.resultsPanel.classList.remove("hidden");
  el.resultTitle.textContent = `Módulo ${state.currentModule.module}: ${percent}%`;
  el.resultStats.innerHTML = `
    <div class="stat"><strong>${correct}</strong><span>correctas</span></div>
    <div class="stat"><strong>${total - correct}</strong><span>a revisar</span></div>
    <div class="stat"><strong>${percent}%</strong><span>resultado</span></div>
  `;
  el.retryErrorsBtn.classList.toggle("hidden", state.lastErrors.length === 0);
  renderModules();
  el.resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function exitModule() {
  el.quizPanel.classList.add("hidden");
  state.currentModule = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function retryErrors() {
  if (!state.lastErrors.length || !state.currentModule) return;
  startModule(state.currentModule, [...state.lastErrors]);
}

function resetProgress() {
  if (!confirm("¿Querés borrar el progreso guardado de estos módulos?")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderModules();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

el.checkBtn.addEventListener("click", checkAnswer);
el.nextBtn.addEventListener("click", nextQuestion);
el.exitBtn.addEventListener("click", exitModule);
el.retryErrorsBtn.addEventListener("click", retryErrors);
el.backModulesBtn.addEventListener("click", () => {
  el.resultsPanel.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});
el.resetProgressBtn.addEventListener("click", resetProgress);

init();
