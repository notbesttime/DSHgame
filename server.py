# -*- coding: utf-8 -*-
"""本地开发/调参服务器:静态文件 + 编辑器「保存到文档」接口。

    python server.py [端口]        # 默认 8765,只监听 127.0.0.1

POST /api/save-overrides
    body = {"模型名": {"reasoning": 60, "speed": 28, ...}, ...}   (键名见 KEYS,0-100)
    → 把覆盖值合并进《中转站设计.md》§3.1 的设计属性列(9 维,只替换给出的键,其余保持)
    → 自动跑 sync_models.py --write(生成 REAL_MODELS)和 build.py(重建 index.html)
    → 前端刷新(F5)即读到固化数据。

为什么需要它:游戏编辑器的调整原本只存浏览器 localStorage(按打开方式隔离,易丢),
有这个接口后,「保存到文档」按钮一键固化,不再需要导出/导入。
这是开发/调参工具:只监听本机,不要部署到公网。
"""
import io
import json
import os
import re
import subprocess
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
DOC = os.path.join(ROOT, '中转站设计.md')
KEYS = ['reasoning', 'knowledge', 'longCtx', 'speed', 'multimodal', 'instruct', 'toolCall', 'fit', 'params']


def merge_overrides(ov):
    """把 {模型名: {键: 值}} 合并进 §3.1 设计属性列(9 维,只替换给出的键)。返回更新的模型名单。"""
    L = io.open(DOC, encoding='utf-8').read().split('\n')
    updated = []
    for i, l in enumerate(L):
        if not (l.startswith('| ') and not l.startswith('|---')):
            continue
        c = [x.strip() for x in l.strip().strip('|').split('|')]
        if len(c) != 14 or not c[0].isdigit():
            continue
        name = c[1]
        if name not in ov or not isinstance(ov[name], dict):
            continue
        cur = c[12]
        vals = [] if cur in ('—', '') else [int(x) for x in cur.split('/')]
        if len(vals) != 9:
            vals = [50] * 9          # 未估行给中性起点,随后被覆盖键替换
        touched = False
        for key, v in ov[name].items():
            if key in KEYS and isinstance(v, (int, float)):
                vals[KEYS.index(key)] = max(0, min(100, int(round(v))))
                touched = True
            elif key == '__cap' and isinstance(v, (int, float)):
                # 有效 cap 一并固化:不然属性改了、cap 会退回静态值(用户报告过的 bug)
                c[11] = '%g' % round(v, 1)
                touched = True
            elif key == '__k' and isinstance(v, str) and re.match(r'^20\d\d-\d\d$', v):
                c[5] = v            # 有效知识截止日期
                touched = True
        if touched:
            c[12] = '/'.join(str(x) for x in vals)
            L[i] = '| ' + ' | '.join(c) + ' |'
            updated.append(name)
    io.open(DOC, 'w', encoding='utf-8', newline='\n').write('\n'.join(L))
    return updated


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_POST(self):
        if self.path != '/api/save-overrides':
            self.send_error(404)
            return
        n = int(self.headers.get('Content-Length', 0) or 0)
        try:
            ov = json.loads(self.rfile.read(n).decode('utf-8'))
            assert isinstance(ov, dict)
        except Exception as e:
            body = json.dumps({'ok': False, 'error': str(e)}, ensure_ascii=False).encode('utf-8')
            self.send_response(400)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        updated = merge_overrides(ov)
        # 固化:文档 → 数组(sync)→ 单文件(index.html)
        subprocess.run(['python', '-X', 'utf8', 'sync_models.py', '--write'], cwd=ROOT, capture_output=True)
        subprocess.run(['python', 'build.py'], cwd=ROOT, capture_output=True)
        body = json.dumps({'ok': True, 'updated': updated}, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass          # 静音访问日志(刷榜单很吵)


if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print('serving %s at http://127.0.0.1:%d  (POST /api/save-overrides 可用)' % (ROOT, port))
    HTTPServer(('127.0.0.1', port), Handler).serve_forever()
