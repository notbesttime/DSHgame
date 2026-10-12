// sim/startup_loop.js — P0 诊断：起步期刀乐闭环（§16.6 闭环能不能跑通）
//
// 要回答的问题：起步期（天 1-13）刀乐从哪来？「考试奖 tokens → 卖掉 → 买道具」这条 §16.6 闭环
//               到底卡在哪一环？顺便量化 2026-10-05 仿真发现的 findings ③（天 24-30 周期震荡）。
//
// 与旧的 sim_fullcurve.js 的三点不同（旧脚本已被 /TEMP 清理风险，本脚本固化进项目）：
//   1. 用**真实** updateTrain / fireExam / useTrainItem（含 2026-10-05 新加的涨价+衰减+硬上限），
//      旧脚本把 updateTrain 整个 stub 成空函数 —— 所以它看不到考试奖励，也看不到涨价。
//   2. 用**真实** machines 结构（state.machines.rtx3080.count）与真实 rtx3080Price/a100Price，
//      旧脚本用的是 machines:{rtx3080:0} 的简化结构（会让 recalcProduction 算出 NaN）。
//   3. 建模了「调教小游戏」这条**主成长引擎**（旧脚本完全没有）：一局烧 TOKEN_START+14*TOKEN_PER_MOVE
//      tokens（3e6+14*5e5=10M 时代它是在跟「卖 token」抢资源，必须建进来否则属性成长被严重低估；
//      2026-10-06 已下调为 3e4+14*5e3=0.1M，小游戏从「奢侈品」变成「日常」）。
//
// 已知近似（引用结论时注意）：
//   - 小游戏用「14 步 ×4 块均分 4 色 → 每色 tally≈14 → frac=14/40」的期望值模型，不含连锁/combo 与运气。
//   - 玩家点击恒 2 tok/s、无暴击、不买风扇/水冷/额外机架/服务器。
//   - 跑分线每冷却好就发（等价于「玩家摸到了最优起步解」）；诚实线完全不发布。
//   - 官方参考价用 blendPriceNum 近似（新闻官价系数恒 1）。
//
// 运行：cd 项目根 && node sim/startup_loop.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC_PATH = path.join(__dirname, '..', 'index_template.html');
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

function exF(n) {
  const i = SRC.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('fn missing: ' + n);
  let d = 0, k = SRC.indexOf('{', i);
  for (; k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) break; } }
  return SRC.slice(i, k + 1);
}
function exC(n) {
  const i = SRC.indexOf('const ' + n + ' =');
  if (i < 0) throw new Error('const missing: ' + n);
  const eq = SRC.indexOf('=', i); let j = eq + 1;
  while (SRC[j] !== '{' && SRC[j] !== '[' && SRC[j] !== ';' && j < SRC.length) j++;
  if (SRC[j] === ';') return SRC.slice(i, j);
  const open = SRC[j], close = open === '{' ? '}' : ']'; let d = 0;
  for (; j < SRC.length; j++) { if (SRC[j] === open) d++; else if (SRC[j] === close) { d--; if (!d) break; } }
  return SRC.slice(i, j + 1);
}

// SIM_OVER_K 支持 env 覆盖,用于「单向 vs 双向」前后对照:
//     SIM_OVER_K=1 node sim/startup_loop.js   → 等价 2026-10-11 之前的双向实现
//     node sim/startup_loop.js                → 当前源码里的值(0.3)
// 之所以能这么对照:SIM_OVER_K=1 时 `df > 0 ? df * 1 : -df` 恒等于 Math.abs(df),即改动前的算法。
let SIM_OVER_K_SRC = exC('SIM_OVER_K');
if (process.env.SIM_OVER_K) SIM_OVER_K_SRC = SIM_OVER_K_SRC.replace(/=\s*[\d.]+/, '= ' + Number(process.env.SIM_OVER_K));

