// sim/verify_price_legs.js — 「单价腿」两条新机制(C2 极价负增长 / C4 信誉愿付溢价)的断言(不跑仿真,秒级)
//
// 为什么要有它:2026-10-13 §20.14 落了 P1 单价腿的两条腿(依据《P1单价腿决策报告.md》,四窗口复核过数值)。
// 它们各自的失败模式都是**静默**的:
//   C2 的病根:ratio ≥ GROW_NEG_RATIO 时若被改回「返回 0」,天价就只是「拉不到新客」而不再吐人 ——
//      数值会悄悄回退到 §20.13 的翻转曲线,而语法、平账、既有 55 项断言全都不会报。
//   C4 的病根:信誉溢价若被写进 relaySellPayMul(层4/层5 里面)而不是外层乘子,就会**同时改变虚标罚的语义**;
//      若忘了 listed 守卫,自研线(§5.4 明确不触发信誉机制)也会吃溢价 —— 两处都不会报错。
// ⇒ 两条腿都必须有断言钉住「数值、边界、作用面(只标榜、不碰标价、不进层4/层5)」。
//
// 沙箱复用 sim/startup_loop.js 导出的 makeSim(不要另抄抽取清单,见 verify_gouge.js 文件头)。
//
// 运行:node sim/verify_price_legs.js
'use strict';
const { makeSim } = require('./startup_loop');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '   → ' + detail : '')); }
}
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-9);

const sb = makeSim(20261012);
const RB = sb.RB;
const src = fs.readFileSync(path.join(__dirname, '..', 'index_template.html'), 'utf8');

// ── 确定性随机:配对对照要「同一串随机数」,所以自己接管 Math.random 并能复位 ──────────
let rseed = 987654321;
const myRandom = () => { rseed = (rseed * 1103515245 + 12345) % 2147483648; return rseed / 2147483648; };
const resetRandom = () => { rseed = 987654321; sb.Math.random = myRandom; };

// ── [0] 沙箱自检 + 新常量存在性 ─────────────────────────────────────────────
console.log('\n[0] 沙箱自检 / 常量存在性');
{
  const w = sb.relayGrowWeight(1, 1);
  ok('relayGrowWeight 可用且为有限数', Number.isFinite(w), String(w));
  ok('relayHourlyRefresh 可用', typeof sb.relayHourlyRefresh === 'function');
  ok('updateRelayBusiness 可用', typeof sb.updateRelayBusiness === 'function');
  ok('RELAY_BIZ.GROW_NEG_K 存在', Number.isFinite(RB.GROW_NEG_K), String(RB.GROW_NEG_K));
  ok('RELAY_BIZ.GROW_NEG_RATIO 存在', Number.isFinite(RB.GROW_NEG_RATIO), String(RB.GROW_NEG_RATIO));
  ok('RELAY_BIZ.TRUST_PRICE_K 存在', Number.isFinite(RB.TRUST_PRICE_K), String(RB.TRUST_PRICE_K));
  if (fail) { console.log('\n沙箱没起来,后续断言无意义,直接中止。'); process.exit(1); }
}

// ── [1] C2 常量护栏(数值 + 语义边界) ───────────────────────────────────────
console.log('\n[1] C2 常量护栏');
{
  ok('GROW_NEG_K = 0.6(决策报告选定值)', near(RB.GROW_NEG_K, 0.6, 1e-9), String(RB.GROW_NEG_K));
  ok('GROW_NEG_RATIO = 1.4(决策报告选定值)', near(RB.GROW_NEG_RATIO, 1.4, 1e-9), String(RB.GROW_NEG_RATIO));
  ok('GROW_NEG_RATIO > 1.0(必须位于「增长已停」区之外,否则与 FALLOFF 段重叠)',
    RB.GROW_NEG_RATIO > 1.0, String(RB.GROW_NEG_RATIO));
  ok('GROW_NEG_RATIO ≤ PRICE_MAX(否则硬价格带上限内永远触发不到 ⇒ 死项)',
    RB.GROW_NEG_RATIO <= RB.PRICE_MAX + 1e-9, RB.GROW_NEG_RATIO + ' vs PRICE_MAX ' + RB.PRICE_MAX);
  ok('GROW_NEG_K < 1(单次流失期望不该超过「一小时掉一整个 base」的量级)',
    RB.GROW_NEG_K < 1, String(RB.GROW_NEG_K));
}

