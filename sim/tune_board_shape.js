// 调教棋盘「非方形」扫描:找出手机竖屏能容纳的形状
// 依据:手机竖屏(375x667)横向紧张、纵向宽裕 → 优先「窄而高」的棋盘。
// 目标:对 5 色 / 6 色,在 COLS <= 9 的前提下找最小 ROWS 使无解率 <= 5%。
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
  let clear = 0, dead = 0, gain = 0; const per = new Array(n).fill(0);
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
      gsum += (100 - (ATTR0[dims[i]] || 5)) * Math.min(1, tally[i] / BASE) * (i === 0 ? W_P : W_S);
    }
    gain += gsum;
  }
  return { n, C, R, cells: C * R, perColor: (C * R) / n, clear: clear / runs, gain: gain / runs,
    deadPct: (dead / runs) * 100, perDim: per.map(v => v / runs), dims };
}

const RUNS = 900;
const CELL_MIN = 26; // 触摸可用下限(现码硬编 28,这里给触碰判定放宽的余量)
console.log('手机竖屏 375x667 换算:cells*' + CELL_MIN + 'px 为棋盘实际宽/高\n');
console.log('色数  形状      总格  格/色  无解率   每维点数(frac)   棋盘像素(宽x高)   375宽能放?');
console.log('-'.repeat(96));

function px(C, R) { return (C * CELL_MIN) + 'x' + (R * CELL_MIN); }
function fit(C) { return C * CELL_MIN <= 300 ? '是' : '否'; }

for (const n of [5, 6]) {
  let printed = 0;
  for (const C of [7, 8, 9]) {
    for (let R = 7; R <= 18; R++) {
      const r = measure(n, C, R, RUNS);
      if (r.deadPct <= 5) {
        console.log(
          String(n).padEnd(5) + (C + 'x' + R).padEnd(10) + String(r.cells).padEnd(6) +
          r.perColor.toFixed(1).padEnd(7) + (r.deadPct.toFixed(1) + '%').padEnd(9) +
          (r.perDim[0].toFixed(1) + '(f' + (r.perDim[0] / BASE).toFixed(2) + ')').padEnd(17) +
          px(C, R).padEnd(18) + fit(C));
        printed++;
        break;
      }
    }
  }
  if (printed) console.log('');
}

console.log('对照:如果只求「不卡死」而不计手感,同样 3 个宽度下的极端形状:');
for (const n of [5, 6]) {
  for (const C of [7, 8, 9]) {
    const r = measure(n, C, 20, RUNS);
    console.log('  ' + n + '色/' + (C + 'x20').padEnd(7) + '无解率 ' + r.deadPct.toFixed(1) + '% · 每维 ' +
      r.perDim[0].toFixed(1) + '(f' + (r.perDim[0] / BASE).toFixed(2) + ')');
  }
}
