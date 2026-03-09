#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/dist"
TOOL_DIR="${OUT_DIR}/tools"
APP_NAME="QuiltyCode"
APP_ID="quiltycode"
ARCHITECTURE="${ARCH:-x86_64}"
APPDIR="${OUT_DIR}/${APP_NAME}.AppDir"
APPIMAGE_TOOL="${TOOL_DIR}/appimagetool-${ARCHITECTURE}.AppImage"
APPIMAGE_RUNNER="${TOOL_DIR}/squashfs-root/AppRun"
OUTPUT_IMAGE="${OUT_DIR}/${APP_NAME}-${ARCHITECTURE}.AppImage"

require_cmd() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "error: missing dependency '$1'." >&2
		exit 1
	fi
}

require_cmd curl
require_cmd file

mkdir -p "${OUT_DIR}" "${TOOL_DIR}" "${APPDIR}/usr/bin" "${APPDIR}/usr/share/icons/hicolor/256x256/apps"
rm -rf "${APPDIR:?}"/*

if [[ ! -f "${APPIMAGE_TOOL}" ]]; then
	curl -fL "https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-${ARCHITECTURE}.AppImage" -o "${APPIMAGE_TOOL}"
	chmod +x "${APPIMAGE_TOOL}"
fi

if [[ ! -x "${APPIMAGE_RUNNER}" ]]; then
	(
		cd "${TOOL_DIR}"
		"${APPIMAGE_TOOL}" --appimage-extract >/dev/null
	)
fi

cat > "${APPDIR}/AppRun" <<APP_RUN
#!/usr/bin/env bash
set -euo pipefail
exec "${ROOT_DIR}/scripts/code.sh" "\$@"
APP_RUN
chmod +x "${APPDIR}/AppRun"

cat > "${APPDIR}/${APP_ID}.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=${APP_NAME}
Comment=${APP_NAME} IDE
Exec=${APP_ID}
Icon=${APP_ID}
Categories=Development;IDE;
Terminal=false
DESKTOP

cat > "${APPDIR}/usr/bin/${APP_ID}" <<'BIN'
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPDIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
exec "${APPDIR}/AppRun" "$@"
BIN
chmod +x "${APPDIR}/usr/bin/${APP_ID}"

if [[ -f "${ROOT_DIR}/resources/linux/code.png" ]]; then
	cp "${ROOT_DIR}/resources/linux/code.png" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/${APP_ID}.png"
	ln -sf "usr/share/icons/hicolor/256x256/apps/${APP_ID}.png" "${APPDIR}/${APP_ID}.png"
else
	cp "${ROOT_DIR}/resources/linux/code.svg" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/${APP_ID}.svg"
	ln -sf "usr/share/icons/hicolor/256x256/apps/${APP_ID}.svg" "${APPDIR}/${APP_ID}.svg"
fi

ARCH="${ARCHITECTURE}" "${APPIMAGE_RUNNER}" "${APPDIR}" "${OUTPUT_IMAGE}"
echo "Built: ${OUTPUT_IMAGE}"
