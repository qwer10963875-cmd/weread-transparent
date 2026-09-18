/* 桥接层：把窗口控制能力安全地暴露给页面里的控制面板 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wxdsApp', {
  isElectron: true,
  /* 点击穿透：开启后鼠标直接穿到下层软件（面板/把手区域自动恢复可点） */
  clickThrough: (on) => ipcRenderer.send('wxds:clickthrough', on),
  /* 窗口置顶 */
  onTop: (on) => ipcRenderer.send('wxds:ontop', on),
  /* 调整窗口大小 / 移动窗口 */
  size: (w, h) => ipcRenderer.send('wxds:size', w, h),
  move: (dx, dy) => ipcRenderer.send('wxds:move', dx, dy),
  /* 读取窗口当前位置尺寸 */
  bounds: () => ipcRenderer.invoke('wxds:bounds'),
  /* 最小化 / 最大化 / 关闭 */
  win: (cmd) => ipcRenderer.send('wxds:win', cmd),
  /* 通知主进程当前透明状态（托盘菜单用） */
  notifyTransparent: (on) => ipcRenderer.send('wxds:transparent', on),
  /* 接收全局快捷键命令 */
  onCmd: (cb) => ipcRenderer.on('wxds:cmd', (e, c) => cb(c)),
});
