import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;
const QUIZ_CATEGORIES = ['house', 'wild', 'extinct'];

const QUIZ_CATEGORY_ALIASES = {
  home: 'house',
  domestic: 'house',
  домашняя: 'house',
  домашний: 'house',
  дикая: 'wild',
  дикий: 'wild',
  вымершая: 'extinct',
  вымерший: 'extinct',
};

const QUIZ_DEFAULT_PHOTO = {
  house: 'assets/img/cats/quiz/house.png',
  wild: 'assets/img/cats/quiz/wild.png',
  extinct: 'assets/img/cats/quiz/extinct.png',
};

function normalizeQuizCategory(raw) {
  const key = String(raw ?? '').trim().toLowerCase();
  if (QUIZ_CATEGORIES.includes(key)) return key;
  return QUIZ_CATEGORY_ALIASES[key] ?? null;
}

function normalizeQuizPhoto(photo, category) {
  const cat = normalizeQuizCategory(category) ?? category;
  const fallback = QUIZ_DEFAULT_PHOTO[cat] ?? '';

  if (!photo || !String(photo).trim()) return fallback;

  let p = String(photo).trim().replace(/\\/g, '/');
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith('/')) p = p.slice(1);
  if (!p.startsWith('assets/')) {
    p = p.includes('/') ? `assets/img/cats/${p}` : `assets/img/cats/quiz/${p}`;
  }
  return p;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'frontend', 'dist');
const publicPath = path.join(__dirname, 'frontend', 'public');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
  // user: process.env.DB_USER,
  // host: process.env.DB_HOST,
  // database: process.env.DB_NAME,
  // password: process.env.DB_PASSWORD,
  // port: process.env.DB_PORT,
});

pool
  .connect()
  .then((client) => {
    console.log('PostgreSQL: подключение установлено.');
    client.release();
  })
  .catch((err) => console.error('PostgreSQL: ошибка подключения.', err.message));

app.use(express.json());
app.use(express.static(distPath));
app.use(express.static(publicPath));

function parseCountriesField(row) {
  const raw = row.countries;
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    if (t.startsWith('[')) {
      try {
        const arr = JSON.parse(t);
        if (Array.isArray(arr)) {
          return arr.map((s) => String(s).trim()).filter(Boolean);
        }
      } catch {}
    }
    return t.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeCat(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    photo: row.photo,
    categories_id: row.categories_id ?? row.category_id,
    likes: row.likes ?? 0,
    countries: parseCountriesField(row),
  };
}

function parseLikeParams(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  const { userUUID } = req.body;
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Некорректный id' });
    return null;
  }
  if (!userUUID) {
    res.status(400).json({ error: 'Нет userUUID' });
    return null;
  }
  return { id, userUUID };
}

function parseQuestionOptions(row) {
  const options = [];
  for (let i = 1; i <= 3; i += 1) {
    const text = row[`answer_${i}`];
    const category = normalizeQuizCategory(row[`cat_${i}`]);
    if (!text || !category) continue;
    options.push({ text: String(text), category });
  }
  return options;
}

function normalizeQuestion(row) {
  return {
    id: row.id,
    text: String(row.question_text ?? ''),
    options: parseQuestionOptions(row),
  };
}

function normalizeQuizResult(row) {
  const category =
    normalizeQuizCategory(row.category) ??
    String(row.category).trim().toLowerCase();
  return {
    category,
    title: row.title ?? '',
    text: row.description ?? '',
    photo: normalizeQuizPhoto(row.photo, category),
  };
}

