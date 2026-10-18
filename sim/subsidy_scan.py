#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 补贴定价重标扫描器(2026-10-18;§8.1 五「补贴价格公式仍是粗估,D180 数据出来后应重标」)
#
# 背景:补贴价 = max(PR_SUBSIDY_MIN, R.dollars × PR_SUBSIDY_RATE × PR_SUBSIDY_DAYS) Mtok。
# RATE 目前 0.005(D30 剂量曲线拍的),但 §8.1 实测补贴在 D90 反转成 +650% —— 长窗口下
# 补贴可能从「有钱后的保险」变成「钱多的印钞机」。本扫描器沿 p2_scan 协议(≥3 种子均值±sd),
# 扫 RATE 三档 × {D90, D180},同时盯:①跑分线 Δ ②诚实线正交性 ③补贴实际花出去的 M 数。
#
#   python sim/subsidy_scan.py                      # D90+D180 × 3 种子
#   python sim/subsidy_scan.py --days 180 --seeds 3
#   python sim/subsidy_scan.py --only BASE,SUB_R005 # 指定变体
#
# ⚠️ 不要设 P2_EVENT_* ——模板 P2-1(翻车/识破)已落码且默认生效;设了会触发 P2_ACTIVE,
#    把 startup_loop 里**已停用**的 legacy 注入块重新激活 ⇒ 双重生效(§20.15 的老坑)。
#    BASE = 模板原生 P2 + 无公关策略。
# 验收目标(2026-10-18 与重标一起定):D180 补贴 Δ跑分 ∈ [−20%, +25%](有钱后仍值得买,
# 但不是印钞机);D30 保持显著为负(早期别赌,§8.1 的设计意图);诚实线 |Δ| < 1σ(正交)。
import os
import re
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
    ('BASE',     'template P2, no PR (reference)',  {}),
    ('SUB_R005', 'subsidize rate .005 (current)',   {'PR_POLICY': 'subsidize', 'P2_PR_SUBSIDY_RATE': '0.005'}),
    ('SUB_R02',  'subsidize rate .02 (4x)',         {'PR_POLICY': 'subsidize', 'P2_PR_SUBSIDY_RATE': '0.02'}),
    ('SUB_R05',  'subsidize rate .05 (10x)',        {'PR_POLICY': 'subsidize', 'P2_PR_SUBSIDY_RATE': '0.05'}),
]
OUTDIR = ''

NUM = lambda s: float(s) if s is not None else 0.0


def parse(txt):
    """SUMMARY 行是 key+value 直接连写(如 刀乐$1.13|道具$0.50),前缀匹配会串号
    (刀乐$ 会把 "1.13|道具$0.50" 全吞掉) —— 先按 | 切段再精确匹配段头。
    返回 (rows per line) 每行一个 dict。"""
    rows = []
    for line in txt.splitlines():
        if not line.startswith('SUMMARY|'):
            continue
        segs = line.split('|')[2:]
        d = {}
        for seg in segs:
            m = re.match(r'^刀乐\$([-\d.]+)', seg);  d['h_dollar'] = NUM(m.group(1)) if m else d.get('h_dollar')
            m = re.match(r'^道具\$([-\d.]+)', seg);   d['item'] = NUM(m.group(1)) if m else d.get('item')
            m = re.match(r'^P2公关(\d+)/(\d+)', seg); d['pr_ok'] = NUM(m.group(1)) if m else d.get('pr_ok'); d['pr_used'] = NUM(m.group(2)) if m else d.get('pr_used')
            m = re.match(r'^P2补贴M([-\d.]+)', seg);  d['sub_M'] = NUM(m.group(1)) if m else d.get('sub_M')
            m = re.match(r'^P2翻车(\d+)', seg);       d['trig'] = NUM(m.group(1)) if m else d.get('trig')
        d.setdefault('item', 0.0)
        rows.append(d)
    return rows


