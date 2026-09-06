with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

# ========== 1. 添加风扇精灵到场景层 ==========
old_scene = """const pcCase = PIXI.Sprite.from(ASSETS.pc_case);
const casePlaceholder = PIXI.Sprite.from(ASSETS.placeholder);
layers.scene.addChild(pcCase, casePlaceholder);"""

new_scene = """const pcCase = PIXI.Sprite.from(ASSETS.pc_case);
const casePlaceholder = PIXI.Sprite.from(ASSETS.placeholder);
const fanSprite = PIXI.Sprite.from(ASSETS.fan);
layers.scene.addChild(pcCase, casePlaceholder, fanSprite);"""

if old_scene in h:
    h = h.replace(old_scene, new_scene, 1)
    print("1. added fan sprite")
else:
    print("1. ERROR: scene pattern not found")

# ========== 2. 修改layoutCase函数，添加风扇布局（机箱镜像位置） ==========
old_layout_end = """  const hasFirstGpu = state.machines.rtx3080.count > 0;
  casePlaceholder.visible = !hasFirstGpu;
  pcCase.visible = hasFirstGpu;
}"""

new_layout_end = """  const hasFirstGpu = state.machines.rtx3080.count > 0;
  casePlaceholder.visible = !hasFirstGpu;
  pcCase.visible = hasFirstGpu;

  // 风扇：机箱镜像位置（右侧），竖长造型
  const maxFanH = app.screen.height * 0.48;
  const fanS = maxFanH / fanSprite.texture.height;
  const fanW = fanSprite.texture.width * fanS;
  fanSprite.scale.set(fanS);
  // 镜像：机箱左边距28%，风扇右边距也28%
  fanSprite.x = app.screen.width * 0.72 - fanW;
  fanSprite.y = app.screen.height - maxFanH - bottomMargin - 65;
  fanSprite.visible = state.fans.count > 0;
}"""

if old_layout_end in h:
    h = h.replace(old_layout_end, new_layout_end, 1)
    print("2. added fan layout (mirror position)")
else:
    print("2. ERROR: layout end pattern not found")

# ========== 3. 游戏状态添加风扇计数 ==========
old_state = """const state = {
  tokens: 0,
  tokensPerClick: 1,
  tokensPerSecond: 0,
  paused: false,
  machines: {
    rtx3080: { count: 0 },
  },
};"""

new_state = """const state = {
  tokens: 0,
  tokensPerClick: 1,
  tokensPerSecond: 0,
  paused: false,
  machines: {
    rtx3080: { count: 0 },
  },
  fans: {
    count: 0,
  },
};

function fanPrice() {
  return Math.floor(80 * Math.pow(1.5, state.fans.count));
}
function recalcClickPower() {
  state.tokensPerClick = 1 + state.fans.count;
}"""

if old_state in h:
    h = h.replace(old_state, new_state, 1)
    print("3. added fan state and price logic")
else:
    print("3. ERROR: state pattern not found")

# ========== 4. 点击事件使用tokensPerClick（已经是了，确认） ==========
# 当前代码：state.tokens += state.tokensPerClick; 已经正确

# ========== 5. 风扇购买项：替换风扇标签的占位内容 ==========
old_fan_placeholder = """  // 风扇标签占位内容
  const fanPlaceholder = makeText('风扇模块开发中…', { size: 14, color: '#8a7a6a', anchor: 0.5 });
  fanPlaceholder.x = panelW / 2; fanPlaceholder.y = 120;
  fanContent.addChild(fanPlaceholder);"""

new_fan_placeholder = """  // 风扇购买项：心静自然凉
  const fanBuyUI = new PIXI.Graphics();
  fanBuyUI.x = 20; fanBuyUI.y = 56;
  fanContent.addChild(fanBuyUI);

  // 风扇图标
  const fanIcon = new PIXI.Graphics();
  fanIcon.x = 28; fanIcon.y = 68;
  fanIcon.lineStyle(2, 0x7ac8a0, 0.9);
  fanIcon.beginFill(0x2a5a4a, 0.6);
  fanIcon.drawCircle(19, 19, 19);
  fanIcon.endFill();
  // 风扇叶片
  fanIcon.lineStyle(1.5, 0x7ac8a0, 0.8);
  fanIcon.beginFill(0x5aaa8a, 0.5);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    fanIcon.moveTo(19, 19);
    fanIcon.quadraticCurveTo(
      19 + Math.cos(angle - 0.4) * 14, 19 + Math.sin(angle - 0.4) * 14,
      19 + Math.cos(angle) * 16, 19 + Math.sin(angle) * 16
    );
    fanIcon.quadraticCurveTo(
      19 + Math.cos(angle + 0.4) * 14, 19 + Math.sin(angle + 0.4) * 14,
      19, 19
    );
  }
  fanIcon.endFill();
  fanIcon.beginFill(0x7ac8a0, 0.9);
  fanIcon.drawCircle(19, 19, 4);
  fanIcon.endFill();
  fanContent.addChild(fanIcon);

  const fanName = makeText('心静自然凉', { size: 16, color: '#fff5e6', weight: 'bold' });
  fanName.x = 80; fanName.y = 72;
  fanContent.addChild(fanName);

  const fanDesc = makeText('点击获得 token +1/次', { size: 12, color: '#d4c4a8' });
  fanDesc.x = 80; fanDesc.y = 96;
  fanContent.addChild(fanDesc);

  const fanPrice = makeText('', { size: 15, color: '#7ac8a0', weight: 'bold', anchor: 1 });
  fanPrice.x = panelW - 24; fanPrice.y = 88;
  fanContent.addChild(fanPrice);
  fanPrice.text = fanPrice() + ' token';

  function drawFanBuyButton() {
    fanBuyUI.clear();
    const canAfford = state.tokens >= fanPrice();
    const bgColor = canAfford ? 0x2a6a4a : 0x6b6b6b;
    roundRect(fanBuyUI, 0, 0, 320, 68, 10, bgColor, 0.9);
  }
  drawFanBuyButton();

  fanBuyUI.eventMode = 'static';
  fanBuyUI.cursor = 'pointer';
  fanBuyUI.hitArea = new PIXI.Rectangle(0, 0, 320, 68);
  fanBuyUI.on('pointerdown', () => {
    const price = fanPrice();
    if (state.tokens >= price) {
      state.tokens -= price;
      state.fans.count++;
      recalcClickPower();
      layoutCase();
      fanPrice.text = fanPrice() + ' token';
      drawFanBuyButton();
      updateTokenDisplay();
    }
  });"""

