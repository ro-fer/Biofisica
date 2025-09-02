let questionBank = []; // 🔹 se cargará desde JSON
const numQuestions = 2; // 🔹 cuántas preguntas usar por examen

// Cargar preguntas desde JSON
async function loadQuestions() {
  try {
    const response = await fetch("preguntas.json");
    questionBank = await response.json();
  } catch (error) {
    console.error("Error cargando preguntas:", error);
  }
}

window.onload = loadQuestions; // se cargan al abrir la página

let quizQuestions = [];
let currentIndex = 0;
let score = 0;
let timer = 0;
let timerInterval;

const startBtn = document.getElementById("start-btn");
const nextBtn = document.getElementById("next-btn");
const finishBtn = document.getElementById("finish-btn");
const questionContainer = document.getElementById("question-container");
const resultDiv = document.getElementById("result");
const timerDiv = document.getElementById("timer");

startBtn.addEventListener("click", startQuiz);
nextBtn.addEventListener("click", () => showQuestion(++currentIndex));
finishBtn.addEventListener("click", finishQuiz);

function startQuiz() {
  // Reiniciar
  currentIndex = 0;
  score = 1;
  timer = 0;
  resultDiv.innerHTML = "";
  startBtn.style.display = "none";
  nextBtn.style.display = "none";
  finishBtn.style.display = "none";

  // Seleccionar preguntas aleatorias
  quizQuestions = shuffle([...questionBank]).slice(0, numQuestions);

  // Iniciar tiempo
  timerInterval = setInterval(() => {
    timer++;
    timerDiv.textContent = "Tiempo: " + timer + "s";
  }, 1000);

  showQuestion(currentIndex);
}

function showQuestion(index) {
  if (index >= quizQuestions.length) {
    finishQuiz();
    return;
  }
  const q = quizQuestions[index];
  questionContainer.innerHTML = `
    <div class="question">
      <h3>${q.question}</h3>
      ${q.options.map((opt, i) =>
        `<label><input type="radio" name="q${index}" value="${i}"> ${opt}</label><br>`
      ).join("")}
    </div>
  `;
  nextBtn.style.display = (index < quizQuestions.length - 1) ? "inline-block" : "none";
  finishBtn.style.display = (index === quizQuestions.length - 1) ? "inline-block" : "none";
}

function finishQuiz() {
  clearInterval(timerInterval);
  // Calcular puntaje
  quizQuestions.forEach((q, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    if (selected && parseInt(selected.value) === parseInt(q.answer)) {
        score++;
    }
  });
  questionContainer.innerHTML = "";
  nextBtn.style.display = "none";
  finishBtn.style.display = "none";
  startBtn.style.display = "inline-block";
  resultDiv.innerHTML = `
    <h2>Resultados</h2>
    <p>Correctas: ${score} / ${quizQuestions.length}</p>
    <p>Tiempo total: ${timer} segundos</p>
  `;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
