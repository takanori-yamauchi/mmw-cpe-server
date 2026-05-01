const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.text()); // プレーンテキスト受信

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// テキストパース
function parseText(raw) {
  const data = {};
  raw.split(',').forEach(p => {
    const [k, v] = p.split('=');
    data[k.toLowerCase()] = v;
  });

  return {
    imei: data.imei,
    rsrp: Number(data.rsrp),
    sinr: Number(data.sinr)
  };
}

// ★ DB保存
app.post('/api/data', async (req, res) => {
  try {
    const d = parseText(req.body);

    await pool.query(
      'INSERT INTO app.measurements (imei, rsrp, sinr) VALUES ($1,$2,$3)',
      [d.imei, d.rsrp, d.sinr]
    );

    res.json({ status: 'saved' });
  } catch (e) {
    console.error(e);
    res.status(500).send('error');
  }
});

// ★ Grafana用取得
app.get('/api/data', async (req, res) => {
  const result = await pool.query(`
    SELECT
      created_at as time,
      rsrp,
      sinr,
      imei
    FROM app.measurements
    ORDER BY created_at
  `);

  res.json(result.rows);
});

app.listen(process.env.PORT || 3000);