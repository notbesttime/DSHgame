from PIL import Image
import os

os.chdir(r"D:\Doubao_benti\集合\DSHgame")

def tight_crop(img, alpha_thresh=20):
    w, h = img.size
    pixels = img.load()
    min_x, max_x = w, 0
    min_y, max_y = h, 0
    found = False
    for y in range(h):
        for x in range(w):
            if pixels[x, y][3] > alpha_thresh:
                found = True
                if x < min_x: min_x = x
                if x > max_x: max_x = x
                if y < min_y: min_y = y
                if y > max_y: max_y = y
    if not found:
        return img
    return img.crop((min_x, min_y, max_x + 1, max_y + 1))

img = Image.open("assets/raw/fan.png").convert("RGBA")
print(f"original: {img.size}")
img = tight_crop(img, alpha_thresh=20)
print(f"after tight crop: {img.size}")
img.save("assets/compressed/fan.png")
print(f"saved fan.png ({os.path.getsize('assets/compressed/fan.png')//1024}KB)")
