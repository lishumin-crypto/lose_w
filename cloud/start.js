/* 一键启动：本地服务器 + 公网隧道（需先 npm i localtunnel）
 *   node start.js
 * - 优先申请固定子域名；被占用则等待重试，拿不到才退回随机域名
 * - 支持父进程（watchdog）通过 IPC 通知「优雅关闭」：先关隧道再退出，
 *   这样 loca.lt 会立刻释放子域名，重启后能拿回同一个网址。
 */
const fs = require('fs');
const path = require('path');
process.chdir(__dirname);
require('./server.js');                 // 启动 8080 服务器（同进程）

let lt;
try { lt = require('localtunnel'); }
catch (e) { console.log('\n[!] 缺少 localtunnel，请先运行：npm i localtunnel'); process.exit(1); }

const secret = fs.readFileSync(path.join(__dirname, 'secret.txt'), 'utf8').trim();
const SUB = (process.env.SUB || 'jfplan-2026a').toLowerCase();
const RETRY_WAIT = 15000, MAX_TRY = 6;
let current = null;

function report(url, fixed) {
  const link = url + '/a/' + secret + '/';
  fs.writeFileSync(path.join(__dirname, 'url.txt'), link);
  console.log('\n============================================');
  console.log(' 公网链接（' + (fixed ? '固定子域名' : '随机域名') + '，手机/电脑都能打开）：');
  console.log(' ' + link);
  console.log('============================================\n');
}
function attach(t) {
  current = t;
  t.on('close', () => console.log('隧道已关闭'));
  t.on('error', (e) => console.log('隧道错误（会自动重连）：' + e.message));
}

function attempt(n) {
  lt({ port: 8080, local_host: '127.0.0.1', subdomain: SUB }, (err, tunnel) => {
    if (err) {
      console.log('子域名 ' + SUB + ' 无法使用（' + err.message + '），改用随机域名');
      return lt({ port: 8080, local_host: '127.0.0.1' }, (e2, t2) => {
        if (e2) { console.log('隧道创建失败：' + e2.message); process.exit(1); }
        report(t2.url, false); attach(t2);
      });
    }
    const ok = tunnel.url.indexOf(SUB) !== -1;
    if (!ok && n < MAX_TRY) {
      console.log('子域名 ' + SUB + ' 暂被占用，' + (RETRY_WAIT / 1000) + 's 后重试（' + n + '/' + MAX_TRY + '）…');
      try { tunnel.close(); } catch (e) {}
      return setTimeout(() => attempt(n + 1), RETRY_WAIT);
    }
    report(tunnel.url, ok); attach(tunnel);
  });
}

/* 优雅关闭：父进程要求重启时，先关隧道再退出 */
process.on('message', (m) => {
  if (m && m.cmd === 'stop') {
    console.log('收到重启指令，正在关闭隧道…');
    try { if (current) current.close(); } catch (e) {}
    setTimeout(() => process.exit(0), 1000);
  }
});

attempt(1);
