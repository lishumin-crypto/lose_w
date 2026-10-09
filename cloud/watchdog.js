/* 守护进程：保证 "服务器 + 隧道" 一直可用
 *  1) 子进程退出 → 5 秒后自动重启
 *  2) 每 60 秒探测一次公网链接；连续 2 次失败 → 判定隧道假死
 *  3) 重启优先走「优雅关闭」（IPC 通知子进程先关隧道），以便拿回固定子域名
 * 用法：node watchdog.js
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
process.chdir(__dirname);

const LOG = path.join(__dirname, 'run.log');
const URLFILE = path.join(__dirname, 'url.txt');
let child = null;
let fails = 0;
let restarts = 0;

function log(msg) { try { fs.appendFileSync(LOG, '[' + new Date().toLocaleString() + '] ' + msg + '\n'); } catch (e) {} }
function readUrl() { try { return fs.readFileSync(URLFILE, 'utf8').trim(); } catch (e) { return ''; } }

function launch() {
  log('starting child (restart #' + restarts + ')');
  child = spawn(process.execPath, [path.join(__dirname, 'start.js')],
    { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  child.stdout.on('data', (d) => fs.appendFileSync(LOG, d));
  child.stderr.on('data', (d) => fs.appendFileSync(LOG, d));
  child.on('exit', (code) => {
    log('child exited (code ' + code + '), restart in 5s');
    child = null;
    restarts++;
    setTimeout(launch, 5000);
  });
}

function softRestart(reason) {
  if (!child) return launch();
  log('watchdog: restarting child (' + reason + ')');
  let sent = false;
  try { child.send({ cmd: 'stop' }); sent = true; } catch (e) {}
  setTimeout(() => {
    if (child) { log('watchdog: force kill (graceful ' + (sent ? 'timed out' : 'failed') + ')'); try { child.kill(); } catch (e) {} }
  }, 9000);
}

function probe(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const mod = url.indexOf('https:') === 0 ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'watchdog', 'bypass-tunnel-reminder': '1' } }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(15000, () => { req.destroy(); resolve(false); });
  });
}

async function check() {
  if (!child) { log('watchdog: child missing, launching'); return launch(); }
  const url = readUrl();
  if (!url) return;
  const ok = await probe(url);
  if (ok) { if (fails) log('watchdog: probe OK again'); fails = 0; return; }
  fails++;
  log('watchdog: probe FAILED (' + fails + '/2) ' + url);
  if (fails >= 2) { fails = 0; softRestart('tunnel looks dead'); }
}

log('watchdog started');
launch();
setTimeout(check, 60000);
setInterval(check, 60000);
