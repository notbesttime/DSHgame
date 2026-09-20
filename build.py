# 构建脚本:把 PixiJS + 素材内联进 index_template.html 生成可离线打开的单文件 index.html
#
#   python build.py            单文件模式(默认):一切 base64 内联 → index.html
#   python build.py --dist     网页托管模式:代码/hash 资源分离 → dist/(配合平台长缓存)
#
# 两种模式共用同一份 index_template.html 与同一张 ASSET_FILES 清单,不要各自维护。
#
# 为什么需要 --dist:网页平台对 HTML 只给 60 秒缓存,对「内容哈希命名的资源」给 1 年强缓存。
# 把 2.13MB 全部内联进 index.html = 老玩家每次回来都重下 2.13MB。拆开后:
#   index.html ~76KB(仅代码)+ pixi.<hash>.js 445KB + 素材 <name>.<hash>.* 1243KB
# 回访只需重下 index.html 那 76KB。副产品是省掉 base64 的 33% 体积膨胀。
import base64
import hashlib
import os
import shutil
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# 资产唯一数据源:新增素材只在这里加一行(key, 路径, MIME)
ASSET_FILES = {
    "bg_dark": ("assets/compressed_webp/bg_dark.webp", "image/webp"),
    "bg_light": ("assets/compressed_webp/bg_light.webp", "image/webp"),
    "char1": ("assets/compressed_webp/char1.webp", "image/webp"),
    "char2": ("assets/compressed_webp/char2.webp", "image/webp"),
    "pc_case": ("assets/compressed_webp/pc_case.webp", "image/webp"),
    "fan": ("assets/compressed_webp/fan.webp", "image/webp"),
    "placeholder": ("assets/compressed_webp/placeholder.webp", "image/webp"),
    "speech_bubble": ("assets/compressed_webp/speech_bubble.webp", "image/webp"),
    "pc_case_upgraded": ("assets/compressed_webp/pc_case_upgraded.webp", "image/webp"),
    "transfer_bg": ("assets/compressed_webp/transfer_bg.webp", "image/webp"),
    "chair": ("assets/compressed_webp/chair_hi.webp", "image/webp"),
    "walk_left": ("assets/compressed_webp/walk_left.webp", "image/webp"),
    "walk_right": ("assets/compressed_webp/walk_right.webp", "image/webp"),
    "walk_idle": ("assets/compressed_webp/walk_idle.webp", "image/webp"),
    "walker_lift": ("assets/compressed_webp/walker_lift.webp", "image/webp"),
    "walker_sit": ("assets/compressed_webp/walker_sit.webp", "image/webp"),
    "chair_outline": ("assets/compressed_webp/chair_outline.webp", "image/webp"),
    "panel_logo": ("assets/compressed_webp/panel_logo.webp", "image/webp"),
    "tune_bg": ("assets/compressed_webp/tune_bg.webp", "image/webp"),
    "whip_idle": ("assets/compressed_webp/whip_idle.webp", "image/webp"),
    "whip_crack": ("assets/compressed_webp/whip_crack.webp", "image/webp"),
    "whale_cursor": ("assets/compressed_webp/whale_cursor.webp", "image/webp"),
    "whale_cursor_down": ("assets/compressed_webp/whale_cursor_down.webp", "image/webp"),
    "tune_desk": ("assets/compressed_webp/tune_desk.webp", "image/webp"),
    "tune_idle": ("assets/compressed_webp/tune_idle.webp", "image/webp"),
}

DIST_MODE = "--dist" in sys.argv
DIST_DIR = "dist"

with open("index_template.html", "r", encoding="utf-8") as f:
    TEMPLATE = f.read()

with open("lib/pixi.min.js", "r", encoding="utf-8") as f:
    PIXI_JS = f.read()


def short_hash(path):
    """内容哈希前 8 位:文件名变了内容才变,可安全用 1 年强缓存。"""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()[:8]


def build_single():
    html = TEMPLATE.replace("__PIXIES__", PIXI_JS)
    print("PixiJS embedded:", len(PIXI_JS) // 1024, "KB")

    assets_js = "const ASSETS = {\n"
    for key, (path, mime) in ASSET_FILES.items():
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        assets_js += f'  "{key}": "data:{mime};base64,{b64}",\n'
        print(f"  {key}: {len(b64) // 1024} KB base64")
    assets_js += "};"

    html = html.replace("__ASSETS__", assets_js)
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("\n单文件 index.html:", os.path.getsize("index.html") // 1024, "KB")


def build_dist():
    if os.path.isdir(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(os.path.join(DIST_DIR, "assets"))
    print(f"输出目录: {DIST_DIR}/")

    # 1) 素材:以 <name>.<hash>.<ext> 落盘,HTML 里引用相对路径
    assets_js = "const ASSETS = {\n"
    for key, (path, _mime) in ASSET_FILES.items():
        ext = os.path.splitext(path)[1]
        out_name = f"{key}.{short_hash(path)}{ext}"
        shutil.copyfile(path, os.path.join(DIST_DIR, "assets", out_name))
        assets_js += f'  "{key}": "assets/{out_name}",\n'
        print(f"  assets/{out_name}")
    assets_js += "};"

    # 2) PixiJS 独立成带哈希的文件(445KB,一年缓存)
    pixi_name = f"pixi.{hashlib.sha256(PIXI_JS.encode('utf-8')).hexdigest()[:8]}.js"
    with open(os.path.join(DIST_DIR, pixi_name), "w", encoding="utf-8") as f:
        f.write(PIXI_JS)
    print(f"  {pixi_name} ({len(PIXI_JS) // 1024} KB)")

    # 3) HTML 只留代码:把内联 PixiJS 换成外链,ASSETS 换成路径表
    html = TEMPLATE.replace(
        "<script>__PIXIES__</script>", f'<script src="{pixi_name}"></script>'
    )
    html = html.replace("__ASSETS__", assets_js)
    with open(os.path.join(DIST_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

    total = 0
    for root, _dirs, files in os.walk(DIST_DIR):
        for name in files:
            total += os.path.getsize(os.path.join(root, name))
    print(f"\ndist/index.html: {os.path.getsize(os.path.join(DIST_DIR, 'index.html')) // 1024} KB")
    print(f"dist/ 合计: {total // 1024} KB (首访);回访只需重下 index.html")


if DIST_MODE:
    build_dist()
else:
    build_single()
