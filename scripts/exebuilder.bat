@echo off
setlocal enabledelayedexpansion

set ROOT_DIR=%~dp0..\
set OUT_DIR=%ROOT_DIR%dist\windows
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

echo Building QuiltyCode Windows executable installer...
call npm run gulp vscode-win32-x64-min || exit /b 1
call npm run gulp vscode-win32-x64-setup || exit /b 1

echo Build complete. Output is under %OUT_DIR%