if old_fan_placeholder in h:
    h = h.replace(old_fan_placeholder, new_fan_placeholder, 1)
    print("5. added fan purchase item")
else:
    print("5. ERROR: fan placeholder pattern not found")

# ========== 6. UI分割线优化：标签之间竖线 + 标签与内容之间横线 ==========
old_tabs_code = """  machineTab.x = panelW / 2 - 55; machineTab.y = 26;
  fanTab.x = panelW / 2 + 55; fanTab.y = 26;
  machineTab.eventMode = 'static'; machineTab.cursor = 'pointer';
  fanTab.eventMode = 'static'; fanTab.cursor = 'pointer';
  panelContent.addChild(machineTab, fanTab);

  const tabLine = new PIXI.Graphics();
  panelContent.addChild(tabLine);"""

new_tabs_code = """  machineTab.x = panelW / 2 - 55; machineTab.y = 26;
  fanTab.x = panelW / 2 + 55; fanTab.y = 26;
  machineTab.eventMode = 'static'; machineTab.cursor = 'pointer';
  fanTab.eventMode = 'static'; fanTab.cursor = 'pointer';
  panelContent.addChild(machineTab, fanTab);

  // 标签之间竖线分隔
  const tabDivider = new PIXI.Graphics();
  tabDivider.beginFill(0xd4c4a8, 0.4);
  tabDivider.drawRect(panelW / 2 - 0.5, 18, 1, 20);
  tabDivider.endFill();
  panelContent.addChild(tabDivider);

  const tabLine = new PIXI.Graphics();
  panelContent.addChild(tabLine);

  // 标签与内容之间的横向分割线
  const contentDivider = new PIXI.Graphics();
  panelContent.addChild(contentDivider);"""

if old_tabs_code in h:
    h = h.replace(old_tabs_code, new_tabs_code, 1)
    print("6a. added tab dividers (vertical + horizontal)")
else:
    print("6a. ERROR: tabs code pattern not found")

# 修改drawTabLine函数，同时绘制横向分割线
old_draw_tabline = """  function drawTabLine() {
    tabLine.clear();
    tabLine.beginFill(0xc4853a, 0.8);
    if (currentTab === 'machine') {
      tabLine.drawRect(panelW / 2 - 85, 46, 60, 2);
    } else {
      tabLine.drawRect(panelW / 2 + 25, 46, 60, 2);
    }
    tabLine.endFill();
  }
  drawTabLine();"""

new_draw_tabline = """  function drawTabLine() {
    tabLine.clear();
    tabLine.beginFill(0xc4853a, 0.8);
    if (currentTab === 'machine') {
      tabLine.drawRect(panelW / 2 - 85, 46, 60, 2);
    } else {
      tabLine.drawRect(panelW / 2 + 25, 46, 60, 2);
    }
    tabLine.endFill();
    // 标签与内容之间的横向分割线
    contentDivider.clear();
    contentDivider.beginFill(0xd4c4a8, 0.25);
    contentDivider.drawRect(20, 52, panelW - 40, 1);
    contentDivider.endFill();
  }
  drawTabLine();"""

if old_draw_tabline in h:
    h = h.replace(old_draw_tabline, new_draw_tabline, 1)
    print("6b. updated drawTabLine with content divider")
else:
    print("6b. ERROR: drawTabLine pattern not found")

# ========== 7. 主循环中更新风扇购买按钮状态 ==========
old_update_rtx = """function updateRtxBuyButton() {
  const canAfford = state.tokens >= rtx3080Price();
  const newState = canAfford ? 'enabled' : 'disabled';
  if (newState !== rtxBtnState) drawRtxBuyButton();
}"""

new_update_rtx = """function updateRtxBuyButton() {
  const canAfford = state.tokens >= rtx3080Price();
  const newState = canAfford ? 'enabled' : 'disabled';
  if (newState !== rtxBtnState) drawRtxBuyButton();
  // 风扇购买按钮实时刷新
  if (typeof drawFanBuyButton === 'function') {
    drawFanBuyButton();
  }
}"""

if old_update_rtx in h:
    h = h.replace(old_update_rtx, new_update_rtx, 1)
    print("7. added fan button realtime update")
else:
    print("7. ERROR: updateRtxBuyButton pattern not found")

# ========== 8. 购买RTX3080后也调用recalcClickPower（不需要，风扇才影响点击） ==========
# 不需要修改

with open("index_template.html", "w", encoding="utf-8") as f:
    f.write(h)

print("\nAll fan features and UI optimizations added!")
