# 构建脚本:把 PixiJS + 素材内联进 index_template.html 生成可离线打开的单文件 index.html
#
#   python build.py            单文件模式(默认):一切 base64 内联 → index.html
#   python build.py --dist     网页托管模式:代码/hash 资源分离 → dist/(配合平台长缓存)
#   python build.py --release  发布模式:剔除模板里 __DEBUG_STRIP_BEGIN__/END 标记的调试块,
#                              并对产物做「零调试痕迹」断言(可与 --dist 组合:--dist --release)
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
import re
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
    "tune_hit": ("assets/compressed_webp/tune_hit.webp", "image/webp"),
}

# 背景音乐:始终外置(绝不 base64 内联,否则单文件 HTML 会暴涨)。key → 源路径。
# 地下室=主生产场景 / 中转站=relay / 调教=tune。AAC 64k(.m4a),iOS/安卓/桌面全支持。
AUDIO_FILES = {
    "bgm_basement": "assets/audio/bgm_basement.m4a",
    "bgm_relay": "assets/audio/bgm_relay.m4a",
    "bgm_tune": "assets/audio/bgm_tune.m4a",
    # 操作音效(程序化合成,make_sfx.py 生成):点击/购买/挥鞭/消除。同样只外链、绝不内联。
    "sfx_click": "assets/audio/sfx_click.wav",
    "sfx_buy": "assets/audio/sfx_buy.wav",
    "sfx_whip": "assets/audio/sfx_whip.wav",
    "sfx_pop": "assets/audio/sfx_pop.wav",
}

# 兜底字体(§20.17):子集化 Noto Sans SC(OFL 可再分发;make_font_subset.py 生成)。
# 栈里放最后一位:有雅黑/PingFang 的设备零变化。与音频同理只外链、绝不内联。
FONT_FILES = {
    "dshgamecn": "assets/fonts/dshgamecn.woff2",
}

DIST_MODE = "--dist" in sys.argv
DIST_DIR = "dist"

# 全局资源域名:默认空 = 同源相对路径(assets 随 dist 一起上传,吃平台 1 年哈希缓存)。
# 将来想改走对象存储/CDN,只需 ASSET_BASE=https://你的域名/ python build.py --dist,代码零改动。
ASSET_BASE = os.environ.get("ASSET_BASE", "").strip()
if ASSET_BASE and not ASSET_BASE.endswith("/"):
    ASSET_BASE += "/"

# 发布模式(--release):把模板里 __DEBUG_STRIP_BEGIN__/__DEBUG_STRIP_END__ 标记之间的调试块
# 从产物里整块剔除(模型属性编辑器的调试按钮、/admodel 开关、覆盖表读写、编辑器键盘输入),并做
# 「零调试痕迹」断言 —— 不信手工删干净,漏了就让构建直接红。
# 块内若含 `// __RELEASE__`,保留它之后的内容作为正式版实现(整块删不掉的分支这样处理)。
# 断言在「去掉行注释后的代码」上做:注释是留给开发者看的,不算玩家可见痕迹。
RELEASE_MODE = "--release" in sys.argv
DEBUG_STRIP_RE = re.compile(
    r"//[ \t]*__DEBUG_STRIP_BEGIN__[^\n]*\n(.*?)//[ \t]*__DEBUG_STRIP_END__[^\n]*\n?", re.S)
RELEASE_BANNED = ["/admodel", "dshgame.modelAttrOverride", "保存到文档", "清空全部",
                  "saveModelOverrides", "commitModelAttrEdit"]


def strip_debug(src):
    """正式构建剔除调试块;--release 额外断言产物零调试痕迹。"""
    def repl(m):
        body = m.group(1)
        cut = body.find("// __RELEASE__")
        if cut >= 0:
            return body[cut + len("// __RELEASE__"):].lstrip("\n")
        return ""

    out = DEBUG_STRIP_RE.sub(repl, src)
    if RELEASE_MODE:
        code_only = re.sub(r"//[^\n]*", "", out)          # 仅用于断言,不改产物
        hits = [s for s in RELEASE_BANNED if s in code_only]
        if hits:
            raise SystemExit(f"[release] 自检失败:产物仍含调试痕迹 {hits}")
        print(f"[release] 调试痕迹 0 处 OK(剔除 {len(DEBUG_STRIP_RE.findall(src))} 块)")
    return out


