with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

# 找到旧购买面板的起始和结束标记
start_marker = "// ==================== 购买面板 ===================="
end_marker = "addPressFeedback(purchaseBtn);"

start_idx = h.find(start_marker)
end_idx = h.find(end_marker) + len(end_marker)

if start_idx == -1 or end_idx == -1:
    print("ERROR: Could not find purchase panel markers")
    print(f"start_idx={start_idx}, end_idx={end_idx}")
    exit(1)

print(f"Old panel: chars {start_idx} to {end_idx} ({end_idx-start_idx} chars)")

new_panel = '''// ==================== 购买面板 ====================
const purchasePanel = new PIXI.Container();
layers.ui.addChild(purchasePanel);

const purchaseBtn = new PIXI.Container();
const purchaseBtnBg = new PIXI.Graphics();
const purchaseArrow = new PIXI.Graphics();
const purchaseText = makeText('购\\n买', { size: 15, color: '#fff5e6', weight: 'bold', align: 'center', anchor: 0.5, lineHeight: 18 });
purchaseBtn.addChild(purchaseBtnBg, purchaseArrow, purchaseText);

const panelContent = new PIXI.Container();
const panelBg = new PIXI.Graphics();
panelContent.addChild(panelBg);
purchasePanel.addChild(panelContent, purchaseBtn);

let panelExpanded = false;
const panelW = 360;
const panelH = 420;
let buyButtons = {};

function drawPurchaseArrow(expanded) {
  purchaseArrow.clear();
  purchaseArrow.lineStyle(2.5, 0xfff5e6, 0.9);
  const cx = 21, cy = 18;
  if (expanded) {
    purchaseArrow.moveTo(cx - 6, cy + 4);
    purchaseArrow.lineTo(cx, cy - 4);
    purchaseArrow.lineTo(cx + 6, cy + 4);
  } else {
    purchaseArrow.moveTo(cx - 4, cy - 6);
    purchaseArrow.lineTo(cx + 4, cy);
    purchaseArrow.lineTo(cx - 4, cy + 6);
  }
}

function layoutPurchasePanel() {
  const btnW = 48, btnH = 92;
  const baseX = app.screen.width - btnW - 16;
  const baseY = app.screen.height * 0.2;
  purchaseBtn.x = baseX;
  purchaseBtn.y = baseY;
  roundRect(purchaseBtnBg, 0, 0, btnW, btnH, 10, 0xc4853a, 0.92);
  purchaseText.x = btnW / 2;
  purchaseText.y = btnH / 2 + 8;
  drawPurchaseArrow(panelExpanded);
  purchaseBtn.hitArea = new PIXI.Rectangle(0, 0, btnW, btnH);

  panelContent.x = baseX - panelW - 8;
  panelContent.y = baseY;
  panelContent.visible = panelExpanded;
  if (panelExpanded) {
    roundRect(panelBg, 0, 0, panelW, panelH, 12, 0xfff8ee, 0.95);
  }
}

function drawBuyButton(g, canAfford, color) {
  g.clear();
  const bgColor = canAfford ? color : 0x6b6b6b;
  roundRect(g, 0, 0, 320, 68, 10, bgColor, 0.9);
}

function updateAllBuyButtons() {
  if (buyButtons.rtx3080) drawBuyButton(buyButtons.rtx3080, state.tokens >= rtx3080Price(), 0x4a7c59);
  if (buyButtons.a100) drawBuyButton(buyButtons.a100, state.tokens >= a100Price(), 0x5a6a9a);
  if (buyButtons.extraRack) drawBuyButton(buyButtons.extraRack, state.tokens >= extraRackPrice(), 0x8a5a9a);
  if (buyButtons.fan) drawBuyButton(buyButtons.fan, state.tokens >= fanPrice(), 0x3a9a6a);
  if (buyButtons.waterCooling) drawBuyButton(buyButtons.waterCooling, state.tokens >= waterCoolingPrice(), 0x3a8aba);
  if (buyButtons.niger && !state.scripts.niger) drawBuyButton(buyButtons.niger, state.tokens >= 800, 0xba8a3a);
  if (buyButtons.miracle && !state.scripts.miracle) drawBuyButton(buyButtons.miracle, state.tokens >= 1500, 0xba5a8a);
}

function createBuyItem(container, y, iconDraw, name, desc, priceFn, buyColor, onBuy, oneTime, owned) {
  const bg = new PIXI.Graphics();
  bg.x = 20; bg.y = y;
  container.addChild(bg);

  const icon = new PIXI.Graphics();
  icon.x = 28; icon.y = y + 12;
  iconDraw(icon);
  container.addChild(icon);

  const nameText = makeText(name, { size: 15, color: '#fff5e6', weight: 'bold' });
  nameText.x = 80; nameText.y = y + 14;
  container.addChild(nameText);

  const descText = makeText(desc, { size: 11, color: '#d4c4a8' });
  descText.x = 80; descText.y = y + 36;
  container.addChild(descText);

  const priceText = makeText('', { size: 14, color: '#ffd98a', weight: 'bold', anchor: 1 });
  priceText.x = panelW - 24; priceText.y = y + 30;
  container.addChild(priceText);

  function refresh() {
    if (oneTime && owned()) {
      priceText.text = '已拥有';
      drawBuyButton(bg, false, buyColor);
    } else {
      priceText.text = priceFn() + ' token';
    }
  }
  refresh();

  bg.eventMode = 'static';
  bg.cursor = 'pointer';
  bg.hitArea = new PIXI.Rectangle(0, 0, 320, 68);
  bg.on('pointerdown', () => {
    if (oneTime && owned()) return;
    const price = priceFn();
    if (state.tokens >= price) {
      state.tokens -= price;
      onBuy();
      refresh();
      updateAllBuyButtons();
      updateTokenDisplay();
      layoutCase();
      updateSellTabVisibility();
    }
  });

  return { bg, refresh };
}

function initPurchasePanel() {
  if (panelContent.children.length > 1) return;

  // 三个标签
  let currentTab = 'machine';
  const tabs = {};
  const tabNames = ['machine', 'cooling', 'script'];
  const tabLabels = { machine: '机器', cooling: '散热', script: '脚本' };
  const tabColors = { machine: '#c4853a', cooling: '#3a9a6a', script: '#ba8a3a' };

  for (let i = 0; i < 3; i++) {
    const key = tabNames[i];
    const tab = makeText(tabLabels[key], { size: 15, color: i === 0 ? tabColors[key] : '#8a7a6a', weight: 'bold', anchor: 0.5 });
    tab.x = panelW / 2 - 80 + i * 80;
    tab.y = 26;
    tab.eventMode = 'static';
    tab.cursor = 'pointer';
    tab.hitArea = new PIXI.Rectangle(-40, -16, 80, 32);
    panelContent.addChild(tab);
    tabs[key] = tab;
  }

  // 标签间竖线
  for (let i = 1; i < 3; i++) {
    const div = new PIXI.Graphics();
    div.beginFill(0xd4c4a8, 0.3);
    div.drawRect(panelW / 2 - 80 + i * 80 - 0.5, 16, 1, 20);
    div.endFill();
    panelContent.addChild(div);
  }

  const tabLine = new PIXI.Graphics();
  panelContent.addChild(tabLine);

  const contentDivider = new PIXI.Graphics();
  panelContent.addChild(contentDivider);

  const contents = {};
  for (const key of tabNames) {
    contents[key] = new PIXI.Container();
    panelContent.addChild(contents[key]);
    if (key !== 'machine') contents[key].visible = false;
  }

  function drawTabLine() {
    tabLine.clear();
    const idx = tabNames.indexOf(currentTab);
    tabLine.beginFill(tabColors[currentTab], 0.8);
    tabLine.drawRect(panelW / 2 - 80 + idx * 80 - 30, 46, 60, 2);
    tabLine.endFill();
    contentDivider.clear();
    contentDivider.beginFill(0xd4c4a8, 0.2);
    contentDivider.drawRect(20, 52, panelW - 40, 1);
    contentDivider.endFill();
  }
  drawTabLine();

  for (const key of tabNames) {
    tabs[key].on('pointerdown', () => {
      currentTab = key;
      for (const k of tabNames) {
        tabs[k].style.fill = k === key ? tabColors[k] : '#8a7a6a';
        contents[k].visible = k === key;
      }
      drawTabLine();
    });
  }

  // ========== 机器板块 ==========
  const mc = contents.machine;

  // RTX 3080
  const rtx = createBuyItem(mc, 56, (icon) => {
    icon.lineStyle(2, 0xffd98a, 0.9);
    icon.beginFill(0x3a5a7a, 0.6);
    icon.drawRoundedRect(0, 0, 38, 38, 5);
    icon.endFill();
    icon.lineStyle(1.5, 0xffd98a, 0.7);
    icon.beginFill(0x5a7a9a, 0.5);
    icon.drawRoundedRect(9, 9, 20, 20, 3);
    icon.endFill();
  }, 'RTX 3080', 'token生成效率 +5/s', rtx3080Price, 0x4a7c59, () => {
    state.machines.rtx3080.count++;
    recalcProduction();
    recalcCrit();
  }, false, () => false);
  buyButtons.rtx3080 = rtx.bg;

  // A100 计算卡
  const a100 = createBuyItem(mc, 134, (icon) => {
    icon.lineStyle(2, 0xaabbff, 0.9);
    icon.beginFill(0x2a3a6a, 0.6);
    icon.drawRoundedRect(0, 0, 38, 38, 5);
    icon.endFill();
    icon.lineStyle(1.5, 0xaabbff, 0.7);
    icon.beginFill(0x4a5a8a, 0.5);
    icon.drawRoundedRect(6, 6, 26, 26, 3);
    icon.endFill();
    icon.lineStyle(1, 0xaabbff, 0.6);
    icon.beginFill(0x6a7aaa, 0.4);
    icon.drawRect(12, 12, 14, 14);
    icon.endFill();
  }, 'A100 计算卡', '+50 token/s，暴击率 +0.5%', a100Price, 0x5a6a9a, () => {
    state.machines.a100.count++;
    recalcProduction();
    recalcCrit();
  }, false, () => false);
  buyButtons.a100 = a100.bg;

  // 额外机柜
  const rack = createBuyItem(mc, 212, (icon) => {
    icon.lineStyle(2, 0xd4aaff, 0.9);
    icon.beginFill(0x4a2a6a, 0.6);
    icon.drawRoundedRect(0, 0, 38, 38, 4);
    icon.endFill();
    icon.lineStyle(1, 0xd4aaff, 0.6);
    for (let i = 0; i < 4; i++) {
      icon.drawRect(5, 5 + i * 8, 28, 5);
    }
  }, '额外机柜', '暴击倍率 +1%', extraRackPrice, 0x8a5a9a, () => {
    state.machines.extraRack.count++;
    recalcCrit();
  }, false, () => false);
  buyButtons.extraRack = rack.bg;

  // ========== 散热板块 ==========
  const cc = contents.cooling;

  // 心静自然凉（风扇）
  const fan = createBuyItem(cc, 56, (icon) => {
    icon.lineStyle(2, 0x7ac8a0, 0.9);
    icon.beginFill(0x2a5a4a, 0.6);
    icon.drawCircle(19, 19, 19);
    icon.endFill();
    icon.lineStyle(1.5, 0x7ac8a0, 0.8);
    icon.beginFill(0x5aaa8a, 0.5);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      icon.moveTo(19, 19);
      icon.quadraticCurveTo(19 + Math.cos(angle - 0.4) * 14, 19 + Math.sin(angle - 0.4) * 14, 19 + Math.cos(angle) * 16, 19 + Math.sin(angle) * 16);
      icon.quadraticCurveTo(19 + Math.cos(angle + 0.4) * 14, 19 + Math.sin(angle + 0.4) * 14, 19, 19);
    }
    icon.endFill();
    icon.beginFill(0x7ac8a0, 0.9);
    icon.drawCircle(19, 19, 4);
    icon.endFill();
  }, '心静自然凉', '每次点击获得的token数 ×1.1', fanPrice, 0x3a9a6a, () => {
    state.cooling.fan.count++;
    recalcClickPower();
  }, false, () => false);
  buyButtons.fan = fan.bg;

  // 水冷
  const wc = createBuyItem(cc, 134, (icon) => {
    icon.lineStyle(2, 0x6abaff, 0.9);
    icon.beginFill(0x1a3a5a, 0.6);
    icon.drawRoundedRect(0, 0, 38, 38, 5);
    icon.endFill();
    icon.lineStyle(1.5, 0x6abaff, 0.7);
    icon.beginFill(0x3a6a9a, 0.5);
    icon.moveTo(19, 6);
    icon.quadraticCurveTo(32, 14, 19, 22);
    icon.quadraticCurveTo(6, 30, 19, 38);
    icon.lineTo(19, 6);
    icon.endFill();
    icon.beginFill(0x6abaff, 0.8);
    icon.drawCircle(19, 22, 3);
    icon.endFill();
  }, '水冷', '10s-2min触发，19%概率 token×1.2', waterCoolingPrice, 0x3a8aba, () => {
    state.cooling.waterCooling.count++;
    state.waterCoolingNextTrigger = 10 + Math.random() * 110;
    state.waterCoolingTimer = 0;
  }, false, () => false);
  buyButtons.waterCooling = wc.bg;

  // ========== 脚本板块 ==========
  const sc = contents.script;

  // niger 自动点击
  const niger = createBuyItem(sc, 56, (icon) => {
    icon.lineStyle(2, 0xffd98a, 0.9);
    icon.beginFill(0x5a4a2a, 0.6);
    icon.drawRoundedRect(0, 0, 38, 38, 5);
    icon.endFill();
    icon.lineStyle(1.5, 0xffd98a, 0.8);
    icon.moveTo(8, 14); icon.lineTo(30, 14);
    icon.moveTo(8, 20); icon.lineTo(25, 20);
    icon.moveTo(8, 26); icon.lineTo(28, 26);
    icon.moveTo(8, 32); icon.lineTo(20, 32);
  }, 'niger', '每秒自动点击 3 次', () => 800, 0xba8a3a, () => {
    state.scripts.niger = true;
  }, true, () => state.scripts.niger);
  buyButtons.niger = niger.bg;

  // 奇迹算法
  const miracle = createBuyItem(sc, 134, (icon) => {
    icon.lineStyle(2, 0xff8acc, 0.9);
    icon.beginFill(0x5a2a4a, 0.6);
    icon.drawRoundedRect(0, 0, 38, 38, 5);
    icon.endFill();
    icon.lineStyle(1.5, 0xff8acc, 0.8);
    icon.moveTo(19, 6);
    icon.lineTo(22, 16);
    icon.lineTo(32, 16);
    icon.lineTo(24, 22);
    icon.lineTo(27, 32);
    icon.lineTo(19, 26);
    icon.lineTo(11, 32);
    icon.lineTo(14, 22);
    icon.lineTo(6, 16);
    icon.lineTo(16, 16);
    icon.closePath();
  }, '奇迹算法', '拖动服务器砸地面有概率获得token', () => 1500, 0xba5a8a, () => {
    state.scripts.miracle = true;
  }, true, () => state.scripts.miracle);
  buyButtons.miracle = miracle.bg;

  updateAllBuyButtons();
}

purchaseBtn.on('pointerdown', () => {
  panelExpanded = !panelExpanded;
  drawPurchaseArrow(panelExpanded);
  layoutPurchasePanel();
  if (panelExpanded) initPurchasePanel();
});
addPressFeedback(purchaseBtn);'''

h = h[:start_idx] + new_panel + h[end_idx:]

with open("index_template.html", "w", encoding="utf-8") as f:
    f.write(h)

print(f"Purchase panel rewritten! New size: {len(new_panel)} chars")