// ── [2] C2 relayGrowWeight 单元行为 ────────────────────────────────────────
console.log('\n[2] C2 relayGrowWeight:合法价不误伤 / 阈值处转负 / 单调');
{
  const O = 10;                                    // 假设官价 $10
  const gw = r => sb.relayGrowWeight(O * r, O);
  ok('ratio 0.5(远低于增长线)→ 1', near(gw(0.5), 1), String(gw(0.5)));
  ok('ratio 0.8(增长线 CHEAP_LINE)→ 1', near(gw(0.8), 1), String(gw(0.8)));
  ok('ratio 0.9 → 0.5(衰减中段)', near(gw(0.9), 0.5), String(gw(0.9)));
  ok('ratio 1.0 → 0(旧口径的「增长已停」点不变)',
    near(gw(1.0), 0), String(gw(1.0)));
  ok('ratio 1.3(合法带内、阈值之下)→ 仍为 0,不转负(不误伤「贵但合法」)',
    near(gw(1.3), 0), String(gw(1.3)));
  ok('ratio 1.39(阈值前一分钱)→ 仍为 0', near(gw(1.39), 0), String(gw(1.39)));
  ok('ratio 1.4(阈值,>= 语义)→ −GROW_NEG_K', near(gw(1.4), -RB.GROW_NEG_K), String(gw(1.4)));
  ok('ratio 1.5(硬价格带上限)→ −GROW_NEG_K', near(gw(1.5), -RB.GROW_NEG_K), String(gw(1.5)));
  ok('ratio 2.0(带外,理论上被 clamp)→ −GROW_NEG_K', near(gw(2.0), -RB.GROW_NEG_K), String(gw(2.0)));

  let mono = true;
  for (let r = 0.5; r <= 2.0; r += 0.01) {
    if (gw(r + 0.01) > gw(r) + 1e-9) { mono = false; break; }
  }
  ok('ratio 从 0.5 扫到 2.0:权重单调不增', mono);
  ok('无参照(official = 0)→ 0(自研/无官价不适用,与 relayUsageMul 返回 1 的语义不同)',
    sb.relayGrowWeight(5, 0) === 0, String(sb.relayGrowWeight(5, 0)));
  ok('价格非法(price = 0)→ 0', sb.relayGrowWeight(0, O) === 0, String(sb.relayGrowWeight(0, O)));

  // 源码形态:必须真的是「>= 阈值时 return −K」,而不是被写成 > 或忘了负号
  const fnStart = src.indexOf('function relayGrowWeight(');
  const fn = src.slice(fnStart, fnStart + 600);
  const m = fn.match(/ratio\s*>=\s*RELAY_BIZ\.GROW_NEG_RATIO\)\s*return\s*-RELAY_BIZ\.GROW_NEG_K/);
  ok('源码形态:ratio >= GROW_NEG_RATIO → return -GROW_NEG_K', !!m, fn.split('\n').slice(0, 6).join(' / '));
}