with open("index_template.html", "r", encoding="utf-8") as f:
    TEMPLATE = strip_debug(f.read())

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

    # 音频:单文件模式也走相对外链(index.html 在项目根,assets/audio 就在旁边;离线双击可播)
    audio_js = "const AUDIO = {\n"
    for key, path in AUDIO_FILES.items():
        audio_js += f'  "{key}": "{path}",\n'
        print(f"  audio {key}: {os.path.getsize(path) // 1024} KB (外链)")
    audio_js += "};"
    html = html.replace("__AUDIO__", audio_js)

    # 兜底字体(§20.17):同音频逻辑相对外链(本体目录须连 assets/fonts 一起拷)
    for key, path in FONT_FILES.items():
        print(f"  font {key}: {os.path.getsize(path) // 1024} KB (外链)")
    html = html.replace("__FONT__", next(iter(FONT_FILES.values())))

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("\n单文件 index.html:", os.path.getsize("index.html") // 1024, "KB")


def build_dist():
    if os.path.isdir(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(os.path.join(DIST_DIR, "assets"))
    print(f"输出目录: {DIST_DIR}/")
    print(f"资源域名 ASSET_BASE: {ASSET_BASE!r} (空 = 同源相对路径,随 dist 一起上传)")

    # 1) 素材:以 <name>.<hash>.<ext> 落盘,HTML 里引用 ASSET_BASE + 相对路径
    assets_js = "const ASSETS = {\n"
    for key, (path, _mime) in ASSET_FILES.items():
        ext = os.path.splitext(path)[1]
        out_name = f"{key}.{short_hash(path)}{ext}"
        shutil.copyfile(path, os.path.join(DIST_DIR, "assets", out_name))
        assets_js += f'  "{key}": "{ASSET_BASE}assets/{out_name}",\n'
        print(f"  assets/{out_name}")
    assets_js += "};"

    # 1b) 音频:同样哈希外置到 dist/assets(一年缓存),绝不内联
    audio_js = "const AUDIO = {\n"
    for key, path in AUDIO_FILES.items():
        ext = os.path.splitext(path)[1]
        out_name = f"{key}.{short_hash(path)}{ext}"
        shutil.copyfile(path, os.path.join(DIST_DIR, "assets", out_name))
        audio_js += f'  "{key}": "{ASSET_BASE}assets/{out_name}",\n'
        print(f"  assets/{out_name} ({os.path.getsize(path) // 1024} KB)")
    audio_js += "};"

    # 1c) 兜底字体:哈希外置(与素材同待遇;font-display:swap ⇒ 加载中用系统字体不闪白)
    for key, path in FONT_FILES.items():
        ext = os.path.splitext(path)[1]
        out_name = f"{key}.{short_hash(path)}{ext}"
        shutil.copyfile(path, os.path.join(DIST_DIR, "assets", out_name))
        print(f"  assets/{out_name} ({os.path.getsize(path) // 1024} KB)")
        html_font = f"{ASSET_BASE}assets/{out_name}"

    # 2) PixiJS 独立成带哈希的文件(445KB,一年缓存)
    pixi_name = f"pixi.{hashlib.sha256(PIXI_JS.encode('utf-8')).hexdigest()[:8]}.js"
    with open(os.path.join(DIST_DIR, pixi_name), "w", encoding="utf-8") as f:
        f.write(PIXI_JS)
    print(f"  {pixi_name} ({len(PIXI_JS) // 1024} KB)")

    # 3) HTML 只留代码:把内联 PixiJS 换成外链,ASSETS 换成路径表
    html = TEMPLATE.replace(
        "<script>__PIXIES__</script>", f'<script src="{ASSET_BASE}{pixi_name}"></script>'
    )
    html = html.replace("__ASSETS__", assets_js)
    html = html.replace("__AUDIO__", audio_js)
    html = html.replace("__FONT__", html_font)
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
