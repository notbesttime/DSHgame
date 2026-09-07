# 资产重压缩流水线 v2:按游戏内显示尺寸把大 PNG 转 WebP(有损 q85-88,保留透明通道)
# 只处理 assets/compressed 下的素材(保留旧流水线的裁切结果),背景 JPEG 不动。
# 输出 assets/compressed_webp/*.webp,由 build.py 采用。
import os
import sys
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, 'assets', 'compressed')
DST = os.path.join(BASE, 'assets', 'compressed_webp')
os.makedirs(DST, exist_ok=True)

# name: (目标最长边 or None=保持原尺寸, webp质量)
TARGETS = {
    'pc_case.png': (860, 88),          # 显示宽最大420,2x=840
    'pc_case_upgraded.png': (None, 88),
    'fan.png': (None, 85),             # 400x989,显示高~0.48屏
    'char1.png': (None, 88),           # 400x400
    'char2.png': (None, 88),
    'speech_bubble.png': (None, 88),
}

for name, (max_edge, q) in TARGETS.items():
    src = os.path.join(SRC, name)
    out = os.path.join(DST, os.path.splitext(name)[0] + '.webp')
    im = Image.open(src).convert('RGBA')
    if max_edge and max(im.size) > max_edge:
        s = max_edge / max(im.size)
        im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS)
    im.save(out, 'WEBP', quality=q, method=6)
    old_kb = os.path.getsize(src) // 1024
    new_kb = os.path.getsize(out) // 1024
    print(f'{name}: {im.size[0]}x{im.size[1]} {old_kb}KB -> {new_kb}KB')

print('done ->', DST)
