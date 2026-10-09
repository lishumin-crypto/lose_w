/* 守护进程：始终让 "服务器 + 隧道" 保持运行
 * 子进程退出 → 5 秒后自动重启；网址因固定子域名而不变。
 * 用法：node watchdog.js
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
process.chdir(__dirname);

const LOG = path.join(__dirname, 'run.log');
function log(msg) { fs.appendFileSync(LOG, '[' + new Date().toLocaleString() + '] ' + msg + '\n'); }

log('watchdog started');
function launch() {
  const p = spawn(process.execPath, [path.join(__dirname, 'start.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout.on('data', (d) => fs.appendFileSync(LOG, d));
  p.stderr.on('data', (d) => fs.appendFileSync(LOG, d));
  p.on('exit', (code) => {
    log('child exited (code ' + code + '), restart in 5s');
    setTimeout(launch, 5000);
  });
}
launch();
