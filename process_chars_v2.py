from PIL import Image
import os

os.chdir(r"D:\Doubao_benti\集合\DSHgame")

def cutout(img, outline_thresh=55, bright_thresh=200, sat_thresh=0.25):
    img = img.convert("RGBA")
    w, h = img.size
    pixels = img.load()
    def is_candidate(x, y):
        r, g, b, a = pixels[x, y]
        if a < 10: return True
        brightness = (r + g + b) / 3
        mx, mn = max(r, g, b), min(r, g, b)
        saturation = (mx - mn) / mx if mx > 0 else 0
        return brightness > bright_thresh and saturation < sat_thresh
    def is_outline(x, y):
        r, g, b, a = pixels[x, y]
        return (r + g + b) / 3 < outline_thresh
    visited = [[False] * w for _ in range(h)]
    queue = []
    for x in range(w):
        for y in [0, h-1]:
            if is_candidate(x, y) and not is_outline(x, y):
                visited[y][x] = True; queue.append((x, y))
    for y in range(h):
        for x in [0, w-1]:
            if is_candidate(x, y) and not is_outline(x, y):
                visited[y][x] = True; queue.append((x, y))
    while queue:
        x, y = queue.pop(0)
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if is_candidate(nx, ny) and not is_outline(nx, ny):
                    visited[ny][nx] = True; queue.append((nx, ny))
    for y in range(h):
        for x in range(w):
            if visited[y][x]:
                pixels[x, y] = (0, 0, 0, 0)
    return img

def tight_crop(img, alpha_thresh=20):
    """用严格alpha阈值紧裁剪，去掉边缘半透明噪点"""
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
    # 额外收紧1像素，去掉边缘抗锯齿
    min_x = max(0, min_x + 1)
    max_x = min(w - 1, max_x - 1)
    min_y = max(0, min_y + 1)
    max_y = min(h - 1, max_y - 1)
    return img.crop((min_x, min_y, max_x + 1, max_y + 1))

def fit_to_canvas(img, canvas_size, target_height, bottom_pad=0):
    w, h = img.size
    scale = target_height / h
    new_w = int(w * scale)
    img = img.resize((new_w, target_height), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    x = (canvas_size - new_w) // 2
    y = canvas_size - target_height - bottom_pad
    canvas.paste(img, (x, y), img)
    return canvas

# 先处理两张图，获取紧裁剪后的尺寸
cropped = {}
for name, src in [("char1", "assets/raw/char1_new.png"), ("char2", "assets/raw/char2_new.png")]:
    print(f"Processing {name}...")
    img = Image.open(src)
    img = cutout(img)
    img = tight_crop(img, alpha_thresh=20)
    cropped[name] = img
    print(f"  cropped size: {img.size}")

# 以人物高度为基准统一缩放（两张图都缩放到340px高度）
# 同时检查宽度比例，如果一张明显更宽，以宽度为约束
target_h = 340
for name in ["char1", "char2"]:
    img = cropped[name]
    w, h = img.size
    scale = target_h / h
    new_w = int(w * scale)
    # 如果宽度超过400画布太多，按宽度约束
    if new_w > 380:
        scale = 380 / w
        new_w = 380
        new_h = int(h * scale)
    else:
        new_h = target_h
    img = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    x = (400 - new_w) // 2
    y = 400 - new_h
    canvas.paste(img, (x, y), img)
    canvas.save(f"assets/compressed/{name}.png")
    print(f"  {name}: final character size {new_w}x{new_h}, saved ({os.path.getsize(f'assets/compressed/{name}.png')//1024}KB)")

print("\nDone! Both characters now have consistent height (340px).")
