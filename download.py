import urllib.request
import os

os.chdir(r"D:\Doubao_benti\集合\DSHgame")

# PixiJS v7.4.0
print("Downloading PixiJS...")
urllib.request.urlretrieve("https://cdn.jsdelivr.net/npm/pixi.js@7.4.0/dist/pixi.min.js", "lib/pixi.min.js")
print("  pixi.min.js:", os.path.getsize("lib/pixi.min.js") // 1024, "KB")

# 6张素材
assets = [
    ("https://aka.doubaocdn.com/s/J4GQ3UVaCv", "assets/raw/char1.png"),
    ("https://aka.doubaocdn.com/s/VH2cTAQx8s", "assets/raw/char2.png"),
    ("https://aka.doubaocdn.com/s/8RCXYds4xj", "assets/raw/bg_dark.png"),
    ("https://aka.doubaocdn.com/s/1N9XJo80VB", "assets/raw/bg_light.png"),
    ("https://aka.doubaocdn.com/s/T9EdVPl9UX", "assets/raw/pc_case.png"),
    ("https://aka.doubaocdn.com/s/wHaZyxsvEp", "assets/raw/placeholder.png"),
]

for url, path in assets:
    print("Downloading", os.path.basename(path), "...")
    urllib.request.urlretrieve(url, path)
    print("  ", os.path.basename(path), ":", os.path.getsize(path) // 1024, "KB")

print("All downloads complete!")
