/* 一键启动：本地服务器 + 公网隧道（需先 npm i localtunnel）
 *   node start.js
 * 特性：优先申请固定子域名；若暂时被占用，会等待并重试（最多约 2 分钟），
 *       实在拿不到才退回随机域名。最终链接写入 url.txt 并打印。
 */
const fs = require('fs');
const path = require('path');
process.chdir(__dirname);
require('./server.js');                 // 启动 8080 服务器（同进程）

let lt;
try { lt = require('localtunnel'); }
catch (e) { console.log('\n[!] 缺少 localtunnel，请先运行：npm i localtunnel'); process.exit(1); }

const secret = fs.readFileSync(path.join(__dirname, 'secret.txt'), 'utf8').trim();
const SUB = (process.env.SUB || 'jfplan-9x7q2e').toLowerCase();
const RETRY_WAIT = 20000, MAX_TRY = 6;

function report(url, fixed) {
  const link = url + '/a/' + secret + '/';
  fs.writeFileSync(path.join(__dirname, 'url.txt'), link);
  console.log('\n============================================');
  console.log(' 公网链接（' + (fixed ? '固定子域名' : '随机域名') + '，手机/电脑都能打开）：');
  console.log(' ' + link);
  console.log('============================================\n');
}
function attach(tunnel) {
  tunnel.on('close', () => console.log('隧道已关闭'));
  tunnel.on('error', (e) => console.log('隧道错误（会自动重连）：' + e.message));
}

function attempt(n) {
  lt({ port: 8080, local_host: '127.0.0.1', subdomain: SUB }, (err, tunnel) => {
    if (err) {
      console.log('子域名 ' + SUB + ' 无法使用（' + err.message + '），改用随机域名');
      lt({ port: 8080, local_host: '127.0.0.1' }, (e2, t2) => {
        if (e2) { console.log('隧道创建失败：' + e2.message); process.exit(1); }
        report(t2.url, false); attach(t2);
      });
      return;
    }
    const ok = tunnel.url.indexOf(SUB) !== -1;
    if (!ok && n < MAX_TRY) {
      console.log('子域名 ' + SUB + ' 暂被占用，' + (RETRY_WAIT / 1000) + 's 后重试（' + n + '/' + MAX_TRY + '）…');
      try { tunnel.close(); } catch (e) {}
      setTimeout(() => attempt(n + 1), RETRY_WAIT);
      return;
    }
    report(tunnel.url, ok); attach(tunnel);
  });
}
attempt(1);
