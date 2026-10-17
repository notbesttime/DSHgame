#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
考试文案池扫描器(§17.8)
========================
读《考试文案池.md》(用户手改),把池 A–O 的内心戏与池 P 的提示卡同步进 index_template.html。

用法:
    python sync_exam_text.py           # 扫描 + 写入模板
    python sync_exam_text.py --check   # 只报告,不写

扫描规则(与文档顶部的说明一致):
  · 池标题行  ### 池 X:说明   ⇒ 切换当前池(池 P 走提示卡格式)
  · 条目行    - 文案            ⇒ 普通条目;行首 "- [x] " 表示禁用,跳过
  · 提示卡    - [prefix][attr] 文案  ⇒ 仅池 P;prefix ∈ inspire/material/phrase/exam
                                        attr ∈ reasoning/knowledge/instruct/longCtx/toolCall/multimodal/speed
  · 含 "//" 的尾部注释会被剥掉(不写进游戏)
  · 以 ">" 开头的引用块、以及 "---" 分隔线、代码块内内容一律跳过
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DOC = os.path.join(ROOT, '考试文案池.md')
TPL = os.path.join(ROOT, 'index_template.html')

# 池字母 → 游戏内键(题型 × 对错)
POOL_KEYS = {
    'A': 'reasoning_ok',  'B': 'reasoning_bad',
    'C': 'knowledge_ok',  'D': 'knowledge_bad',
    'E': 'instruct_ok',   'F': 'instruct_bad',
    'G': 'longCtx_ok',    'H': 'longCtx_bad',
    'I': 'toolCall_ok',   'J': 'toolCall_bad',
    'K': 'multimodal_ok', 'L': 'multimodal_bad',
    'M': 'speed_ok',      'N': 'speed_bad',
    'O': '_general',      # 通用自嘲:任意场景可抽
}
PREFIXES = {'inspire': '灵感', 'material': '素材', 'phrase': '金句', 'exam': '考点'}
ATTRS = {'reasoning', 'knowledge', 'instruct', 'longCtx', 'toolCall', 'multimodal', 'speed'}


def parse():
    """返回 (think: {key: [文案]}, hints: [{prefix, attr, text}])"""
    if not os.path.exists(DOC):
        print('!! 找不到 %s' % DOC)
        sys.exit(1)
    think, hints = {}, []
    cur = None          # 当前池键(或 'P')
    in_fence = False
    for raw in io.open(DOC, encoding='utf-8').read().split('\n'):
        line = raw.rstrip()
        if line.startswith('```'):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        # 池标题:### 池 A:推理题 · 答对
        m = re.match(r'^###\s*池\s*([A-P])\s*[:：]', line)
        if m:
            letter = m.group(1)
            cur = 'P' if letter == 'P' else POOL_KEYS.get(letter)
            if cur and cur != 'P':
                think.setdefault(cur, [])
            continue
        # 其它 ### 标题 ⇒ 退出当前池(如「## 二、…」下面还有 ### 池 P)
        if line.startswith('## ') and not line.startswith('### '):
            continue
        if not line.startswith('- ') or cur is None:
            continue
        if line.startswith('- [x] ') or line.startswith('- [X] '):
            continue                      # 用户禁用
        body = line[2:].strip()
        body = re.sub(r'\s*//.*$', '', body).strip()   # 去尾部注释
        if not body:
            continue
        if cur == 'P':
            m2 = re.match(r'^\[(\w+)\]\s*\[(\w+)\]\s*(.+)$', body)
            if not m2:
                continue                  # 池 P 格式不对 ⇒ 跳过(不静默写坏)
            pf, attr, text = m2.group(1), m2.group(2), m2.group(3).strip()
            if pf not in PREFIXES or attr not in ATTRS:
                continue
            hints.append({'prefix': PREFIXES[pf], 'attr': attr, 'text': text})
        else:
            think.setdefault(cur, []).append(body)
    return think, hints


def render(think, hints):
    """生成两段 JS:EXAM_THINK(内心戏)与 EXAM_HINTS(提示卡)"""
    lines = ['const EXAM_THINK = {']
    for k in sorted(think):
        arr = think[k]
        if not arr:
            continue
        lines.append('  ' + k + ': [')
        for t in arr:
            lines.append('    ' + js_str(t) + ',')
        lines.append('  ],')
    lines.append('};')
    js1 = '\n'.join(lines)

    lines = ['const EXAM_HINTS = [']
    for h in hints:
        lines.append("  { key: '%s', label: '%s:', text: %s }," % (h['attr'], h['prefix'], js_str(h['text'])))
    lines.append('];')
    js2 = '\n'.join(lines)
    return js1, js2


def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"


def main():
    check_only = '--check' in sys.argv
    think, hints = parse()
    n_think = sum(len(v) for v in think.values())
    print('扫描结果:内心戏 %d 条(池 %d 个)· 提示卡 %d 条' % (n_think, len([k for k in think if think[k]]), len(hints)))
    for k in sorted(think):
        if think[k]:
            print('   %-16s %d 条' % (k, len(think[k])))
    if not n_think and not hints:
        print('!! 没扫到任何条目,检查文档格式(池标题与 "- " 条目)')
        sys.exit(1)
    if check_only:
        return
    js1, js2 = render(think, hints)
    src = io.open(TPL, encoding='utf-8').read()
    # 替换两个标记块之间的内容(首次运行会自动补标记)
    src = replace_block(src, 'EXAM_THINK_BEGIN', 'EXAM_THINK_END', js1)
    src = replace_block(src, 'EXAM_HINTS_BEGIN', 'EXAM_HINTS_END', js2)
    io.open(TPL, 'w', encoding='utf-8', newline='\n').write(src)
    print('已写入 index_template.html(记得 python build.py)')


def replace_block(src, begin, end, body):
    marker_b = '/* ' + begin + ' */'
    marker_e = '/* ' + end + ' */'
    if marker_b in src and marker_e in src:
        i = src.index(marker_b) + len(marker_b)
        j = src.index(marker_e)
        return src[:i] + '\n' + body + '\n' + src[j:]
    print('!! 模板里没有 %s 标记,跳过替换(需先手动加标记)' % begin)
    return src


if __name__ == '__main__':
    main()
