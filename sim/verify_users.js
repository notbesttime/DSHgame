// sim/verify_users.js — 「信誉 → 客流」两条约束(base / cap)的边界与分支验证（不跑 30 天仿真，秒级）
//
// 为什么要有它：2026-10-12 §20.12 把 relayBaseUsers 的信誉除数 25→8、relayUserCap 的系数 0.1→0.2。
// 前者的病根是**信誉项在旧除数下恒为 0**(信誉要攒到 25 才换 1 个客流，而诚实线 D30 只到 20.8)
// —— 一个恒等 0 的项不会报错、不会变慢，只会静默地把「信誉换客流」这条设计整条架空；
// 后者的病根是 **cap 天花板 12 < base 天花板 15 ⇒ base 整条被钳死**，
// 于是「只提信誉分辨率」实测收益 2.09→2.09 一分不动(§20.12 扫描第 1→2 行)。
// 这两处任何一个被改回去都不会报错，只会静默改平衡 ⇒ 必须有断言钉住。
//
// ⚠️ 纪律(见 single-file-js-numeric-verify §5)：base 与 cap 是一对被耦合的约束，
//    只扫其中一个旋钮必然得出「这个旋钮没用」的错误结论。本文件把「两条腿都能成为瓶颈」也断言下来。
//
// 沙箱复用 sim/startup_loop.js 导出的 makeSim（不要另抄抽取清单，见 verify_gouge.js 文件头）。
//
// 运行：node sim/verify_users.js
'use strict';
const { makeSim } = require('./startup_loop');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '   → ' + detail : '')); }
}

const sb = makeSim(20261012);

// ── 沙箱自检 ────────────────────────────────────────────────────────────────
console.log('\n[0] 沙箱自检');
{
  const b = sb.relayBaseUsers(), c = sb.relayUserCap();
  ok('relayBaseUsers 可用且为有限数', Number.isFinite(b), String(b));
  ok('relayUserCap  可用且为有限数', Number.isFinite(c), String(c));
  if (fail) { console.log('\n沙箱没起来，后续断言无意义，直接中止。'); process.exit(1); }
}

// 把 modelCapability 钉成固定值，才能把「信誉项」单独隔离出来看
const setMC = v => { sb.modelCapability = () => v; };
const base = (rep, mc) => { sb.modelCapability = () => mc; sb.state.relay.reputation = rep; return sb.relayBaseUsers(); };
const cap = tc => { sb.state.relay.ability.toolCall = tc; return sb.relayUserCap(); };
// 旧口径复算（只用于「钉住病根」的反向断言，不参与游戏逻辑）
const oldBase = (rep, mc) => 2 + Math.floor(rep / 25) + Math.floor(Math.max(0, mc - 20) / 8);
const oldCap = tc => Math.floor(2 + tc * 0.1);

