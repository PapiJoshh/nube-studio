const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Capa de base de datos: PostgreSQL en la nube (DATABASE_URL) o SQLite local ----
let q; // q(sql, params) -> filas
async function initDb() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    });
    q = async (sql, p = []) => (await pool.query(sql, p)).rows;
    await q(`CREATE TABLE IF NOT EXISTS recursos (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(120) NOT NULL,
      descripcion VARCHAR(500) DEFAULT '',
      tipo VARCHAR(20) NOT NULL,
      url TEXT NOT NULL,
      me_gusta INTEGER NOT NULL DEFAULT 0,
      creado TIMESTAMP DEFAULT NOW()
    )`);
    console.log('Base de datos: PostgreSQL');
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'data.db'));
    db.exec(`CREATE TABLE IF NOT EXISTS recursos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL, descripcion TEXT DEFAULT '', tipo TEXT NOT NULL,
      url TEXT NOT NULL, me_gusta INTEGER NOT NULL DEFAULT 0,
      creado TEXT DEFAULT CURRENT_TIMESTAMP)`);
    // adapta $1,$2 -> ? y devuelve filas
    q = async (sql, p = []) => {
      const s = sql.replace(/\$\d+/g, '?').replace(/ RETURNING \*$/i, '');
      const returning = /RETURNING \*$/i.test(sql);
      const st = db.prepare(s);
      if (/^\s*select/i.test(s)) return st.all(...p);
      const r = st.run(...p);
      if (returning) {
        if (/^\s*insert/i.test(s)) return db.prepare('SELECT * FROM recursos WHERE id=?').all(Number(r.lastInsertRowid));
        return db.prepare('SELECT * FROM recursos WHERE id=?').all(Number(p[p.length - 1]));
      }
      return [];
    };
    console.log('Base de datos: SQLite local');
  }
  const [{ c }] = await q('SELECT COUNT(*) AS c FROM recursos');
  if (Number(c) === 0) {
    const ej = [
      ['Introducción a la computación en la nube', 'Qué es la nube y por qué importa. Video alojado en YouTube.', 'video', 'https://www.youtube.com/watch?v=mxT233EdY5c'],
      ['Aurora boreal', 'Fotografía servida desde la CDN de Unsplash.', 'imagen', 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200&q=80'],
      ['Montañas al amanecer', 'Imagen en la nube con carga diferida.', 'imagen', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80'],
      ['Lo-fi para programar', 'Reproductor incrustado desde Spotify.', 'musica', 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn'],
      ['Documentación de Render', 'Guía oficial para publicar aplicaciones web.', 'enlace', 'https://render.com/docs'],
    ];
    for (const r of ej) await q('INSERT INTO recursos (titulo,descripcion,tipo,url) VALUES ($1,$2,$3,$4)', r);
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TIPOS = ['video', 'imagen', 'musica', 'enlace'];
const urlValida = (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } };
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: 'Error del servidor' }); });

app.get('/api/recursos', wrap(async (req, res) => {
  res.json(await q('SELECT * FROM recursos ORDER BY id DESC'));
}));
app.post('/api/recursos', wrap(async (req, res) => {
  const { titulo, descripcion = '', tipo, url } = req.body || {};
  if (!titulo || !String(titulo).trim() || !TIPOS.includes(tipo) || !urlValida(url))
    return res.status(400).json({ error: 'Datos inválidos' });
  const rows = await q('INSERT INTO recursos (titulo,descripcion,tipo,url) VALUES ($1,$2,$3,$4) RETURNING *',
    [String(titulo).trim().slice(0, 120), String(descripcion).slice(0, 500), tipo, url]);
  res.status(201).json(rows[0]);
}));
app.put('/api/recursos/:id/like', wrap(async (req, res) => {
  const rows = await q('UPDATE recursos SET me_gusta = me_gusta + 1 WHERE id = $1 RETURNING *', [Number(req.params.id)]);
  rows.length ? res.json(rows[0]) : res.status(404).json({ error: 'No encontrado' });
}));
app.delete('/api/recursos/:id', wrap(async (req, res) => {
  await q('DELETE FROM recursos WHERE id = $1', [Number(req.params.id)]);
  res.status(204).end();
}));

initDb().then(() => app.listen(PORT, () => console.log('Servidor en puerto ' + PORT)))
  .catch((e) => { console.error('Error al iniciar la base de datos', e); process.exit(1); });
