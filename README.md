# 微信读书 · 透明阅读工具箱

三套方案，按需取用：

- **方案 C（推荐）· 独立桌面版** —— 真正的独立桌面应用：双击即用、内置完整微信读书、可扫码登录、原生透明窗口 + 原生置顶 + 真·点击穿透。见 `wxds-desktop/`
- **方案 B · 微信读书网页版透明化改造** —— 用 Edge 加载 weread.qq.com 并注入透明样式，绿色免安装。见 `weread-app/`
- **方案 A · 独立透明阅读层** —— 把微信读书的文字提取出来贴到一个纯透明层上。见根目录 `reader.html`

---

## 方案 C：独立桌面版（`wxds-desktop/`）

**这是真正意义上的"独立工具"**：不依赖浏览器、不装扩展，一个 exe 就是一个完整的微信读书——书架、搜索、笔记、翻页全部都在，扫码登录，窗口底面原生透明。

| 文件 | 作用 |
|---|---|
| GitHub [Releases](https://github.com/qwer10963875-cmd/weread-transparent/releases) | **安装包在线下载页**（`WeRead-Transparent-Setup-1.0.0.exe`，约 76MB） |
| `wxds-desktop/installer2/微信读书透明版/微信读书透明版 Setup 1.0.0.exe` | 本地安装包文件（直接发给别人的就是这个） |
| `wxds-desktop/dist/微信读书透明版-win32-x64/微信读书透明版.exe` | 便携版主程序（双击即用，整个文件夹可拷走便携运行） |
| `桌面版效果预览.png` | 实测截图（灰字浮于下层界面上） |
| `wxds-desktop/main.js` `preload.js` `inject.js` | 源码（Electron 主进程 / 桥接 / 页面注入） |
| `wxds-desktop/smoke-test.mjs` | 打包后自检脚本（`node smoke-test.mjs [exe路径]`，14 项断言） |

### 分发给别人：安装包

- **在线（推荐）**：让对方打开仓库 [Releases 页](https://github.com/qwer10963875-cmd/weread-transparent/releases)，下载 `WeRead-Transparent-Setup-1.0.0.exe`（约 76MB）
- **离线**：把 **`wxds-desktop/installer2/微信读书透明版/微信读书透明版 Setup 1.0.0.exe`**（约 76MB，单文件）直接发给对方即可，无需其它任何文件

- **安装体验**：双击 → 可选安装目录（默认 `%LOCALAPPDATA%\Programs\weread-transparent-desktop`）→ 自动创建桌面和开始菜单快捷方式，**不需要管理员权限**
- **首次运行可能弹 SmartScreen**「Windows 已保护你的电脑」——这是因为安装包没有购买代码签名证书，点 **「更多信息」→「仍要运行」** 即可，属正常现象
- **登录状态**：安装版保存在系统目录 `%APPDATA%\微信读书透明版`（便携版保存在应用目录 `weread-profile/`），扫码一次后续免登录
- **卸载**：Windows 设置 → 应用 → 已安装的应用 里找到「微信读书透明版」卸载即可

### 使用

1. 双击 `wxds-desktop/dist/微信读书透明版-win32-x64/微信读书透明版.exe`
2. 首次打开是微信读书官网 → 手机扫码登录（登录状态保存在应用目录 `resources/app/weread-profile/`，下次免扫码）
3. 打开一本书进入阅读页 → 点面板 **「开启透明模式」**（或按 `Alt+Shift+T`）
4. 书页背景、顶栏、工具栏全部消失，只剩灰色文字浮在桌面/其它软件上

### 功能

- **原生透明窗口**：无边框 + 底面真透明（OS 级，不是浏览器 hack）
- **原生置顶**：始终浮在所有窗口之上，面板里可关
- **真·点击穿透**：`Alt+Shift+C` 开启后鼠标直接点穿到下层软件；悬停到面板/拖动条时自动恢复可点
- **全局快捷键**（窗口没聚焦也能用）：`Alt+Shift+T` 透明、`Alt+Shift+C` 穿透、`Alt+Shift+H` 面板、`Alt+Shift+Q` 退出
- **窗口操作**：顶部细条拖动移动，右下角手柄缩放，面板可最小化/最大化/退出，位置尺寸自动记忆
- **阅读调节**：字号 / 行距 / 阅读区宽度滑块、8 档灰色字体、隐藏原界面、白色柔光描边
- **翻页**：`→` / `空格` / 滚轮 / 点击页面左右区域
- **面板不迷路**：关闭面板后，右上角会留一个半透明小圆钮，点一下即可唤回（也可用 `Alt+Shift+H`）
- **托盘菜单**：显示/隐藏、透明开关、穿透开关、退出

### 技术说明

- Electron 33：`transparent:true` + `alwaysOnTop:'screen-saver'` + `setIgnoreMouseEvents({forward:true})`
- 页面注入与方案 B 同一份 `inject.js`；桌面能力（移动窗口、置顶、穿透等）由 preload 的 `contextBridge` 暴露为 `wxdsApp`
- 已实测：真实 weread.qq.com 登录注入翻页正常；便携版与**安装版**冒烟测试均 14/14 通过

### 从源码重新打包（可选）

```bash
cd wxds-desktop
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"   # 国内网络加速
npm install
node node_modules/electron-packager/bin/electron-packager.js . 微信读书透明版 \
  --platform=win32 --arch=x64 --out=dist --overwrite \
  --icon=icon.ico --prune=true --ignore=weread-profile --ignore=dist/
```

> 注意：在 WorkBuddy 等 Electron 系终端里命令行启动 exe 时，需先删除环境变量 `ELECTRON_RUN_AS_NODE`（资源管理器双击不受影响）。
> `wxds-desktop/node_modules`（约 260MB）仅开发/打包用，确认 exe 没问题后可整个删除，不影响 dist 里的成品运行。
> `wxds-desktop/release/` 与 `wxds-desktop/installer/` 是构建安装包时的**旧版残留**（约 800MB，其中的 Setup 是旧版本，不要分发）；因系统文件锁暂时删不掉，重启电脑后手动删除即可。

### 重新构建安装包（可选）

```bash
cd wxds-desktop
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npx electron-builder --win --x64      # 配置在 electron-builder.yml，产物输出到 installer2/
```

> 若构建报 `EBUSY: resource busy or locked`（旧 app.asar 被系统占用）：把 `electron-builder.yml` 里 `directories.output` 改成一个新目录名再构建即可。

---

## 方案 B：微信读书网页版 · 透明化改造（`weread-app/`）

**这是真正的"微信读书改造版"**：工具窗口里打开的就是微信读书网页版本体，扫码登录、书架、翻页、笔记全都正常，只是页面被注入的扩展改造成了透明样式。

| 文件 | 作用 |
|---|---|
| `weread-app/启动微信读书透明版.bat` | 一键启动（Edge 优先） |
| `weread-app/extension/` | 透明层扩展（MV3） |
| `weread-app/demo.html` | 演示页，双击即可体验面板全部功能 |
| `weread-app/效果预览.png` | 实测截图 |

### 使用

1. 双击 `weread-app/启动微信读书透明版.bat`
2. 首次会打开微信读书官网 → 手机扫码登录（登录状态会保存在工具自己的目录里，下次免扫码）
3. 打开任意一本书进入阅读 → 点面板上的 **「开启透明模式」**（或按 `Alt+T`）
4. 书页背景、顶栏、工具栏、页脚全部消失，只剩灰色文字浮在桌面上
5. 窗口随意拖动、边缘缩放；用 `→` / `空格` / `滚轮` 翻页

### 面板功能

- **透明模式**：背景全透明 + 灰色文字（`Alt+T` 切换，随时恢复原样）
- **字号 14–40px**（`Alt+±` 微调）、**行距**、**阅读区宽度 40–96%**
- **字体颜色**：8 档灰 + 自定义任意色
- **隐藏顶栏/工具栏/页脚**：透明时自动隐藏，微信读书界面不露馅
- **防误触**：透明时锁定鼠标，点击不会误触书页（`Alt+P`）
- **白色柔光描边**：浅色背景下文字依然清晰
- **面板唤回**：关闭面板后右上角留有半透明小圆钮，点一下唤回（`Alt+H`）
- 所有设置自动保存

### 技术说明

- 启动器用 Edge 的 app 模式 + `--force-transparent-background` 实现真窗口透明，`--load-extension` 注入扩展
- **Chrome 137+ 已禁用命令行加载扩展**（实测本机 Chrome 已被阻止），所以启动器强制优先 Edge——Windows 自带 Edge，无需额外安装
- 扩展只匹配 `weread.qq.com`，不影响其它网站
- 面板用 Shadow DOM 实现，与微信读书页面样式完全隔离

### 已知限制

- 浏览器窗口仍会挡住其覆盖区域的鼠标操作（这是 OS 层限制）——用键盘翻页基本不需要鼠标；需要鼠标操作下层软件时，把阅读窗口移开或最小化
- 微信读书改版后若选择器变化，`extension/content.js` 顶部的 CSS 选择器需对应更新
- 窗口置顶请配合 PowerToys（`Win+Ctrl+T`）

---

## 方案 A：独立透明阅读层（根目录）

把微信读书的正文**提取出来**贴到一个纯透明层上，与微信读书本身解耦。

| 文件 | 作用 |
|---|---|
| `reader.html` | 透明阅读层主体（双击即用） |
| `启动阅读层.bat` | 一键以"独立应用窗口"启动（推荐） |
| `tools/extract-weread.js` | 微信读书整章正文提取脚本（在网页控制台运行） |

## 快速开始

### 方式一：复制粘贴（最简单）

1. 双击 `启动阅读层.bat`（或直接双击 `reader.html`）
2. 打开 [微信读书网页版](https://weread.qq.com)，进入想看的书，选中正文复制
3. 回到阅读层：`Ctrl+V` 粘贴到页面任意位置（或粘贴到面板文本框后点「应用文本」）
4. 点一下面板外的空白处 → 自动穿透，继续干你的活
5. 用键盘 `→` / `←`（或空格、滚轮）翻页

### 方式二：整章提取（长文推荐）

1. 微信读书网页版进入某一章
2. 按 `F12` 打开控制台（若提示不能粘贴，先按提示输入 `allow pasting` 回车）
3. 把 `tools/extract-weread.js` 全文粘进去回车
4. 脚本自动滚动加载整章，正文复制到剪贴板
5. 回到阅读层点「读取剪贴板」即可，自动分段整理

> 换章节后重新运行一次脚本即可。

## 调整

面板里可实时调节：

- **字号** 12–60px（快捷键 `Ctrl+↑/↓` 微调）
- **行距 / 字距 / 字重**
- **字体颜色**：预设 8 档灰色 + 自定义色 + 一键自动适配灰
- **窗口宽度** 20%–100%、四周留白 4 档
- **底色**：默认全透明，可切白底
- **描边**：自动（深色字自动加浅色柔光，浅色网页上也清晰）

## 关键操作

| 操作 | 效果 |
|---|---|
| 点面板外空白 | 开启**点击穿透**，鼠标直接操作下层软件 |
| 双击页面 | 关闭穿透，回到可操作状态 |
| `Ctrl+Shift+O` | 切换点击穿透 |
| `Ctrl+Shift+L` | 锁定/解锁（锁定后鼠标完全不干扰） |
| `Ctrl+Shift+M` | 显示/隐藏面板 |
| `Ctrl+Shift+R` | 阅读模式（面板收起+穿透，纯阅读） |
| `→` `空格` `PgDn` | 下一页 |
| `←` `PgUp` | 上一页 |
| `Home` / `End` | 首/末页 |
| 拖拽空白处 | 移动整个窗口内容 |
| 拖入 txt 文件 | 直接载入 |

设置自动保存（localStorage），下次打开保持原样。

## 透明原理（重要）

普通浏览器窗口无法真正透明。`启动阅读层.bat` 用了 Chrome/Edge 的 app 模式 + 强制透明参数：

```
--app=reader.html --force-transparent-background --allow-transparent-windows
```

- 用 bat 启动 → 窗口背景真透明，只有文字浮在桌面上
- 直接双击 html → 也能用，但窗口背景可能是白色（功能不受影响，视觉上没那么"隐形"）

Chrome 和 Edge 任装其一即可，bat 会自动查找。

## 已知限制

- 浏览器安全策略不允许页面直接读剪贴板时，会提示用 `Ctrl+V` 代替
- 「读取剪贴板」按钮需要授权一次，选"允许"即可
- 提取脚本只抓当前章节，切章需重跑
- 微信读书页面结构更新可能导致提取脚本失效，脚本用"文本密度"识别正文，一般不受影响

## 常见问题

**Q：穿透开着时怎么把面板唤回来？**
`Ctrl+Shift+M`，或双击页面任意处。

**Q：字看不清？**
面板里调颜色（深色网页选浅灰 `#b5b5b5`，浅色网页选深灰 `#606060`），或直接点「自动适配灰」。

**Q：想让它一直置顶？**
浏览器 app 窗口用系统置顶工具（如 PowerToys Always On Top，`Win+Ctrl+T`）即可。
