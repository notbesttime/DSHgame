# -*- coding: utf-8 -*-
"""把《中转站设计.md》§3.1 的唯一数据表同步进 index_template.html 的 REAL_MODELS 数组。

用法:
    python sync_models.py            # 只看会改什么(默认,不动文件)
    python sync_models.py --write    # 真正写入 index_template.html

表格是唯一数据源:调榜只改 md,别手改代码数组。
`设计属性` 那一列目前不进代码(代码用 modelToAttrs() 从 cap 硬推),见设计文档 §13.11。
"""
import io, re, sys, difflib

DOC = '中转站设计.md'
SRC = 'index_template.html'
BEGIN = 'const REAL_MODELS = ['
END = '];'
MODAL = [('PDF', 3), ('视', 2), ('图', 1)]   # 文图音 → 命中"图" → 1,与现有代码一致
MODAL_OK = ('文', '文图', '文图视', '文图视PDF', '文图PDF', '文图音')


def parse_doc():
    L = io.open(DOC, encoding='utf-8').read().split('\n')
    i = next(k for k, l in enumerate(L) if l.startswith('### 3.1'))
    j = next(k for k, l in enumerate(L) if l.startswith('### 3.2'))
    out = []
    for l in L[i:j]:
        if not l.startswith('|') or l.startswith('|---') or '名次 |' in l:
            continue
        c = [x.strip() for x in l.strip().strip('|').split('|')]
        if len(c) < 13 or not re.match(r'^\d+$', c[0]):
            continue
        name, vendor, tier, status, k, ctx = c[1], c[2], c[3], c[4].replace('*', ''), c[5].lstrip('~'), c[6]
        pi, po, modal, tools, cap = c[7], c[8], c[9], c[10], int(c[12].replace('*', ''))
        ck = {'M': 1000.0, 'k': 1.0}[ctx[-1]] if ctx[-1] in 'Mk' else 1.0
        try:
            ctxk = int(round(float(ctx[:-1]) * ck))
        except ValueError:
            raise SystemExit('上下文解析不了:%s (%s)' % (ctx, name))
        if modal not in MODAL_OK:
            raise SystemExit('模态写法不认识:%s (%s)' % (modal, name))
        m = next((v for key, v in MODAL if key in modal), 0)
        out.append((name, vendor, tier, k, ctxk, pi, po, m,
                    1 if tools == '✓' else 0, cap, 1 if '退役' in status else 0))
    return out


def render(rows):
    def q(s):
        return "'%s'" % s
    wn = max([len(r[0]) for r in rows] + [len('n 名称')])
    wv = max([len(r[1]) for r in rows] + [len('v 厂商')])
    wt = max([len(r[2]) for r in rows] + [len('t 档位')])
    lines = [BEGIN]
    for n, v, t, k, c, pi, po, m, tools, cap, legacy in rows:
        lines.append('  {{ n: {n} v: {v} t: {t} k: {k}, c: {c}, pi: {pi}, po: {po}, m: {m}, tools: {tools}, cap: {cap}{lg} }},'.format(
            n=(q(n) + ',').ljust(wn + 3), v=(q(v) + ',').ljust(wv + 3), t=(q(t) + ',').ljust(wt + 3),
            k=q(k), c=c, pi=pi, po=po, m=m, tools=tools, cap=cap,
            lg=', legacy: 1' if legacy else ''))
    lines.append(END)
    return lines


def main():
    rows = parse_doc()
    text = io.open(SRC, encoding='utf-8').read()
    i = text.index(BEGIN)
    j = text.index('\n' + END, i)
    old = text[i:j + len(END) + 1].split('\n')
    new = render(rows)
    if old == new:
        print('已是最新,%d 条,无需改动。' % len(rows))
        return
    print('文档 %d 条  →  代码 %d 条' % (len(rows), sum(1 for l in old if l.strip().startswith('{'))))
    for l in difflib.unified_diff(old, new, 'index_template.html(now)', 'from doc', lineterm='', n=0):
        if l.startswith(('---', '+++', '@@')):
            print(l)
    if '--write' in sys.argv:
        io.open(SRC, 'w', encoding='utf-8', newline='\n').write(text[:i] + '\n'.join(new) + text[j + len(END) + 1:])
        print('已写入 %s' % SRC)
    else:
        print('(仅报告。加 --write 才写入。)')


main()
