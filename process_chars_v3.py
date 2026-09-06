from PIL import Image
import os

os.chdir(r"D:\Doubao_benti\集合\DSHgame")

def tight_crop(img, alpha_thresh=20):
    """用严格alpha阈值紧裁剪，去掉边缘透明边距"""
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

def fit_to_canvas(img, canvas_size, target_height):
    """缩放到目标高度，放入画布底部居中"""
    w, h = img.size
    scale = target_height / h
    new_w = int(w * scale)
    new_h = target_height
    # 如果宽度超过画布太多，按宽度约束
    if new_w > canvas_size - 20:
        scale = (canvas_size - 20) / w
        new_w = canvas_size - 20
        new_h = int(h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    x = (canvas_size - new_w) // 2
    y = canvas_size - new_h
    canvas.paste(img, (x, y), img)
    return canvas

# 直接使用用户已经抠好的新图，不跑cutout！
for name, src in [("char1", "assets/raw/char1_new.png"), ("char2", "assets/raw/char2_new.png")]:
    print(f"Processing {name} (using pre-cutout image)...")
    img = Image.open(src).convert("RGBA")
    print(f"  original size: {img.size}")
    img = tight_crop(img, alpha_thresh=20)
    print(f"  after tight crop: {img.size}")
    img = fit_to_canvas(img, 400, 340)
    img.save(f"assets/compressed/{name}.png")
    print(f"  saved {name}.png ({os.path.getsize(f'assets/compressed/{name}.png')//1024}KB)")

print("\nDone! Using user's pre-cutout images directly.")