// Статичный fallback: координаты центров стран — используются если Nominatim недоступен
// const GEO_FALLBACK = {
//   'россия': [61.5, 105.3], 'russia': [61.5, 105.3],
//   'китай': [35.9, 104.2], 'china': [35.9, 104.2],
//   'индия': [20.6, 79.1], 'india': [20.6, 79.1],
//   'африка': [8.8, 26.8], 'africa': [8.8, 26.8],
//   'казахстан': [48.0, 68.0], 'kazakhstan': [48.0, 68.0],
//   'монголия': [46.9, 103.8], 'mongolia': [46.9, 103.8],
//   'иран': [32.4, 53.7], 'iran': [32.4, 53.7],
//   'афганистан': [33.9, 67.7], 'afghanistan': [33.9, 67.7],
//   'пакистан': [30.4, 69.3], 'pakistan': [30.4, 69.3],
//   'индонезия': [-2.5, 118.0], 'indonesia': [-2.5, 118.0],
//   'борнео': [1.0, 114.0], 'borneo': [1.0, 114.0],
//   'малайзия': [4.2, 108.0], 'malaysia': [4.2, 108.0],
//   'таиланд': [15.9, 100.9], 'thailand': [15.9, 100.9],
//   'вьетнам': [14.1, 108.3], 'vietnam': [14.1, 108.3],
//   'бразилия': [-14.2, -51.9], 'brazil': [-14.2, -51.9],
//   'аргентина': [-38.4, -63.6], 'argentina': [-38.4, -63.6],
//   'чили': [-35.7, -71.5], 'chile': [-35.7, -71.5],
//   'перу': [-9.2, -75.0], 'peru': [-9.2, -75.0],
//   'колумбия': [4.6, -74.3], 'colombia': [4.6, -74.3],
//   'венесуэла': [6.4, -66.6], 'venezuela': [6.4, -66.6],
//   'боливия': [-16.3, -63.6], 'bolivia': [-16.3, -63.6],
//   'парагвай': [-23.4, -58.4], 'paraguay': [-23.4, -58.4],
//   'уругвай': [-32.5, -55.8], 'uruguay': [-32.5, -55.8],
//   'мексика': [23.6, -102.6], 'mexico': [23.6, -102.6],
//   'канада': [56.1, -106.3], 'canada': [56.1, -106.3],
//   'сша': [37.1, -95.7], 'usa': [37.1, -95.7], 'united states': [37.1, -95.7],
//   'испания': [40.5, -3.7], 'spain': [40.5, -3.7],
//   'португалия': [39.4, -8.2], 'portugal': [39.4, -8.2],
//   'эфиопия': [9.1, 40.5], 'ethiopia': [9.1, 40.5],
//   'кения': [-0.0, 37.9], 'kenya': [-0.0, 37.9],
//   'танзания': [-6.4, 34.9], 'tanzania': [-6.4, 34.9],
//   'южная африка': [-28.5, 24.7], 'south africa': [-28.5, 24.7],
//   'ангола': [-11.2, 17.9], 'angola': [-11.2, 17.9],
//   'конго': [-4.0, 21.8], 'congo': [-4.0, 21.8],
//   'камерун': [3.8, 11.5], 'cameroon': [3.8, 11.5],
//   'нигерия': [9.1, 8.7], 'nigeria': [9.1, 8.7],
//   'судан': [12.9, 30.2], 'sudan': [12.9, 30.2],
//   'египет': [26.8, 30.8], 'egypt': [26.8, 30.8],
//   'алжир': [28.0, 2.6], 'algeria': [28.0, 2.6],
//   'марокко': [31.8, -7.1], 'morocco': [31.8, -7.1],
//   'саудовская аравия': [23.9, 45.1], 'saudi arabia': [23.9, 45.1],
//   'туркменистан': [40.0, 59.6], 'turkmenistan': [40.0, 59.6],
//   'узбекистан': [41.4, 64.6], 'uzbekistan': [41.4, 64.6],
//   'непал': [28.4, 84.1], 'nepal': [28.4, 84.1],
//   'бутан': [27.5, 90.4], 'bhutan': [27.5, 90.4],
//   'мьянма': [21.9, 95.9], 'myanmar': [21.9, 95.9],
// };

const geocodeCache = new Map();

