import urllib.request
import os

os.chdir(r"D:\Doubao_benti\集合\DSHgame")

# 图1闭嘴，图2张嘴
assets = [
    ("https://aka.doubaocdn.com/s/tjVUzWVRAx", "assets/raw/char2_new.png"),  # 闭嘴
    ("https://aka.doubaocdn.com/s/BGjjovQU5n", "assets/raw/char1_new.png"),  # 张嘴
]

for url, path in assets:
    print("Downloading", os.path.basename(path), "...")
    urllib.request.urlretrieve(url, path)
    print("  ", os.path.basename(path), ":", os.path.getsize(path) // 1024, "KB")

print("Done!")
