#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/dist/windows"
mkdir -p "${OUT_DIR}"

echo "This helper prepares the Windows packaging command."
echo "Run on Windows with PowerShell/CMD:"
echo "  npm run gulp vscode-win32-x64-min"
echo "  npm run gulp vscode-win32-x64-setup"
echo "Output directory: ${OUT_DIR}"