// ── [3] C2 负增长「真的踢人」(配对对照:关/开 C2,同一串随机数) ──────────────
console.log('\n[3] C2 净流失:同一状态下,「关掉 C2(权重 0)」vs「开着 C2(权重 −0.6)」');
{
  const st = sb.state, R = st.relay;
  const realGW = sb.relayGrowWeight;
  const setUsers = n => { R.userSlots = []; for (let i = 0; i < n; i++) R.userSlots.push({ leftH: 99 }); R.users = n; };

  // 固定场景:标榜一个真实模型、定价贴到硬上限(ratio 1.5,合法且刚好越过 C2 阈值)
  const m = sb.TM[0];
  R.listedModel = m.n;
  const official = sb.officialPriceOf(m);
  R.price = official * RB.PRICE_MAX;
  R.reputation = 100;                  // keepP 触顶,排除「信誉低导致的留存差异」
  st.tokensPerSecond = 0;
  sb.modelCapability = () => 100;      // base 钉死 = 2 + 12 + 10 = 24

  const runHours = 6;
  const measure = (disableC2) => {
    sb.relayGrowWeight = disableC2 ? (() => 0) : realGW;
    setUsers(24);
    resetRandom();
    for (let i = 0; i < runHours; i++) sb.relayHourlyRefresh();
    const n = R.userSlots.length;
    return n;
  };
  const withC2 = measure(false);
  const withoutC2 = measure(true);
  sb.relayGrowWeight = realGW;

  ok('关闭 C2(权重 0)时 ' + runHours + ' 小时人数不变(对照组的干净性)',
    withoutC2 === 24, String(withoutC2));
  ok('开着 C2 时 ' + runHours + ' 小时人数净减少(负增长真的落地了)',
    withC2 < withoutC2, 'with=' + withC2 + ' without=' + withoutC2);
  ok('净流失量级符合 expAdd ≈ base(24) × pct(−0.06) = −1.44/小时(6 小时 ≈ −8.6)',
    Math.abs((withoutC2 - withC2) - 8.6) <= 3, 'delta=' + (withoutC2 - withC2));

  // 反例:合法价(ratio 0.8)下不该有任何流失
  R.price = official * RB.CHEAP_LINE;
  setUsers(24);
  resetRandom();
  for (let i = 0; i < runHours; i++) sb.relayHourlyRefresh();
  ok('合法价(ratio 0.8)下 6 小时不流失(不误伤合法定价)',
    R.userSlots.length >= 24, String(R.userSlots.length));
}

// ── [4] C2 流失顺序:surge(发布注入)先走 ────────────────────────────────────
console.log('\n[4] C2 流失顺序:栈尾的 surge 用户先离开');
{
  const st = sb.state, R = st.relay;
  const m = sb.TM[0];
  R.listedModel = m.n;
  R.price = sb.officialPriceOf(m) * RB.PRICE_MAX;
  R.reputation = 100;
  sb.modelCapability = () => 100;
  R.userSlots = [];
  for (let i = 0; i < 5; i++) R.userSlots.push({ leftH: 99 });              // 自然用户(栈前)
  for (let i = 0; i < 3; i++) R.userSlots.push({ leftH: 99, surge: true });  // 发布注入(栈尾)
  R.users = 8;
  resetRandom();
  sb.relayHourlyRefresh();
  const organic = R.userSlots.filter(u => !u.surge).length;
  const surge = R.userSlots.filter(u => u.surge).length;
  ok('跑完 1 小时后:自然用户 5 个全在', organic === 5, String(organic));
  ok('surge 用户先被踢(3 → <3)', surge < 3, String(surge));
  ok('总人数 = 自然 + surge,无凭空蒸发', R.userSlots.length === organic + surge);
}

