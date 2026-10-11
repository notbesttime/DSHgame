// 调教棋盘「横屏」形状扫描(修正版)
// 事实修正:updateOrientationGate() = isTouchDevice() && isPortraitViewport()
//   → 触屏设备被强制横屏游玩(iPhone SE = 667x375, iPhone 14 = 844x390)。
//   → 真实约束是「宽而矮」,棋盘必须扁平(列多行少),而不是竖屏时代的「窄而高」。
// 约束:棋盘可用宽 = w - 左边距20 - 属性区宽240 - 间距30;可用高 = h - 顶部146 - 底栏56 - 净空14
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index_template.html'), 'utf8');
function extractFn(name) {
  const idx = html.indexOf('function ' + name + '(');
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
const DIMS = ['reasoning', 'toolCall', 'knowledge', 'speed', 'longCtx', 'instruct', 'params', 'multimodal'];
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
  let dead = 0, gain = 0; const per = new Array(n).fill(0);
  for (let it = 0; it < runs; it++) {
    let board = ctx.makeBoard();
    const tally = new Array(n).fill(0);
    let m = MOVES, died = false;
    while (m > 0) {
      const g = bestGroup(board, C, R);
      if (!g) { died = true; break; }
      tally[board[g[0][0]][g[0][1]]] += g.length;
      board = ctx.clearAndDrop(board, g); m--;
    }
    if (died) dead++;
    let gs = 0;
    for (let i = 0; i < n; i++) {
      per[i] += tally[i];
      gs += (100 - (ATTR0[DIMS[i]] || 5)) * Math.min(1, tally[i] / BASE) * (i === 0 ? W_P : W_S);
    }
    gain += gs;
  }
  return { n, C, R, cells: C * R, perColor: (C * R) / n, deadPct: (dead / runs) * 100,
    perDim: per.map(v => v / runs), gain: gain / runs };
}

const RUNS = 1200, LM = 20, LIST_W = 240, GAP = 30, TOP = 146, NAV = 56, CLEAR = 14;
function cellOf(w, h, C, R) {
  const WMAX = w - LM - LIST_W - GAP, HMAX = h - TOP - NAV - CLEAR;
  return { cell: Math.min(WMAX / C, HMAX / R), WMAX, HMAX };
}

const CANDS = [
  [6, 13, 9], [6, 14, 9], [6, 15, 8], [6, 16, 8], [6, 17, 7], [6, 18, 7], [6, 20, 6], [6, 12, 10],
  [5, 11, 7], [5, 13, 6], [5, 12, 7], [5, 14, 6],
];

console.log('手机横屏 iPhone SE 667x375: 棋盘可用区 = ' + (667 - LM - LIST_W - GAP) + 'x' + (375 - TOP - NAV - CLEAR));
console.log('桌面 1440x980:               棋盘可用区 = ' + (1440 - LM - LIST_W - GAP) + 'x' + (980 - TOP - NAV - CLEAR) + '\n');
console.log('色数 形状    总格  格/色  无解率  每维点数(frac)   SE-cell  桌面-cell  棋盘(SE)   触感(SE)');
console.log('-'.repeat(104));
const ok = [];
for (const [n, C, R] of CANDS) {
  const r = measure(n, C, R, RUNS);
  const s = cellOf(667, 375, C, R), d = cellOf(1440, 980, C, R);
  const dc = Math.min(d.cell, 64);
  let touch = 'OK';
  if (s.cell < 26) touch = '偏小';
  if (s.cell < 21) touch = '过小';
  if (r.deadPct <= 5) ok.push({ ...r, s: s.cell, d: dc, touch });
  console.log(
    String(n).padEnd(5) + (C + 'x' + R).padEnd(8) + String(r.cells).padEnd(6) + r.perColor.toFixed(1).padEnd(7) +
    (r.deadPct.toFixed(1) + '%').padEnd(8) +
    (r.perDim[0].toFixed(1) + '(f' + (r.perDim[0] / BASE).toFixed(2) + ')').padEnd(16) +
    s.cell.toFixed(1).padEnd(9) + dc.toFixed(1).padEnd(11) +
    (Math.round(s.cell * C) + 'x' + Math.round(s.cell * R)).padEnd(11) + touch
  );
}

console.log('\n【合格(无解率<=5%)按 SE 上 cell 从大到小】');
ok.sort((a, b) => b.s - a.cell);
for (const r of ok) {
  console.log('  ' + r.n + '色 ' + r.C + 'x' + r.R + '  cell=' + r.s.toFixed(1) + 'px  ' + r.touch +
    '  每维 ' + r.perDim[0].toFixed(1) + ' 点  覆盖率 ' + r.n + '/8');
}