const CODE = [
  exC('CTX_MAX_K'), exC('KNOW_M0'), exC('KNOW_M1'), exC('TOK_PER_SPEED_POINT'),
  exC('CAP_W'), exC('CAP_SPEED_W'), exC('CAP_CTX_W_LO'), exC('CAP_CTX_W_HI'),
  exC('CAP_MM_W_LOW'), exC('CAP_MM_W_MID'), exC('CAP_MM_W_HIGH'),
  exC('CAP_FIT_OPT'), exC('CAP_FIT_PENALTY'), exC('CAP_FIT_EXP'), exC('CAP_NORM'),
  exC('SIM_KEYS'), exC('SIM_W'), exC('SIM_SAT'), exC('SIM_GATE_KNOWLEDGE'), exC('SIM_GATE_MULTIMODAL'),
  SIM_OVER_K_SRC,   // 2026-10-11 加:rawSimilarityTo/closestModel 的方向折扣系数(env 可覆盖,见上)
  exC('CAP_MUL_EXP'), exC('CAP_MUL_MIN'), exC('CAP_MUL_MAX'),
  exC('REAL_MODELS'),
  exC('RELAY_BIZ'), exC('PUBLISH_CFG'), exC('TRAIN_CFG'), exC('TRAIN_ITEMS'),
  exC('GAME_CFG'), exC('TRAIN_MODES'),
  exF('ctxK'), exF('cutoffMonths'), exF('ctxAttr'), exF('monthsFromStr'),
  exF('modelCapability'), exF('deriveModelAttrs'), exF('modelToAttrs'), exF('modelCapabilityOf'),
  exF('closestModel'), exF('rawSimilarityTo'), exF('capMulTo'), exF('similarityTo'),
  exF('blendPriceNum'),
  exF('relayPriceBand'), exF('clampRelayPrice'),
  exF('relayUsageMul'), exF('relayGrowWeight'), exF('relayTrustMul'), exF('relaySellPayMul'),
  exF('fairPriceOf'), exF('relayGougePayMul'),   // 2026-10-12:虚标折价的锚与层5,漏抽会 ReferenceError
  exF('relayRenewMul'), exF('relayUserCap'), exF('relayBaseUsers'),
  exF('findModelByName'), exF('relayListedModel'),
  exF('boardOrder'), exF('effectiveCap'), exF('boardRankOf'), exF('repCoef'),
  exF('publishPoolDraw'), exF('doPublish'), exF('publishTick'),
  exF('relayHourlyRefresh'), exF('relayRepSettle'), exF('updateRelayBusiness'),
  // —— 生产侧(真实机器结构) ——
  exF('rtx3080Price'), exF('a100Price'), exF('recalcProduction'),
  // —— 调教/训练(真实,含涨价+衰减+上限) ——
  exF('trainDefaults'), exF('trainGainMul'), exF('abilityAdd'), exF('spendAP'),
  exF('trainItemByKey'), exF('trainPriceCount'), exF('trainBoughtCount'),
  exF('trainItemPrice'), exF('trainItemMaxed'), exF('trainPriceText'),
  exF('trainPressureMaxed'), exF('trainCanUse'), exF('useTrainItem'), exF('finishSession'),
  exF('trainElapsedDays'), exF('fireExam'), exF('updateTrain'),
  // —— stubs ——
  'var MODEL_ATTR_OVERRIDE = {};',
  'function officialPriceOf(m){ return blendPriceNum(m); }',
  'function saveGame(){} function spawnFloatText(){} function updateTokenDisplay(){}',
  'function newsTick(){} function gameClockFull(){ return "x"; }',
  'function formatNum(v){ return String(v); } function fmt2(v){ return String(v); } function formatRate(v){ return String(v); }',
  'var app = { screen: { width: 0, height: 0 } };',
  'var screenPanelOpen=false, panelTab="", backendLive=null, backendSelIdx=-1;',
  'var relaySceneOpen=false, relayHudLine1=null, relayHudLine2=null;',
  'var tuneSceneOpen=false, tuneHudLine1=null, tuneHudLine2=null;',
  'var relayUiAccum = 0;',
  'var gameState = null;',
  'var state = null;',
  'var RB = RELAY_BIZ; var UB = updateRelayBusiness; var TM = REAL_MODELS; var TI = TRAIN_ITEMS;',
  'var PC = PUBLISH_CFG; var GC = GAME_CFG; var TCFG = TRAIN_CFG; var TMODES = TRAIN_MODES;',
  // ⚠️ 顶层 const/let 不会挂到 vm 沙箱对象上(只有 var 与函数声明会)。
  //    任何要在沙箱外读的常量(REAL_MODELS / SIM_KEYS / RELAY_BIZ …)都必须在这里起别名,
  //    否则外面拿到的是 undefined —— require 本文件做单元验证的脚本尤其容易踩。
  'var SKEYS = SIM_KEYS;',
].join('\n');

