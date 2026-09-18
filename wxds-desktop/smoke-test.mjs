/* ============================================================
 * 打包版 exe 冒烟测试
 * ------------------------------------------------------------
 * 1. 起本地静态服务器（根目录 = ../weread-app，提供 demo.html）
 * 2. 用 WXDS_START_URL 指向 demo 启动打包后的 exe（自动清掉
 *    ELECTRON_RUN_AS_NODE，否则 WorkBuddy 终端里 exe 会退化成纯 Node）
 * 3. 通过 CDP（--remote-debugging-port + 手写极简 WebSocket 客户端）
 *    对页面做一组断言，最后截一张图
 * 用法： node smoke-test.mjs
 * ============================================================ */
import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMO_ROOT = path.join(HERE, '..', 'weread-app');
const EXE = process.argv[2] || path.join(HERE, 'dist', '微信读书透明版-win32-x64', '微信读书透明版.exe');
const PORT = 8899, CDP_PORT = 9333;
const SHOT = path.join(HERE, '..', '桌面版效果预览.png');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(EXE)) { console.error('找不到 exe：' + EXE); process.exit(1); }

/* ---------- 1. 静态服务器 ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/demo.html';
  fs.readFile(path.join(DEMO_ROOT, p), (e, buf) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

/* ---------- 2. 启动 exe ---------- */
const env = { ...process.env, WXDS_START_URL: `http://127.0.0.1:${PORT}/demo.html` };
delete env.ELECTRON_RUN_AS_NODE; // 关键：变量存在即生效，必须删除而不是置空
const proc = spawn(EXE, [`--remote-debugging-port=${CDP_PORT}`], { env, cwd: path.dirname(EXE) });
let appLog = '';
proc.stdout.on('data', (d) => { appLog += d; });
proc.stderr.on('data', (d) => { appLog += d; });
proc.on('error', (e) => { appLog += '\nSPAWN-ERR: ' + e.message; });