// ── [1] base 信誉项：除数 8，且不再有「攒不到就恒为 0」的死区 ────────────────
console.log('\n[1] base 信誉项（除数 8，与能力项同分母；门槛与除数都从源码取值，不手抄）');
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index_template.html'), 'utf8');
  const fn = src.slice(src.indexOf('function relayBaseUsers()'), src.indexOf('function relayBaseUsers()') + 400);
  // §17.6(2026-10-16):公式外面包了 userBoost 加成,本体改成 `const base = 2 + ...; return base`。
  // 断言守护的是**公式本体**(除数 8 / 门槛 20 / 分母 8),故兼容两种写法 —— 别为了过测试去改公式。
  const m = fn.match(/(?:return|const base =) 2 \+ Math\.floor\(rep \/ (\d+)\) \+ Math\.floor\(Math\.max\(0, mcap - (\d+)\) \/ (\d+)\)/);
  ok('relayBaseUsers 源码形如 2 + floor(rep/repDiv) + floor(max(0,mcap-门槛)/mcapDiv)',
    !!m, fn.split('\n')[0]);
  if (!m) { console.log('\n公式对不上，后续断言无意义，直接中止。'); process.exit(1); }
  const [repDiv, mcFloor, mcDiv] = [Number(m[1]), Number(m[2]), Number(m[3])];
  ok(`信誉除数 = 8（本次从 25 改过来）`, repDiv === 8, String(repDiv));
  ok(`能力项除数 = 8（本次不动，防误改）`, mcDiv === 8, String(mcDiv));
  ok(`能力门槛 = 20（开局防通胀，本次不动）`, mcFloor === 20, String(mcFloor));

  // 隔离信誉项：能力分取门槛值 ⇒ 能力项恒 0
  const at = rep => base(rep, mcFloor) - 2;   // 只留信誉项
  ok('rep = 0    → 信誉项 0', at(0) === 0, String(at(0)));
  ok('rep = 7.9  → 信誉项 0（floor，未到 8 不给）', at(7.9) === 0, String(at(7.9)));
  ok('rep = 8    → 信誉项 1', at(8) === 1, String(at(8)));
  ok('rep = 16   → 信誉项 2', at(16) === 2, String(at(16)));
  const honestRep = 20.8;  // 诚实线 D30 实测信誉（§20.12 扫描）
  ok(`rep = ${honestRep}（诚实线 D30 实测）→ 信誉项 ${Math.floor(honestRep / 8)}，> 0`,
    at(honestRep) === Math.floor(honestRep / 8) && at(honestRep) > 0, String(at(honestRep)));
  console.log('\n[1b] 反向：钉住「信誉项曾是死项」这个病根');
  ok(`旧除数 25 下 rep = ${honestRep} → 信誉项 ${Math.floor(honestRep / 25)}（恒为 0 ⇒ 攒信誉换不到客流）`,
    Math.floor(honestRep / 25) === 0 && oldBase(honestRep, mcFloor) - 2 === 0,
    String(oldBase(honestRep, mcFloor) - 2));
  ok('正是这一项从 0 变 2，才让「信誉」第一次真的能换客流',
    at(honestRep) - (oldBase(honestRep, mcFloor) - 2) === 2);
}

// ── [2] base 能力项：门槛 20、除数 8（本次不动，防连带回归） ─────────────────
console.log('\n[2] base 能力项（门槛 20 / 除数 8，防误改）');
{
  ok('mcap = 20 → 不加成（含门槛，边界）', base(0, 20) - 2 === 0, String(base(0, 20) - 2));
  ok('mcap = 19 → 不加成（低于门槛）', base(0, 19) - 2 === 0, String(base(0, 19) - 2));
  ok('mcap = 28 → +1', base(0, 28) - 2 === 1, String(base(0, 28) - 2));
  ok('mcap = 60 → +5', base(0, 60) - 2 === 5, String(base(0, 60) - 2));
  ok('开局防通胀：门槛内 base 恒 2（信誉项与能力项都 0）', base(0, 20) === 2, String(base(0, 20)));
}

// ── [3] cap 系数 0.2 ────────────────────────────────────────────────────────
console.log('\n[3] cap（并发上限）系数 0.2');
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index_template.html'), 'utf8');
  const fn = src.slice(src.indexOf('function relayUserCap()'), src.indexOf('function relayUserCap()') + 200);
  const m = fn.match(/\* ([\d.]+)\)/);
  ok('relayUserCap 源码系数 = 0.2（本次从 0.1 改过来）', !!m && Number(m[1]) === 0.2, m && m[1]);
  ok('toolCall = 0   → 2', cap(0) === 2, String(cap(0)));
  ok('toolCall = 5   → 3（开局）', cap(5) === 3, String(cap(5)));
  ok('toolCall = 45  → 11', cap(45) === 11, String(cap(45)));
  ok('toolCall = 100 → 22（天花板）', cap(100) === 22, String(cap(100)));
}