async function geocodeCountry(country) {
  const key = country.trim().toLowerCase();

  if (geocodeCache.has(key)) {
    return geocodeCache.get(key);
  }

  if (GEO_FALLBACK[key]) {
    const [lat, lon] = GEO_FALLBACK[key];
    const result = { country, lat, lon };
    geocodeCache.set(key, result);
    return result;
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', country);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000); // 5 сек вместо 10

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Subcatica/1.0 (educational project)',
        'Accept-Language': 'ru,en',
      },
    });
    clearTimeout(timer);

    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.length) return null;

    const result = {
      country,
      lat: Number.parseFloat(data[0].lat),
      lon: Number.parseFloat(data[0].lon),
    };
    geocodeCache.set(key, result);
    return result;
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'таймаут' : err.message;
    console.warn(`Геокодирование "${country}": ${msg}`);
    return null;
  }
}

app.get('/api/cards', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cats ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    console.error('БД /api/cards:', err);
    res.status(500).json({ error: 'Не удалось получить данные' });
  }
});

app.get('/api/cards/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Некорректный id' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM cats WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Кошка не найдена' });
    }
    res.json(normalizeCat(rows[0]));
  } catch (err) {
    console.error('БД GET /api/cards/:id:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/likes', async (req, res) => {
  const userUUID = req.query.userUUID;
  if (!userUUID) {
    return res.status(400).json({ error: 'Нет userUUID' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT cat_id FROM cat_likes WHERE user_uuid = $1',
      [userUUID]
    );
    res.json(rows.map((r) => r.cat_id));
  } catch (err) {
    console.error('БД /api/likes:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/cards/:id/like', async (req, res) => {
  const params = parseLikeParams(req, res);
  if (!params) return;
  const { id, userUUID } = params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO cat_likes (cat_id, user_uuid) VALUES ($1, $2)',
      [id, userUUID]
    );
    const result = await client.query(
      'UPDATE cats SET likes = COALESCE(likes, 0) + 1 WHERE id = $1 RETURNING likes',
      [id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Кошка не найдена' });
    }
    await client.query('COMMIT');
    res.json({ likes: result.rows[0].likes });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      return res.status(403).json({ error: 'Вы уже лайкнули эту кошку' });
    }
    console.error('БД POST /like:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.delete('/api/cards/:id/like', async (req, res) => {
  const params = parseLikeParams(req, res);
  if (!params) return;
  const { id, userUUID } = params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const removed = await client.query(
      'DELETE FROM cat_likes WHERE cat_id = $1 AND user_uuid = $2',
      [id, userUUID]
    );
    if (removed.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Лайк не найден' });
    }
    const result = await client.query(
      `UPDATE cats SET likes = GREATEST(COALESCE(likes, 0) - 1, 0)
       WHERE id = $1 RETURNING likes`,
      [id]
    );
    await client.query('COMMIT');
    res.json({ likes: result.rows[0]?.likes ?? 0 });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('БД DELETE /like:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

app.post('/api/geocode', async (req, res) => {
  const list = req.body?.countries;
  if (!Array.isArray(list) || list.length === 0) {
    return res.status(400).json({ error: 'Нужен массив countries' });
  }

  const countries = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
  const points = [];

  try {
    for (let i = 0; i < countries.length; i += 1) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1100));
      const point = await geocodeCountry(countries[i]);
      if (point) points.push(point);
    }
    res.json({ points });
  } catch (err) {
    console.error('Геокодирование:', err);
    res.status(500).json({ error: 'Ошибка геокодирования' });
  }
});

app.get('/api/quiz/questions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM quiz_questions ORDER BY id ASC'
    );
    res.json(
      rows.map(normalizeQuestion).filter((q) => q.text && q.options.length > 0)
    );
  } catch (err) {
    console.error('БД /api/quiz/questions:', err);
    res.status(500).json({ error: 'Не удалось загрузить вопросы' });
  }
});

app.get('/api/quiz/results/:category', async (req, res) => {
  const category = normalizeQuizCategory(req.params.category);
  if (!category) {
    return res.status(400).json({ error: 'Неизвестная категория' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM quiz_results');
    const found = rows
      .map(normalizeQuizResult)
      .find((r) => r.category === category);
    if (!found) {
      return res.status(404).json({ error: 'Результат не найден' });
    }
    res.json(found);
  } catch (err) {
    console.error('БД /api/quiz/results/:category:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
