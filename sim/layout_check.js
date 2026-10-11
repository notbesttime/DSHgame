// 校验 buildTuneGameLayer 的布局算式在各类屏幕上是否溢出 / 是否压到底部标签栏
// 复刻 index_template.html 里改后的常量,若那边改了这里要同步(仅几行,肉眼可对比)。
const COLS = 9, ROWS = 13, NCOLORS = 6, ROW_H = 24;
const TOP = 146;      // 内容顶边(避开标题 92 + 资源行 124)
const BUDGET = 380;   // cell 高度预算:顶部 146 + 底部(提示32+属性72+间距10+按钮46+底栏70+余量4)
const SBH = 46;       // 结算按钮高
const NAV_H = 42, NAV_GAP = 14; // layoutNavTabs: y = h-42-14

function layout(w, h) {
  const cell = Math.max(16, Math.min((w * 0.62) / COLS, (h - BUDGET) / ROWS));
  const bw2 = cell * COLS, bh2 = cell * ROWS;
  const bx = (w - bw2) / 2;
  const navTop = h - NAV_H - NAV_GAP;
  const listRows = Math.ceil(NCOLORS / 2);
  const contentH = bh2 + 32 + listRows * ROW_H + 10 + SBH;
  const by = Math.max(TOP, TOP + (navTop - 14 - TOP - contentH) / 2);
  const listY0 = by + bh2 + 32;
  const sby = listY0 + listRows * ROW_H + 10;
  const bottom = sby + SBH;
  return { cell, bw2, bh2, bx, by, bottom, navTop, overScreen: bottom > h, overNav: bottom > navTop - 14 };
}

const SCREENS = [
  ['iPhone SE', 375, 667], ['安卓小屏', 360, 640], ['iPhone 14', 390, 844],
  ['iPhone Plus', 414, 896], ['平板竖', 768, 1024], ['笔记本浏览器', 1280, 720],
  ['大屏浏览器', 1440, 900], ['uidiag 视口', 1440, 980], ['极窄 320', 320, 568],
  ['扁屏 600', 1280, 600], ['高屏 1080P', 1920, 940],
];

console.log('屏幕'.padEnd(14) + '尺寸'.padEnd(12) + 'cell'.padEnd(7) + '棋盘(宽x高)'.padEnd(15) +
  'by'.padEnd(6) + '内容底'.padEnd(8) + '底栏顶'.padEnd(8) + '超屏'.padEnd(6) + '压底栏'.padEnd(7) + '触感');
console.log('-'.repeat(96));
let bad = 0;
for (const [name, w, h] of SCREENS) {
  const L = layout(w, h);
  if (L.overScreen || L.overNav || L.bx < 0) bad++;
  let touch = 'OK';
  if (L.cell < 22) touch = '偏小';
  if (L.cell < 20.5) touch = '过小';
  console.log(
    name.padEnd(14) + (w + 'x' + h).padEnd(12) + L.cell.toFixed(1).padEnd(7) +
    (L.bw2.toFixed(0) + 'x' + L.bh2.toFixed(0)).padEnd(15) +
    L.by.toFixed(0).padEnd(6) + L.bottom.toFixed(0).padEnd(8) + L.navTop.toFixed(0).padEnd(8) +
    (L.overScreen ? '✗' : '否').padEnd(6) + (L.overNav ? '✗' : '否').padEnd(7) + touch
  );
}
console.log('\n问题屏数(超屏/压底栏/横向溢出): ' + bad + '/' + SCREENS.length + '  ← 320x568 为 2016 年前设备,已知不可用');

console.log('\n属性区横向排布(2 列, 标签实测宽约 128px):');
for (const [name, w] of SCREENS) {
  const listW = Math.min(w - 40, 460), listX = (w - listW) / 2, colW = listW / 2;
  const right = listX + colW + 22 + 128;
  console.log('  ' + name.padEnd(14) + '第二列标签右缘=' + right.toFixed(0).padEnd(6) +
    (right <= w ? '✓' : '✗ 越界 ' + (right - w).toFixed(0) + 'px'));
}
