#!/usr/bin/env python3
# 一条龙自检:构建(单文件)→ 语法/素材 → 人数/瓶颈断言(42)→ 虚标断言(20)→ 单价腿/保价/P2 断言(92)
#          → 30 天经济仿真 → 构建(dist)。
# 顺序固定、失败即停(后面步骤拿前面产物,跑反了会验到旧文件)。退出码非 0 = 有失败。
#
#   python check_all.py              全跑
#   python check_all.py --skip-sim   跳过 30 天仿真(只改 UI/文案时够用)
#   python check_all.py --skip-dist  跳过 dist 构建
#   DAYS=180 python check_all.py     改仿真天数(默认 30)
import os
import subprocess
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
# 控制台编码兜底:Windows GBK 控制台遇到 ✓ 这类符号会直接 UnicodeEncodeError,统一按 UTF-8 输出
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
SKIP_SIM = "--skip-sim" in sys.argv
SKIP_DIST = "--skip-dist" in sys.argv
DAYS = os.environ.get("DAYS", "30")

STEPS = [
    ("构建(单文件)", [sys.executable, "build.py"], {}),
    ("语法 + 素材自检", ["node", "check_syntax.js"], {}),
    ("断言:人数/瓶颈 42 项", ["node", "sim/verify_users.js"], {}),
    ("断言:虚标 20 项", ["node", "sim/verify_gouge.js"], {}),
    ("断言:单价腿/保价/P2/考试/公关/UI/文案/期待值/说明弹层/预警横幅/发布确认/UI优化 224 项", ["node", "sim/verify_price_legs.js"], {}),
    ("经济仿真(诚实/跑分/平账)", ["node", "sim/startup_loop.js"],
     {"LIST_POLICY": "sim", "DAYS": DAYS, "SUMMARY_ONLY": "1"}),
    ("构建(dist)", [sys.executable, "build.py", "--dist"], {}),
]

failed = []
for name, cmd, extra_env in STEPS:
    if name.startswith("经济仿真") and SKIP_SIM:
        print("[跳过] " + name)
        continue
    if name.startswith("构建(dist)") and SKIP_DIST:
        print("[跳过] " + name)
        continue
    env = dict(os.environ)
    env.update(extra_env)
    print("\n===== " + name + " =====", flush=True)
    rc = subprocess.run(cmd, env=env).returncode
    if rc != 0:
        failed.append(name)
        print("[失败] " + name + " (exit %d)" % rc, flush=True)
        break      # 失败即停:继续只会刷屏
    print("[通过] " + name, flush=True)

print("\n==== 总结 ====")
if failed:
    print("失败:" + "、".join(failed) + " —— 修完重跑 python check_all.py")
    sys.exit(1)
print("全链通过:构建 / 语法 / 286 项断言(42+20+224)/ 30 天仿真 / dist")