def one(job):
    vname, env, days, seed = job
    e = dict(os.environ)
    for k in list(e):
        if k.startswith('P2_') or k in ('SIM_SEED', 'PR_POLICY', 'LIST_POLICY', 'DAYS', 'SUMMARY_ONLY'):
            e.pop(k, None)
    e.update(env)
    e.update({'LIST_POLICY': 'sim', 'DAYS': str(days), 'SUMMARY_ONLY': '1', 'SIM_SEED': str(seed)})
    log = os.path.join(OUTDIR, '%s_D%d_s%d.txt' % (vname, days, seed))
    with open(log, 'w', encoding='utf-8') as fh:
        rc = subprocess.run(['node', os.path.join('sim', 'startup_loop.js')], cwd=ROOT, env=e,
                            stdout=fh, stderr=subprocess.STDOUT).returncode
    txt = open(log, encoding='utf-8', errors='replace').read()
    rows = parse(txt)
    if len(rows) < 2 or rc != 0:
        return (vname, days, seed, rc, None)
    h, r = rows[0], rows[1]  # rows[0]=诚实线 rows[1]=跑分线(p2_scan 同款口径)
    gross = lambda d: d.get('h_dollar', 0.0) + d.get('item', 0.0)
    return (vname, days, seed, rc, {'h': gross(h), 'r': gross(r),
            'sub_M': r.get('sub_M', 0.0), 'pr_used': r.get('pr_used', 0.0),
            'trig': r.get('trig', 0.0)})


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
    days = [30, 90, 180]
    nseed, only = 3, None
    if '--days' in argv:
        days = [int(x) for x in argv[argv.index('--days') + 1].split(',')]
    if '--seeds' in argv:
        nseed = int(argv[argv.index('--seeds') + 1])
    if '--only' in argv:
        only = set(argv[argv.index('--only') + 1].split(','))
    seeds = SEEDS0[:max(1, nseed)]
    variants = [v for v in VARIANTS if (not only or v[0] in only)]
    OUTDIR = os.path.join(ROOT, 'sim', 'scan_out', time.strftime('sub_%Y%m%d_%H%M%S'))
    os.makedirs(OUTDIR, exist_ok=True)
    jobs = [(n, env, d, s) for (n, _ds, env) in variants for d in days for s in seeds]
    print('== 补贴定价扫描:%d 变体 × %d 窗口 × %d 种子 = %d 跑 ==' % (len(variants), len(days), len(seeds), len(jobs)))
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=min(len(jobs), 10)) as ex:
        res = list(ex.map(one, jobs))
    print('  耗时 %ds,原始输出 sim/scan_out/%s' % (round(time.time() - t0), os.path.basename(OUTDIR)))
    for d in days:
        print('\n【D%d】(3 种子均值;跑分线毛收益=刀乐+道具$)' % d)
        print('%-10s | %8s %8s | %8s %8s | %7s | 补贴M 公关次数 翻车' % ('变体', '诚实', '诚实sd', '跑分', '跑分sd', 'Δ跑分'))
        gb = [x for x in res if x[0] == 'BASE' and x[1] == d and x[4]]
        base_r = mean([x[4]['r'] for x in gb]) if gb else 0.0
        sdr = sd([x[4]['r'] for x in gb]) or 0.01
        for (n, desc, _e) in variants:
            got = [x for x in res if x[0] == n and x[1] == d and x[4]]
            if not got:
                print('%-10s | 缺' % n); continue
            hr = [x[4]['r'] for x in got]; hh = [x[4]['h'] for x in got]
            dr = mean(hr) - base_r
            pct = ('%+.1f%%' % (dr / base_r * 100)) if base_r else 'n/a'
            print('%-10s | %8.2f %8.2f | %8.2f %8.2f | %7s | %6.1f %5.0f %6.0f' % (
                n, mean(hh), sd(hh), mean(hr), sd(hr), pct,
                mean([x[4]['sub_M'] for x in got]), mean([x[4]['pr_used'] for x in got]),
                mean([x[4]['trig'] for x in got])))
        print('  跑分基线跨种子 sd=%.2f(|Δ|<1σ 视为无差别)' % sdr)
    print('\n判读:① BASE D90 跑分须 ≈ §17.7 基线 16.05(首种子)/多种子均值看 sd;'
          '\n      ② SUB 变体诚实线 Δ 应 ≈ 0(诚实不吃公关)——否则扫描器污染了基线;'
          '\n      ③ 选档标准:D180 Δ跑分 ∈ [−20%,+25%] 且 补贴M > 0(真金白银在流动,不是买不起形同关闭)。')


if __name__ == '__main__':
    main()