const INIT = `
  state = {};
  state.tokens = 0;
  state.machines = { rtx3080:{count:0}, a100:{count:0}, extraRack:{count:0}, server:{count:0} };
  state.cooling = { fan:{count:0}, waterCooling:{count:0} };
  state.scripts = { autoClick:false, miracle:false };
  recalcProduction();
  state.relay = {
    ability: { reasoning:5, longCtx:2, speed:5, knowledge:5, fit:70, multimodal:10, instruct:5, params:5, toolCall:5 },
    listedModel: null, price: 0, pool:'standard', reputation: 1, dollars: 0,
    users: 2, userSlots: [{leftH:3},{leftH:5}], activeCoef: 0.65,
    gameHour: 0, hourAccum: 0, repAccum: 0, serviceDown: false,
    totalTokensSold: 0, totalDollarsEarned: 0,
    train: trainDefaults(),
    publish: { active:false, strategy:null, model:null, remainH:0, totalH:0, lastCap:null },
    news: { totalH: 0, nextSpawnH: 6, active: [], collected: {}, boosts: [] },
  };
  state.relay.train.ap = 10;
  var __examTok = 0, __examDays = [], __origFireExam = fireExam;
  fireExam = function(exam){ var b = state.tokens; __origFireExam(exam); var d = state.tokens - b; __examTok += d; __examDays.push({ name: exam.name, tok: d }); };
  var __excTok = 0, __boxTok = 0;
`;

function makeSim(seed) {
  const M = Object.create(Math);
  let s = seed >>> 0;
  M.random = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const sb = { console, Math: M };
  vm.createContext(sb);
  vm.runInContext(CODE, sb);
  // 环境变量覆盖 token 成本:做「改动前后」同代码对照,避免手抄旧值到另一份脚本里。
  //   例:TOK_START=3e6 TOK_MOVE=5e5 node sim/startup_loop.js   → 2026-10-07 下调前的基线
  if (process.env.TOK_START) sb.GC.TOKEN_START = Number(process.env.TOK_START);
  if (process.env.TOK_MOVE) sb.GC.TOKEN_PER_MOVE = Number(process.env.TOK_MOVE);
  // 人数通路参数覆盖(2026-10-11 §20.8 方案 D 扫描用):
  //   BASE_DIV  = relayBaseUsers 的分母(现 25);REP_LOSS_MUL = RUN_REP_LOSS 的缩放
  //   ⚠️ relayBaseUsers 是 function 声明 → 本身就是沙箱全局属性,直接赋值即可替换,
  //      被抽取的 relayHourlyRefresh 会走新版本(functions 挂在 globalThis 上)。
  if (process.env.BASE_DIV) {
    const d = Number(process.env.BASE_DIV);
    sb.relayBaseUsers = function () { return 2 + Math.floor(sb.state.relay.reputation / d); };
  }
  // D-1 强化(2026-10-11)：base 追加「模型能力」项。先在这里扫参数，定好再落进游戏代码。
  //   BASE_MCAP_DIV   = 能力项除数 ; BASE_MCAP_FLOOR = 能力扣除门槛(低于它不加成,防开局通胀)
  //   BASE_REP_DIV    = 信誉项除数(默认 25 = 现状)
  if (process.env.BASE_MCAP_DIV) {
    const rd = Number(process.env.BASE_REP_DIV || 25);
    const md = Number(process.env.BASE_MCAP_DIV);
    const fl = Number(process.env.BASE_MCAP_FLOOR || 20);
    sb.relayBaseUsers = function () {
      const R = sb.state.relay;
      const rep = R.reputation || 0;
      const mc = sb.modelCapability(R.ability);
      return 2 + Math.floor(rep / rd) + Math.floor(Math.max(0, mc - fl) / md);
    };
  }
  if (process.env.REP_LOSS_MUL) {
    // ⚠️ RUN_REP_LOSS 属于 PUBLISH_CFG(别名 PC),不是 RELAY_BIZ —— 放错对象会 TypeError
    const k = Number(process.env.REP_LOSS_MUL);
    sb.PC.RUN_REP_LOSS = [sb.PC.RUN_REP_LOSS[0] * k, sb.PC.RUN_REP_LOSS[1] * k];
  }
  // 虚标罚力度(2026-10-12)可用 env 覆盖,用于扫描「罚多重才既不误伤诚实、又能压住虚标」。
  // 传 0 即关掉该层 —— 等价于「只有相似度维度的旧行为」,方便做前后对照。
  // ⚠️ RB = RELAY_BIZ 是同一个对象引用,改 sb.RB.X 就等于改 RELAY_BIZ.X;但改完必须重新 runInContext(INIT)
  //    让依赖它的闭包重新建立 —— 这里正好在 INIT 之前,顺序没问题。
  if (process.env.GOUGE_REP_K !== undefined) sb.RB.GOUGE_REP_K = Number(process.env.GOUGE_REP_K);
  // 2026-10-12:GOUGE_PAY_K(系数)已被 GOUGE_PAY_EXP(幂指数)取代 —— 见 index_template.html RELAY_BIZ 处推导。
  // EXP=0.5 退化成旧开方式,便于与「换幂律前」的结论对照。
  if (process.env.GOUGE_PAY_EXP !== undefined) sb.RB.GOUGE_PAY_EXP = Number(process.env.GOUGE_PAY_EXP);
  vm.runInContext(INIT, sb);
  return sb;
}

