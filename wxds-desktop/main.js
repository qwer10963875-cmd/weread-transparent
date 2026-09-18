/* ============================================================
 * 微信读书透明版 · 桌面端主进程
 * ------------------------------------------------------------
 * 把微信读书网页版装进一个真正的桌面窗口：
 *   - 无边框 + 原生透明窗口（底面真透明，露出桌面/下层软件）
 *   - 原生置顶（alwaysOnTop）
 *   - 真·点击穿透（setIgnoreMouseEvents，鼠标直接穿到下层软件）
 *   - 托盘、全局快捷键（窗口没聚焦也能用）
 *   - 登录状态与窗口位置记忆（便携版存应用目录；安装版存系统目录）
 * ============================================================ */
const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_DIR = __dirname;
const START_URL = process.env.WXDS_START_URL || 'https://weread.qq.com/';

/* 登录与窗口状态的存放位置：
 * - 开发 / 绿色便携版（应用目录可写且非 asar）→ 应用目录下 weread-profile（拷走文件夹设置都在）
 * - 安装版（asar 包或受保护目录不可写）→ 系统标准目录（%APPDATA%\微信读书透明版） */
(function resolveUserData() {
  try {
    if (APP_DIR.indexOf('.asar') !== -1) return;   // asar 只读，用默认 userData
    fs.accessSync(APP_DIR, fs.constants.W_OK);
    app.setPath('userData', path.join(APP_DIR, 'weread-profile'));
  } catch (e) { /* 目录不可写 → 用默认 userData */ }
})();
app.setAppUserModelId('cn.wxds.weread-transparent');

/* 伪装成普通 Edge，避免微信读书把环境当成奇怪的客户端 */
app.userAgentFallback =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';

const INJECT_JS = fs.readFileSync(path.join(APP_DIR, 'inject.js'), 'utf8');

let win = null;
let tray = null;

/* ---------- 窗口状态记忆 ---------- */
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { return null; }
}
let stTimer = null;
function saveStateSoon() {
  clearTimeout(stTimer);
  stTimer = setTimeout(() => {
    if (!win) return;
    try { fs.writeFileSync(stateFile(), JSON.stringify(win.getBounds())); } catch (e) {}
  }, 400);
}

/* ---------- 单实例：重复启动时唤起已有窗口 ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {

app.whenReady().then(() => {
  const st = loadState();
  const opts = {
    width: 1000, height: 700, minWidth: 340, minHeight: 260,
    frame: false,          // 无浏览器边框
    transparent: true,     // 原生透明窗口（核心）
    resizable: true,
    alwaysOnTop: true,     // 原生置顶
    skipTaskbar: false,    // 任务栏正常显示，像真正的应用
    backgroundColor: '#00000000',
    icon: path.join(APP_DIR, 'icon.png'),
    webPreferences: {
      preload: path.join(APP_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  };
  if (st && st.width) {
    /* 只在合法屏幕范围内恢复位置 */
    const wa = screen.getDisplayMatching(st).workArea;
    if (st.x >= wa.x - 40 && st.x < wa.x + wa.width && st.y >= wa.y - 40 && st.y < wa.y + wa.height) {
      Object.assign(opts, { width: st.width, height: st.height, x: st.x, y: st.y });
    }
  }
  win = new BrowserWindow(opts);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadURL(START_URL);

  /* 页面加载完注入控制面板（幂等，页面自己会防重复） */
  const injectOnce = () => {
    if (win) win.webContents.executeJavaScript(INJECT_JS, true).catch(() => {});
  };
  win.webContents.on('did-finish-load', injectOnce);

  win.on('resize', saveStateSoon);
  win.on('move', saveStateSoon);
  win.on('closed', () => { win = null; });

  /* ---------- IPC：页面 ↔ 主进程 ---------- */
  ipcMain.handle('wxds:bounds', () => (win ? win.getBounds() : null));
  ipcMain.on('wxds:clickthrough', (e, on) => {
    if (win) win.setIgnoreMouseEvents(!!on, { forward: true });  // forward 保留悬停探测
  });
  ipcMain.on('wxds:ontop', (e, on) => {
    if (win) win.setAlwaysOnTop(!!on, 'screen-saver');
  });
  ipcMain.on('wxds:size', (e, w, h) => {
    if (!win) return;
    const b = win.getBounds();
    win.setBounds({ x: b.x, y: b.y, width: Math.max(340, Math.round(w)), height: Math.max(260, Math.round(h)) });
  });
  ipcMain.on('wxds:move', (e, dx, dy) => {
    if (!win) return;
    const b = win.getBounds();
    win.setBounds({ x: b.x + Math.round(dx), y: b.y + Math.round(dy), width: b.width, height: b.height });
  });
  ipcMain.on('wxds:win', (e, cmd) => {
    if (!win) return;
    if (cmd === 'min') win.minimize();
    else if (cmd === 'max') (win.isMaximized() ? win.unmaximize() : win.maximize());
    else if (cmd === 'close') app.quit();
  });

  /* ---------- 全局快捷键（窗口未聚焦也生效） ---------- */
  const reg = (accel, cmd) => {
    try { globalShortcut.register(accel, () => { if (win) win.webContents.send('wxds:cmd', cmd); }); } catch (e) {}
  };
  reg('Alt+Shift+T', 'toggle-transparent');
  reg('Alt+Shift+H', 'toggle-panel');
  reg('Alt+Shift+C', 'toggle-clickthrough');
  reg('Alt+Shift+Q', 'quit');

  /* ---------- 托盘 ---------- */
  try {
    tray = new Tray(path.join(APP_DIR, 'icon.png'));
    tray.setToolTip('微信读书透明版');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示 / 隐藏窗口', click: () => {
          if (!win) return;
          if (win.isVisible() && win.isFocused()) win.hide();
          else { win.show(); win.focus(); }
        } },
      { type: 'separator' },
      { label: '切换透明模式（Alt+Shift+T）', click: () => win && win.webContents.send('wxds:cmd', 'toggle-transparent') },
      { label: '切换点击穿透（Alt+Shift+C）', click: () => win && win.webContents.send('wxds:cmd', 'toggle-clickthrough') },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]));
  } catch (e) { /* 托盘失败不影响使用 */ }
});

app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());

} /* end single-instance */
