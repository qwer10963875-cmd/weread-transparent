@echo off
chcp 65001 >nul
setlocal

rem ============================================================
rem  微信读书网页版 · 透明化改造 启动器
rem  直接加载 weread.qq.com，可正常扫码登录；
rem  注入"透明层"扩展：背景透明 + 灰色文字 + 面板调节
rem ============================================================

set "HERE=%~dp0"
set "EXT=%HERE%extension"
set "PROFILE=%HERE%.profile"
set "URL=https://weread.qq.com/"

rem ---- 首选 Edge（Chrome 137+ 已禁用 --load-extension 命令行加载） ----
set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if defined BROWSER goto launch

rem ---- 没有 Edge 时退回 Chrome（新版可能不加载扩展） ----
set "BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if not defined BROWSER (
  echo.
  echo   [错误] 没找到 Edge 或 Chrome，请先安装 Microsoft Edge。
  echo.
  pause
  exit /b 1
)

echo.
echo   [提示] 未找到 Edge，使用 Chrome 启动。
echo   Chrome 137+ 禁用了命令行加载扩展，若窗口右上角没有"透明层"面板，
echo   请安装 Microsoft Edge 后再用本启动器。
echo.

start "" "%BROWSER%" ^
  --app="%URL%" ^
  --user-data-dir="%PROFILE%" ^
  --load-extension="%EXT%" ^
  --disable-features=DisableLoadExtensionCommandLineSwitch,CalculateNativeWinOcclusion ^
  --force-transparent-background ^
  --allow-transparent-windows ^
  --no-first-run --no-default-browser-check ^
  --window-size=1000,700 --window-position=140,90
exit /b 0

:launch
start "" "%BROWSER%" ^
  --app="%URL%" ^
  --user-data-dir="%PROFILE%" ^
  --load-extension="%EXT%" ^
  --force-transparent-background ^
  --allow-transparent-windows ^
  --disable-features=CalculateNativeWinOcclusion ^
  --no-first-run --no-default-browser-check ^
  --window-size=1000,700 --window-position=140,90
exit /b 0
