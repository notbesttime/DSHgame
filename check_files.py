import os, hashlib, time

os.chdir(r"D:\Doubao_benti\集合\DSHgame")

files = [
    "assets/raw/char1.png",
    "assets/raw/char2.png",
    "assets/raw/char1_new.png",
    "assets/raw/char2_new.png",
    "assets/compressed/char1.png",
    "assets/compressed/char2.png",
]
for f in files:
    if os.path.exists(f):
        mtime = os.path.getmtime(f)
        size = os.path.getsize(f)
        with open(f, "rb") as fh:
            md5 = hashlib.md5(fh.read()).hexdigest()[:8]
        ts = time.strftime("%H:%M:%S", time.localtime(mtime))
        print(f"{f}: {size//1024}KB, md5={md5}, modified={ts}")
    else:
        print(f"{f}: NOT FOUND")
