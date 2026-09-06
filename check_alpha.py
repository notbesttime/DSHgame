from PIL import Image
import os

os.chdir(r"D:\Doubao_benti\集合\DSHgame")

for name in ["char1_new.png", "char2_new.png"]:
    img = Image.open(f"assets/raw/{name}")
    print(f"{name}: mode={img.mode}, size={img.size}")
    if img.mode == "RGBA":
        # 检查alpha通道是否有透明像素
        alpha = img.split()[3]
        extrema = alpha.getextrema()
        print(f"  alpha range: {extrema} (0=fully transparent, 255=fully opaque)")
        # 统计透明像素比例
        w, h = img.size
        transparent = 0
        total = w * h
        pixels = img.load()
        for y in range(0, h, 10):  # 采样
            for x in range(0, w, 10):
                if pixels[x, y][3] < 10:
                    transparent += 1
        sampled = (w // 10) * (h // 10)
        print(f"  sampled transparent pixels: {transparent}/{sampled} ({transparent*100//sampled}%)")
    else:
        print("  No alpha channel!")