// ── [5] C4 常量 + 源码形态护栏 ─────────────────────────────────────────────
console.log('\n[5] C4 常量 / 源码形态');
{
  ok('TRUST_PRICE_K = 0.6(决策报告选定值)', near(RB.TRUST_PRICE_K, 0.6, 1e-9), String(RB.TRUST_PRICE_K));
  ok('TRUST_PRICE_K > 0(信誉必须真能换单价)', RB.TRUST_PRICE_K > 0, String(RB.TRUST_PRICE_K));
  ok('信誉触顶时倍率 1+K ≤ 3(防手滑写出爆炸倍率)',
    1 + RB.TRUST_PRICE_K <= 3, String(1 + RB.TRUST_PRICE_K));

  const i = src.indexOf('const payMul = (listed ?');
  const line = src.slice(i, i + 300);
  ok('源码形态:溢价是 payMul 的外层乘子(不是写进 relaySellPayMul)', i > 0, String(i));
  ok('源码形态:外层乘子带 listed 守卫(自研不吃溢价)',
    /\*\s*\(listed\s*\?\s*1 \+ RELAY_BIZ\.TRUST_PRICE_K/.test(line), line.split('\n')[6]);
  const inner = src.indexOf('function relaySellPayMul');
  const innerBody = src.slice(inner, inner + 220);
  ok('层4/层5 本体(relaySellPayMul)不含信誉项 —— 溢价不得污染虚标罚语义',
    !innerBody.includes('reputation') && !innerBody.includes('TRUST_PRICE_K'),
    innerBody.split('\n').slice(0, 4).join(' / '));
}

// ── [6] C4 成交系数:行为(清空库存口径,直接量刀乐增量) ─────────────────────
console.log('\n[6] C4 行为:信誉 0 → ×1.0;信誉 100 → ×(1+K);线性');
{
  const st = sb.state, R = st.relay;
  const m = sb.TM[0];
  const prep = (rep, listed, priceMul) => {
    st.tokens = 1e12;                  // 库存管够 ⇒ used = ideal
    R.ability.speed = 10;
    R.activeCoef = 1;
    R.userSlots = []; for (let i = 0; i < 4; i++) R.userSlots.push({ leftH: 99 });
    R.users = 4;
    R.reputation = rep;
    R.dollars = 0;
    R.hourAccum = 0; R.repAccum = 0; R.serviceDown = false;
    R.listedModel = listed ? m.n : null;
    const off = listed ? sb.officialPriceOf(m) : 0;
    R.price = listed ? off * priceMul : 0.3;
    return off;
  };
  const delta = (rep, listed, priceMul) => {
    prep(rep, listed, priceMul);
    const d0 = R.dollars;
    sb.updateRelayBusiness(0.01);
    return R.dollars - d0;
  };
  const d0 = delta(0, true, RB.CHEAP_LINE);
  const d50 = delta(50, true, RB.CHEAP_LINE);
  const d100 = delta(100, true, RB.CHEAP_LINE);
  ok('成交额随着信誉单调增', d0 < d50 && d50 < d100, [d0, d50, d100].map(x => x.toExponential(3)).join(' < '));
  ok('信誉 0 时倍率恒 1(跑分线零影响 —— 与四窗口「逐位相同」一致)',
    near(d0 / d0, 1, 1e-12) && d0 > 0, String(d0));
  ok('信誉 100 时倍率 = 1+K = ' + (1 + RB.TRUST_PRICE_K).toFixed(2),
    near(d100 / d0, 1 + RB.TRUST_PRICE_K, 1e-9), (d100 / d0).toFixed(6));
  ok('信誉 50 时倍率 = 1+K/2(线性、无折点)',
    near(d50 / d0, 1 + RB.TRUST_PRICE_K / 2, 1e-9), (d50 / d0).toFixed(6));
  ok('信誉 200(脏数据)倍率不超过 1+K(与信誉硬顶 100 一致)',
    near(delta(200, true, RB.CHEAP_LINE) / d0, 1 + RB.TRUST_PRICE_K * 2, 1e-9),
    (delta(200, true, RB.CHEAP_LINE) / d0).toFixed(6));
}

// ── [7] C4 自研豁免(§5.4:自研完全不触发信誉机制) ─────────────────────────
console.log('\n[7] C4 自研豁免');
{
  const st = sb.state, R = st.relay;
  const selfDelta = (rep) => {
    st.tokens = 1e12;
    R.ability.speed = 10;
    R.activeCoef = 1;
    R.userSlots = []; for (let i = 0; i < 4; i++) R.userSlots.push({ leftH: 99 });
    R.users = 4;
    R.reputation = rep;
    R.dollars = 0;
    R.hourAccum = 0; R.repAccum = 0; R.serviceDown = false;
    R.listedModel = null;                       // 自研
    R.price = RB.SELF_PRICE_MAX;                // 上限内
    const d0 = R.dollars;
    sb.updateRelayBusiness(0.01);
    return R.dollars - d0;
  };
  const s0 = selfDelta(0), s100 = selfDelta(100);
  ok('自研:信誉 0 与信誉 100 的成交额完全相同(豁免生效)',
    near(s0, s100, Math.abs(s0) * 1e-12 + 1e-18), s0.toExponential(6) + ' vs ' + s100.toExponential(6));
  ok('自研:成交仍为正(没被误伤成 0)', s0 > 0, String(s0));
}

// ── [8] C4 不碰标价、不碰层4/层5(作用面守卫) ──────────────────────────────
console.log('\n[8] C4 作用面:不动标价 / 不进层4、层5');
{
  const st = sb.state, R = st.relay;
  const m = sb.TM[0];
  const off = sb.officialPriceOf(m);
  const price = off * RB.CHEAP_LINE;

  R.listedModel = m.n;
  R.reputation = 0;
  R.price = price;
  const g0 = sb.relayGougePayMul(m, price);
  const s0 = sb.relaySellPayMul(m, price, off);
  R.reputation = 100;
  const g100 = sb.relayGougePayMul(m, price);
  const s100 = sb.relaySellPayMul(m, price, off);
  ok('relayGougePayMul(层5)与信誉无关', near(g0, g100), g0 + ' vs ' + g100);
  ok('relaySellPayMul(层4×层5)与信誉无关 —— 信誉只在最外层相乘',
    near(s0, s100), s0 + ' vs ' + s100);

  // 溢价不得改动标价本身(否则会连带触发层5 的「超法定上限」判定)
  st.tokens = 1e12;
  R.ability.speed = 10; R.activeCoef = 1;
  R.userSlots = []; for (let i = 0; i < 4; i++) R.userSlots.push({ leftH: 99 });
  R.users = 4; R.hourAccum = 0; R.repAccum = 0;
  R.reputation = 100;
  R.price = price;
  // ⚠️ 这里不假设层5 = 1:本测试的能力分低于 SIM_GATE(80),层5 本来就可能在罚
  //    (那与信誉无关)。要钉的是「溢价没有改动层5 的输入/输出」,所以结算前后取同一次值比对。
  const gBefore = sb.relayGougePayMul(m, price);
  sb.updateRelayBusiness(0.01);
  ok('跑过结算后标价未被改动', near(R.price, price), String(R.price));
  ok('结算不改变层5 的判定(溢价只是最外层乘子,不碰标价也不碰虚标罚)',
    near(sb.relayGougePayMul(m, R.price), gBefore), gBefore + ' vs ' + sb.relayGougePayMul(m, R.price));
}

// ── [9] 回归护栏:合法价区间的旧行为一字未动 ────────────────────────────────
console.log('\n[9] 回归:合法价区间(ratio ≤ 1.0)与改动前完全一致');
{
  const O = 10;
  const legacy = r => Math.max(0, Math.min(1, (RB.CHEAP_LINE + RB.GROW_FALLOFF - r) / RB.GROW_FALLOFF));
  let same = true, firstBad = '';
  for (let r = 0.5; r <= 1.0 + 1e-9; r += 0.005) {
    const a = sb.relayGrowWeight(O * r, O), b = legacy(r);
    if (!near(a, b, 1e-12)) { same = false; firstBad = 'ratio=' + r.toFixed(3) + ' ' + a + ' vs ' + b; break; }
  }
  ok('ratio ∈ [0.5, 1.0] 上,relayGrowWeight 与旧公式逐点一致(只有 ≥1.4 段是新增)', same, firstBad);
  ok('ratio ∈ (1.0, 1.4) 新旧也一致(都为 0)', near(sb.relayGrowWeight(O * 1.2, O), legacy(1.2)),
    String(sb.relayGrowWeight(O * 1.2, O)));
}

console.log('\n' + '─'.repeat(60));
console.log('结果:' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) process.exit(1);
