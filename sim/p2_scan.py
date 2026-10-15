#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# P2 随机机制扫描器(2026-10-14;协议依据《P2风险玩法备料.md》§7.4)
#
# 为什么必须有它:冒烟实测证明「单种子的随机机制对照不可用」—— 事件/热点一旦触发,
# 后续信誉/客流/发布节奏全部改道,结果被「这一局运气」主导(CAP 变大时跑分收益
# 在 1.83/2.39/2.13 之间跳,非单调)。故本工具固定按【多种子取均值 + 标准差】出表。
#
#   python sim/p2_scan.py                          # D30 × 3 种子 × 全变体
#   python sim/p2_scan.py --days 30,90 --seeds 3   # 多窗口
#   python sim/p2_scan.py --only BASE,EV,EV_POOL   # 指定变体
#
# 原始输出落 sim/scan_out/p2_<时间戳>/(*.txt 已被 gitignore)。变体改 VARIANTS 一处。
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEEDS0 = [20261006, 20261007, 20261008]

VARIANTS = [
    ('BASE',    'all-off(should = 20.14 baseline)', {}),
    ('EV',      'P2-1 event, prob-based CAP .35', {'P2_EVENT_K': '2.0', 'P2_EVENT_CAP': '0.35'}),
    ('EV_POOL', 'P2-1 + pool discount .5', {'P2_EVENT_K': '2.0', 'P2_EVENT_CAP': '0.35', 'P2_EVENT_POOL_MUL': '0.5'}),
    ('POOL_70', 'pool discount .70 (milder)', {'P2_EVENT_K': '2.0', 'P2_EVENT_CAP': '0.35', 'P2_EVENT_POOL_MUL': '0.7'}),
    ('POOL_85', 'pool discount .85 (mildest)', {'P2_EVENT_K': '2.0', 'P2_EVENT_CAP': '0.35', 'P2_EVENT_POOL_MUL': '0.85'}),
    ('HEAT',    'P2-3 heat, symmetric muls', {'P2_HEAT': '1'}),
    ('ST',      'P2-4 stealth 0.7', {'P2_STEALTH_K': '0.7'}),
    ('EV_PR',   'P2-1 + PR best_ev', {'P2_EVENT_K': '2.0', 'P2_EVENT_CAP': '0.35', 'P2_PR_POLICY': 'best_ev'}),
]
KEYS = ('刀乐$', '道具$', '已卖M', '信誉', 'P2翻车', 'P2识破', 'P2热点')
OUTDIR = ''


def parse(line):
    d = {}
    for seg in line.split('|')[2:]:
        for k in KEYS:
            if seg.startswith(k):
                try:
                    d[k] = float(seg[len(k):].replace('$', ''))
                except ValueError:
                    pass
    return d


def one(job):
    vname, env, days, seed = job
    e = dict(os.environ)
    for k in list(e):
        if k.startswith('P2_') or k == 'SIM_SEED':
            e.pop(k, None)
    e.update(env)
    e.update({'LIST_POLICY': 'sim', 'DAYS': str(days), 'SUMMARY_ONLY': '1', 'SIM_SEED': str(seed)})
    log = os.path.join(OUTDIR, '%s_D%d_s%d.txt' % (vname, days, seed))
    with open(log, 'w', encoding='utf-8') as fh:
        rc = subprocess.run(['node', os.path.join('sim', 'startup_loop.js')], cwd=ROOT, env=e,
                            stdout=fh, stderr=subprocess.STDOUT).returncode
    txt = open(log, encoding='utf-8', errors='replace').read()
    rows = [parse(l) for l in txt.splitlines() if l.startswith('SUMMARY|')]
    if len(rows) < 2 or rc != 0:
        return (vname, days, seed, rc, None)
    g = lambda d: d.get('刀乐$', 0.0) + d.get('道具$', 0.0)
    return (vname, days, seed, rc, {'h': g(rows[0]), 'r': g(rows[1]),
            'trig': rows[0].get('P2翻车', 0) + rows[1].get('P2翻车', 0),
            'det': rows[0].get('P2识破', 0) + rows[1].get('P2识破', 0)})