function killApp() {
  try { execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' }); } catch (e) {}
}

/* ---------- 3. 极简 WebSocket 客户端（CDP 只需要文本帧） ---------- */
class WS {
  constructor(url) {
    const u = new URL(url);
    this.host = u.hostname; this.port = +u.port; this.path = u.pathname + u.search;
    this.buf = Buffer.alloc(0); this.handlers = []; this.open = false; this.frag = '';
  }
  connect() {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      this.sock = net.connect(this.port, this.host, () => {
        this.sock.write(`GET ${this.path} HTTP/1.1\r\nHost: ${this.host}:${this.port}\r\n` +
          'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
          `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
      });
      this.sock.on('error', reject);
      this.sock.on('data', (d) => this._onData(d, resolve));
    });
  }
  _onData(d, resolve) {
    this.buf = Buffer.concat([this.buf, d]);
    if (!this.open) {
      const idx = this.buf.indexOf('\r\n\r\n');
      if (idx === -1) return;
      if (!/^HTTP\/1\.1 101/.test(this.buf.slice(0, idx).toString())) throw new Error('WS 握手失败');
      this.open = true;
      this.buf = this.buf.slice(idx + 4);
      resolve();
    }
    for (;;) {
      const msg = this._readFrame();
      if (msg === null) break;
      if (msg) for (const h of this.handlers) h(msg);
    }
  }
  _readFrame() { // 返回文本消息；null=数据不足；''=控制帧/中间帧
    const b = this.buf;
    if (b.length < 2) return null;
    const fin = b[0] & 0x80, op = b[0] & 0x0f;
    const masked = b[1] & 0x80;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return null; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return null; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (masked) { if (b.length < off + 4) return null; off += 4; } // 服务端一般不 mask
    if (b.length < off + len) return null;
    let payload = b.slice(off, off + len);
    if (masked) { const m = b.slice(off - 4, off); payload = Buffer.from(payload.map((v, i) => v ^ m[i % 4])); }
    this.buf = b.slice(off + len);
    if (op === 1 || op === 0) { this.frag += payload.toString('utf8'); if (fin) { const t = this.frag; this.frag = ''; return t; } return ''; }
    if (op === 9) this._sendRaw(0x8A, payload); // ping -> pong
    if (op === 8) { try { this.sock.end(); } catch (e) {} }
    return '';
  }
  send(str) { this._sendRaw(0x81, Buffer.from(str, 'utf8')); }
  _sendRaw(opcode, payload) { // 客户端帧必须 mask
    const len = payload.length;
    let header;
    if (len < 126) header = Buffer.from([opcode | 0x80, 0x80 | len]);
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = opcode | 0x80; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = opcode | 0x80; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
    const mask = crypto.randomBytes(4);
    const masked = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
    this.sock.write(Buffer.concat([header, mask, masked]));
  }
}

/* ---------- 4. CDP 会话 ---------- */
async function getTarget() {
  const getJson = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
  for (let i = 0; i < 90; i++) {
    try {
      const list = await getJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const page = list.find((t) => t.type === 'page' && t.url.includes(`127.0.0.1:${PORT}`));
      if (page) return page;
    } catch (e) {}
    await sleep(1000);
  }
  let hint = '';
  if (appLog.includes('DevTools listening')) {
    hint = '（日志里有 DevTools listening 但端口无应答 → exe 启动后立即退出了，' +
      '多半是残留实例占着单实例锁：ps -W | grep 透明，taskkill /F /PID <pid> 后再试）';
  }
  throw new Error('CDP target 未出现（exe 可能没起来）。' + hint + ' 应用日志: ' + (appLog || '(空)'));
}

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  [' + extra + ']' : ''}`);
}

let exitCode = 0;
try {
  console.log('等待应用窗口…');
  const target = await getTarget();
  const ws = new WS(target.webSocketDebuggerUrl);
  await ws.connect();

  let seq = 0; const pending = new Map(); let exceptions = 0;
  ws.handlers.push((t) => {
    try {
      const m = JSON.parse(t);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      else if (m.method === 'Runtime.exceptionThrown') { exceptions++; console.log('  [页面异常]', JSON.stringify(m.params).slice(0, 160)); }
    } catch (e) {}
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('CDP 超时: ' + method)); } }, 15000);
  });
  const ev = async (expression) => {
    const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.error) throw new Error('CDP 错误: ' + (r.error.message || JSON.stringify(r.error)));
    const p = r.result || {}; // 信封结构：{ id, result: { result: {type,value}, exceptionDetails? } }
    if (p.exceptionDetails) throw new Error('页面内执行失败: ' + expression.slice(0, 80));
    return p.result && p.result.value;
  };
  await cdp('Runtime.enable');

  /* 等面板注入（真实站点可能数秒，轮询而非固定等待） */
  let panel = false;
  for (let i = 0; i < 40 && !panel; i++) {
    try { panel = await ev("!!document.querySelector('#wxds-root')"); } catch (e) {}
    if (!panel) await sleep(500);
  }

  check('wxdsApp 桥接（Electron 环境）', await ev("typeof wxdsApp==='object' && !!wxdsApp.isElectron"));
  check('桌面模式标记', await ev("!!window.__wxds && window.__wxds.isDesktop===true"));
  check('控制面板注入', panel);
  check('拖动条 + 缩放手柄', await ev("!!document.querySelector('#wxds-dragbar') && !!document.querySelector('#wxds-grip')"));
  /* 透明模式默认关闭（与产品一致，需用户开启），通过测试 API 开启后验证 */
  await ev("window.__wxds && __wxds.toggle && __wxds.toggle(); new Promise((r)=>setTimeout(r,400))");
  check('透明模式可开启（html.wxds-on）', await ev("document.documentElement.classList.contains('wxds-on')"));
  const bg = await ev('getComputedStyle(document.body).backgroundColor');
  check('body 背景透明', bg === 'rgba(0, 0, 0, 0)', bg);
  const gray = await ev("(()=>{const el=document.querySelector('.readerChapterContent p');return el?getComputedStyle(el).color:'no-p'})()");
  check('灰色字体 #808080', gray === 'rgb(128, 128, 128)', gray);

  /* 面板隐藏后必须留有唤回入口（半透明小圆钮） */
  await ev("__wxds.set('panel', false); new Promise((r)=>setTimeout(r,250))");
  check('隐藏后面板本体不可见', await ev("(()=>{const p=document.querySelector('#wxds-root').shadowRoot.querySelector('.wx-panel');return getComputedStyle(p).display==='none'})()"));
  check('宿主保留（未整体 display:none）', await ev("(()=>{const h=document.querySelector('#wxds-root');return getComputedStyle(h).display!=='none'})()"));
  check('唤回小圆钮可见', await ev("(()=>{const f=document.querySelector('#wxds-root').shadowRoot.querySelector('.fab');return getComputedStyle(f).display!=='none'})()"));
  await ev("document.querySelector('#wxds-root').shadowRoot.querySelector('.fab').click(); new Promise((r)=>setTimeout(r,250))");
  check('点小圆钮后面板恢复', await ev("(()=>{const p=document.querySelector('#wxds-root').shadowRoot.querySelector('.wx-panel');return getComputedStyle(p).display!=='none'})()"));

  const b1 = await ev('wxdsApp.bounds().then((b)=>JSON.stringify([b.width,b.height]))');
  check('窗口初始尺寸 1000x700', b1 === '[1000,700]', String(b1));
  await ev('wxdsApp.size(800,560); new Promise((r)=>setTimeout(r,500))');
  const b2 = await ev('wxdsApp.bounds().then((b)=>JSON.stringify([b.width,b.height]))');
  check('IPC 调整窗口为 800x560', b2 === '[800,560]', String(b2));
  await ev('wxdsApp.size(1000,700)');
  check('页面零异常', exceptions === 0, 'exceptions=' + exceptions);

  /* 截图留档（透明窗口 → PNG 带 alpha） */
  try {
    const shot = await cdp('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(SHOT, Buffer.from(shot.result.data, 'base64'));
    console.log('截图已保存: ' + SHOT);
  } catch (e) { console.log('截图失败（不影响判定）: ' + e.message); }

  try { ws.sock.end(); } catch (e) {}
} catch (e) {
  console.error('冒烟测试出错: ' + e.message);
  exitCode = 1;
}

killApp();
server.close();
/* 清掉测试期间写入应用目录的运行数据，保证交付的包是干净的 */
try { fs.rmSync(path.join(HERE, 'dist', '微信读书透明版-win32-x64', 'resources', 'app', 'weread-profile'), { recursive: true, force: true }); } catch (e) {}

const fail = results.filter((r) => !r.ok);
if (fail.length || exitCode) { console.log(`\n结果: ${fail.length}/${results.length} 项失败`); process.exit(1); }
console.log(`\n结果: 全部 ${results.length} 项通过`);
process.exit(0);
