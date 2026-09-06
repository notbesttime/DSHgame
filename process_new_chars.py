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

def crop_to_content(img):
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img

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

# 处理新角色图
for name, src in [("char1", "assets/raw/char1_new.png"), ("char2", "assets/raw/char2_new.png")]:
    print(f"Processing {name}...")
    img = Image.open(src)
    img = cutout(img)
    img = crop_to_content(img)
    img = fit_to_canvas(img, 400, 340, bottom_pad=0)
    img.save(f"assets/compressed/{name}.png")
    print(f"  saved {name}.png ({os.path.getsize(f'assets/compressed/{name}.png')//1024}KB)")

print("Done!")
