/* 一键启动：本地服务器 + 公网隧道（SSH 反向隧道，走 localhost.run）
 *   node start.js
 * - 比 localtunnel/loca.lt 稳，且没有「隧道密码页」
 * - 公网网址会写入 url.txt；每次重连会换一个新网址（免费版不支持固定域名）
 * - 支持 watchdog 通过 IPC 通知优雅重启
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
process.chdir(__dirname);
require('./server.js');                 // 启动 8080 服务器（同进程）

const secret = fs.readFileSync(path.join(__dirname, 'secret.txt'), 'utf8').trim();
const KNOWN = path.join(__dirname, 'known_hosts');

const SSH_CANDIDATES = [
  process.env.SSH_EXE,
  'D:\\Program Files\\Git\\usr\\bin\\ssh.exe',
  'C:\\Program Files\\Git\\usr\\bin\\ssh.exe',
  'C:\\Windows\\System32\\OpenSSH\\ssh.exe',
  'ssh',
].filter(Boolean);

function findSsh() {
  for (const p of SSH_CANDIDATES) {
    if (p === 'ssh') return p;
    try { if (fs.existsSync(p)) return p; } catch (e) {}
  }
  return 'ssh';
}

let child = null, current = null;

function report(url) {
  const link = url + '/a/' + secret + '/';
  fs.writeFileSync(path.join(__dirname, 'url.txt'), link);
  console.log('\n============================================');
  console.log(' 公网链接（手机/电脑都能打开）：');
  console.log(' ' + link);
  console.log('============================================\n');
}

function launch() {
  const ssh = findSsh();
  console.log('ssh = ' + ssh);
  const args = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=' + KNOWN,
    '-o', 'ServerAliveInterval=20',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ExitOnForwardFailure=yes',
    '-R', '80:localhost:8080',
    'nokey@localhost.run',
  ];
  child = spawn(ssh, args, { cwd: __dirname });
  const handle = (buf) => {
    const s = buf.toString();
    process.stdout.write(s);
    // localhost.run 可能在同一连接里更换网址，取最新出现的那个并及时更新 url.txt
    const all = s.match(/https:\/\/[A-Za-z0-9._-]+\.lhr\.life/g);
    if (all && all.length) {
      const latest = all[all.length - 1];
      if (latest !== current) { current = latest; report(current); }
    }
  };
  child.stdout.on('data', handle);
  child.stderr.on('data', handle);
  child.on('exit', (code) => { console.log('ssh exited with code ' + code); child = null; });
}

process.on('message', (m) => {
  if (m && m.cmd === 'stop') {
    console.log('收到重启指令，关闭隧道…');
    try { if (child) child.kill(); } catch (e) {}
    setTimeout(() => process.exit(0), 800);
  }
});

launch();
