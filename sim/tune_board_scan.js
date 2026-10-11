// 调教棋盘「扩色 + 扩盘」尺寸扫描
// 问题:颜色数一多,棋盘上"至少 3 块相邻同色"变得罕见 → 全盘无解(消不动、步数白费)。
// 目标:对每个颜色数 n,找出能把「无解率」压回现状水平(<=5%)的最小方形棋盘。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index_template.html'), 'utf8');

function extractFn(name) {
  const idx = html.indexOf('function ' + name + '(');
  if (idx < 0) throw new Error('fn not found: ' + name);
  let i = html.indexOf('{', idx), depth = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(idx, j + 1); }
  }
}
function extractConst(name) {
  const idx = html.indexOf('const ' + name + ' = ');
  let i = html.indexOf('{', idx), depth = 0;
  for (let j = i; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(idx, j + 1).replace(/^const /, 'var ') + ';'; }
  }
}

const src = [extractConst('GAME_CFG'), extractFn('randColor'), extractFn('makeBoard'),
  extractFn('findGroup'), extractFn('clearAndDrop')].join('\n');
const ctx = vm.createContext({ Math, console });
vm.runInContext(src + '\nthis.GAME_CFG=GAME_CFG;this.randColor=randColor;this.makeBoard=makeBoard;this.findGroup=findGroup;this.clearAndDrop=clearAndDrop;', ctx);
const CFG = ctx.GAME_CFG;
if (!CFG) throw new Error('GAME_CFG 抽取失败');

const ATTR0 = { reasoning: 5, longCtx: 2, speed: 5, knowledge: 5, instruct: 5, params: 5, toolCall: 5, multimodal: 10 };
const MOVES = CFG.START_MOVES, BASE = CFG.BASE_POINTS, W_P = CFG.WEIGHT_PRIMARY, W_S = CFG.WEIGHT_SECOND;

function bestGroup(board, C, R) {
  let best = null; const seen = {};
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const k = r + ',' + c; if (seen[k]) continue;
    const g = ctx.findGroup(board, r, c);
    for (const [rr, cc] of g) seen[rr + ',' + cc] = 1;
    if (g.length >= CFG.MIN_GROUP && (!best || g.length > best.length)) best = g;
  }
  return best;
}

function measure(n, C, R, runs) {
  CFG.COLS = C; CFG.ROWS = R; CFG.COLORS = n;
  const dims = ['reasoning', 'knowledge', 'speed', 'longCtx', 'toolCall', 'instruct', 'multimodal', 'params'].slice(0, n);
  let clear = 0, dead = 0, gain = 0;
  const per = new Array(n).fill(0);
  for (let it = 0; it < runs; it++) {
    let board = ctx.makeBoard();
    const tally = new Array(n).fill(0);
    let m = MOVES, died = false;
    while (m > 0) {
      const g = bestGroup(board, C, R);
      if (!g) { died = true; break; }
      tally[board[g[0][0]][g[0][1]]] += g.length; clear += g.length;
      board = ctx.clearAndDrop(board, g); m--;
    }
    if (died) dead++;
    let gsum = 0;
    for (let i = 0; i < n; i++) {
      per[i] += tally[i];
      const w = i === 0 ? W_P : W_S;
      gsum += (100 - (ATTR0[dims[i]] || 5)) * Math.min(1, tally[i] / BASE) * w;
    }
    gain += gsum;
  }
  return { n, C, R, cells: C * R, perColor: (C * R) / n, clear: clear / runs, gain: gain / runs,
    deadPct: (dead / runs) * 100, perDim: per.map(v => v / runs), dims };
}

const RUNS = 900;
console.log('基线(现状 4色/7x7)复测中...');
const base = measure(4, 7, 7, RUNS);
console.log('  基线: 无解率 ' + base.deadPct.toFixed(1) + '% · 平均消除 ' + base.clear.toFixed(1) +
  ' 块/局 · 每维约 ' + (base.perDim[0]).toFixed(1) + ' 点(frac ' + (base.perDim[0] / BASE).toFixed(2) + ') · 单局收益 ' + base.gain.toFixed(2) + '\n');

console.log('对每个颜色数,向上找「无解率 <= 5%」的最小方形棋盘:\n');
console.log('色数'.padEnd(5) + '棋盘'.padEnd(9) + '总格'.padEnd(6) + '格/色'.padEnd(7) +
  '无解率'.padEnd(9) + '平均消除/局'.padEnd(13) + '每维点数(frac)'.padEnd(15) + '单局收益');

const found = [];
for (const n of [5, 6, 7, 8]) {
  let hit = null;
  for (let s = n + 2; s <= 20; s++) {
    const r = measure(n, s, s, RUNS);
    if (r.deadPct <= 5) { hit = r; break; }
    if (s === 20) { hit = { ...r, note: '20x20 仍 >5%' }; }
  }
  if (r_ok(hit)) {
    found.push(hit);
    console.log(
      String(hit.n).padEnd(5) + (hit.C + 'x' + hit.R).padEnd(9) + String(hit.cells).padEnd(6) +
      hit.perColor.toFixed(1).padEnd(7) + (hit.deadPct.toFixed(1) + '%').padEnd(9) +
      hit.clear.toFixed(1).padEnd(13) +
      (hit.perDim[0].toFixed(1) + '(f' + (hit.perDim[0] / BASE).toFixed(2) + ')').padEnd(15) +
      hit.gain.toFixed(2));
  }
}
function r_ok(h) { return h && h.deadPct <= 5; }

console.log('\n不含 toolCall 的对照(仅看尺寸-无解率关系):');
for (const s of [8, 10, 12, 14, 16]) {
  const r = measure(4, s, s, RUNS);
  console.log('  4色/' + (s + 'x' + s).padEnd(7) + '格/色 ' + r.perColor.toFixed(1).padEnd(6) +
    '无解率 ' + r.deadPct.toFixed(1) + '% · 每维 ' + r.perDim[0].toFixed(1) + ' 点(frac ' + (r.perDim[0] / BASE).toFixed(2) + ')');
}
