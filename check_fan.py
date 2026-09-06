from PIL import Image
import os

os.chdir(r"D:\Doubao_benti\集合\DSHgame")

img = Image.open("assets/raw/fan.png")
print(f"fan.png: mode={img.mode}, size={img.size}")

if img.mode == "RGBA":
    alpha = img.split()[3]
    extrema = alpha.getextrema()
    print(f"  alpha range: {extrema}")
    # 采样统计透明像素
    w, h = img.size
    transparent = 0
    sampled = 0
    pixels = img.load()
    for y in range(0, h, 8):
        for x in range(0, w, 8):
            sampled += 1
            if pixels[x, y][3] < 10:
                transparent += 1
    print(f"  sampled transparent: {transparent}/{sampled} ({transparent*100//max(sampled,1)}%)")
else:
    print("  No alpha channel - needs cutout")