const CLICKS_PER_SEC = 2;
const FRAMES_PER_HOUR = 60 * 30;
const DT = 1 / 30;
// DAYS 支持 env 覆盖:调参扫描时用 DAYS=15 把单跑成本砍半(默认 30 保持历史口径可比)。
const DAYS = Number(process.env.DAYS) || 30;
// SUMMARY_ONLY=1 → 只打「SUMMARY|…」一行 + 汇总块，供参数扫描用（不打 30 行日表）
const SUMMARY_ONLY = !!process.env.SUMMARY_ONLY;
// LIST_POLICY（2026-10-11）：标榜策略。默认 'price' = 挑「官价×相似度」期望收入最高的（= 现脚本原行为，
// "摸到最优起步解"）；'sim' = 挑最像的（牺牲单价换信誉）。
// ⚠️ 这条策略会决定信誉走向：相似度 <80 时 relayRepSettle 是「主跌」分支 → 信誉归零 → base 恒 2。
const LIST_POLICY = process.env.LIST_POLICY || 'price';

// 调教小游戏（近似模型，见文件头「已知近似」）
function playMiniGame(sb, bufferTok) {
  const R = sb.state.relay, T = R.train;
  const mul = Math.min(1 + (R.news.totalH / 24) * sb.GC.TOKEN_GROWTH_PER_DAY, sb.GC.TOKEN_MUL_CAP);
  const cost = sb.GC.TOKEN_START * mul + sb.GC.START_MOVES * sb.GC.TOKEN_PER_MOVE * mul;
  if (T.ap < sb.GC.AP_COST || sb.state.tokens < cost + bufferTok) return 0;
  sb.state.tokens -= cost; T.ap -= sb.GC.AP_COST;
  const gm = sb.trainGainMul();
  // 期望模型:14 步 × 每消约 4 块 = 56 块总消除量,均摊到 COLORS 个维度。
  // ⚠️ 旧版写死 /4(4 色时代),6 色后仍按 4 色摊 → 每维点数被高估 1.5 倍。
  //    与 tune_landscape.js 的实测口径对齐:14*4/6/BASE_POINTS = 9.33/维,实测 9.3 ✅
  const frac = Math.min(1, (sb.GC.START_MOVES * 4 / sb.GC.COLORS) / sb.GC.BASE_POINTS);
  const mode = sb.TMODES[0];
  for (const k of mode.colors) {
    const w = (k === mode.primary) ? sb.GC.WEIGHT_PRIMARY : sb.GC.WEIGHT_SECOND;
    sb.abilityAdd(k, (100 - R.ability[k]) * frac * w * gm);
  }
  return cost;
}

