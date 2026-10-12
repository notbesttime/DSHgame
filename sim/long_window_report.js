#!/usr/bin/env node
// 长窗口验证结果汇总器（§20.13）
//
// 用法：
//   ① 跑仿真（每个组合会打两条 SUMMARY：诚实线 + 跑分线）：
//        LIST_POLICY=sim DAYS=30  SUMMARY_ONLY=1 node sim/startup_loop.js > <outdir>/simout_d30_sim.txt
//        LIST_POLICY=sim DAYS=60  ...                                     > <outdir>/simout_d60_sim.txt
//   ② 汇总：
//        node sim/long_window_report.js <outdir>
//      <outdir> 省略时取当前工作目录。
//
// ⚠️ 口径铁律（PROJECT.md）：收益 = 刀乐 + 道具$。只看刀乐会得出**相反**结论
// —— 跑分线会把钱砸进训练道具，刀乐余额反而更低。
const fs = require('fs');
const path = require('path');

const POLICIES = ['sim', 'price'];
const DAYSETS = [30, 60, 90, 180];
const base = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

function parseSummary(line) {
  // SUMMARY|标签|刀乐$X|局数N|toolCallN|capUN|baseUN|信誉X|已卖MX|容量MX|供给MX|用户D30=N|道具$X|...
  const seg = line.split('|');
  const get = (prefix, cast) => {
    const s = seg.find(x => x.startsWith(prefix));
    if (s === undefined) return NaN;
    const v = s.slice(prefix.length);
    return cast === 'n' ? Number(v) : v;
  };
  return {
    label: seg[1],
    dollars: Number(String(get('刀乐$')).replace(/[^\d.-]/g, '')),
    items: Number(String(get('道具$')).replace(/[^\d.-]/g, '')),
    toolCall: get('toolCall', 'n'),
    capU: get('capU', 'n'),
    baseU: get('baseU', 'n'),
    rep: get('信誉', 'n'),
    // ⚠️ 源码里这列的标签写死 '用户D30='，但值是最后一天的 rows[rows.length-1].users
    users: get('用户D30=', 'n'),
  };
}

const rows = [];
for (const p of POLICIES) {
  for (const d of DAYSETS) {
    const f = path.join(base, `simout_d${d}_${p}.txt`);
    if (!fs.existsSync(f)) { console.log(`[SKIP] 缺 ${path.basename(f)}`); continue; }
    const lines = fs.readFileSync(f, 'utf8').split('\n').filter(l => l.startsWith('SUMMARY|'));
    for (const l of lines) {
      const s = parseSummary(l);
      s.policy = p; s.days = d;
      s.gross = s.dollars + s.items;
      rows.push(s);
    }
  }
}

console.log('\n=== 长窗口验证汇总（口径 = 刀乐 + 道具$）===\n');
console.log('| 策略 | 天数 | 线 | 刀乐$ | 道具$ | 毛收益 | 用户 | toolCall | capU | baseU | 信誉 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  const wire = /诚实/.test(r.label) ? '诚实' : (/跑分/.test(r.label) ? '跑分' : r.label.slice(0, 6));
  console.log(`| ${r.policy} | D${r.days} | ${wire} | ${r.dollars.toFixed(2)} | ${r.items.toFixed(2)} | **${r.gross.toFixed(2)}** | ${r.users} | ${r.toolCall} | ${r.capU} | ${r.baseU} | ${r.rep.toFixed(1)} |`);
}

console.log('\n=== 诚实 ÷ 跑分（>1 = 诚实经营更划算）===\n');
console.log('| 策略 | ' + DAYSETS.map(d => 'D' + d).join(' | ') + ' |');
console.log('|' + Array(DAYSETS.length + 1).fill('---').join('|') + '|');
for (const p of POLICIES) {
  const pick = (d, w) => rows.find(r => r.policy === p && r.days === d && new RegExp(w).test(r.label));
  const cells = DAYSETS.map(d => {
    const h = pick(d, '诚实'), r = pick(d, '跑分');
    if (!h || !r) return 'n/a';
    const ratio = r.gross > 0 ? (h.gross / r.gross) : Infinity;
    return `${ratio.toFixed(2)}${ratio >= 1 ? ' ✅' : ' ❌'}`;
  });
  console.log(`| ${p} | ${cells.join(' | ')} |`);
}
