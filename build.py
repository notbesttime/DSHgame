# 构建脚本:把 PixiJS 与所有素材(base64)内联进 index_template.html,生成单文件 index.html
# ASSET_FILES 是资产唯一数据源,新增素材只需在这里加一行。
import base64
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

ASSET_FILES = {
    "bg_dark": ("assets/compressed/bg_dark.jpg", "image/jpeg"),
    "bg_light": ("assets/compressed/bg_light.jpg", "image/jpeg"),
    "char1": ("assets/compressed_webp/char1.webp", "image/webp"),
    "char2": ("assets/compressed_webp/char2.webp", "image/webp"),
    "pc_case": ("assets/compressed_webp/pc_case.webp", "image/webp"),
    "fan": ("assets/compressed_webp/fan.webp", "image/webp"),
    "placeholder": ("assets/compressed/placeholder.jpg", "image/jpeg"),
    "speech_bubble": ("assets/compressed_webp/speech_bubble.webp", "image/webp"),
    "pc_case_upgraded": ("assets/compressed_webp/pc_case_upgraded.webp", "image/webp"),
    "transfer_bg": ("assets/compressed/transfer_bg.jpg", "image/jpeg"),
    "chair": ("assets/compressed_webp/chair.webp", "image/webp"),
}

with open("index_template.html", "r", encoding="utf-8") as f:
    html = f.read()

with open("lib/pixi.min.js", "r", encoding="utf-8") as f:
    pixi_js = f.read()
html = html.replace("__PIXIES__", pixi_js)
print("PixiJS embedded:", len(pixi_js) // 1024, "KB")

assets_js = "const ASSETS = {\n"
for key, (path, mime) in ASSET_FILES.items():
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    assets_js += f'  "{key}": "data:{mime};base64,{b64}",\n'
    print(f"  {key}: {len(b64)//1024} KB base64")
assets_js += "};"

html = html.replace("__ASSETS__", assets_js)

with open("index.html", "w", encoding="utf-8") as f:
    f.write(html)

print("\nFinal index.html:", os.path.getsize("index.html") // 1024, "KB")
print("Done!")
