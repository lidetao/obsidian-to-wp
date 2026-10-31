#!/usr/bin/env bash
#
# 一键构建 / 安装 / 发版。
#
#   仅本地构建并安装（改代码后最快路径，不动 git）
#     ./scripts/release.sh --local
#
#   完整发版（升版本 + 构建 + 安装 + 提交 + 打 tag + 发 release）
#     ./scripts/release.sh 0.1.2 "改动说明"
#
# 依赖：npm、gh（已登录）。VAULT_PLUGIN_DIR 可覆盖安装目标。
#
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
VAULT_PLUGIN="${VAULT_PLUGIN_DIR:-/Users/jiahui.wu/File/Obsidian/detao-blog/.obsidian/plugins/obsidian-to-wp}"
ARTIFACTS=(main.js manifest.json styles.css)

build_and_install() {
	npm run build
	mkdir -p "$VAULT_PLUGIN"
	cp "${ARTIFACTS[@]}" "$VAULT_PLUGIN/"
	echo "已安装到 $VAULT_PLUGIN"
}

if [[ "${1:-}" == "--local" ]]; then
	build_and_install
	exit 0
fi

VERSION="${1:?用法：$0 <版本号 形如 0.1.2> [改动说明]，或 $0 --local}"
NOTES="${2:-$VERSION}"
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "版本号必须是 x.y.z 形式：$VERSION"
	exit 1
fi
if git rev-parse -q --verify "v$VERSION" >/dev/null; then
	echo "tag v$VERSION 已存在"
	exit 1
fi

# 1. 升版本号：manifest.json + versions.json
python3 - "$VERSION" <<'PY'
import json, pathlib, re, sys
v = sys.argv[1]
mp = pathlib.Path("manifest.json")
s = mp.read_text(encoding="utf-8")
if not re.search(r'"version"\s*:\s*"[^"]+"', s):
    sys.exit("manifest.json 里找不到 version 字段")
mp.write_text(re.sub(r'"version"\s*:\s*"[^"]+"', f'"version": "{v}"', s, count=1), encoding="utf-8")
min_app = json.loads(mp.read_text(encoding="utf-8"))["minAppVersion"]
vp = pathlib.Path("versions.json")
d = json.loads(vp.read_text(encoding="utf-8"))
d[v] = min_app
vp.write_text(json.dumps(d, indent="\t", ensure_ascii=False) + "\n", encoding="utf-8")
print(f"版本 -> {v} (minAppVersion {min_app})")
PY

# 2. 构建并安装到 vault
build_and_install

# 3. 提交 + 打 tag + 推送
git add -A
git commit -m "$NOTES"
git tag "v$VERSION"
git push origin HEAD
git push origin "v$VERSION"

# 4. 发 release（BRAT 从 release 资源安装，三个文件缺一不可）
gh release create "v$VERSION" "${ARTIFACTS[@]}" --title "v$VERSION" --notes "$NOTES"

echo
echo "完成：v$VERSION"
echo "Obsidian 里执行 BRAT: Check for updates to all beta plugins and UPDATE"