def mean(a):
    return sum(a) / len(a) if a else 0.0


def sd(a):
    if len(a) < 2:
        return 0.0
    m = mean(a)
    return (sum((x - m) ** 2 for x in a) / (len(a) - 1)) ** 0.5


def main():
    global OUTDIR
    argv = sys.argv[1:]
    days = [30]
    nseed, only = 3, None
    if '--days' in argv:
        days = [int(x) for x in argv[argv.index('--days') + 1].split(',')]
    if '--seeds' in argv:
        nseed = int(argv[argv.index('--seeds') + 1])
    if '--only' in argv:
        only = set(argv[argv.index('--only') + 1].split(','))
    seeds = SEEDS0[:max(1, nseed)]
    variants = [v for v in VARIANTS if (not only or v[0] in only)]
    OUTDIR = os.path.join(ROOT, 'sim', 'scan_out', time.strftime('p2_%Y%m%d_%H%M%S'))
    os.makedirs(OUTDIR, exist_ok=True)
    jobs = [(n, env, d, s) for (n, _ds, env) in variants for d in days for s in seeds]
    print('== P2 扫描:%d 变体 × %d 窗口 × %d 种子 = %d 跑 ==' % (len(variants), len(days), len(seeds), len(jobs)))
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=min(len(jobs), 10)) as ex:
        res = list(ex.map(one, jobs))
    print('  耗时 %ds,原始输出 sim/scan_out/%s' % (round(time.time() - t0), os.path.basename(OUTDIR)))
    for d in days:
        print('\n【D%d】毛收益=刀乐+道具$(%d 种子均值;比值sd = 跨种子离散度)' % (d, len(seeds)))
        print('%-9s | %-34s | %8s %8s | %7s %7s | 机制' % ('变体', '说明', '诚实', '跑分', '比值', '比值sd'))
        for (n, desc, _e) in variants:
            got = [x for x in res if x[0] == n and x[1] == d and x[4]]
            if len(got) < len(seeds):
                print('%-9s | %-34s | 只成功 %d/%d 跑' % (n, desc, len(got), len(seeds)))
                continue
            hs = [x[4]['h'] for x in got]
            rs = [x[4]['r'] for x in got]
            ratios = [a / b for a, b in zip(hs, rs) if b]
            mech = ' '.join('%s=%s' % (k, round(mean([x[4][k] for x in got]), 1)) for k in ('trig', 'det')
                            if mean([x[4][k] for x in got]) > 0) or '—'
            print('%-9s | %-34s | %8.2f %8.2f | %7.3f %7.3f | %s' % (
                n, desc, mean(hs), mean(rs), mean(ratios), sd(ratios), mech))
        gb = [x for x in res if x[0] == 'BASE' and x[1] == d and x[4]]
        if len(gb) >= 2:
            sdr = sd([x[4]['r'] for x in gb]) or 0.01
            print('  vs BASE(跑分基线跨种子 sd=%.2f;|σ|<1 视为无差别):' % sdr)
            for (n, _desc, _e) in variants:
                if n == 'BASE':
                    continue
                got = [x for x in res if x[0] == n and x[1] == d and x[4]]
                if len(got) < 2:
                    continue
                dh = mean([x[4]['h'] for x in got]) - mean([x[4]['h'] for x in gb])
                dr = mean([x[4]['r'] for x in got]) - mean([x[4]['r'] for x in gb])
                print('    %-9s Δ诚实=%+6.2f  Δ跑分=%+6.2f (%+.1fσ)' % (n, dh, dr, dr / sdr))
    print('\n判读:① **首种子(SEEDS0[0])的 BASE** 须 = §20.14 逐位(1.617@D30)——均值是另一统计量,不能用来自证没污染;'
          '\n      ② HEAT 落在基线 σ 内 ⇒ 期望对称验收通过;'
          '\n      ③ 池打折要「咬得住又不打死」:Δ跑分 显著为负(>|1σ|)且跑分线仍 ≥ 基线 40%(§20.14 验收第 3 条)。')


if __name__ == '__main__':
    main()
