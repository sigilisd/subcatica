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

// SPA: всё остальное — index.html
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
