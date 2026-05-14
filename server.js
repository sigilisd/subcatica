import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, 'frontend', 'dist');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Ошибка подключения к PostgreSQL:', err.stack);
  }
  console.log('✅ База данных PostgreSQL успешно подключена!');
  release();
});

app.use(express.json());
app.use(express.static(distPath));

app.get('/api/cards', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cats ORDER BY id ASC');

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка при запросе к БД:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении данных' });
  }
});

app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});