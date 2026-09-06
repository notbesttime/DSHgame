import subprocess
import os
from PIL import Image

os.chdir(r"D:\Doubao_benti\集合\DSHgame")
FFMPEG = r"D:\Chat_GPT5.5Projects\FollowCreate\ffmpeg\ffmpeg.exe"

# ========== 1. 压缩背景图和占位图为JPEG ==========
def compress_jpg(input_path, output_path, width):
    cmd = [FFMPEG, "-y", "-i", input_path, "-vf", f"scale={width}:-1", "-q:v", "5", output_path]
    subprocess.run(cmd, capture_output=True)
    print(f"  compressed: {os.path.basename(output_path)} ({os.path.getsize(output_path)//1024}KB)")

print("=== 压缩背景图 ===")
compress_jpg("assets/raw/bg_dark.png", "assets/compressed/bg_dark.jpg", 1920)
compress_jpg("assets/raw/bg_light.png", "assets/compressed/bg_light.jpg", 1920)
compress_jpg("assets/raw/placeholder.png", "assets/compressed/placeholder.jpg", 600)

# ========== 2. 智能抠图函数 ==========
def cutout(img, outline_thresh=55, bright_thresh=200, sat_thresh=0.25):
    """智能抠图：基于亮度/饱和度判定背景，从边缘BFS删除，黑色轮廓线屏障"""
    img = img.convert("RGBA")
    w, h = img.size
    pixels = img.load()
    
    # 判定背景候选：高亮度 + 低饱和度
    def is_candidate(x, y):
        r, g, b, a = pixels[x, y]
        if a < 10: return True
        brightness = (r + g + b) / 3
        mx, mn = max(r, g, b), min(r, g, b)
        saturation = (mx - mn) / mx if mx > 0 else 0
        return brightness > bright_thresh and saturation < sat_thresh
    
    # 黑色轮廓线屏障：遇到暗像素停止
    def is_outline(x, y):
        r, g, b, a = pixels[x, y]
        return (r + g + b) / 3 < outline_thresh
    
    # BFS from all 4 edges
    visited = [[False] * w for _ in range(h)]
    queue = []
    for x in range(w):
        for y in [0, h-1]:
            if is_candidate(x, y) and not is_outline(x, y):
                visited[y][x] = True
                queue.append((x, y))
    for y in range(h):
        for x in [0, w-1]:
            if is_candidate(x, y) and not is_outline(x, y):
                visited[y][x] = True
                queue.append((x, y))
    
    while queue:
        x, y = queue.pop(0)
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if is_candidate(nx, ny) and not is_outline(nx, ny):
                    visited[ny][nx] = True
                    queue.append((nx, ny))
    
    # 删除背景像素
    for y in range(h):
        for x in range(w):
            if visited[y][x]:
                pixels[x, y] = (0, 0, 0, 0)
    
    return img

def crop_to_content(img):
    """裁剪到非透明区域边界"""
    bbox = img.getbbox()
    if bbox:
        return img.crop(bbox)
    return img

def fit_to_canvas(img, canvas_size, target_height, bottom_pad=0):
    """缩放到目标高度，放入画布底部居中"""
    w, h = img.size
    scale = target_height / h
    new_w = int(w * scale)
    new_h = target_height
    img = img.resize((new_w, new_h), Image.LANCZOS)
    
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    x = (canvas_size - new_w) // 2
    y = canvas_size - new_h - bottom_pad
    canvas.paste(img, (x, y), img)
    return canvas

# ========== 3. 抠图并处理角色 ==========
print("\n=== 抠图角色 ===")
for name in ["char1", "char2"]:
    print(f"  processing {name}...")
    img = Image.open(f"assets/raw/{name}.png")
    img = cutout(img)
    img = crop_to_content(img)
    img = fit_to_canvas(img, 400, 340, bottom_pad=0)
    img.save(f"assets/compressed/{name}.png")
    print(f"    saved {name}.png ({os.path.getsize(f'assets/compressed/{name}.png')//1024}KB)")

# ========== 4. 抠图机箱 ==========
print("\n=== 抠图机箱 ===")
img = Image.open("assets/raw/pc_case.png")
img = cutout(img)
img = crop_to_content(img)
img.save("assets/compressed/pc_case.png")
print(f"  saved pc_case.png ({os.path.getsize('assets/compressed/pc_case.png')//1024}KB, size={img.size})")

print("\n=== 全部处理完成 ===")
