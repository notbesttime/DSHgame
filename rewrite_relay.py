with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

old = """// ==================== 中转站标签（购买服务器后解锁） ====================
const relayTab = new PIXI.Container();
const relayTabBg = new PIXI.Graphics();
const relayTabText = makeText('中转站', { size: 16, color: '#fff5e6', weight: 'bold', anchor: 0.5 });
relayTab.addChild(relayTabBg, relayTabText);
layers.ui.addChild(relayTab);
relayTab.visible = false;
addPressFeedback(relayTab);

let relayPanelOpen = false;
const relayPanel = new PIXI.Container();
const relayPanelBg = new PIXI.Graphics();
const relayPanelText = makeText('中转站功能开发中…', { size: 14, color: '#8a7a6a', anchor: 0.5 });
relayPanel.addChild(relayPanelBg, relayPanelText);
layers.ui.addChild(relayPanel);
relayPanel.visible = false;

relayTab.on('pointerdown', () => {
  relayPanelOpen = !relayPanelOpen;
  relayPanel.visible = relayPanelOpen;
  if (relayPanelOpen) {
    const w = 280, h = 100;
    relayPanel.x = app.screen.width * 0.5 - w / 2;
    relayPanel.y = app.screen.height - h - 70;
    roundRect(relayPanelBg, 0, 0, w, h, 12, 0x2a1f16, 0.92);
    relayPanelText.x = w / 2;
    relayPanelText.y = h / 2;
  }
});

function layoutRelayTab() {
  const w = 120, h = 44;
  relayTab.x = app.screen.width * 0.62 - w / 2;
  relayTab.y = app.screen.height - h - 14;
  roundRect(relayTabBg, 0, 0, w, h, 10, 0x6a3a2a, 0.85);
  relayTabText.x = w / 2;
  relayTabText.y = h / 2;
}

function updateRelayTabVisibility() {
  relayTab.visible = state.machines.server.count > 0;
  if (!relayTab.visible) { relayPanel.visible = false; relayPanelOpen = false; }
}"""

