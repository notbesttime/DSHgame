// sim/verify_gouge.js — 层5「虚标成交折扣」的边界与分支验证（不跑 30 天仿真，秒级）
//
// 为什么要有它：relayGougePayMul 在 2026-10-12 从「1/(1+√over×K)」改成
// 「相似度闸 + 法定上限阈值 + 幂律」，三道闸各自对应一个实测出来的坑：
//   ① 相似度闸     —— 曾把「高配低标」(有效相似 >100 的诚实策略)也罚了(实测诚实线 D8-14 被压到 0.34)
//   ② 法定上限阈值 —— 曾对合法价格带上半段(1.1~1.5× 相称价)双重收费
//   ③ 幂律         —— 开方把罚力度白白让掉十几倍，虚标收益仍是诚实 5.5 倍(正确口径:刀乐+道具$)
// 这三条任何一个被改回去都不会报错，只会静默改平衡 ⇒ 必须有断言钉住。
//
// 沙箱复用 sim/startup_loop.js 导出的 makeSim。
// ⚠️ 不要另抄抽取清单，也不要给派生属性「节选字段」：modelToAttrs 的返回值要整个拿去用，
//    少一个 fit/params 会让 modelCapability 变 NaN，被 (a[k]||0) 吞掉后造出过假结论。
//
// 运行：node sim/verify_gouge.js
'use strict';
const { makeSim } = require('./startup_loop');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (detail ? '   → ' + detail : '')); }
}
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-9);

const sb = makeSim(20261012);
const RB = sb.RB;
const SG = sb.similarityTo;
const gp = (listed, price) => sb.relayGougePayMul(listed, price);
// 能力 = 某真实模型的完整派生属性（整个对象，不节选）
const abilOf = m => sb.modelToAttrs(m);

// ── [0] 沙箱自检：证明相似度函数是准的，否则后面全是在验证 NaN ──────────────
console.log('\n[0] 沙箱自检');
{
  const m = sb.TM[0], a = abilOf(m), s = SG(a, m);
  ok('相似度函数可用，且能力等同标榜对象时 ≥99（超额交付会 >100）',
    Number.isFinite(s) && s >= 99, String(s));
  ok('modelToAttrs 含 fit（缺它会令 modelCapability 变 NaN ⇒ 静默污染）',
    Number.isFinite(abilOf(m).fit), String(abilOf(m).fit));
  if (fail) { console.log('\n沙箱没起来，后续断言无意义，直接中止。'); process.exit(1); }
}

// 场景选材：最弱模型（当「真本事」）／最贵模型（当「虚标对象」）
const mWeak = sb.TM.slice().sort((x, y) => sb.officialPriceOf(x) - sb.officialPriceOf(y))[0];
const mDear = sb.TM.slice().sort((x, y) => sb.officialPriceOf(y) - sb.officialPriceOf(x))[0];

console.log('\n[1] 闸门与输入边界');
ok('listed = null → 1', gp(null, 100) === 1);
ok('price ≤ 0 → 1', gp(mDear, 0) === 1 && gp(mDear, -5) === 1);

console.log('\n[2] 闸① 相似度 ≥ SIM_GATE 不罚（防「高配低标」误伤）');
{
  const m = sb.TM[0];
  sb.state.relay.ability = abilOf(m);
  const off = sb.officialPriceOf(m);
  ok(`相似 ${SG(sb.state.relay.ability, m).toFixed(0)} ≥ ${sb.PC.SIM_GATE}:合法上限 1.5× 定价 → 1`,
    gp(m, off * RB.PRICE_MAX) === 1);
  ok('同场景:定价 50× 官价 → 仍为 1（是闸挡住的，不是被价格带挡住的）',
    gp(m, off * 50) === 1);
}

