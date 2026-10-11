// 调教棋盘「扩色 + 扩盘」参数扫描
// 目的:在「不新增训练模式」的前提下,把 toolCall 装进现有棋盘,并算出合理的颜色数/棋盘尺寸。
// 方法:从 index_template.html 抽取真实的 GAME_CFG / randColor / makeBoard / findGroup / clearAndDrop,
//       在 vm 沙箱里跑「每步贪心消最大连通组」的玩家策略,统计单局收益。严禁手抄公式。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SRC = path.join(__dirname, '..', 'index_template.html');
const html = fs.readFileSync(SRC, 'utf8');

function extractFn(name) {
  const idx = html.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('function not found: ' + name);
  let i = html.indexOf('{', idx), depth = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(idx, j + 1); }
  }
  throw new Error('unbalanced: ' + name);
}
function extractConst(name) {
  const idx = html.indexOf('const ' + name + ' = ');
  if (idx < 0) throw new Error('const not found: ' + name);
  let i = html.indexOf('{', idx);
  if (i < 0) throw new Error('no object literal: ' + name);
  let depth = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(idx, j + 1).replace(/^const /, 'var ') + ';'; }
  }
  throw new Error('unbalanced const: ' + name);
}

const src = [
  extractConst('GAME_CFG'),
  extractFn('randColor'),
  extractFn('makeBoard'),
  extractFn('findGroup'),
  extractFn('clearAndDrop'),
].join('\n');

const ctx = vm.createContext({ Math, console });
vm.runInContext(src + '\n' +
  'this.GAME_CFG = GAME_CFG; this.randColor = randColor; this.makeBoard = makeBoard;' +
  'this.findGroup = findGroup; this.clearAndDrop = clearAndDrop;', ctx);
const CFG = ctx.GAME_CFG;
if (!CFG) throw new Error('GAME_CFG 抽取失败(vm 顶层 const 不挂全局)');
if (typeof ctx.makeBoard !== 'function') throw new Error('函数未挂到 sandbox 全局');

// ---- 真实初始属性(index_template.html 存档模板) ----
const ATTR0 = { reasoning: 5, longCtx: 2, speed: 5, knowledge: 5, fit: 70, multimodal: 10, instruct: 5, params: 5, toolCall: 5 };

// ---- 候选方案:棋盘尺寸 × 颜色维(第一个 = 主色) ----
const PLANS = [
  { tag: '现状',            cols: 7,  rows: 7,  colors: ['reasoning', 'knowledge', 'speed', 'longCtx'] },
  { tag: '5色/8x8',         cols: 8,  rows: 8,  colors: ['reasoning', 'knowledge', 'speed', 'longCtx', 'toolCall'] },
  { tag: '6色/8x8',         cols: 8,  rows: 8,  colors: ['reasoning', 'knowledge', 'speed', 'longCtx', 'toolCall', 'instruct'] },
  { tag: '6色/9x9',         cols: 9,  rows: 9,  colors: ['reasoning', 'knowledge', 'speed', 'longCtx', 'toolCall', 'instruct'] },
  { tag: '7色/9x9',         cols: 9,  rows: 9,  colors: ['reasoning', 'knowledge', 'speed', 'longCtx', 'toolCall', 'instruct', 'multimodal'] },
  { tag: '8色/10x10',       cols: 10, rows: 10, colors: ['reasoning', 'knowledge', 'speed', 'longCtx', 'toolCall', 'instruct', 'multimodal', 'params'] },
  { tag: '8色/11x11',       cols: 11, rows: 11, colors: ['reasoning', 'knowledge', 'speed', 'longCtx', 'toolCall', 'instruct', 'multimodal', 'params'] },
];

const MOVES = CFG.START_MOVES;   // 14,不动
const BASE = CFG.BASE_POINTS;    // 40
const W_P = CFG.WEIGHT_PRIMARY;  // 0.09
const W_S = CFG.WEIGHT_SECOND;   // 0.045

// 每步贪心:找全盘最大的 >=3 连通组消掉
function bestGroup(board, C, R) {
  let best = null;
  const seen = {};
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const k = r + ',' + c;
    if (seen[k]) continue;
    const g = ctx.findGroup(board, r, c);
    for (const [rr, cc] of g) seen[rr + ',' + cc] = 1;
    if (g.length >= CFG.MIN_GROUP && (!best || g.length > best.length)) best = g;
  }
  return best;
}

