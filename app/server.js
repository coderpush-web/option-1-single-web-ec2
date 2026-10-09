const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
const port = process.env.PORT || 80;
const APP_ENV = process.env.APP_ENV || 'Production';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const startTime = Date.now();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', env: APP_ENV });
});

app.get('/api/metrics', (req, res) => {
  const memUsage = process.memoryUsage();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const cpuUsage = Math.floor(18 + Math.random() * 12);
  const memoryUsage = Math.floor(38 + Math.random() * 8);

  res.json({
    env: APP_ENV,
    hostname: os.hostname(),
    uptimeSeconds,
    cpuUsage,
    memoryUsage,
    heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024)
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`CloudPulse Web Server running on port ${port} in ${APP_ENV} mode`);
});
