#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 兜底字体子集生成(§20.17;2026-10-15 固化为活脚本)
#
# 作用:从本机 Noto Sans SC 可变字体(OFL 授权,可自由再分发)按模板实际用字生成 woff2 子集,
#      作为 font-family 栈**最后一位**的兜底 —— 有雅黑/PingFang 的设备零变化,
#      缺字体的安卓/Linux 才吃到,防「回退到任意 sans-serif ⇒ 字宽不可控 ⇒ 布局错位」。
#
# 用法: python make_font_subset.py            # 默认源字体与输出路径
#       改用字后(改文案/加新句子)必须重跑,否则新字在兜底设备上缺字。
#
# 依赖: fontTools + brotli(woff2 编码);源字体不在时请先安装 Noto Sans SC。
#       ⚠️ 不要用微软雅黑做源字体 —— 其许可不允许再分发子集文件。
import io
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC_CANDIDATES = [
    r'C:/Windows/Fonts/NotoSansSC-VF.ttf',
    'C:/Windows/Fonts/NotoSansSC-Regular.ttf',
    os.path.expanduser('~/fonts/NotoSansSC-VF.ttf'),
]
OUT = os.path.join(ROOT, 'assets', 'fonts', 'dshgamecn.woff2')

def main():
    src = next((p for p in SRC_CANDIDATES if os.path.exists(p)), None)
    if not src:
        print('未找到 Noto Sans SC 源字体,请把路径加进 SRC_CANDIDATES')
        sys.exit(1)
    # 模板里实际用到的字符(全部非 ASCII + ASCII 可打印,宁多勿漏)
    src_html = io.open(os.path.join(ROOT, 'index_template.html'), encoding='utf-8').read()
    uniq = sorted(set(c for c in src_html if ord(c) >= 0x20))
    text_file = os.path.join(ROOT, '_font_chars.txt')
    io.open(text_file, 'w', encoding='utf-8').write(''.join(uniq))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    cmd = [sys.executable, '-m', 'fontTools.subset', src,
           '--text-file=' + text_file, '--flavor=woff2', '--output-file=' + OUT,
           '--no-hinting']
    r = subprocess.run(cmd)
    os.remove(text_file)
    if r.returncode != 0 or not os.path.exists(OUT) or os.path.getsize(OUT) == 0:
        print('子集化失败')
        sys.exit(1)
    print('OK: %s (%d KB, %d 字符, 源 %s)' % (OUT, os.path.getsize(OUT) // 1024, len(uniq), os.path.basename(src)))

if __name__ == '__main__':
    main()
