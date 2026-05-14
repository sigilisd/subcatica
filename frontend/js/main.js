import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const container = document.getElementById('cats-container');
const searchInput = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const results = document.getElementById('results');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesWord(text, token) {
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(token)}([^\\p{L}\\p{N}]|$)`,
    'iu'
  );
  return pattern.test(text);
}

function getCatScenes() {
  if (!container) return [];
  return Array.from(container.querySelectorAll('.scene.cat-card'));
}

function applyFilters() {
  if (!results || !searchInput || !filterCategory) return;

  const query = searchInput.value.trim().toLowerCase();
  const queryTokens = query.split(/\s+/).filter(Boolean);
  const selectedCategory = filterCategory.value;
  let visibleCount = 0;

  getCatScenes().forEach((scene) => {
    const h1Text = scene.querySelector('h1')?.textContent?.toLowerCase() || '';
    const pText = scene.querySelector('p')?.textContent?.toLowerCase() || '';
    const idText = (scene.id || '').toLowerCase();
    const contentText = `${h1Text} ${pText}`;

    const matchesSearch =
      queryTokens.length === 0 ||
      queryTokens.every(
        (token) => matchesWord(contentText, token) || idText.includes(token)
      );
    const categoryId = scene.dataset.categoryId ?? '';
    const matchesCategory =
      selectedCategory === 'all' || String(categoryId) === selectedCategory;
    const isVisible = matchesSearch && matchesCategory;

    scene.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });

  results.textContent =
    visibleCount > 0
      ? `Найдено: ${visibleCount}`
      : 'Ничего не найдено. Попробуйте другой запрос.';

  ScrollTrigger.refresh(true);
}

function initFilters() {
  if (!searchInput || !filterCategory || !results) return;
  searchInput.addEventListener('input', applyFilters);
  filterCategory.addEventListener('change', applyFilters);
}

function animateCards() {
  if (!container) return;
  const cards = container.querySelectorAll('.cat-card');
  if (!cards.length) return;
  gsap.set(cards, { opacity: 0, y: 36 });
  gsap.to(cards, {
    opacity: 1,
    y: 0,
    duration: 0.6,
    stagger: 0.15,
    ease: 'power2.out',
  });
}

function initScrollAnimations() {
  gsap.to('.progress-bar', {
    width: '100%',
    ease: 'none',
    scrollTrigger: {
      trigger: document.documentElement,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      invalidateOnRefresh: true,
    },
  });

  gsap.to('#cat1', {
    y: 300,
    rotation: -360,
    scrollTrigger: {
      trigger: '#welcome',
      start: 'top top',
      end: 'bottom top',
      scrub: 3,
    },
  });

  gsap.to('#cat2', {
    y: 300,
    rotation: 360,
    scrollTrigger: {
      trigger: '#welcome',
      start: 'top top',
      end: 'bottom top',
      scrub: 3,
    },
  });
}

async function loadCats() {
  if (!container) return;
  try {
    const response = await fetch('/api/cards');
    const cats = await response.json();
    container.innerHTML = '';

    cats.forEach((cat) => {
      const categoryId = cat.categories_id ?? cat.category_id ?? '';
      const catHTML = `
      <section class="scene cat-card" id="cat-${cat.id}" data-category-id="${categoryId}">
          <div class="content">
            <img src="${cat.photo}" class="parallax-cat image-contour cat-img-main" alt="${cat.title}">
            <h1>${cat.title}</h1>
            <p>${cat.description}</p>
          </div>
        </section>
      `;
      container.insertAdjacentHTML('beforeend', catHTML);
    });

    animateCards();
    applyFilters();
  } catch (error) {
    console.error('Ошибка при загрузке котиков на фронтенд:', error);
  }
}

initFilters();
initScrollAnimations();
loadCats();
