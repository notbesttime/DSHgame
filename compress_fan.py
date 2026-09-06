from PIL import Image
import os

os.chdir(r"D:\Doubao_benti\集合\DSHgame")

img = Image.open("assets/compressed/fan.png")
w, h = img.size
new_w = 400
new_h = int(h * new_w / w)
img = img.resize((new_w, new_h), Image.LANCZOS)
img.save("assets/compressed/fan.png", optimize=True)
print(f"compressed: {new_w}x{new_h}, {os.path.getsize('assets/compressed/fan.png')//1024}KB")
