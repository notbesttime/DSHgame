# 从 raw 高清椅子图重新切割 chair_hi.webp(替代 300px 模糊小图),并裁剪掉四周透明边
import os
import sys
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
BASE = os.path.dirname(os.path.abspath(__file__))

im = Image.open(os.path.join(BASE, 'assets', 'raw', 'chair.png')).convert('RGBA')
bbox = im.getbbox()  # 非零(含透明度)内容的包围盒
print('raw size:', im.size, 'content bbox:', bbox)
im = im.crop(bbox)
print('cropped:', im.size)

out = os.path.join(BASE, 'assets', 'compressed_webp', 'chair_hi.webp')
im.save(out, 'WEBP', quality=90, method=6)
print('saved:', out, os.path.getsize(out) // 1024, 'KB')
