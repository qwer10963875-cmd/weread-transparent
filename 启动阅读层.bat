@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

rem ==========================================================
rem  微信读书 · 透明阅读层 启动器
rem  用 Chrome 的 app 模式打开，并强制窗口背景透明（关键）
rem ==========================================================

set "HERE=%~dp0"
set "TARGET=%HERE%reader.html"
set "PROFILE=%HERE%.chrome-profile"

rem ---- 找浏览器 ----
set "BROWSER="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) do (
  if not defined BROWSER if exist %%P set "BROWSER=%%~P"
)

if not defined BROWSER (
  echo.
  echo   [错误] 没找到 Chrome 或 Edge。
  echo   请安装其中之一，或手动把 reader.html 拖进浏览器打开。
  echo.
  pause
  exit /b 1
)

echo.
echo   浏览器: %BROWSER%
echo   阅读层: %TARGET%
echo   正在启动...
echo.

rem ---- 关键参数说明 ----
rem  --app=            以独立应用窗口打开（没有地址栏、标签栏）
rem  --force-transparent-background   强制窗口背景透明
rem  --allow-transparent-windows      允许透明窗口（部分版本需要）
rem  --disable-gpu-compositing        避免部分显卡驱动下透明失效
rem  --no-first-run / --no-default-browser-check  跳过首次提示
start "" "%BROWSER%" ^
  --app="%TARGET%" ^
  --user-data-dir="%PROFILE%" ^
  --force-transparent-background ^
  --allow-transparent-windows ^
  --enable-features=AllowWindowsTransparency ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-features=CalculateNativeWinOcclusion ^
  --window-size=980,660 ^
  --window-position=120,90

exit /b 0
