#!/usr/bin/env python3
# P1「单价腿」候选修法扫描器(§20.13 六;2026-10-13 新增)
# 用 sim/startup_loop.js 的 P1 实验开关跑多组参数,**不改游戏代码**;并行启动,输出对照表 + UTF-8 报告文件。
#
#   python sim/p1_scan.py 30                 # D30 全矩阵(快,看是否回归)
#   python sim/p1_scan.py 90                 # D90 主筛选
#   python sim/p1_scan.py 180 --only BASE,C14   # D180 只跑指定配置
#   python sim/p1_scan.py 90 --jobs 12
#
# 原始输出落 sim/p1_out/<名>_D<天>.log,对照表落 sim/p1_out/report_D<天>.md
# (*.log 与 *.md 都被 .gitignore 忽略,不入库;要留证据就把 report 贴进设计文档)
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
OUT = os.path.join(ROOT, 'sim', 'p1_out')
SEED = 20261006   # 与 startup_loop.js 主流程同种子 ⇒ 各配置逐位可比

# 配置表:名 → (说明, env)
CONFIGS = [
    ('BASE', '基线(零补丁)', {}),
    ('C1a', 'C1 批发递减 K=0.10', {'PRICE_BULK_K': '0.1'}),
    ('C1b', 'C1 批发递减 K=0.30', {'PRICE_BULK_K': '0.3'}),
    ('C2a', 'C2 极价负增长 K=0.30', {'GROW_NEG_K': '0.3'}),
    ('C2b', 'C2 极价负增长 K=0.60', {'GROW_NEG_K': '0.6'}),
    ('C3a', 'C3 道具价随 toolCall K=0.5', {'TRAIN_TC_K': '0.5'}),
    ('C3b', 'C3 道具价随 toolCall K=1.0', {'TRAIN_TC_K': '1.0'}),
    ('C4a', 'C4 信誉愿付溢价 K=0.30', {'TRUST_PRICE_K': '0.3'}),
    ('C4b', 'C4 信誉愿付溢价 K=0.60', {'TRUST_PRICE_K': '0.6'}),
    ('C14', 'C1+C4 组合(0.20 + 0.40)', {'PRICE_BULK_K': '0.2', 'TRUST_PRICE_K': '0.4'}),
    # D30 结果出来后的追加:主打「打跑分(C2)+ 抬诚实(C4)」双臂组合
    ('C24', 'C2+C4 双臂(0.60 + 0.60)', {'GROW_NEG_K': '0.6', 'TRUST_PRICE_K': '0.6'}),
    ('C34', 'C3+C4 双臂(1.0 + 0.60)', {'TRAIN_TC_K': '1.0', 'TRUST_PRICE_K': '0.6'}),
    ('C124', 'C1+C2+C4 三臂(0.2+0.6+0.6)', {'PRICE_BULK_K': '0.2', 'GROW_NEG_K': '0.6', 'TRUST_PRICE_K': '0.6'}),
]

FIELDS = ['刀乐', '局数', 'toolCall', 'capU', 'baseU', '信誉', '已卖M', '容量M', '供给M', '用户', '道具$']


def parse(txt):
    rows = []
    resid = None
    m = re.search(r'残差 ([\d.e+-]+)', txt)
    if m:
        resid = float(m.group(1))
    for line in txt.splitlines():
        if not line.startswith('SUMMARY|'):
            continue
        parts = line.split('|')
        d = {'label': parts[1]}
        for p in parts[2:]:
            for f in FIELDS:
                if p.startswith(f):
                    v = p[len(f):].lstrip('$=').replace('D30', '')
                    try:
                        d[f] = float(v)
                    except ValueError:
                        d[f] = v
        rows.append(d)
    return rows, resid


