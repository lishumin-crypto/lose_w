/* ============================================================
 * 我的减脂计划 · 云端托管服务器
 *   静态站点：../site/（index / plan / tracker）
 *   存储：GET|POST  /a/<secret>/api/state
 *     - 默认写入本机 state.json
 *     - 若设置了 GH_TOKEN + GH_REPO，则改为读写你的 GitHub 仓库文件
 *       （Render 免费版磁盘是临时的，必须用这个才能不丢数据）
 *   启动：node server.js   （PORT 可用环境变量覆盖）
 * ============================================================ */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', 'site') + path.sep;
const DATA = path.join(__dirname, 'state.json');
const SECFILE = path.join(__dirname, 'secret.txt');

let SECRET = process.env.APP_SECRET || '';
if (!SECRET) {
  if (fs.existsSync(SECFILE)) SECRET = fs.readFileSync(SECFILE, 'utf8').trim();
  else { SECRET = crypto.randomBytes(6).toString('hex'); try { fs.writeFileSync(SECFILE, SECRET); } catch (e) {} }
}
const PREFIX = '/a/' + SECRET + '/';

/* ---------- 可选：GitHub 仓库存储 ---------- */
const GH = {
  token: process.env.GH_TOKEN || '',
  repo: process.env.GH_REPO || '',
  file: process.env.GH_PATH || 'state.json',
  branch: process.env.GH_BRANCH || 'main',
};
const useGH = !!(GH.token && GH.repo);

function gh(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'User-Agent': 'fitplan-app',
      Authorization: 'Bearer ' + GH.token,
      Accept: 'application/vnd.github+json',
    };
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    const req = https.request({ host: 'api.github.com', port: 443, method, path: urlPath, headers }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ code: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}
const ghPath = () => '/repos/' + GH.repo + '/contents/' + GH.file.split('/').map(encodeURIComponent).join('/');
async function ghRead() {
  const r = await gh(GET_M, ghPath() + '?ref=' + encodeURIComponent(GH.branch));
  if (r.code === 404) return { text: '{}', sha: null };
  if (r.code !== 200) throw new Error('GitHub 读取失败 ' + r.code);
  const j = JSON.parse(r.body);
  return { text: Buffer.from(j.content.replace(/\n/g, ''), 'base64').toString('utf8'), sha: j.sha };
}
async function ghWrite(text) {
  const cur = await ghRead();
  const body = { message: 'update fitness state', content: Buffer.from(text, 'utf8').toString('base64'), branch: GH.branch };
  if (cur.sha) body.sha = cur.sha;
  const r = await gh(PUT_M, ghPath(), body);
  if (r.code !== 200 && r.code !== 201) throw new Error('GitHub 写入失败 ' + r.code);
}
const GET_M = 'GET', PUT_M = 'PUT';

/* ---------- 通用 ---------- */
const FILES = {
  '': 'index.html', 'index': 'index.html', 'index.html': 'index.html',
  'plan': 'plan.html', 'plan.html': 'plan.html',
  'tracker': 'tracker.html', 'tracker.html': 'tracker.html',
};
function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}
function atomicWrite(file, txt) { const t = file + '.tmp'; fs.writeFileSync(t, txt); fs.renameSync(t, file); }
function localRead() { try { return fs.readFileSync(DATA, 'utf8'); } catch (e) { return '{}'; } }
function localWrite(txt) { atomicWrite(DATA, txt); }

http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url.indexOf(PREFIX) !== 0) return send(res, 404, 'Not found');
  const rest = url.slice(PREFIX.length);

  if (rest === 'api/state') {
    if (req.method === 'GET') {
      if (useGH) {
        return ghRead().then((r) => send(res, 200, r.text, 'application/json; charset=utf-8'))
          .catch((e) => send(res, 502, JSON.stringify({ error: e.message }), 'application/json'));
      }
      return send(res, 200, localRead(), 'application/json; charset=utf-8');
    }
    if (req.method === 'POST') {
      let body = '', tooBig = false;
      req.on('data', (c) => { body += c; if (body.length > 2e6) { tooBig = true; req.destroy(); } });
      req.on('end', () => {
        if (tooBig) return send(res, 413, '{"error":"too big"}', 'application/json');
        try { JSON.parse(body); } catch (e) { return send(res, 400, '{"error":"bad json"}', 'application/json'); }
        if (useGH) {
          return ghWrite(body)
            .then(() => send(res, 200, '{"ok":true}', 'application/json; charset=utf-8'))
            .catch((e) => send(res, 502, JSON.stringify({ error: e.message }), 'application/json'));
        }
        try { localWrite(body); } catch (e) { return send(res, 500, '{"error":"write failed"}', 'application/json'); }
        send(res, 200, '{"ok":true}', 'application/json; charset=utf-8');
      });
      return;
    }
    return send(res, 405, 'Method not allowed');
  }

  const fname = FILES[rest];
  if (!fname) return send(res, 404, 'Not found');
  try { send(res, 200, fs.readFileSync(ROOT + fname, 'utf8'), 'text/html; charset=utf-8'); }
  catch (e) { send(res, 500, 'file error: ' + e.message); }
}).listen(parseInt(process.env.PORT || '8080', 10), () => {
  console.log('server on :' + (process.env.PORT || 8080) + '  path ' + PREFIX);
  console.log('storage: ' + (useGH ? ('GitHub ' + GH.repo + '/' + GH.file) : 'local state.json'));
});
