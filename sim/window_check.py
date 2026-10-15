#!/usr/bin/env python3
# 四窗口复核器(2026-10-13 起,取代已下线的 sim/p1_scan.py)
# 并行跑 startup_loop 的多个天数窗口,写 simout_d<天>_<策略>.txt(兼容 long_window_report.js 口径),
# 并直接打印「诚实÷跑分」比值表。改中转站数值前后各跑一次,看四档有没有漂。
#
#   python sim/window_check.py                 # D30/D60/D90/D180 × sim 策略(默认)
#   python sim/window_check.py 30 90           # 只跑指定窗口
#   python sim/window_check.py 90 --policy price
#   DAYS=180 python check_all.py               # 自检链可改仿真天数
#
# 产物落 sim/scan_out/<时间戳>/(已被 .gitignore 忽略);报告数字手抄进《中转站设计.md》。
# 也可用 node sim/long_window_report.js sim/scan_out/<时间戳> 看它那份汇总表。
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


def parse(txt):
    rows = {}
    resid = []
    for line in txt.splitlines():
        if line.startswith('SUMMARY|'):
            parts = line.split('|')
            d = {}
            for p in parts[2:]:
                # 值可能带 $ 前缀(如 刀乐$0.03),先剔掉非数字再转
                m = re.match(r'^(刀乐|道具\$|局数|已卖M|信誉)(.+)$', p)
                if m:
                    try:
                        d[m.group(1)] = float(m.group(2).replace('$', ''))
                    except ValueError:
                        pass
            rows[parts[1]] = d
        m = re.search(r'残差 ([-\d.e+]+)', line)
        if m:
            resid.append(float(m.group(1)))
    return rows, resid


def run(days, policy):
    e = dict(os.environ)
    e.update({'LIST_POLICY': policy, 'DAYS': str(days), 'SUMMARY_ONLY': '1'})
    out = os.path.join(OUTDIR, 'simout_d%d_%s.txt' % (days, policy))
    with open(out, 'w', encoding='utf-8') as fh:
        rc = subprocess.run(['node', os.path.join('sim', 'startup_loop.js')], cwd=ROOT,
                            env=e, stdout=fh, stderr=subprocess.STDOUT).returncode
    txt = open(out, encoding='utf-8', errors='replace').read()
    return days, policy, rc, txt


def main():
    global OUTDIR
    days_list = [int(x) for x in sys.argv[1:] if x.isdigit()] or [30, 60, 90, 180]
    policies = ['sim']
    if '--policy' in sys.argv:
        policies = [sys.argv[sys.argv.index('--policy') + 1]]
    elif '--both' in sys.argv:
        policies = ['sim', 'price']
    OUTDIR = os.path.join(ROOT, 'sim', 'scan_out', time.strftime('%Y%m%d_%H%M%S'))
    os.makedirs(OUTDIR, exist_ok=True)
    jobs = [(d, p) for p in policies for d in days_list]
    print('== 四窗口复核:%s · 策略 %s ==' % (days_list, policies))
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=len(jobs)) as ex:
        res = list(ex.map(lambda a: run(*a), jobs))
    print('  耗时 %ds,输出目录 sim/scan_out/%s' % (round(time.time() - t0), os.path.basename(OUTDIR)))
    for p in policies:
        print('\n【策略 %s】诚实 ÷ 跑分(毛收益 = 刀乐 + 道具$)' % p)
        for d in days_list:
            r = next((x for x in res if x[0] == d and x[1] == p), None)
            if not r:
                continue
            rows, resid = parse(r[3])
            keys = list(rows.keys())
            if len(keys) < 2 or r[2] != 0:
                print('  D%-3d !! rc=%s' % (d, r[2]))
                continue
            h = rows[keys[0]]
            ru = rows[keys[1]]
            hg = h.get('刀乐', 0) + h.get('道具$', 0)
            rg = ru.get('刀乐', 0) + ru.get('道具$', 0)
            print('  D%-3d 诚实 %8.2f / 跑分 %8.2f = %.3f   (已卖 %.1fM/%.1fM 局数 %s/%s 信誉 %.1f/%.1f 残差 %s)'
                  % (d, hg, rg, (hg / rg) if rg else 0,
                     h.get('已卖M', 0), ru.get('已卖M', 0),
                     h.get('局数', 0), ru.get('局数', 0),
                     h.get('信誉', 0), ru.get('信誉', 0),
                     ('%.2e' % max(abs(x) for x in resid)) if resid else '?'))


if __name__ == '__main__':
    main()
