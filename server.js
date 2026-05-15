import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'frontend', 'dist');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
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

// карточки кошек из таблицы cats
app.get('/api/cards', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cats ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    console.error('БД /api/cards:', err);
    res.status(500).json({ error: 'Не удалось получить данные' });
  }
});

/** Список id карточек, которые пользователь уже лайкнул */
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
    await client.query('ROLLBACK');
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
    await client.query('ROLLBACK');
    console.error('БД DELETE /like:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  } finally {
    client.release();
  }
});

// SPA: всё остальное — index.html
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
