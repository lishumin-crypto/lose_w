/* ============================================================
 * 我的减脂计划 · 云端托管服务器
 *   静态站点：../site/（index / plan / tracker）
 *   存储：GET|POST  /a/<secret>/api/state
 *     优先级：码云 Gitee  >  GitHub  >  本机 state.json
 *     —— 云主机（Render 等）磁盘是临时的，必须用前两者才不丢数据
 *   启动：node server.js   （PORT 可覆盖）
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

/* ============ 存储后端 ============ */
// 码云 Gitee
const GT = {
  token: process.env.GT_TOKEN || '',
  repo: process.env.GT_REPO || 'llssmm/lose-w',
  file: process.env.GT_PATH || 'state.json',
  branch: process.env.GT_BRANCH || 'master',
};
// GitHub
const GH = {
  token: process.env.GH_TOKEN || '',
  repo: process.env.GH_REPO || '',
  file: process.env.GH_PATH || 'state.json',
  branch: process.env.GH_BRANCH || 'main',
};
const useGT = !!GT.token;
const useGH = !useGT && !!(GH.token && GH.repo);

function httpSend(opts, rawBody, ctype) {
  return new Promise((resolve, reject) => {
    const headers = Object.assign({ 'User-Agent': 'fitplan-app' }, opts.headers || {});
    if (rawBody != null) { headers['Content-Type'] = ctype || 'application/json'; headers['Content-Length'] = Buffer.byteLength(rawBody); }
    const req = https.request({ host: opts.host, port: 443, method: opts.method, path: opts.path, headers }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ code: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (rawBody != null) req.write(rawBody);
    req.end();
  });
}
const httpJson = (opts, payload) => httpSend(opts, payload ? JSON.stringify(payload) : null, 'application/json');
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s) => Buffer.from(String(s).replace(/\s/g, ''), 'base64').toString('utf8');

/* ---- 码云读写 ---- */
async function gtRead() {
  const p = '/api/v5/repos/' + GT.repo + '/contents/' + GT.file.split('/').map(encodeURIComponent).join('/') +
    '?access_token=' + encodeURIComponent(GT.token) + '&ref=' + encodeURIComponent(GT.branch);
  const r = await httpJson({ host: 'gitee.com', method: 'GET', path: p });
  if (r.code === 404) return { text: '{}', sha: null };
  if (r.code !== 200) throw new Error('码云读取失败 ' + r.code);
  const j = JSON.parse(r.body);
  return { text: unb64(j.content || ''), sha: j.sha };
}
async function gtWrite(text) {
  const cur = await gtRead();
  const enc = GT.file.split('/').map(encodeURIComponent).join('/');
  const basePath = '/api/v5/repos/' + GT.repo + '/contents/' + enc;
  const method = cur.sha ? 'PUT' : 'POST';
  const fields = { content: b64(text), message: 'update fitness state', branch: GT.branch };
  if (cur.sha) fields.sha = cur.sha;

  // 写法 1：JSON body + token 放 query
  let r = await httpSend(
    { host: 'gitee.com', method, path: basePath + '?access_token=' + encodeURIComponent(GT.token) },
    JSON.stringify(fields), 'application/json');
  if (r.code === 200 || r.code === 201) return;

  // 写法 2：表单格式（部分接口只认 x-www-form-urlencoded）
  const all = Object.assign({ access_token: GT.token }, fields);
  const form = Object.keys(all).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(all[k])).join('&');
  r = await httpSend({ host: 'gitee.com', method, path: basePath }, form, 'application/x-www-form-urlencoded');
  if (r.code === 200 || r.code === 201) return;

  throw new Error('码云写入失败 ' + r.code + ' ' + r.body.slice(0, 140));
}

/* ---- GitHub 读写 ---- */
async function ghRead() {
  const p = '/repos/' + GH.repo + '/contents/' + GH.file.split('/').map(encodeURIComponent).join('/') +
    '?ref=' + encodeURIComponent(GH.branch);
  const r = await httpJson({ host: 'api.github.com', method: 'GET', path: p, headers: { Authorization: 'Bearer ' + GH.token, Accept: 'application/vnd.github+json' } });
  if (r.code === 404) return { text: '{}', sha: null };
  if (r.code !== 200) throw new Error('GitHub 读取失败 ' + r.code);
  const j = JSON.parse(r.body);
  return { text: unb64(j.content || ''), sha: j.sha };
}
async function ghWrite(text) {
  const cur = await ghRead();
  const p = '/repos/' + GH.repo + '/contents/' + GH.file.split('/').map(encodeURIComponent).join('/');
  const payload = { message: 'update fitness state', content: b64(text), branch: GH.branch };
  if (cur.sha) payload.sha = cur.sha;
  const r = await httpJson({ host: 'api.github.com', method: 'PUT', path: p, headers: { Authorization: 'Bearer ' + GH.token, Accept: 'application/vnd.github+json' } }, payload);
  if (r.code !== 200 && r.code !== 201) throw new Error('GitHub 写入失败 ' + r.code);
}

/* ---- 统一入口 ---- */
const localRead = () => { try { return fs.readFileSync(DATA, 'utf8'); } catch (e) { return '{}'; } };
function localWrite(t) { const f = DATA + '.tmp'; fs.writeFileSync(f, t); fs.renameSync(f, DATA); }

async function storeRead() {
  if (useGT) return (await gtRead()).text;
  if (useGH) return (await ghRead()).text;
  return localRead();
}
async function storeWrite(text) {
  if (useGT) return gtWrite(text);
  if (useGH) return ghWrite(text);
  return localWrite(text);
}
function storageName() {
  if (useGT) return 'Gitee ' + GT.repo + '/' + GT.file;
  if (useGH) return 'GitHub ' + GH.repo + '/' + GH.file;
  return 'local state.json';
}

/* ============ HTTP ============ */
const FILES = {
  '': 'index.html', 'index': 'index.html', 'index.html': 'index.html',
  'plan': 'plan.html', 'plan.html': 'plan.html',
  'tracker': 'tracker.html', 'tracker.html': 'tracker.html',
};
function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url.indexOf(PREFIX) !== 0) return send(res, 404, 'Not found');
  const rest = url.slice(PREFIX.length);

  if (rest === 'api/state') {
    if (req.method === 'GET') {
      return storeRead()
        .then((t) => send(res, 200, t, 'application/json; charset=utf-8'))
        .catch((e) => send(res, 502, JSON.stringify({ error: e.message }), 'application/json'));
    }
    if (req.method === 'POST') {
      let body = '', tooBig = false;
      req.on('data', (c) => { body += c; if (body.length > 2e6) { tooBig = true; req.destroy(); } });
      req.on('end', () => {
        if (tooBig) return send(res, 413, '{"error":"too big"}', 'application/json');
        try { JSON.parse(body); } catch (e) { return send(res, 400, '{"error":"bad json"}', 'application/json'); }
        storeWrite(body)
          .then(() => send(res, 200, '{"ok":true}', 'application/json; charset=utf-8'))
          .catch((e) => send(res, 502, JSON.stringify({ error: e.message }), 'application/json'));
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
  console.log('storage: ' + storageName());
});