function run(opts) {
  const sb = makeSim(opts.seed);
  const R = sb.state.relay;
  const DAY = 24 * FRAMES_PER_HOUR;
  const st = { machinesTok: 0, machinesBought: 0, trainBought: 0, trainSpent: 0, miniGames: 0, miniTok: 0, runs: 0, prodTok: 0, sellCap: 0, downH: 0, buyLog: [] };
  const rows = [];
  let lastDollars = 0, firstAfford = null;

  const machinesN = () => sb.state.machines.rtx3080.count;
  const a100N = () => sb.state.machines.a100.count;
  const prodNow = () => sb.state.machines.rtx3080.count * 5 + sb.state.machines.a100.count * 50;
  // 与 updateRelayBusiness 同口径:上架 与 自研(未标榜但价≤SELF_PRICE_MAX) 都能卖。
  // ⚠️ 这里漏掉自研分支过一次,导致需求被算成 0(自研是起步期唯一的卖出口)。
  const demandPerH = () => {
    const lm = sb.relayListedModel();
    const listed = !!lm;
    const selfMode = !listed && R.price > 0 && R.price <= sb.RB.SELF_PRICE_MAX;
    if ((!listed && !selfMode) || R.users <= 0 || !(R.price > 0)) return 0;
    const usage = listed ? sb.relayUsageMul(R.price, sb.officialPriceOf(lm)) : 1;
    return R.users * R.ability.speed * R.activeCoef * usage * 60;   // ×60:1 游戏时 = 60 现实秒(dt 是现实秒)
  };

  for (let f = 1; f <= DAYS * DAY; f++) {
    const gain = (prodNow() + CLICKS_PER_SEC) * DT;
    sb.state.tokens += gain; st.prodTok += gain;
    R.news.totalH = f * DT * (sb.RB.GAME_MIN_PER_REAL_SEC / 60);   // 只算游戏时,与真实一致
    sb.UB(DT);
    // 断供统计(2026-10-11):serviceDown 期间 relayHourlyRefresh 每小时扣 0.1 信誉 = 每天 -2.4,
    // 远大于信誉自然增长(0.21~0.61/天) → 一旦长期断供,信誉永远回不到 25,base 被钉死在 2。
    if (R.serviceDown) st.downH += DT * (sb.RB.GAME_MIN_PER_REAL_SEC / 60);

    if (f % FRAMES_PER_HOUR === 0) {
      const hourTotal = f / FRAMES_PER_HOUR;
      const income = R.dollars - lastDollars; lastDollars = R.dollars;

      // —— 每游戏时的决策 ——
      // 1) 跑分/对标发布(仅跑分线)
      if (opts.publish && !R.publish.active) {
        let target = null, bestOff = 0;
        for (const m of sb.TM) {
          if (sb.similarityTo(R.ability, m) < sb.PC.SIM_GATE) {
            const off = sb.officialPriceOf(m);
            if (off > bestOff) { target = m; bestOff = off; }
          }
        }
        if (target && sb.doPublish('run', target.n).ok) { R.price = sb.clampRelayPrice(bestOff * sb.RB.PRICE_MAX, bestOff); st.runs++; }
      }
      if (!R.publish.active) {
        // 2) 标榜:有效相似 ≥ LIST_SIM_MIN 里挑期望收入最高;没有 → 自研兜底
        let best = null, bestScore = 0, bestOff = 0;
        for (const m of sb.TM) {
          const eff = sb.similarityTo(R.ability, m);
          if (eff >= sb.RB.LIST_SIM_MIN) {
            const off = sb.officialPriceOf(m);
            // LIST_POLICY='sim' → 挑最像的(信誉友好);'price' → 原行为(收入友好)
            const score = (LIST_POLICY === 'sim') ? eff : off * Math.max(0.5, eff / 80);
            if (score > bestScore) { best = m; bestScore = score; bestOff = off; }
          }
        }
        if (best) { R.listedModel = best.n; R.price = sb.clampRelayPrice(bestOff * sb.RB.CHEAP_LINE, bestOff); }
        else { R.listedModel = null; R.price = sb.RB.SELF_PRICE_MAX; }
      }
      // 3) 瓶颈决策:卡产能 → tokens 买机器;卡客流 → 买训练道具 / 打调教
      const prod = prodNow(), dem = demandPerH() / 60;
      st.sellCap += demandPerH();   // 本游戏时可承载的卖出量(用于算「变现容量」)
      if (prod < dem * 0.999) {
        const p30 = sb.rtx3080Price(), pa = sb.a100Price();
        if (sb.state.tokens >= p30 && (p30 / 5 <= pa / 50 || sb.state.tokens < pa)) {
          sb.state.tokens -= p30; sb.state.machines.rtx3080.count++; sb.recalcProduction(); st.machinesTok += p30; st.machinesBought++;
        } else if (sb.state.tokens >= pa) {
          sb.state.tokens -= pa; sb.state.machines.a100.count++; sb.recalcProduction(); st.machinesTok += pa; st.machinesBought++;
        }
      } else {
        // 买「最优性价比」道具（用真实 useTrainItem:含涨价/上限/AP/压力/疗程独占）
        let bestV = 0, bestItem = null;
        for (const it of sb.TI) {
          if (!sb.trainCanUse(it)) continue;
          let v = 0;
          for (const k in it.rate) v += it.rate[k] * (100 - R.ability[k]) * sb.trainGainMul();
          v /= sb.trainItemPrice(it.key);
          if (v > bestV) { bestV = v; bestItem = it; }
        }
        if (bestItem) {
          const before = R.dollars, pr = sb.trainItemPrice(bestItem.key);
          if (sb.useTrainItem(bestItem)) {
            st.trainBought++; st.trainSpent += before - R.dollars; st.buyLog.push([hourTotal / 24, bestItem.key]);
            // 「首次买得起」以首次成功购买为准：智能体一有钱就立刻花掉，采样瞬时余额永远看不到"存着钱"的状态
            if (!firstAfford) firstAfford = { day: +(hourTotal / 24).toFixed(2), key: bestItem.key, name: bestItem.name, price: pr };
          }
        }
      }
      // 4) 调教小游戏(拿「一天需求」当保留库存,其余 tokens 才敢烧)
      const miniCost = playMiniGame(sb, demandPerH() * 24);
      if (miniCost) { st.miniGames++; st.miniTok += miniCost; }

      if (f % DAY === 0) {
        const lm = sb.relayListedModel();
        const day = hourTotal / 24;
        const offic = lm ? sb.officialPriceOf(lm) : 0;
        rows.push({
          day, dollars: R.dollars, income, users: R.users, rep: R.reputation,
          prod: prodNow(), dem:hourTotal, demandPerH: demandPerH(),
          examTok: sb.__examTok, sold: R.totalTokensSold, stock: sb.state.tokens,
          trainBought: st.trainBought, miniGames: st.miniGames,
          machines: sb.state.machines.rtx3080.count + sb.state.machines.a100.count,
          speed: R.ability.speed, toolCall: R.ability.toolCall, reason: R.ability.reasoning,
          cap: sb.modelCapability(R.ability),
          offic, gw: lm ? sb.relayGrowWeight(R.price, offic) : 0,
          mul: lm ? sb.relayUsageMul(R.price, offic) : 0,
          // 虚标罚诊断列(2026-10-12):sim=标榜对象相似度, fair=能力相称价, gouge=层5 成交折扣。
          // ⚠️ 只用来判断「诚实线是否被误伤」:诚实线价 = 官价×0.8 < 续约线 1.1 ⇒ gouge 应恒为 1.00。
          sim: lm ? sb.similarityTo(R.ability, lm) : 0,
          fair: sb.fairPriceOf(R.ability),
          gouge: lm ? sb.relayGougePayMul(lm, R.price) : 1,
          organic: R.userSlots.filter(u => !u.surge).length,
          // 并发上限(2026-10-06 新增):board 加色把 toolCall 塞进免费通路后,
          // 「toolCall → relayUserCap」这条链路才第一次真的能动,必须显式量出来。
          capU: sb.relayUserCap(), baseU: sb.relayBaseUsers(),
        });
      }
    }
  }
  return { sb, st, rows, R, firstAfford };
}