function playOnce(plan, runs) {
  CFG.COLS = plan.cols; CFG.ROWS = plan.rows; CFG.COLORS = plan.colors.length;
  const n = plan.colors.length;
  let sumClear = 0, sumGain = 0, stuck = 0, sumPerDim = new Array(n).fill(0), noGroupGames = 0;
  for (let it = 0; it < runs; it++) {
    let board = ctx.makeBoard();
    const tally = new Array(n).fill(0);
    let moves = MOVES;
    while (moves > 0) {
      const g = bestGroup(board, plan.cols, plan.rows);
      if (!g) { noGroupGames++; break; }   // 全盘无 >=3 连通 = 卡死
      tally[board[g[0][0]][g[0][1]]] += g.length;
      sumClear += g.length;
      board = ctx.clearAndDrop(board, g);
      moves--;
    }
    if (moves > 0) stuck++;
    for (let i = 0; i < n; i++) sumPerDim[i] += tally[i];
    let g0 = 0;
    for (let i = 0; i < n; i++) {
      const w = (i === 0) ? W_P : W_S;
      g0 += (100 - ATTR0[plan.colors[i]]) * Math.min(1, tally[i] / BASE) * w;
    }
    sumGain += g0;
  }
  return {
    tag: plan.tag,
    board: plan.cols + 'x' + plan.rows,
    n,
    avgClear: sumClear / runs,
    avgGain: sumGain / runs,
    perDim: sumPerDim.map(v => v / runs),
    stuckPct: (stuck / runs) * 100,
    noGroupPct: (noGroupGames / runs) * 100,
    colors: plan.colors,
  };
}

const RUNS = 4000;
console.log('抽取确认: GAME_CFG.COLS=' + CFG.COLS + ' ROWS=' + CFG.ROWS + ' COLORS=' + CFG.COLORS +
  ' START_MOVES=' + MOVES + ' BASE_POINTS=' + BASE + ' W(主/副)=' + W_P + '/' + W_S);
console.log('策略: 每步贪心消最大连通组,每方案 ' + RUNS + ' 局\n');

const rows = PLANS.map(p => playOnce(p, RUNS));

console.log('方案'.padEnd(12) + '棋盘'.padEnd(9) + '色'.padEnd(4) + '平均消除块/局'.padEnd(15) +
  '单局总收益(点)'.padEnd(15) + '无解率'.padEnd(9) + '提前卡死率');
console.log('-'.repeat(78));
for (const r of rows) {
  console.log(
    r.tag.padEnd(12) + r.board.padEnd(9) + String(r.n).padEnd(4) +
    r.avgClear.toFixed(1).padEnd(15) + r.avgGain.toFixed(2).padEnd(15) +
    (r.noGroupPct.toFixed(1) + '%').padEnd(9) + (r.stuckPct.toFixed(1) + '%')
  );
}

console.log('\n各维平均点数/局(分母 BASE_POINTS=40 → frac 封顶值):');
for (const r of rows) {
  const s = r.colors.map((k, i) => k + ' ' + r.perDim[i].toFixed(1) + '(f' + (r.perDim[i] / BASE).toFixed(2) + ')').join(' · ');
  console.log('  ' + r.tag.padEnd(12) + s);
}

// ---- toolCall 专项:从 5 练到各 cap 门槛需要几局 ----
console.log('\n【toolCall 专项】初始 5。cap=floor(2+toolCall*0.1):');
for (const cap of [3, 4, 5, 6, 8, 10]) {
  const need = (cap + 1 - 2) * 10; // toolCall 需要超过的阈值
  console.log('  cap=' + String(cap).padEnd(3) + ' → 需 toolCall > ' + String(need - 10).padEnd(4) + ' 即达到 ' + need + ' (净练 +' + (need - 5) + ')');
}
console.log('');
for (const r of rows) {
  const i = r.colors.indexOf('toolCall');
  if (i < 0) { console.log('  ' + r.tag.padEnd(12) + '不含 toolCall'); continue; }
  const frac = Math.min(1, r.perDim[i] / BASE);
  const w = (i === 0) ? W_P : W_S;
  const perGame = (100 - ATTR0.toolCall) * frac * w;   // trainGainMul=1
  const to40 = (40 - 5) / perGame;
  console.log('  ' + r.tag.padEnd(12) +
    'toolCall ' + (i === 0 ? '主色' : '副色') + ' w=' + w +
    ' · 单局 +' + perGame.toFixed(2) + ' · 练到 40(cap=6) 需 ' + to40.toFixed(1) + ' 局 · ' +
    'AP 消耗 ' + (to40 * CFG.AP_COST).toFixed(0) + ' · token ' + (to40 * (CFG.TOKEN_START / 1e6)).toFixed(0) + 'M(开局倍率)');
}
