import { escHtml, escAttr } from './utils.js';

const QUIZ_CATEGORIES = ['house', 'wild', 'extinct'];

const modal = document.getElementById('testModal');
const openBtn = document.getElementById('testOpenBtn');
const closeBtn = document.getElementById('testModalClose');
const bodyEl = document.getElementById('testModalBody');
const progressEl = document.getElementById('testProgress');

let questions = [];
let step = 0;
const scores = { house: 0, wild: 0, extinct: 0 };

function openQuizModal() {
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeQuizModal() {
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
}

function resetQuiz() {
  step = 0;
  scores.house = 0;
  scores.wild = 0;
  scores.extinct = 0;
}

function pickWinner() {
  let best = QUIZ_CATEGORIES[0];
  let max = scores[best];
  for (const cat of QUIZ_CATEGORIES) {
    if (scores[cat] > max) {
      max = scores[cat];
      best = cat;
    }
  }
  return best;
}

function renderQuestion() {
  if (!bodyEl) return;
  const q = questions[step];
  if (!q) return;

  if (progressEl) {
    progressEl.textContent = `Вопрос ${step + 1} из ${questions.length}`;
  }

  const answersHtml = q.options
    .map(
      (opt, i) =>
        `<button type="button" class="test-answer" data-index="${i}">${escHtml(opt.text)}</button>`
    )
    .join('');

  bodyEl.innerHTML = `
    <p class="test-question">${escHtml(q.text)}</p>
    <div class="test-answers">${answersHtml}</div>
  `;

  bodyEl.querySelectorAll('.test-answer').forEach((btn) => {
    btn.addEventListener('click', () => {
      const option = q.options[Number(btn.dataset.index)];
      if (option?.category) scores[option.category] += 1;
      step += 1;
      if (step < questions.length) renderQuestion();
      else showResult();
    });
  });
}

async function showResult() {
  if (!bodyEl) return;
  const category = pickWinner();

  bodyEl.innerHTML = '<p class="test-loading">Подбираем результат…</p>';
  if (progressEl) progressEl.textContent = '';

  try {
    const res = await fetch(`/api/test/results/${category}`);
    if (!res.ok) throw new Error('result');
    const data = await res.json();

    const title = data.title
      ? `<h3 class="test-result-title">${escHtml(data.title)}</h3>`
      : '';
    const img = data.photo
      ? `<img src="${escAttr(data.photo)}" class="test-result-img image-contour" alt="${escAttr(data.title)}">`
      : '';

    bodyEl.innerHTML = `
      <div class="test-result">
        ${img}
        ${title}
        <p class="test-result-text">${escHtml(data.text ?? '')}</p>
        <button type="button" class="test-restart">Пройти снова</button>
      </div>
    `;

    bodyEl.querySelector('.test-restart')?.addEventListener('click', startQuiz);
  } catch {
    bodyEl.innerHTML =
      '<p class="test-error">Не удалось загрузить результат. Попробуйте позже.</p>';
  }
}

async function startQuiz() {
  if (!bodyEl) return;
  resetQuiz();
  bodyEl.innerHTML = '<p class="test-loading">Загрузка вопросов…</p>';
  if (progressEl) progressEl.textContent = '';

  try {
    const res = await fetch('/api/test/questions');
    if (!res.ok) throw new Error('questions');
    questions = await res.json();
    if (!questions.length) {
      bodyEl.innerHTML = '<p class="test-error">Вопросы квиза пока не добавлены.</p>';
      return;
    }
    renderQuestion();
  } catch {
    bodyEl.innerHTML =
      '<p class="test-error">Не удалось загрузить квиз. Проверьте подключение к серверу.</p>';
  }
}

export function initQuiz() {
  if (!modal || !openBtn) return;

  openBtn.addEventListener('click', () => {
    openQuizModal();
    startQuiz();
  });

  closeBtn?.addEventListener('click', closeQuizModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeQuizModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeQuizModal();
  });
}