def one(cfg, days):
    name, desc, env = cfg
    e = dict(os.environ)
    e.update(env)
    e.update({'LIST_POLICY': 'sim', 'DAYS': str(days), 'SUMMARY_ONLY': '1'})
    os.makedirs(OUT, exist_ok=True)
    log = os.path.join(OUT, name + '_D' + str(days) + '.log')
    t0 = time.time()
    with open(log, 'w', encoding='utf-8') as fh:
        rc = subprocess.run(['node', os.path.join('sim', 'startup_loop.js')], cwd=ROOT,
                            env=e, stdout=fh, stderr=subprocess.STDOUT).returncode
    txt = open(log, encoding='utf-8', errors='replace').read()
    rows, resid = parse(txt)
    return {'name': name, 'desc': desc, 'rc': rc, 'sec': round(time.time() - t0),
            'rows': rows, 'resid': resid, 'log': log}


def main():
    lines = []

    def emit(s=''):
        print(s)
        lines.append(s)

    days = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 90
    jobs = 10
    if '--jobs' in sys.argv:
        jobs = int(sys.argv[sys.argv.index('--jobs') + 1])
    only = None
    if '--only' in sys.argv:
        only = set(sys.argv[sys.argv.index('--only') + 1].split(','))
    cfgs = [c for c in CONFIGS if (not only or c[0] in only)]
    emit('== P1 扫描 D%d · %d 配置 · %d 并发 · seed %d ==' % (days, len(cfgs), jobs, SEED))
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=jobs) as ex:
        res = list(ex.map(lambda c: one(c, days), cfgs))
    emit('  总耗时 %ds(各配置耗时:%s)' % (round(time.time() - t0),
        ' '.join(r['name'] + '=' + str(r['sec']) + 's' for r in res)))
    emit()

    for line_kind in (0, 1):
        emit('【' + ('诚实线(不发布)' if line_kind == 0 else '跑分线(每冷却好就发)') + '】')
        emit(' | '.join(['配置', '说明', '刀乐', '道具$', '毛收益', '局数', '已卖M', '用户',
                         '信誉', 'toolCall', 'capU', '供给M']))
        for r in res:
            if r['rc'] != 0 or len(r['rows']) <= line_kind:
                emit('%s | %s | !! rc=%s rows=%d' % (r['name'], r['desc'], r['rc'], len(r['rows'])))
                continue
            d = r['rows'][line_kind]
            g = lambda k: d.get(k, '?')
            gross = (d.get('刀乐', 0) or 0) + (d.get('道具$', 0) or 0)
            emit(' | '.join([r['name'], r['desc'], str(g('刀乐')), str(g('道具$')),
                             '%.2f' % gross, str(g('局数')), str(g('已卖M')),
                             str(g('用户')).replace('.0', ''), str(g('信誉')), str(g('toolCall')),
                             str(g('capU')), str(g('供给M'))]))
        base_run = next((r for r in res if r['name'] == 'BASE' and r['rc'] == 0 and len(r['rows']) > line_kind), None)
        if base_run:
            emit('  —— 诚实÷跑分(同配置两条线毛收益之比;D30/D60/D90/D180 基线 = 1.15/0.88/0.75/0.65):')
            for r in res:
                if r['rc'] != 0 or len(r['rows']) < 2:
                    continue
                h = (r['rows'][0].get('刀乐', 0) or 0) + (r['rows'][0].get('道具$', 0) or 0)
                run = (r['rows'][1].get('刀乐', 0) or 0) + (r['rows'][1].get('道具$', 0) or 0)
                emit('     %-5s 诚实 %8.2f / 跑分 %8.2f = %.3f' % (r['name'], h, run, (h / run) if run else 0))
            browse = (base_run['rows'][1].get('刀乐', 0) or 0)
            emit('  —— 跑分线刀乐相对基线倍数:' + ' '.join(
                '%s=%.2f×' % (r['name'], (r['rows'][1].get('刀乐', 0) or 0) / browse) for r in res
                if r['rc'] == 0 and len(r['rows']) > 1 and browse))
        emit()

    emit('原始输出: sim/p1_out/*.log')
    rep = os.path.join(OUT, 'report_D' + str(days) + '.md')
    os.makedirs(OUT, exist_ok=True)
    open(rep, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    emit('报告文件: ' + rep)


if __name__ == '__main__':
    main()
