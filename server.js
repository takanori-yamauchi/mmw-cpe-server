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
// ログのパース
function parseLog(log) {
  // %idle（CPU使用率から）
  // 'all' 行の ' %idle' を抽出
  const idleMatch = log.match(/^.*all\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)$/m);
  const percentIdle = idleMatch ? idleMatch[9] : null;

  // MemTotal, MemFree
  const memTotal = log.match(/^MemTotal:\s+(\d+)\s+kB/m);
  const memFree  = log.match(/^MemFree:\s+(\d+)\s+kB/m);

  // ARFCN, PCI, SSB, RSRP, SINR
  // LTE PCell 情報
  const pcellBlock = log.match(/\[LTE Cell Info\][\s\S]*?PCell([\s\S]*?)(SCC|=+)/);
  let ARFCN, PCI, RSRP, SINR;
  if(pcellBlock){
    ARFCN = pcellBlock[1].match(/Raster_ARFCN\s*=\s*([-\w.]+)/)?.[1];
    PCI   = pcellBlock[1].match(/PCI\s*=\s*([-\w.]+)/)?.[1];
    RSRP  = pcellBlock[1].match(/RSRP\s*=\s*([-\w.]+)/)?.[1];
    SINR  = pcellBlock[1].match(/SINR\s*=\s*([-\w.]+)/)?.[1];
    // SSBはこのサンプルログにはなく、NR5Gブロック(File not found)のため取得不可
  }

  // Thermal
  const modemTemp         = log.match(/\[ModemTemp\]\s+([\d.]+) C/);
  const nrSub6AntTemp     = log.match(/\[5GNRSub6AntTemp\]\s+([\d.]+) C/);
  const nrMmWAntTemp      = log.match(/\[5GNRmmWAntTemp\]\s+([\d.]+) C/);
  const lteAntTemp        = log.match(/\[4GAntTemp\]\s+([\d.]+) C/);
  const cpuTemp           = log.match(/\[CPUTemp\]\s+([\d.]+) C/);

  // System Info
  const softwareVer = log.match(/Software Version\s*:\s*(\S+)/);
  const hardwareVer = log.match(/Hardware Version\s*:\s*(\S+)/);
  const imei        = log.match(/IMEI\s*:\s*(\d+)/);

  return {
    percentIdle  : percentIdle,
    MemTotal     : memTotal  ? memTotal[1]  : null,
    MemFree      : memFree   ? memFree[1]   : null,
    Raster_ARFCN : ARFCN     || null,
    PCI          : PCI       || null,
    SSB          : null,  // このログには NR SSB 情報が無い
    RSRP         : RSRP     || null,
    SINR         : SINR     || null,
    ModemTemp    : modemTemp        ? modemTemp[1]    : null,
    NRSub6AntTemp: nrSub6AntTemp    ? nrSub6AntTemp[1]: null,
    NRmmWAntTemp : nrMmWAntTemp     ? nrMmWAntTemp[1] : null,
    LteAntTemp   : lteAntTemp       ? lteAntTemp[1]   : null,
    CPUTemp      : cpuTemp          ? cpuTemp[1]      : null,
    SoftwareVer  : softwareVer      ? softwareVer[1]  : null,
    HardwareVer  : hardwareVer      ? hardwareVer[1]  : null,
    IMEI         : imei             ? imei[1]         : null
  }
}




// ★ DB保存
app.post('/api/data', async (req, res) => {
  try {
    const d = parseText(req.body);
    //const d = parseLog(req.body);

    await pool.query(
      'INSERT INTO app.measurements (imei, rsrp, sinr,datetime,swversion,hwversion) VALUES ($1,$2,$3,$4,$5,$6)',
      [d.imei, d.rsrp, d.sinr,d.datetime,d.swversion,d.hwversion]
      //'INSERT INTO app.measurements (imei, rsrp, sinr) VALUES ($1,$2,$3)',
      //[d.imei, d.rsrp, d.sinr]
      //'INSERT INTO app.measurement-SB (percentIdle,MemTotal,MemFree,Raster_ARFCN,PCI,SSB,RSRP,SINR,ModemTemp,NRSub6AntTemp,NRmmWAntTemp,LteAntTemp,CPUTemp,SoftwareVer,HardwareVer,IMEI) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)',
      //[d.percentIdle,d.MemTotal,d.MemFree,d.Raster_ARFCN,d.PCI,d.SSB,d.RSRP,d.SINR,d.ModemTemp,d.NRSub6AntTemp,d.NRmmWAntTemp,d.LteAntTemp,d.CPUTemp,d.SoftwareVer,d.HardwareVer,d.IMEI]
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