// ── [4] 核心回归：cap 天花板不得再把 base 压死（两条腿都要能成为瓶颈） ──────
console.log('\n[4] 核心回归：cap 天花板 vs base 天花板');
{
  // ⚠️ 信誉是**硬顶 100**（relayRepGain/relayRepSettle 全是 Math.min(100,…)），
  //    所以 base 的真实上限 = 2 + floor(100/8) + floor((100-20)/8) = 2+12+10 = 24。
  //    这里必须用可达值，不能用 rep=200 这种游戏里到不了的数（会算出一条假天花板）。
  const REP_CAP = 100, MC_CAP = 100;
  const baseTop = base(REP_CAP, MC_CAP), capTop = cap(100);
  console.log(`     base 真实天花板(信誉硬顶 100 / 能力分满 100) = ${baseTop}`
    + ` ; cap 天花板(toolCall 100) = ${capTop} ; 旧系数 cap 天花板 = ${oldCap(100)}`);
  console.log(`     旧口径：cap 上限 12 ⇒ base 从 12 往上那半条（信誉项 + 能力项）整条是死的`);
  ok('旧口径复算：cap 天花板 12 < base 天花板 24 ⇒ 病根成立', oldCap(100) === 12 && baseTop === 24,
    `cap ${oldCap(100)} vs base ${baseTop}`);
  ok('新口径：cap 天花板与 base 天花板同量级（差 ≤2，谁先绑定看 build）',
    Math.abs(capTop - baseTop) <= 2, `${capTop} vs ${baseTop}`);
  ok('存在「卡客源」的 build：base < cap（信誉/能力低、工具调用高）',
    base(20.8, 20) < cap(100), `base ${base(20.8, 20)} vs cap ${capTop}`);
  ok('存在「卡并发」的 build：base > cap（信誉/能力高、工具调用低）',
    base(REP_CAP, MC_CAP) > cap(20), `base ${baseTop} vs cap ${cap(20)}`);
}

// ── [5] 开局不变量：实际人数不变（relayUserCap 注释里的承诺，逐日 diff 已验证） ──
console.log('\n[5] 开局不变量：改动不影响开局人数');
{
  const sb2 = makeSim(1);          // 干净沙箱 = INIT 的开局状态
  const R = sb2.state.relay;
  const mc = sb2.modelCapability(R.ability);
  const b = sb2.relayBaseUsers(), c = sb2.relayUserCap();
  const oldC = oldCap(R.ability.toolCall);
  const oldB = oldBase(R.reputation, mc);
  console.log(`     开局:信誉 ${R.reputation} / toolCall ${R.ability.toolCall} / 能力分 ${mc.toFixed(1)}`
    + `  → base ${oldB}→${b} ; cap ${oldC}→${c}`);
  ok('开局信誉项两版都是 0（rep 1 既不到 8 也不到 25）',
    Math.floor(R.reputation / 8) === 0 && Math.floor(R.reputation / 25) === 0);
  ok('开局 base 完全不变（能力分在门槛 20 内 ⇒ 三项全 0）', b === oldB && b === 2, `base ${oldB}→${b}`);
  ok(`开局 cap 从 ${oldC} 升到 ${c}（0.1→0.2 的直接后果）`, oldC === 2 && c === 3);
  ok(`但开局实际人数不变：min(base, cap) = ${Math.min(b, oldC)} → ${Math.min(b, c)}`,
    Math.min(b, oldC) === Math.min(b, c), `${Math.min(b, oldC)} vs ${Math.min(b, c)}`);
}

