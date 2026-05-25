import '../css/style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initQuiz } from './quiz.js';
import { escHtml, escAttr } from './utils.js';

gsap.registerPlugin(ScrollTrigger);

const container = document.getElementById('cats-container');
const searchInput = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const results = document.getElementById('results');

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesWord(text, word) {
  const re = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}([^\\p{L}\\p{N}]|$)`,
    'iu'
  );
  return re.test(text);
}

function catScenes() {
  return container ? [...container.querySelectorAll('.scene.cat-card')] : [];
}

function applyFilters() {
  if (!results || !searchInput || !filterCategory) return;

  const tokens = searchInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const category = filterCategory.value;
  let n = 0;

  catScenes().forEach((scene) => {
    const title = scene.querySelector('h1')?.textContent?.toLowerCase() ?? '';
    const desc = scene.querySelector('p')?.textContent?.toLowerCase() ?? '';
    const blob = `${title} ${desc}`;
    const id = (scene.id || '').toLowerCase();

    const okSearch =
      tokens.length === 0 ||
      tokens.every((t) => matchesWord(blob, t) || id.includes(t));
    const cat = scene.dataset.categoryId ?? '';
    const okCat = category === 'all' || String(cat) === category;
    const show = okSearch && okCat;

    scene.hidden = !show;
    if (show) n += 1;
  });

  results.textContent =
    n > 0 ? `Найдено: ${n}` : 'Ничего не найдено. Попробуйте другой запрос.';
  ScrollTrigger.refresh(true);
}

function initFilters() {
  if (!searchInput || !filterCategory || !results) return;
  searchInput.addEventListener('input', applyFilters);
  filterCategory.addEventListener('change', applyFilters);
}

function initLikes() {
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.like-btn');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.catId;
    if (id) toggleLike(id, btn);
  });
}

function parseCountries(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

let habitatMap = null;
let habitatMarkers = [];

function initMapModal() {
  const modal = document.getElementById('mapModal');
  const closeBtn = document.getElementById('mapModalClose');
  const mapEl = document.getElementById('map');
  if (!modal || !mapEl || typeof L === 'undefined') return;

  habitatMap = L.map(mapEl).setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
  }).addTo(habitatMap);

  closeBtn?.addEventListener('click', closeMapModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeMapModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeMapModal();
  });
}

function openMapModal() {
  const modal = document.getElementById('mapModal');
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => habitatMap?.invalidateSize());
  setTimeout(() => habitatMap?.invalidateSize(), 200);
}

function closeMapModal() {
  const modal = document.getElementById('mapModal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
}

function clearMapMarkers() {
  if (!habitatMap) return;
  habitatMarkers.forEach((m) => habitatMap.removeLayer(m));
  habitatMarkers = [];
}

function setMapStatus(text) {
  const el = document.getElementById('mapModalStatus');
  if (el) el.textContent = text ?? '';
}

async function showHabitatOnMap(catId, catTitle) {
  if (!habitatMap) return;

  openMapModal();
  setMapStatus('Загрузка…');
  clearMapMarkers();

  const titleEl = document.getElementById('modalCatName');
  if (titleEl) {
    titleEl.textContent = catTitle
      ? `Где обитает: ${catTitle}`
      : 'Ареал обитания';
  }

  try {
    const catRes = await fetch(`/api/cards/${catId}`);
    if (!catRes.ok) throw new Error('not found');
    const cat = await catRes.json();
    const countries = parseCountries(cat.countries);

    if (!countries.length) {
      setMapStatus('Страны для этой кошки не указаны в базе данных.');
      habitatMap.setView([20, 0], 2);
      return;
    }

    setMapStatus('Поиск координат…');

    const geoRes = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countries }),
    });

    if (!geoRes.ok) throw new Error('geocode');
    const { points } = await geoRes.json();

    if (!points?.length) {
      setMapStatus('Не удалось найти координаты для указанных стран.');
      habitatMap.setView([20, 0], 2);
      return;
    }

    const bounds = [];
    const name = cat.title ?? catTitle ?? 'Кошка';

    points.forEach(({ country, lat, lon }) => {
      const marker = L.marker([lat, lon]).addTo(habitatMap);
      marker.bindPopup(`${name} — ${country}`);
      habitatMarkers.push(marker);
      bounds.push([lat, lon]);
    });

    if (bounds.length === 1) {
      habitatMap.flyTo(bounds[0], 4);
    } else {
      habitatMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
    }

    setMapStatus(
      points.length < countries.length
        ? `Найдено ${points.length} из ${countries.length} стран.`
        : ''
    );
  } catch (err) {
    console.error('Карта:', err);
    setMapStatus('Не удалось загрузить карту. Попробуйте позже.');
  } finally {
    requestAnimationFrame(() => habitatMap?.invalidateSize());
  }
}

function initCatMapClicks() {
  if (!container) return;
  container.addEventListener('click', (e) => {
    const img = e.target.closest('.cat-card__media img');
    if (!img) return;
    const section = img.closest('.cat-card');
    const catId = section?.id?.replace(/^cat-/, '');
    if (!catId) return;
    const title = section.querySelector('h1')?.textContent?.trim() ?? '';
    showHabitatOnMap(catId, title);
  });
}

function getUserUUID() {
  let uuid = localStorage.getItem('user_cat_uuid');
  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem('user_cat_uuid', uuid);
  }
  return uuid;
}

async function markAlreadyLiked() {
  if (!container) return;
  try {
    const res = await fetch(
      `/api/likes?userUUID=${encodeURIComponent(getUserUUID())}`
    );
    if (!res.ok) return;
    const ids = await res.json();
    ids.forEach((id) => {
      const btn = container.querySelector(`.like-btn[data-cat-id="${id}"]`);
      if (btn) btn.classList.add('liked');
    });
  } catch (err) {
    console.error('Лайки:', err);
  }
}

async function toggleLike(id, button) {
  const liked = button.classList.contains('liked');
  button.disabled = true;

  try {
    const response = await fetch(`/api/cards/${id}/like`, {
      method: liked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userUUID: getUserUUID() }),
    });

    const data = await response.json();

    if (response.ok) {
      const countSpan = button.querySelector('.likes-count');
      if (countSpan) countSpan.textContent = data.likes;
      button.classList.toggle('liked', !liked);
      gsap.fromTo(button, { scale: 0.85 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
      return;
    }

    if (!liked && response.status === 403) {
      button.classList.add('liked');
    }
  } catch (err) {
    console.error('Лайк:', err);
  } finally {
    button.disabled = false;
  }
}

function animateCards(nodes, onDone) {
  if (!nodes?.length) {
    onDone?.();
    return;
  }
  gsap.timeline({ onComplete: onDone }).fromTo(
    nodes,
    { opacity: 0, y: 36 },
    { opacity: 1, y: 0, duration: 0.6, stagger: 0.15, ease: 'power2.out' }
  );
}

function setupTextParallax(scenes) {
  scenes.forEach((scene) => {
    const h1 = scene.querySelector('.back');
    const p = scene.querySelector('.mid');
    if (!h1 || !p) return;

    gsap
      .timeline({
        scrollTrigger: {
          trigger: scene,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.5,
          invalidateOnRefresh: true,
        },
      })
      .fromTo(h1, { y: 48 }, { y: -120, ease: 'none', duration: 1 }, 0)
      .fromTo(p, { y: 24 }, { y: -56, ease: 'none', duration: 1 }, 0);
  });
  ScrollTrigger.refresh(true);
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

  [
    ['#cat1', -360],
    ['#cat2', 360],
  ].forEach(([selector, rotation]) => {
    gsap.to(selector, {
      y: 300,
      rotation,
      scrollTrigger: {
        trigger: '#welcome',
        start: 'top top',
        end: 'bottom top',
        scrub: 3,
      },
    });
  });
}

async function loadCats() {
  if (!container) return;
  try {
    const cats = await (await fetch('/api/cards')).json();
    container.innerHTML = '';

    cats.forEach((cat) => {
      const catId = cat.categories_id ?? cat.category_id ?? '';
      container.insertAdjacentHTML(
        'beforeend',
        `<section class="scene cat-card" id="cat-${cat.id}" data-category-id="${catId}">
          <div class="cat-card__media">
            <img src="${escAttr(cat.photo)}" class="parallax-cat image-contour cat-img-main size-cat" alt="${escAttr(cat.title)}" title="Показать ареал на карте">
          </div>
          <div class="content">
            <h1 class="back">${escHtml(cat.title)}</h1>
            <p class="mid">${escHtml(cat.description)}</p>
            <div class="likes-wrap">
              <button type="button" class="like-btn" data-cat-id="${cat.id}">
                ❤️ <span class="likes-count">${cat.likes ?? 0}</span>
              </button>
            </div>
          </div>
        </section>`
      );
    });

    const scenes = container.querySelectorAll('.scene.cat-card');
    await markAlreadyLiked();
    applyFilters();
    animateCards(scenes, () => setupTextParallax(scenes));
  } catch (e) {
    console.error('Карточки:', e);
  }
}

initFilters();
initLikes();
initQuiz();
initMapModal();
initCatMapClicks();
initScrollAnimations();
loadCats();