console.log('\n[3] 闸② 阈值 = 法定上限（fair × PRICE_MAX），防合法带上半段双重收费');
{
  sb.state.relay.ability = abilOf(mWeak);
  const listed = mDear;
  const fair = sb.fairPriceOf(sb.state.relay.ability);
  const sim = SG(sb.state.relay.ability, listed);
  ok(`场景自检:最弱能力标最贵模型「${listed.n}」的相似度 < ${sb.PC.SIM_GATE}`,
    sim < sb.PC.SIM_GATE, 'sim=' + sim.toFixed(1));
  ok(`场景自检:相称价 $${fair}（=${sb.closestModel(sb.state.relay.ability).model.n}）远小于标榜对象官价 $${sb.officialPriceOf(listed)}`,
    fair > 0 && fair < sb.officialPriceOf(listed));
  ok('价 = 相称价 → 1（不超纲不罚）', gp(listed, fair) === 1);
  ok('价 = 1.0× 法定上限价 → 1（边界含等号）', gp(listed, fair * RB.PRICE_MAX) === 1);
  const just = gp(listed, fair * RB.PRICE_MAX * 1.0001);
  ok('价刚过法定上限 → 略小于 1（连续，无跳变）', just < 1 && just > 0.999, String(just));

  console.log('\n[4] 闸③ 幂律（EXP 是唯一有效旋钮，越大越狠）');
  const r = 10, price = fair * RB.PRICE_MAX * r;
  const expect = Math.pow(1 / r, RB.GOUGE_PAY_EXP);
  ok(`EXP=${RB.GOUGE_PAY_EXP}、卖价 = 10× 法定上限 → ${expect.toFixed(4)}`,
    near(gp(listed, price), expect), String(gp(listed, price)));
  const saved = RB.GOUGE_PAY_EXP;
  RB.GOUGE_PAY_EXP = 0;    const e0 = gp(listed, price);
  RB.GOUGE_PAY_EXP = 0.5;  const e5 = gp(listed, price);
  RB.GOUGE_PAY_EXP = 0.75; const e75 = gp(listed, price);
  RB.GOUGE_PAY_EXP = 1;    const e1 = gp(listed, price);
  RB.GOUGE_PAY_EXP = saved;
  ok('EXP=0 → 1（完全关掉该层，用于前后对照）', e0 === 1);
  ok('EXP 单调:e0.5 > e0.75 > e1', e5 > e75 && e75 > e1,
    [e5, e75, e1].map(v => v.toFixed(4)).join(' > '));
  ok('EXP=0.5 ≈ 旧开方口径量级 1/√r', near(e5, 1 / Math.sqrt(r), 0.01), String(e5));

  console.log('\n[5] 单调性与极值');
  let mono = true, prev = Infinity;
  for (const rr of [1.0001, 1.5, 2, 5, 10, 50, 250, 1000]) {
    const v = gp(listed, fair * RB.PRICE_MAX * rr);
    if (v > prev + 1e-12) mono = false;
    prev = v;
  }
  ok('随卖价单调不增', mono);
  const extreme = gp(listed, fair * RB.PRICE_MAX * 250);
  ok('250× 法定上限时折扣 < 0.05（否则压不住单价差）', extreme < 0.05, extreme.toFixed(4));
  ok('折扣恒 > 0（不归零，避免免费成交）', extreme > 0);
}

console.log('\n[6] 端到端:诚实线真实定价不吃罚（回归本次误伤 bug）');
{
  // 诚实线实际行为：LIST_POLICY=sim 挑最像的，价 = 官价 × CHEAP_LINE(0.8)
  const m = sb.TM[0];
  sb.state.relay.ability = abilOf(m);
  ok('最像的模型 + 0.8× 官价 → 1',
    gp(m, sb.officialPriceOf(m) * RB.CHEAP_LINE) === 1);
  // 高配低标：能力取最强模型的属性、标榜最弱模型 → 有效相似 >100 的「超额交付」，
  // 曾经被误罚成 0.34（本次误伤 bug 的核心场景）
  const strong = sb.TM.slice().sort((x, y) => sb.modelCapabilityOf(y) - sb.modelCapabilityOf(x))[0];
  sb.state.relay.ability = abilOf(strong);
  const over = SG(sb.state.relay.ability, mWeak);
  ok(`高配低标（相似 ${over.toFixed(0)} >100）定价 1.5× 官价 → 1（曾经的误伤点）`,
    gp(mWeak, sb.officialPriceOf(mWeak) * RB.PRICE_MAX) === 1);
}

console.log('\n' + '─'.repeat(60));
console.log(`结果:${pass} 通过 / ${fail} 失败`);
if (fail) process.exit(1);
