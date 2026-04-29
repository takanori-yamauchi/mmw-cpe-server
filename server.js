const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();

app.use(cors());        // ←これが超重要
app.use(express.json());

// 確認用
app.get('/', (req, res) => {
  res.send('サーバー動いてます 👍');
});

// JSON受信＆保存
app.post('/api/data', (req, res) => {
  const newData = req.body;

  let dataArray = [];

  // 既存ファイルがあれば読み込み
  if (fs.existsSync('data.json')) {
    const file = fs.readFileSync('data.json');
    dataArray = JSON.parse(file);
  }

  // 配列に追加
  dataArray.push(newData);

  // 保存
  fs.writeFileSync('data.json', JSON.stringify(dataArray, null, 2));

  console.log('保存データ:', newData);

  res.json({ status: 'ok' });
});

// Render対応（重要）
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`起動ポート: ${PORT}`);
});

// データ取得
app.get('/api/data', (req, res) => {
  if (!fs.existsSync('data.json')) {
    return res.json([]);
  }

  const file = fs.readFileSync('data.json');
  const data = JSON.parse(file);

  res.json(data);
});