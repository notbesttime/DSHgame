// sim/tune_gouge_scan.js — 层5「虚标罚」的系数标定扫描
//
// 背景：2026-10-12 把层5 的锚从 officialPriceOf(标榜对象) 换成 fairPriceOf(能力相称价)，
//       并加了「相似度闸」+ 把阈值抬到法定上限 + 把压缩从开方改成幂律。两个旋钮：
//         GOUGE_REP_K   — 信誉罚强度（relayRepSettle 里 drop *= 1 + √prem × K）
//         GOUGE_PAY_EXP — 成交折扣的幂指数（relayGougePayMul 里 (法定上限倍数)^(−EXP)）
//
// ★★ 口径警告（2026-10-12 踩过）：
//   SUMMARY 里的「刀乐$」是**现金余额**，不是累计收入。跑分线会花钱买训练道具
//   （源码里美元只有两个出口：卖 token 收入、trainItemPrice 扣款），所以比较收益必须用
//   **刀乐 + 道具$**。只比刀乐会得出「诚实反超」的错误结论（实测：刀乐 1.78 vs 0.82 看着诚实赢，
//   加上道具后是 1.78 vs 9.82，虚标其实赢了 5.5 倍）。
//
// 读表口径：
//   · 跑分线 = sim 内硬编码的「跑分发布」策略（在 similarityTo < SIM_GATE 里挑官价最高的发布），
//     与 LIST_POLICY 无关 ⇒ 任何配置下都是同一条线，可直接横比。
//   · 诚实线 = 不发布、只吃自然流量；标榜由 LIST_POLICY 决定（sim=挑最像的 = 真诚实 archetype；
//     price=挑期望收入最高的 = 「假诚实」：标高价模型但不发布）。
//   · 判定看最后一列 诚实÷跑分：>1 诚实更优（设计目标），≈1 两线持平，<1 虚标仍占优。
//
// 运行：node sim/tune_gouge_scan.js
//       LIST_POLICY=price node sim/tune_gouge_scan.js
//       DAYS=15 CONC=6 node sim/tune_gouge_scan.js      （扫描期砍成本）
const path = require('path');
const { execFile } = require('child_process');

const DAYS = String(process.env.DAYS || 30);
const POLICY = process.env.LIST_POLICY || 'sim';
const CONC = Number(process.env.CONC || 4);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

// 网格：exp=0 关掉成交罚（基线，应复现「虚标压倒诚实」）；0.5 = 换幂律前的开方口径
const GRID = [
  { rep: 2, exp: 0 },      // 基线：只有信誉罚，无成交罚
  { rep: 2, exp: 0.5 },    // 旧开方口径（对照用）
  { rep: 2, exp: 0.75 },   // 当前源码值
  { rep: 2, exp: 1.0 },    // 「只按你实际值的价钱成交」
  { rep: 0, exp: 0.75 },   // 验证信誉罚是否仍是零增量
];

const jobs = GRID.map(g => ({
  ...g,
  id: `rep${g.rep}-exp${g.exp}`,
  env: {
    ...process.env,
    SUMMARY_ONLY: '1',
    LIST_POLICY: POLICY,
    DAYS,
    GOUGE_REP_K: String(g.rep),
    GOUGE_PAY_EXP: String(g.exp),
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
        const cash = Number((p[2] || '').replace('刀乐$', ''));
        const rep = Number((p[7] || '').replace('信誉', ''));
        const spent = Number((p[12] || '').replace('道具$', ''));
        return {
          cash, spent, gross: cash + spent,
          rep, listed: (p[14] || '').replace('标榜=', ''), price: Number((p[15] || '').replace('价$', '')),
        };
      };
      res({ job, honest: pick('诚实线'), bench: pick('跑分线'), err: err && String(stderr || err).slice(0, 300), ms: Date.now() - t0 });
    });
  });
}

(async () => {
  const list = ONLY ? jobs.filter(j => ONLY.includes(j.id)) : jobs;
  console.log(`# 层5 虚标罚扫描  LIST_POLICY=${POLICY}  DAYS=${DAYS}  配置=${list.length}  并发=${CONC}`);
  console.log(`# 收益口径 = 刀乐(现金) + 道具$(已花)  ※ 只比刀乐会误判,见文件头警告`);
  console.log('配置'.padEnd(13) + '| 诚实线(毛收益)'.padEnd(46) + '| 跑分线(毛收益)'.padEnd(46) + '| 诚实÷跑分');
  console.log('-'.repeat(120));
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < list.length) {
      const j = list[idx++];
      const r = await run(j);
      results.push(r);
      const f0 = x => x ? `${x.gross.toFixed(2)}(${x.cash.toFixed(2)}+${x.spent.toFixed(2)})`.padStart(16)
        + ` 信${x.rep.toFixed(0)}`.padEnd(6) + ` ${(x.listed || '-').slice(0, 12)}/$${x.price}` : '—— 失败';
      const ratio = (r.honest && r.bench && r.bench.gross > 0) ? (r.honest.gross / r.bench.gross).toFixed(2) : '—';
      console.log(r.job.id.padEnd(13) + '| ' + f0(r.honest) + ' | ' + f0(r.bench) + ' | ' + ratio
        + (r.err ? '   ⚠' + r.err.split('\n')[0] : ''));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, list.length) }, worker));
  console.log('-'.repeat(120));
  console.log('诚实÷跑分 > 1 = 诚实更优(设计目标);≈ 1 = 两线持平(真正的「两种玩法」);< 1 = 虚标仍占优。');
  console.log(`CPU 合计 ${(results.reduce((s, r) => s + r.ms, 0) / 1000).toFixed(0)}s`);
})();
