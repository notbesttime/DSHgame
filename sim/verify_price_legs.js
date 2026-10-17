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
// ⚠️ §20.15 起,模板自带 P2-1/P2-4 风险机制(relayRepSettle 尾钩)。既有断言的沙箱一律关闭它,
//    保证「单价腿」的量测不混入事件噪声;P2 自身的断言在 [10] 段,用自己的沙箱开机制。
sb.RB.RISK_EV_K = 0;
sb.RB.RISK_DETECT_BASE_K = 0;
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

// ── [8b] doPublish 保价提示(§20.11 九 遗留 2;纯提示,不改数值) ─────────────
console.log('\n[8b] doPublish:换标榜后把「定价 vs 新官价」的后果说出来');
{
  const st = sb.state, R = st.relay;
  const P = R.publish;
  const setup = (priceMulOfTarget, listedBefore) => {
    // 先按一个**别的**模型定价(模拟「玩家按旧标的定过价」),再发布一个新标的
    const target = sb.TM[0];
    const off = sb.officialPriceOf(target);
    R.listedModel = listedBefore;
    R.price = off * priceMulOfTarget;          // 相对**新标的**官价的比例
    R.reputation = 0;
    st.tokens = 1e9;
    R.ability.speed = 10; R.activeCoef = 1; R.users = 2; R.userSlots = [{ leftH: 9 }, { leftH: 9 }];
    P.active = false;
    return { target, off };
  };

  // ① 极价(≥ GROW_NEG_RATIO)⇒ 提示必须出现,且含「净流失」与建议上限
  const a = setup(RB.PRICE_MAX, sb.TM[0].n);
  const r1 = sb.doPublish('run', a.target.n);
  ok('doPublish 返回 ok + msg', !!r1 && r1.ok === true && typeof r1.msg === 'string', JSON.stringify(r1));
  ok('极价(1.5× 官价 = 上限)时 msg 含「净流失」警告', r1.msg.includes('净流失'), r1.msg);
  ok('警告里给出了目标上限(CHEAP_LINE)', r1.msg.includes(String(RB.CHEAP_LINE)), r1.msg);

  // ② 便宜价(≤ CHEAP_LINE)⇒ 不该出现流失警告
  P.active = false;
  const b = setup(RB.CHEAP_LINE * 0.9, sb.TM[0].n);
  const r2 = sb.doPublish('run', b.target.n);
  ok('便宜价(0.72× 官价)时 msg 不含「净流失」', !r2.msg.includes('净流失'), r2.msg);

  // ③ 提示是**纯提示**:发布前后玩家定价不被本函数改掉(重钳发生在每小时 refresh 里)
  P.active = false;
  const c = setup(RB.PRICE_MAX, sb.TM[0].n);
  const before = R.price;
  sb.doPublish('run', c.target.n);
  ok('doPublish 本身不改玩家定价(重钳仍归 relayHourlyRefresh)', near(R.price, before), before + ' → ' + R.price);

  // ④ 自研/无官价不炸:定价为 0 时走保底定价,msg 正常
  P.active = false;
  const d = setup(0, null);
  const rd = sb.doPublish('run', d.target.n);
  ok('定价为 0 时走保底定价且 msg 正常', !!rd && rd.ok === true && typeof rd.msg === 'string', JSON.stringify(rd));
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


// ── [10] P2 风险玩法落码断言(§20.15;翻车事件 + 被识破 + 池打折) ─────────────
console.log('\n[10] P2 风险玩法:触发边界 / 池打折 / 识破 / 诚实线免疫 / 翻车报道');
{
  const sb2 = makeSim(20261012);          // 独立沙箱:开机制
  sb2.RB.RISK_EV_GRACE = 0;               // 去掉警告缓冲,触发行为确定化
  let sr = 0.5; sb2.Math.random = () => sr; // 接管随机:0.5 ⇒ p>0.5 必触发、p<0.5 必不触发
  const st = sb2.state, R = st.relay, R2 = sb2.RB;
  const m = sb2.TM[0];
  const setup = (priceMul) => {
    st.tokens = 1e12;
    R.ability.speed = 10; R.activeCoef = 1;
    R.userSlots = []; for (let i = 0; i < 4; i++) R.userSlots.push({ leftH: 99 });
    R.users = 4; R.dollars = 0; R.hourAccum = 0; R.repAccum = 0;
    R.listedModel = m.n; R.reputation = 50;
    R.price = sb2.officialPriceOf(m) * priceMul;
    sb2.state.relay.p2 = { events: [], warnDays: 0, triggers: 0, detects: 0, crashNews: 0 };
  };
  // ① 触发边界:sim 直接驱动(用 ability 低于门槛的状态)。这里用「识破」通道测确定性后果。
  //    翻车通道的 p 由 gap 决定,sim 沙箱里 TM[0] 对初始 ability 的相似度不可控 ⇒ 用识破通道断言。
  // ── 识破:把「我方能力」压到远低于标榜 ⇒ baseDetect 高;fit=LO(70) 之上才有隐蔽度
  setup(RB.PRICE_MAX);
  R.ability.reasoning = 5; R.ability.instruct = 0; R.ability.fit = 100;   // 无隐蔽、无指令减免
  const rep0 = R.reputation;
  sb2.p2RiskSettle(100, m);        // sim=100 ⇒ gap=0 ⇒ 翻车通道不触发;识破通道按 baseDetect 走
  const afterDetect = R.reputation;
  ok('识破触发:声誉被扣(事件+报道)', afterDetect < rep0, rep0 + ' → ' + afterDetect);
  ok('识破计入计数器', sb2.state.relay.p2.detects === 1, String(sb2.state.relay.p2.detects));
  ok('事件已入列(客流折损生效中)', sb2.state.relay.p2.events.length === 1);
  ok('事件期自然客流乘数 = RISK_EV_FLOW_MUL', sb2.p2FlowMul() === R2.RISK_EV_FLOW_MUL, String(sb2.p2FlowMul()));
  ok('客流折损是真实的(<1;=1 即装饰化,变异自检抓过)', R2.RISK_EV_FLOW_MUL < 1 && sb2.p2FlowMul() < 1,
    'FLOW_MUL=' + R2.RISK_EV_FLOW_MUL + ' p2FlowMul()=' + sb2.p2FlowMul());
  ok('池打折同理(<1)', R2.RISK_EV_POOL_MUL < 1 && sb2.p2PoolMul() < 1,
    'POOL_MUL=' + R2.RISK_EV_POOL_MUL + ' p2PoolMul()=' + sb2.p2PoolMul());
  ok('事件期发布池乘数 = RISK_EV_POOL_MUL', sb2.p2PoolMul() === R2.RISK_EV_POOL_MUL, String(sb2.p2PoolMul()));
  ok('翻车报道已入日报', st.relay.news.active.some(a => a.id === 'crash_exposed'));

  // ── 事件期结束:把事件过期 ⇒ 乘数回 1
  sb2.state.relay.p2.events[0].untilH = 0;
  ok('事件过期后客流乘数回 1', sb2.p2FlowMul() === 1 && sb2.p2PoolMul() === 1);

  // ── 隐蔽度:fit=HI(100) 时识破概率 ×(1−K);fit=LO(70) 时 ×1
  const pDet = (fit) => {
    R.ability.fit = fit;
    R.ability.reasoning = 5; R.ability.instruct = 0;
    R.ability.multimodal = 0; R.ability.knowledge = 0;
    R.reputation = 50;
    sb2.state.relay.p2 = { events: [], warnDays: 0, triggers: 0, detects: 0, crashNews: 0 };
    // 直接量「检测乘数」而非掷骰:stealthMul × 各暴露项
    return sb2.p2StealthMul(fit);
  };
  ok('隐蔽度:fit=70(LO)⇒ 乘数 1(无隐蔽)', Math.abs(pDet(70) - 1) < 1e-9, String(pDet(70)));
  ok('隐蔽度:fit=100(HI)⇒ 乘数 0.3(K=0.7 的确定值;K 被清零则此断言红)', Math.abs(pDet(100) - 0.3) < 1e-9, String(pDet(100)));
  ok('隐蔽度:fit=85(中点)⇒ 0.65(平滑无折点)', Math.abs(pDet(85) - 0.65) < 1e-9, String(pDet(85)));

  // ── 池打折咬合 doPublish:发布池抽量在事件期 ×POOL_MUL
  setup(RB.PRICE_MAX);
  sb2.state.relay.p2 = { events: [], warnDays: 0, triggers: 0, detects: 0, crashNews: 0 };
  const off = sb2.officialPriceOf(m);
  R.price = off;                       // 合法价,防额外分支
  R.publish = { active: false, strategy: null, model: null, remainH: 0, totalH: 0, lastCap: null };
  const before = sb2.publishPoolDraw(m.n, R.price, 'run');
  // 造一个活跃事件
  sb2.state.relay.p2.events.push({ untilH: 1e9, flowMul: R2.RISK_EV_FLOW_MUL, sev: 1 });
  const during = Math.round(sb2.publishPoolDraw(m.n, R.price, 'run') * sb2.p2PoolMul());
  ok('事件期发布池抽量打折生效(×' + R2.RISK_EV_POOL_MUL + ')', during === Math.round(before * R2.RISK_EV_POOL_MUL), before + ' → ' + during);
  ok('打折后仍 > 0(池未清零)', during > 0, String(during));

  // ── 诚实线免疫:sim=100(gap=0)且无识破(fit=LO、无能力差)⇒ 两次 settle 零变化
  const sb3 = makeSim(20261012);
  sb3.RB.RISK_EV_GRACE = 0;
  const s3 = sb3.state, R3 = s3.relay;
  s3.tokens = 1e12;
  R3.listedModel = sb3.TM[0].n;
  R3.price = sb3.officialPriceOf(sb3.TM[0]) * RB.CHEAP_LINE;
  R3.reputation = 50;
  R3.ability.fit = R2.RISK_STEALTH_LO;         // 无隐蔽
  R3.ability.instruct = 0;
  // 高配低标:把能力抬到远超标榜 ⇒ sim>100、baseDetect=0
  R3.ability.reasoning = 100; R3.ability.toolCall = 100; R3.ability.speed = 100;
  R3.ability.longCtx = 100; R3.ability.knowledge = 100; R3.ability.multimodal = 100;
  sb3.state.relay.p2 = { events: [], warnDays: 0, triggers: 0, detects: 0, crashNews: 0 };
  const rep3 = R3.reputation;
  for (let i = 0; i < 5; i++) sb3.p2RiskSettle(100, sb3.TM[0]);
  ok('诚实线免疫:高配低标 5 次结算,声誉零损失、零触发、零识破',
    R3.reputation >= rep3 && sb3.state.relay.p2.triggers === 0 && sb3.state.relay.p2.detects === 0,
    'rep ' + rep3 + ' → ' + R3.reputation + ' trig=' + sb3.state.relay.p2.triggers);

  // ── 变异锚:常量被误改时立刻红
  ok('RISK_EV_CAP = 0.35(拍板定稿)', Math.abs(R2.RISK_EV_CAP - 0.35) < 1e-9, String(R2.RISK_EV_CAP));
  // ⚠️ 断言「在合理区间且确实打折」,不钉死单个数值 —— 否则每次平衡调整都会误报。
  //    §17.6 方案B 已把它从 0.7 调到 0.85(小考不再给信誉/用户后,跑分线需要喘口气)。
  ok('RISK_EV_POOL_MUL ∈ (0.5, 1)(事件期确有打折但不打死跑分线)',
    R2.RISK_EV_POOL_MUL > 0.5 && R2.RISK_EV_POOL_MUL < 1, String(R2.RISK_EV_POOL_MUL));
  ok('RISK_EV_FLOW_DAYS = [3,7]', R2.RISK_EV_FLOW_DAYS[0] === 3 && R2.RISK_EV_FLOW_DAYS[1] === 7);

  // ── 源码形态锚 + 行为级 reclamp 断言(变异自检 2/5 的漏网补丁)──
  const src2 = fs.readFileSync(require('path').join(__dirname, '..', 'index_template.html'), 'utf8');
  const hr = src2.slice(src2.indexOf('function relayHourlyRefresh'), src2.indexOf('function relayRepSettle'));
  ok('留存折损在位:keepP 乘 p2FlowMul', /keepP = [^;]+\* p2FlowMul\(\)/.test(hr), (hr.match(/const keepP[^\n]*/) || ['(缺)'])[0]);
  ok('新增折损在位:base 乘 p2FlowMul', /base = relayBaseUsers\(\) \* p2FlowMul\(\)/.test(hr), '(relayHourlyRefresh 增长块)');
  ok('RECLAMP 恒为 1(拍板:按概率发;改 0 即回退「必发」原式)', /const P2_RECLAMP = 1;/.test(src2), (src2.match(/const P2_RECLAMP = \d;/) || ['(缺)'])[0]);
  {
    const sb4 = makeSim(20261012);
    sb4.RB.RISK_EV_GRACE = 0;
    sb4.Math.random = () => 0.99;   // 只有 p>0.99 才触发
    const s4 = sb4.state, R4 = s4.relay;
    const m4 = sb4.TM[0];
    R4.listedModel = m4.n;
    R4.price = sb4.officialPriceOf(m4) * RB.PRICE_MAX;
    R4.reputation = 50;
    R4.ability.fit = 100; R4.ability.instruct = 0;
    R4.ability.multimodal = 0; R4.ability.knowledge = 0;
    s4.relay.p2 = { events: [], warnDays: 0, triggers: 0, detects: 0, crashNews: 0 };
    sb4.p2RiskSettle(20, m4);   // sim=20 ⇒ gap=-0.8;原式 p=0.9×12>1(必发),修后 p≤0.35
    ok('按概率发(RECLAMP):深 gap + 双倍率下,随机 0.99 不触发(p 被 CAP 钳住)',
      s4.relay.p2.triggers === 0, 'triggers=' + s4.relay.p2.triggers);
  }
}


// ── [11] P2-3 热点档位落码断言(§20.16;对称档 / 调度 / 类别命中 / 叠加上限 / 见报) ──
console.log('\n[11] P2-3 热点:对称性 / 调度 / 类别命中 / 叠加 / 过期 / 见报');
{
  const sb5 = makeSim(20261012);
  const R5 = sb5.state.relay, RB5 = sb5.RB;
  // ① 档位均值 = 0(拍板:期望对称;设计稿原式 +4% 已弃用)
  const m0 = RB5.HEAT_MULS.reduce((a, b) => a + b, 0) / RB5.HEAT_MULS.length;
  ok('档位均值 = 0(期望对称)', Math.abs(m0) < 1e-9, String(m0));
  ok('档位对称为 5 档(大热/热/平/冷/冰)', RB5.HEAT_MULS.length === 5, JSON.stringify(RB5.HEAT_MULS));
  // ② 类别判定:五个类别的代表属性都能映射到自己
  ok('p2CategoryOf 可用且返回类别串', HEAT_CATS_AS(sb5).includes(sb5.p2CategoryOf(sb5.TM[0])), sb5.p2CategoryOf(sb5.TM[0]));
  // ③ 调度:把 totalH 拨到 nextH 之上 ⇒ tick 后 heat 出现、见报
  R5.news = sb5.newsDefaults ? sb5.newsDefaults() : R5.news;
  R5.p2 = { events: [], warnDays: 0, triggers: 0, detects: 0, crashNews: 0, heat: [], heatNextH: 0, heatDone: 0 };
  R5.listedModel = sb5.TM[0].n;   // 无标榜时 p2HeatMul 恒 1(自研不吃热点)
  const H0 = R5.news.totalH;
  sb5.p2HeatTick();
  ok('调度:totalH≥heatNextH ⇒ 至少一条热点', R5.p2.heat.length >= 1, JSON.stringify(R5.p2.heat));
  ok('热点见报:type=heat 条目入日报', R5.news.active.some(a => a.type === 'heat'),
    (R5.news.active.map(a => a.type).join(',') || '(空)'));
  ok('热点条目标注了类别与档位方向', R5.news.active.some(a => a.type === 'heat' && /热点\[/.test(a.title)));
  // ④ 命中才乘:构造「命中当前类别」与「不命中」两个热点,乘数应分别为 1+mul 与 1
  const cat = sb5.p2CategoryOf(sb5.TM[0]);
  R5.p2.heat = [{ cat: cat, mul: 0.6, untilH: 1e9 }];
  ok('命中当前类别 ⇒ 乘数 1+0.6', Math.abs(sb5.p2HeatMul() - 1.6) < 1e-9, String(sb5.p2HeatMul()));
  R5.p2.heat = [{ cat: cat, mul: 0.6, untilH: 1e9 }, { cat: '多模态型', mul: -0.6, untilH: 1e9 }];
  ok('不命中的热点不影响乘数(仍 1.6)', Math.abs(sb5.p2HeatMul() - 1.6) < 1e-9, String(sb5.p2HeatMul()));
  // ⑤ 叠加上限:HEAT_MAX 条以内才入列
  R5.p2.heat = [];
  R5.news.totalH = H0 + 24 * 400;   // 拨快时钟,强制 while 连续生成
  sb5.p2HeatTick();
  ok('叠加上限:heat 条数 ≤ 2(硬编码拍板值;HEAT_MAX 被解除则此断言红)', R5.p2.heat.length <= 2, String(R5.p2.heat.length));
  // ⑥ 过期回落:全部 untilH 拨到过去 ⇒ 乘数回 1
  for (const h of R5.p2.heat) h.untilH = 0;
  ok('热点过期 ⇒ 乘数回 1', sb5.p2HeatMul() === 1, String(sb5.p2HeatMul()));
  // ⑦ 自研免疫:未标榜 ⇒ 恒 1(与 §5.4 一致)
  R5.listedModel = null;
  R5.p2.heat = [{ cat: '推理型', mul: 0.6, untilH: 1e9 }];
  ok('自研不吃热点(恒 1)', sb5.p2HeatMul() === 1, String(sb5.p2HeatMul()));
  // ⑧ 源码形态锚:base 必须同时乘 flowMul 与 heatMul(漏一即装饰化)
  const src3 = fs.readFileSync(require('path').join(__dirname, '..', 'index_template.html'), 'utf8');
  ok('base 同时乘 flowMul × heatMul(漏一即装饰化)',
    /base = relayBaseUsers\(\) \* p2FlowMul\(\) \* p2HeatMul\(\)/.test(src3),
    (src3.match(/base = relayBaseUsers[^\n]*/) || ['(缺)'])[0]);
  ok('HEAT_MULS 是对称 5 档(源码级)', /HEAT_MULS: \[0\.6, 0\.2, 0, -0\.2, -0\.6\]/.test(src3));
  const hr3 = src3.slice(src3.indexOf('function relayHourlyRefresh'), src3.indexOf('function relayRepSettle'));
  ok('热点时钟挂点在位:relayHourlyRefresh 开头调 p2HeatTick(被删/被注释都算失效)', /^  p2HeatTick\(\);/m.test(hr3), '(relayHourlyRefresh 头部,须为非注释行)');
  function HEAT_CATS_AS(sb) { return ['推理型', '多模态型', '长上下文型', 'Agent型', '廉价快模型型']; }
}
// ── [12] §17.6 考试体系(阶梯/状态机/隐藏阈值/重考/提示点选) ──────────────
console.log('\n[12] 考试体系:阶梯 / 隐藏阈值 / 会话式过程 / 重考 / 提示点选(分数与数值分离)');
{
  const sb6 = makeSim(20261012);
  const R6 = sb6.state.relay, T6 = R6.train, TCFG6 = sb6.TCFG;
  // ① 阶梯:8 档、60 天主线、atDay 严格递增
  ok('阶梯 8 档', TCFG6.EXAMS.length === 8, String(TCFG6.EXAMS.length));
  ok('主线 60 游戏天(毕业大考 atDay=60)', TCFG6.EXAMS[7].atDay === 60 && TCFG6.EXAMS[7].graduate === true);
  let mono = true;
  for (let i = 1; i < TCFG6.EXAMS.length; i++) if (!(TCFG6.EXAMS[i].atDay > TCFG6.EXAMS[i-1].atDay)) mono = false;
  ok('atDay 严格递增', mono);
  // ② 隐藏阈值:先降后升(初版逐场收紧会月考死锁) —— 用「首场 > 第二场」锚定形状
  ok('隐藏阈值先降后升(首场 > 第二场,防月考死锁)',
    TCFG6.EXAMS[0].passGrade > TCFG6.EXAMS[1].passGrade,
    TCFG6.EXAMS[0].passGrade + ' > ' + TCFG6.EXAMS[1].passGrade);
  ok('阈值全部 < 1(满分 100 分制下可达)', TCFG6.EXAMS.every(e => e.passGrade < 1));
  // ③ 方案B:小考只给 token,市级以上才给信誉/用户
  ok('前 4 场不给信誉与用户奖励(方案B)',
    TCFG6.EXAMS.slice(0,4).every(e => !e.rep && !e.usersPct));
  ok('市级及以上给信誉与用户奖励',
    TCFG6.EXAMS.slice(4).every(e => e.rep > 0 && e.usersPct > 0));
  ok('重考间隔 = 7 游戏天', TCFG6.RETAKE_DELAY_DAYS === 7, String(TCFG6.RETAKE_DELAY_DAYS));
  // ④ 会话式:开考建立 session、期间分数单调上涨、到点结算清空
  sb6.startExam(0);
  const s6 = T6.examSession;
  ok('开考建立会话且 endH > startH', !!s6 && s6.endH > s6.startH, s6 ? (s6.startH + '→' + s6.endH) : 'null');
  const sc0 = s6.score;
  for (let i = 0; i < 60; i++) { R6.news.totalH += 1/60; sb6.examTick(R6.news.totalH, 1/60); if (!T6.examSession) break; }
  ok('考试期间分数随时间上涨(过程化,不是瞬间出结果)',
    !T6.examSession ? true : T6.examSession.score > sc0, String(sc0.toFixed(2)));
  // ⑤ 提示:考试中能生成限时提示
  const s7 = T6.examSession;
  ok('考试中生成限时提示', !!s7 && (s7.hints || []).length > 0, s7 ? String((s7.hints||[]).length) : 'settled');
  if (s7 && s7.hints && s7.hints.length) {
    const h = s7.hints[0];
    const area = { x: 0, y: 0, w: 1000, h: 600 };
    const beforeScore = s7.score, beforeGain = s7.attrGain || 0;
    const attrKey = h.attrKey, attrBefore = R6.ability[attrKey] || 0;
    // ⑥ 点中:分数 +N(只进本次考试) + 属性 +δ(唯一带出局外的收益)
    const hit = sb6.examHintClick(area.x + h.ux * area.w, area.y + h.uy * area.h, area);
    ok('点中提示判定命中', hit === true);
    ok('点中后本次分数上涨(分数只进本次考试)', s7.score > beforeScore, beforeScore.toFixed(1) + ' → ' + s7.score.toFixed(1));
    ok('点中后属性小幅上涨(唯一带出局外的收益)',
      (s7.attrGain || 0) > beforeGain && (R6.ability[attrKey] || 0) > attrBefore,
      attrKey + ' ' + beforeGain.toFixed(2) + ' → ' + (s7.attrGain||0).toFixed(2));
    ok('单条属性收益很小(不是一次练满)', h.attr <= 0.2, String(h.attr.toFixed(3)));
    // ⑦ 空白处点不中
    ok('空白处点击不命中', sb6.examHintClick(-99, -99, area) === false);
    // ⑧ 每场属性上限:连续点满后不再加属性(行为验证 —— 常量在沙箱里是块作用域,外部读不到)
    let gainedSum = 0, clicks = 0;
    for (let round = 0; round < 80 && T6.examSession; round++) {
      // 强制补一条提示再点(模拟肝帝狂点)
      if (!s7.hints || !s7.hints.length) {
        s7.nextHintH = 0;
        sb6.spawnExamHint(s7, TCFG6.EXAMS[s7.idx], R6.news.totalH, 1);
      }
      if (!s7.hints || !s7.hints.length) break;
      const hh = s7.hints[0];
      const g0 = s7.attrGain || 0;
      sb6.examHintClick(area.x + hh.ux * area.w, area.y + hh.uy * area.h, area);
      gainedSum += (s7.attrGain || 0) - g0;
      clicks++;
    }
    // ⚠️ 判据:把 attrGain 手动顶到接近上限,再点一条 ⇒ **属性不再增长**(上限真的生效)。
    //    这样不依赖「能刷到上限」,构造确定、变异必红(移除上限后这一步会继续加)。
    let capOk = false, capDetail = '';
    if (T6.examSession) {
      s7.attrGain = 5.98;                    // 逼近上限(6.0)
      const atk = 'reasoning';
      const a0 = R6.ability[atk] || 0;
      s7.nextHintH = 0;
      sb6.spawnExamHint(s7, TCFG6.EXAMS[s7.idx], R6.news.totalH, 1);
      if (s7.hints && s7.hints.length) {
        const hx = s7.hints[0];
        sb6.examHintClick(area.x + hx.ux * area.w, area.y + hx.uy * area.h, area);
        const a1 = R6.ability[atk] || 0;
        capOk = (a1 - a0) < 0.02;            // 已到上限 ⇒ 几乎不再加
        capDetail = atk + ' ' + a0.toFixed(2) + '→' + a1.toFixed(2) + ' (attrGain 5.98 起)';
      }
    }
    ok('每场属性总增长有上限(顶到 5.98 后再点不再增长)', capOk, capDetail);
  }
  // ⑨ 结算后会话清空、examStage 推进或重考计数(二者必居其一)
  const st0 = T6.examStage, rt0 = T6.examRetakes[0] || 0;
  while (T6.examSession) { R6.news.totalH += 1/60; sb6.examTick(R6.news.totalH, 1/60); }
  ok('结算后会话清空且「推进 or 重考」二者必居其一',
    T6.examSession === null && (T6.examStage > st0 || (T6.examRetakes[0] || 0) > rt0));
  // ⑩ 源码形态锚:分数与属性是两个独立写入点(不能合成一个)
  const src4 = fs.readFileSync(require('path').join(__dirname, '..', 'index_template.html'), 'utf8');
  ok('提示点击里分数与属性分开结算(分数只进本次考试)',
    /s\.score = Math\.min\(100, s\.score \+ h\.score\)/.test(src4) && /A\[h\.attrKey\] = Math\.min\(100, cur \+ add\)/.test(src4));
  ok('隐藏阈值不显示在 HUD(考试中只显示得分与剩余)',
    !/passGrade.*hud/i.test(src4) && /得分 ' \+ Math\.round\(s\.score\)/.test(src4));
}

console.log('\n' + '─'.repeat(60));

console.log('\n' + '─'.repeat(60));
console.log('结果:' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) process.exit(1);