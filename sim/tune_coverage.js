// 调教棋盘:在「手机竖屏可容纳」的前提下,最多能覆盖多少个训练维度?
// 可练维度(TRAIN_ITEMS 里存在对应道具的属性)共 8 个:
//   reasoning knowledge longCtx speed instruct toolCall params multimodal
// (fit 无道具、初始 70,不计入训练指标)
// 约束:棋盘像素宽 <= 300px、高 <= 500px(留给标题行+结算按钮);cell 取 26px 估算。
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
const DIMS = ['reasoning', 'toolCall', 'knowledge', 'speed', 'longCtx', 'instruct', 'params', 'multimodal'];

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
      gsum += (100 - (ATTR0[DIMS[i]] || 5)) * Math.min(1, tally[i] / BASE) * (i === 0 ? W_P : W_S);
    }
    gain += gsum;
  }
  return { n, C, R, cells: C * R, perColor: (C * R) / n, clear: clear / runs,
    deadPct: (dead / runs) * 100, perDim: per.map(v => v / runs), gain: gain / runs };
}

const RUNS = 900, CELLPX = 26, MAXW = 9, MAXR = 19; // 9*26=234px 宽;19*26=494px 高
console.log('屏幕预算: 宽 <= ' + (MAXW * CELLPX) + 'px · 高 <= ' + (MAXR * CELLPX) + 'px(cell=' + CELLPX + 'px)\n');
console.log('维度数  最优形状  总格  格/色  无解率   每维点数(frac)   像素(宽x高)');
console.log('-'.repeat(80));

for (let n = 4; n <= 8; n++) {
  let best = null;
  for (let C = 7; C <= MAXW; C++) {
    for (let R = 7; R <= MAXR; R++) {
      const r = measure(n, C, R, RUNS);
      if (r.deadPct <= 5 && (!best || r.cells < best.cells)) best = r;
    }
  }
  if (best) {
    console.log(
      String(n).padEnd(8) + (best.C + 'x' + best.R).padEnd(10) + String(best.cells).padEnd(6) +
      best.perColor.toFixed(1).padEnd(7) + (best.deadPct.toFixed(1) + '%').padEnd(9) +
      (best.perDim[0].toFixed(1) + '(f' + (best.perDim[0] / BASE).toFixed(2) + ')').padEnd(17) +
      (best.C * CELLPX + 'x' + best.R * CELLPX));
  } else {
    // 报最宽松形状的成绩,说明差多远
    const r = measure(n, MAXW, MAXR, RUNS);
    console.log(String(n).padEnd(8) + ('(最大 ' + MAXW + 'x' + MAXR + ')').padEnd(10) + String(r.cells).padEnd(6) +
      r.perColor.toFixed(1).padEnd(7) + (r.deadPct.toFixed(1) + '% ✗').padEnd(9) +
      (r.perDim[0].toFixed(1) + '(f' + (r.perDim[0] / BASE).toFixed(2) + ')').padEnd(17) + '无解率超标');
  }
}

console.log('\n【每维单局涨点一览】(列 = 各维度,值 = 平均点数/局)');
for (let n = 5; n <= 8; n++) {
  let best = null;
  for (let C = 7; C <= MAXW; C++) for (let R = 7; R <= MAXR; R++) {
    const r = measure(n, C, R, 400);
    if (r.deadPct <= 5 && (!best || r.cells < best.cells)) best = r;
  }
  const t = best || measure(n, MAXW, MAXR, 400);
  console.log('  ' + n + '维 ' + (t.C + 'x' + t.R).padEnd(7) +
    DIMS.slice(0, n).map((d, i) => d + ' ' + t.perDim[i].toFixed(1)).join(' · '));
}
