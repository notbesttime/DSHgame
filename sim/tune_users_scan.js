// sim/tune_users_scan.js — 「信誉 → 客流」这条链的标定扫描（§20.12）
//
// 要回答的问题：诚实经营攒下来的信誉，到底有没有换成客流？
//   base(客流基数) = 2 + floor(信誉/repDiv) + floor(max(0, 能力分-20)/mcapDiv)
//   cap (并发上限) = floor(2 + toolCall × capK)
//
// ⚠️ 必须**两个旋钮一起扫**：D30 诚实线实测 base 9 > cap 8，base 一直被 cap 钳着，
//    只加基数毫无效果 —— 只扫一个旋钮会得出「信誉不影响客流」的错误结论（§5 的纪律）。
//
// ⚠️ 收益口径 = 刀乐(现金) + 道具$（刀乐只是余额，跑分线会把它砸进训练道具）。见 tune_gouge_scan.js 文件头。
//
// 运行：node sim/tune_users_scan.js          （LIST_POLICY=sim）
//       CONC=4 node sim/tune_users_scan.js
const path = require('path');
const { execFile } = require('child_process');

const DAYS = String(process.env.DAYS || 30);
const POLICY = process.env.LIST_POLICY || 'sim';
const CONC = Number(process.env.CONC || 4);

// repDiv 25 / capK 0.1 = 现状
const GRID = [
  { rep: 25, mcap: 8, cap: 0.10 },   // 现状基线
  { rep: 12, mcap: 8, cap: 0.10 },   // 只提信誉分辨率（预期：纹丝不动 → 证明被 cap 钳住）
  { rep: 25, mcap: 8, cap: 0.20 },   // 只松 cap
  { rep: 12, mcap: 8, cap: 0.20 },   // 一起松
  { rep: 8, mcap: 8, cap: 0.20 },    // 信誉权重再加大
];

const jobs = GRID.map(g => ({
  ...g,
  id: `rep${g.rep}-cap${g.cap}`,
  env: {
    ...process.env,
    SUMMARY_ONLY: '1',
    LIST_POLICY: POLICY,
    DAYS,
    BASE_REP_DIV: String(g.rep),
    BASE_MCAP_DIV: String(g.mcap),
    CAP_K: String(g.cap),
  },
}));

function run(job) {
  return new Promise(res => {
    const t0 = Date.now();
    execFile(process.execPath, [path.join(__dirname, 'startup_loop.js')], {
      env: job.env, maxBuffer: 1 << 24,
    }, (err, stdout, stderr) => {
      const sum = String(stdout || '').split('\n').filter(l => l.startsWith('SUMMARY|'));
      const pick = kw => {
        const l = sum.find(s => s.includes(kw));
        if (!l) return null;
        const p = l.split('|');
        const num = (i, pre) => Number(String(p[i] || '').replace(pre, ''));
        return {
          cash: num(2, '刀乐$'), rep: num(7, '信誉'), sold: num(8, '已卖M'),
          capU: num(5, 'capU'), baseU: num(6, 'baseU'), spent: num(12, '道具$'),
          users: num(11, '用户D30='), gross: num(2, '刀乐$') + num(12, '道具$'),
        };
      };
      res({ job, honest: pick('诚实线'), bench: pick('跑分线'), err: err && String(stderr || err).slice(0, 200), ms: Date.now() - t0 });
    });
  });
}

(async () => {
  console.log(`# 信誉→客流 扫描  LIST_POLICY=${POLICY}  DAYS=${DAYS}  配置=${jobs.length}  并发=${CONC}`);
  console.log('# 口径:毛收益 = 刀乐 + 道具$   ⚠️ base 与 cap 必须一起看,只加 base 会被 cap 钳掉');
  console.log('配置'.padEnd(16) + '| 诚实: 毛收益 信誉 用户 base/cap 已卖M'.padEnd(42) + '| 跑分: 毛收益 用户'.padEnd(22) + '| 诚实÷跑分');
  console.log('-'.repeat(124));
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < jobs.length) {
      const j = jobs[idx++];
      const r = await run(j);
      results.push(r);
      const h = r.honest, b = r.bench;
      const fh = h ? `${h.gross.toFixed(2).padStart(6)} ${h.rep.toFixed(0).padStart(3)} ${String(h.users).padStart(3)} ${h.baseU}/${h.capU} ${h.sold.toFixed(2)}`.padEnd(30) : '失败';
      const fb = b ? `${b.gross.toFixed(2).padStart(6)} ${String(b.users).padStart(3)}`.padEnd(10) : '失败';
      const ratio = (h && b && b.gross > 0) ? (h.gross / b.gross).toFixed(2) : '—';
      console.log(r.job.id.padEnd(16) + '| ' + fh + ' | ' + fb + ' | ' + ratio
        + (r.err ? '  ⚠' + r.err.split('\n')[0] : ''));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, jobs.length) }, worker));
  console.log('-'.repeat(124));
  console.log('读法:① 只提 repDiv(第 1→2 行)若诚实线一动不动 ⇒ 证明 base 被 cap 钳住;');
  console.log('      ② 一起松后(第 4/5 行)若用户/收益才涨 ⇒ 信誉确实能换客流,只是原来被 cap 堵住了。');
})();
