#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/dist/deb"
PKG_NAME="quiltycode"
VERSION="${VERSION:-0.0.1}"
ARCH="${ARCH:-amd64}"
PKG_DIR="${OUT_DIR}/${PKG_NAME}_${VERSION}_${ARCH}"

mkdir -p "${PKG_DIR}/DEBIAN" "${PKG_DIR}/usr/bin"
cat > "${PKG_DIR}/DEBIAN/control" <<CTRL
Package: ${PKG_NAME}
Version: ${VERSION}
Section: editors
Priority: optional
Architecture: ${ARCH}
Maintainer: QuiltyCode Team
Description: QuiltyCode desktop launcher package
CTRL

cat > "${PKG_DIR}/usr/bin/quiltycode" <<'BIN'
#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
exec "${ROOT_DIR}/scripts/code.sh" "$@"
BIN
chmod +x "${PKG_DIR}/usr/bin/quiltycode"

mkdir -p "${OUT_DIR}"
dpkg-deb --build "${PKG_DIR}" "${OUT_DIR}/${PKG_NAME}_${VERSION}_${ARCH}.deb"
echo "Built ${OUT_DIR}/${PKG_NAME}_${VERSION}_${ARCH}.deb"