new = """// ==================== 中转站标签（购买服务器后解锁） ====================
const relayTab = new PIXI.Container();
const relayTabBg = new PIXI.Graphics();
const relayTabText = makeText('中转站', { size: 16, color: '#fff5e6', weight: 'bold', anchor: 0.5 });
relayTab.addChild(relayTabBg, relayTabText);
layers.ui.addChild(relayTab);
relayTab.visible = false;
addPressFeedback(relayTab);

// ==================== 中转站场景 ====================
// 后续接入 VibeHub SDK 后，排行榜数据从 vibe.global 读取
// 本地数据与服务器数据并存：本地 localStorage 存玩家进度，vibe.global 存排行榜
const relayScene = new PIXI.Container();
relayScene.visible = false;
app.stage.addChild(relayScene); // 最上层，覆盖整个游戏

const relayBg = PIXI.Sprite.from(ASSETS.relay_bg);
relayScene.addChild(relayBg);

// 半透明遮罩，让文字更清晰
const relayOverlay = new PIXI.Graphics();
relayScene.addChild(relayOverlay);

// 返回按钮
const relayBackBtn = new PIXI.Container();
const relayBackBg = new PIXI.Graphics();
const relayBackText = makeText('← 返回', { size: 16, color: '#fff5e6', weight: 'bold', anchor: 0.5 });
relayBackBtn.addChild(relayBackBg, relayBackText);
relayScene.addChild(relayBackBtn);
addPressFeedback(relayBackBtn);

// 标题
const relayTitle = makeText('中转站', { size: 32, color: '#ffd98a', weight: 'bold', anchor: 0.5 });
relayScene.addChild(relayTitle);

// 排行榜区域（预留，后续接入 VibeHub vibe.global）
const relayRankPanel = new PIXI.Container();
const relayRankBg = new PIXI.Graphics();
relayRankPanel.addChild(relayRankBg);
relayScene.addChild(relayRankPanel);

const relayRankTitle = makeText('全球排行榜', { size: 20, color: '#ffd98a', weight: 'bold', anchor: 0.5 });
relayRankPanel.addChild(relayRankTitle);

const relayRankComing = makeText('排行榜功能即将开放\\n（接入 VibeHub 后上线）', { size: 14, color: '#d4c4a8', align: 'center', anchor: 0.5, lineHeight: 22 });
relayRankPanel.addChild(relayRankComing);

// 玩家数据展示
const relayPlayerPanel = new PIXI.Container();
const relayPlayerBg = new PIXI.Graphics();
relayPlayerPanel.addChild(relayPlayerBg);
relayScene.addChild(relayPlayerPanel);

const relayPlayerTitle = makeText('我的数据', { size: 18, color: '#ffd98a', weight: 'bold', anchor: 0.5 });
relayPlayerPanel.addChild(relayPlayerTitle);

const relayPlayerStats = makeText('', { size: 14, color: '#fff5e6', lineHeight: 24 });
relayPlayerPanel.addChild(relayPlayerStats);

let relaySceneOpen = false;

function openRelayScene() {
  relaySceneOpen = true;
  relayScene.visible = true;
  state.paused = true;
  layoutRelayScene();
  updateRelayPlayerStats();
}

function closeRelayScene() {
  relaySceneOpen = false;
  relayScene.visible = false;
  state.paused = false;
}

function updateRelayPlayerStats() {
  const lines = [
    'Tokens: ' + formatNum(state.tokens),
    'RTX 3080: ' + state.machines.rtx3080.count + ' 台',
    'A100: ' + state.machines.a100.count + ' 台',
    '服务器: ' + state.machines.server.count + ' 台',
    '被动收入: ' + formatNum(state.tokensPerSecond) + ' /秒',
  ];
  relayPlayerStats.text = lines.join('\\n');
}

function layoutRelayScene() {
  const w = app.screen.width;
  const h = app.screen.height;
  // 背景图铺满
  const bgScale = Math.max(w / relayBg.texture.width, h / relayBg.texture.height);
  relayBg.scale.set(bgScale);
  relayBg.x = (w - relayBg.texture.width * bgScale) / 2;
  relayBg.y = (h - relayBg.texture.height * bgScale) / 2;
  // 遮罩
  relayOverlay.clear();
  relayOverlay.beginFill(0x000000, 0.45);
  relayOverlay.drawRect(0, 0, w, h);
  relayOverlay.endFill();
  // 返回按钮
  roundRect(relayBackBg, 0, 0, 100, 44, 10, 0x6a3a2a, 0.9);
  relayBackText.x = 50; relayBackText.y = 22;
  relayBackBtn.x = 20; relayBackBtn.y = 20;
  relayBackBtn.hitArea = new PIXI.Rectangle(0, 0, 100, 44);
  // 标题
  relayTitle.x = w / 2; relayTitle.y = 50;
  // 排行榜面板
  const rankW = Math.min(420, w * 0.4);
  const rankH = 280;
  relayRankPanel.x = w * 0.28 - rankW / 2;
  relayRankPanel.y = 110;
  roundRect(relayRankBg, 0, 0, rankW, rankH, 14, 0x2a1f16, 0.88);
  relayRankTitle.x = rankW / 2; relayRankTitle.y = 30;
  relayRankComing.x = rankW / 2; relayRankComing.y = rankH / 2 + 10;
  // 玩家数据面板
  const playerW = Math.min(320, w * 0.3);
  const playerH = 220;
  relayPlayerPanel.x = w * 0.72 - playerW / 2;
  relayPlayerPanel.y = 110;
  roundRect(relayPlayerBg, 0, 0, playerW, playerH, 14, 0x2a1f16, 0.88);
  relayPlayerTitle.x = playerW / 2; relayPlayerTitle.y = 28;
  relayPlayerStats.x = 30; relayPlayerStats.y = 60;
}

relayBackBtn.eventMode = 'static';
relayBackBtn.cursor = 'pointer';
relayBackBtn.on('pointerdown', closeRelayScene);

relayTab.on('pointerdown', () => {
  if (state.machines.server.count > 0) {
    openRelayScene();
  }
});

function layoutRelayTab() {
  const w = 120, h = 44;
  relayTab.x = app.screen.width * 0.62 - w / 2;
  relayTab.y = app.screen.height - h - 14;
  roundRect(relayTabBg, 0, 0, w, h, 10, 0x6a3a2a, 0.85);
  relayTabText.x = w / 2;
  relayTabText.y = h / 2;
}

function updateRelayTabVisibility() {
  relayTab.visible = state.machines.server.count > 0;
  if (!relayTab.visible && relaySceneOpen) closeRelayScene();
}"""

if old in h:
    h = h.replace(old, new, 1)
    with open("index_template.html", "w", encoding="utf-8") as f:
        f.write(h)
    print("Relay scene rewritten")
else:
    print("ERROR: old relay pattern not found")