function report(label, r) {
  const { sb, st, rows, R } = r;
  const issued = sb.__examTok;
  const supply = st.prodTok + issued;
  if (!SUMMARY_ONLY) {
  console.log('\n' + '='.repeat(120));
  console.log('【' + label + '】');
  console.log('='.repeat(120));
  console.log('天 |  刀乐$ |  收入/时 | 用户 |  需求tok/h | 产能t/s | 考试M | 已卖M | 库存M | 机器 | 道具 | 调教 | 速/工/推/能力 | 上限/底数');
  console.log('   尾部诊断: 官$=标榜对象官价 相$=能力相称价(fairPriceOf) 仿=与标榜对象的有效相似度'
    + ' 增=增长权重 用量=单用户用量系数 虚折=层5虚标成交折扣(1.00=未触发) 自然=自然流量人数');
  for (const x of rows) {
    console.log(
      String(x.day).padStart(2) + ' | ' + ('$' + x.dollars.toFixed(2)).padStart(7)
      + ' | ' + ('$' + x.income.toFixed(4)).padStart(8)
      + ' | ' + String(x.users).padStart(4)
      + ' | ' + String(Math.round(x.demandPerH)).padStart(10)
      + ' | ' + String(Math.round(x.prod)).padStart(7)
      + ' | ' + (x.examTok / 1e6).toFixed(1).padStart(5)
      + ' | ' + (x.sold / 1e6).toFixed(2).padStart(5)
      + ' | ' + (x.stock / 1e6).toFixed(1).padStart(5)
      + ' | ' + String(x.machines).padStart(4)
      + ' | ' + String(x.trainBought).padStart(4)
      + ' | ' + String(x.miniGames).padStart(4)
      + ' | ' + x.speed.toFixed(0) + '/' + x.toolCall.toFixed(0) + '/' + x.reason.toFixed(0) + '/' + x.cap.toFixed(1)
      + ' | ' + String(x.capU).padStart(3) + ' / ' + String(x.baseU) + ' 信' + x.rep.toFixed(1)
      + ' 官$' + x.offic.toFixed(1) + ' 相$' + x.fair.toFixed(2) + ' 仿' + x.sim.toFixed(0)
      + ' 增' + x.gw.toFixed(2) + ' 用量' + x.mul.toFixed(2) + ' 虚折' + x.gouge.toFixed(2) + ' 自然' + x.organic
      + ' ' + (x.users >= x.capU ? '⛔撞顶' : '')
    );
  }
  console.log('\n-- 考试发放明细 --');
  for (const e of sb.__examDays) console.log('   ' + e.name + '  +' + (e.tok / 1e6).toFixed(2) + 'M tok');
  } // ←── SUMMARY_ONLY 的门在此合上：下面「汇总」无论如何都打（扫描时要的就是它）
  const balance = supply - st.machinesTok - st.miniTok - R.totalTokensSold - sb.state.tokens;
  {
    const lr = rows[rows.length - 1];
    console.log('SUMMARY|' + label + '|刀乐$' + R.dollars.toFixed(2) + '|局数' + st.miniGames
      + '|toolCall' + R.ability.toolCall.toFixed(0) + '|capU' + sb.relayUserCap() + '|baseU' + sb.relayBaseUsers()
      + '|信誉' + R.reputation.toFixed(1) + '|已卖M' + (R.totalTokensSold / 1e6).toFixed(2)
      + '|容量M' + (st.sellCap / 1e6).toFixed(2) + '|供给M' + (supply / 1e6).toFixed(2)
      + '|用户D30=' + lr.users + '|道具$' + st.trainSpent.toFixed(2)
      + '|断供时' + st.downH.toFixed(0) + '/' + (DAYS * 24)
      + '|标榜=' + (R.listedModel || '无') + '|价$' + R.price.toFixed(3)
      + '|自研=' + ((!sb.relayListedModel() && R.price > 0 && R.price <= sb.RB.SELF_PRICE_MAX) ? '是' : '否'));
  }
  console.log('\n-- 汇总 --');
  console.log('   token 供给 = 产能 ' + (st.prodTok / 1e6).toFixed(2) + 'M + 考试 ' + (issued / 1e6).toFixed(2) + 'M = ' + (supply / 1e6).toFixed(2) + 'M');
  console.log('   token 去向 = 卖 ' + (R.totalTokensSold / 1e6).toFixed(2) + 'M + 库存 ' + (sb.state.tokens / 1e6).toFixed(2) + 'M'
    + ' + 机器 ' + st.machinesTok.toFixed(0) + ' + 调教 ' + (st.miniTok / 1e6).toFixed(2) + 'M');
  console.log('   ⚖ 平衡校验 ' + (Math.abs(balance) < 1 ? '✅ 平账' : '❌ 差 ' + balance.toFixed(0)) + ' (残差 ' + balance.toFixed(6) + ')');
  console.log('   ★ 需求的销货容量 = ' + (st.sellCap / 1e6).toFixed(2) + 'M tok（30 天里市场总共只能吃下这么多）');
  console.log('     已卖 ' + (R.totalTokensSold / 1e6).toFixed(2) + 'M / 容量 ' + (st.sellCap / 1e6).toFixed(2) + 'M'
    + ' → 市场消化率 ' + (st.sellCap > 0 ? (R.totalTokensSold / st.sellCap * 100).toFixed(0) + '%' : 'n/a'));
  console.log('     → 瓶颈判定：' + (supply > st.sellCap * 1.05
    ? '需 求 不 足 —— 供给 ' + (supply / 1e6).toFixed(2) + 'M ≫ 市场容量 ' + (st.sellCap / 1e6).toFixed(2) + 'M，'
      + '考试 tokens 堆在库存里卖不掉 ❌ 闭环断在「卖」这一环'
    : '产 能 不 足 —— 容量 ' + (st.sellCap / 1e6).toFixed(2) + 'M ≥ 供给 ' + (supply / 1e6).toFixed(2) + 'M，'
      + '市场还饿着 → 考试 tokens 一发出就能变现 ✅'));
  console.log('   刀乐 ' + ('$' + R.dollars.toFixed(2)) + ' · 机器 ' + sb.state.machines.rtx3080.count + '×3080 + ' + sb.state.machines.a100.count + '×A100'
    + ' · 产能 ' + Math.round(sb.state.machines.rtx3080.count * 5 + sb.state.machines.a100.count * 50) + ' tok/s · 发布 ' + st.runs + ' 次');
  console.log('   调教小游戏 ' + st.miniGames + ' 局（吃掉 ' + (st.miniTok / 1e6).toFixed(2) + 'M）· 单局成本 '
    + (sb.GC.TOKEN_START + sb.GC.START_MOVES * sb.GC.TOKEN_PER_MOVE).toExponential(1) + ' tok × 倍率(封顶 ' + sb.GC.TOKEN_MUL_CAP + ')');
  {
    const last = rows[rows.length - 1];
    console.log('   ★ 并发上限链路: toolCall ' + R.ability.toolCall.toFixed(0)
      + ' → relayUserCap=' + sb.relayUserCap() + ' (开局 2) · 底数 relayBaseUsers=' + sb.relayBaseUsers()
      + ' · day30 实到 ' + last.users + ' 人' + (last.users >= last.capU ? ' ⛔撞上限' : ' (未撞顶,空间还在)'));
  }
  console.log('   道具 ' + st.trainBought + ' 次 / $' + st.trainSpent.toFixed(2));
  console.log('   首次买得起道具：' + (r.firstAfford ? ('第 ' + r.firstAfford.day + ' 游戏天 · ' + r.firstAfford.name + ' $' + r.firstAfford.price) : '30 天内从未买得起任何道具'));
}

// 只在「被直接运行」时跑仿真。被 require 时导出沙箱工厂,给单元验证脚本复用 ——
// ⚠️ 别在别的脚本里另抄一份「抽取清单」:2026-10-12 就因为手抄漏了 deriveModelAttrs 需要的字段,
//    造出过一份「高配低标被罚 56%」的假结论(真实 12%)。沙箱只有这一份定义。
if (require.main === module) {
  const honest = run({ seed: 20261006, publish: false });
  report('诚实线（完全不发布）', honest);
  const runner = run({ seed: 20261006, publish: true });
  report('跑分线（每冷却好就发 —— 摸到最优起步解）', runner);
}

module.exports = { makeSim, CODE, INIT };