// ── [6] 瓶颈提示说的「哪条腿」必须与 base/cap 判定一致 ──────────────────────
console.log('\n[6] 瓶颈提示:卡客源 / 卡并发 的方向词与 base/cap 一致');
{
  const R = sb.state.relay;
  const m = sb.TM[0];
  R.listedModel = m.n;
  R.price = sb.officialPriceOf(m) * 0.8;
  R.users = 5;
  sb.state.tokensPerSecond = 1e12;   // 产能 ≫ 需求 ⇒ 走 demand(卡客流)分支,不看产能那条
  R.ability.toolCall = 5;
  R.reputation = 1;
  setMC(4);                          // 能力分压到门槛内

  const b1 = 2, c1 = cap(5);         // base 2 / cap 3
  const bnA = sb.relayBottleneckInfo();
  ok(`base ${b1} ≤ cap ${c1} → 文案说「客源封顶」`,
    !!bnA && bnA.text.includes('客源封顶(' + b1 + '≤' + c1 + ')'), bnA && bnA.text);

  R.reputation = 100;                // 信誉硬顶；base = 2 + 12 + 0 = 14
  R.ability.toolCall = 20;           // cap = 6
  const b2 = base(100, 4), c2 = cap(20);
  const bnB = sb.relayBottleneckInfo();
  ok(`base ${b2} > cap ${c2} → 文案说「并发封顶」`,
    !!bnB && bnB.text.includes('并发封顶(' + c2 + '<' + b2 + ')'), bnB && bnB.text);

  // 单行槽位不放宽度预算:文案不得比被它替换的旧文案长(旧文案 339px / 12px ≈ 28.3 全角当量)
  const fw = s => [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 255 ? 1 : 0.5), 0);
  const oldTxt = '卡客流:需求只用掉产能 12% → 练能力/加用户/调定价才涨收入';
  ok(`新文案不超旧文案宽度:${fw(bnA.text).toFixed(1)} ≤ ${fw(oldTxt).toFixed(1)} 全角当量`,
    fw(bnA.text) <= fw(oldTxt), bnA.text);
  ok('产能利用率三位数时也不超旧文案',
    fw(bnA.text.replace(/产能 \d+%/, '产能 100%')) <= fw(oldTxt));

  // 2026-10-13:瓶颈提示拆两行(390 屏也不溢出)。断言两行制成立,且**每行**都不比旧单行长。
  ok('两行制:第二行存在且非空', typeof bnA.text2 === 'string' && bnA.text2.length > 0, String(bnA.text2));
  ok(`第一行不超旧文案(${fw(bnA.text).toFixed(1)} ≤ ${fw(oldTxt).toFixed(1)})`,
    fw(bnA.text) <= fw(oldTxt), bnA.text);
  ok(`第二行不超旧文案(${fw(bnA.text2).toFixed(1)} ≤ ${fw(oldTxt).toFixed(1)})`,
    fw(bnA.text2) <= fw(oldTxt), bnA.text2);
  // 极端值(产能 100% + 信誉/能力双满 ⇒ 客源封顶(100≤100))也不许超:390 屏可用宽 230px ÷ 12px ≈ 19.2 全角当量
  const hard = bnA.text.replace(/产能 \d+%/, '产能 100%').replace(/\(\d+≤\d+\)/, '(100≤100)');
  ok(`极端值第一行 ≤390 屏可用宽(19.2 全角当量):${fw(hard).toFixed(1)}`,
    fw(hard) <= 19.2, hard);
  // 卡产能那一路同样两行制
  sb.state.relay.price = sb.officialPriceOf(sb.TM[0]) * 0.8;
  sb.state.tokensPerSecond = 0;                 // 产能 0 ⇒ 走 supply 分支
  const bnSup = sb.relayBottleneckInfo();
  ok('卡产能分支也是两行制', !!bnSup && typeof bnSup.text2 === 'string' && bnSup.text2.length > 0,
    bnSup && bnSup.text2);
  ok(`卡产能第一行不超旧文案(${fw(bnSup.text).toFixed(1)} ≤ ${fw(oldTxt).toFixed(1)})`,
    fw(bnSup.text) <= fw(oldTxt), bnSup.text);
  ok(`卡产能第二行不超旧文案(${fw(bnSup.text2).toFixed(1)} ≤ ${fw(oldTxt).toFixed(1)})`,
    fw(bnSup.text2) <= fw(oldTxt), bnSup.text2);
}

console.log('\n' + '─'.repeat(60));
console.log(`结果:${pass} 通过 / ${fail} 失败`);
if (fail) process.exit(1);
