with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

# ========== 1. 在场景层机箱定义后添加物理系统变量和函数 ==========
old_scene_end = """layers.scene.addChild(pcCase, casePlaceholder, fanSprite);

function layoutCase() {"""

new_scene_end = """layers.scene.addChild(pcCase, casePlaceholder, fanSprite);

// ==================== 机箱物理交互系统 ====================
const casePhysics = {
  vx: 0, vy: 0,
  isDragging: false,
  isActive: false,
  groundY: 0,
  gravity: 0.7,
  bounce: 0.45,
  friction: 0.96,
  dragHistory: [],
  dragOffset: { x: 0, y: 0 },
};

function getCaseDisplayWidth() {
  return pcCase.texture.width * pcCase.scale.x;
}
function getCaseDisplayHeight() {
  return pcCase.texture.height * pcCase.scale.y;
}

function startCaseDrag(e) {
  if (!pcCase.visible) return;
  casePhysics.isDragging = true;
  casePhysics.isActive = false;
  casePhysics.vx = 0;
  casePhysics.vy = 0;
  casePhysics.dragHistory = [];
  const pos = e.global;
  casePhysics.dragOffset.x = pos.x - pcCase.x;
  casePhysics.dragOffset.y = pos.y - pcCase.y;
  pcCase.cursor = 'grabbing';
}

function updateCaseDrag(e) {
  if (!casePhysics.isDragging) return;
  const pos = e.global;
  const now = performance.now();
  pcCase.x = pos.x - casePhysics.dragOffset.x;
  pcCase.y = pos.y - casePhysics.dragOffset.y;
  casePhysics.dragHistory.push({ x: pcCase.x, y: pcCase.y, t: now });
  if (casePhysics.dragHistory.length > 6) casePhysics.dragHistory.shift();
}

function endCaseDrag() {
  if (!casePhysics.isDragging) return;
  casePhysics.isDragging = false;
  pcCase.cursor = 'pointer';
  // 从拖动历史计算松开时的速度
  const hist = casePhysics.dragHistory;
  if (hist.length >= 2) {
    const first = hist[Math.max(0, hist.length - 4)];
    const last = hist[hist.length - 1];
    const dt = Math.max(last.t - first.t, 1);
    casePhysics.vx = (last.x - first.x) / dt * 16;
    casePhysics.vy = (last.y - first.y) / dt * 16;
  }
  // 限制最大速度
  const maxV = 30;
  casePhysics.vx = Math.max(-maxV, Math.min(maxV, casePhysics.vx));
  casePhysics.vy = Math.max(-maxV, Math.min(maxV, casePhysics.vy));
  casePhysics.isActive = true;
}

function updateCasePhysics() {
  if (!casePhysics.isActive || casePhysics.isDragging) return;
  if (!pcCase.visible) return;

  // 重力
  casePhysics.vy += casePhysics.gravity;

  // 更新位置
  pcCase.x += casePhysics.vx;
  pcCase.y += casePhysics.vy;

  const cw = getCaseDisplayWidth();
  const ch = getCaseDisplayHeight();
  const sw = app.screen.width;
  let settled = false;

  // 地面碰撞
  if (pcCase.y >= casePhysics.groundY) {
    pcCase.y = casePhysics.groundY;
    if (Math.abs(casePhysics.vy) > 2.5) {
      casePhysics.vy = -casePhysics.vy * casePhysics.bounce;
      casePhysics.vx *= casePhysics.friction;
    } else {
      casePhysics.vy = 0;
      casePhysics.vx *= 0.85;
      if (Math.abs(casePhysics.vx) < 0.15) {
        casePhysics.vx = 0;
        settled = true;
      }
    }
  }

  // 左墙碰撞
  if (pcCase.x <= 0) {
    pcCase.x = 0;
    casePhysics.vx = -casePhysics.vx * casePhysics.bounce;
  }
  // 右墙碰撞
  if (pcCase.x >= sw - cw) {
    pcCase.x = sw - cw;
    casePhysics.vx = -casePhysics.vx * casePhysics.bounce;
  }
  // 顶部碰撞
  if (pcCase.y <= 0) {
    pcCase.y = 0;
    casePhysics.vy = -casePhysics.vy * casePhysics.bounce;
  }

  if (settled) casePhysics.isActive = false;
}

// 机箱拖动事件
pcCase.eventMode = 'static';
pcCase.cursor = 'pointer';
pcCase.hitArea = new PIXI.Rectangle(0, 0, 1, 1); // 临时，layoutCase中更新
pcCase.on('pointerdown', startCaseDrag);
pcCase.on('pointermove', updateCaseDrag);
pcCase.on('pointerup', endCaseDrag);
pcCase.on('pointerupoutside', endCaseDrag);

function layoutCase() {"""

if old_scene_end in h:
    h = h.replace(old_scene_end, new_scene_end, 1)
    print("1. added physics system variables and functions")
else:
    print("1. ERROR: scene end pattern not found")

# ========== 2. 修改 layoutCase：记录地面高度，物理激活时不重置位置，更新hitArea ==========
old_layout_end = """  fanSprite.visible = state.fans.count > 0;
}"""

new_layout_end = """  fanSprite.visible = state.fans.count > 0;

  // 记录地面高度（物理系统用）
  casePhysics.groundY = pcCase.y;
  // 如果物理未激活，重置位置到默认
  if (!casePhysics.isActive && !casePhysics.isDragging) {
    pcCase.x = app.screen.width * 0.28;
    pcCase.y = casePhysics.groundY;
  }
  // 更新机箱hitArea为实际大小
  pcCase.hitArea = new PIXI.Rectangle(0, 0, pcCase.texture.width, pcCase.texture.height);
}"""

if old_layout_end in h:
    h = h.replace(old_layout_end, new_layout_end, 1)
    print("2. layoutCase records groundY and updates hitArea")
else:
    print("2. ERROR: layout end pattern not found")

# ========== 3. 主循环中添加物理更新 ==========
old_ticker_start = """app.ticker.add(() => {
  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.5);
  lastFrameTime = now;
  updateTweens(dt);
  if (!state.paused) {
    updateLight();
    updateCharacters(dt);
    updateRtxBuyButton();"""

new_ticker_start = """app.ticker.add(() => {
  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.5);
  lastFrameTime = now;
  updateTweens(dt);
  if (!state.paused) {
    updateLight();
    updateCharacters(dt);
    updateRtxBuyButton();
    updateCasePhysics();"""

if old_ticker_start in h:
    h = h.replace(old_ticker_start, new_ticker_start, 1)
    print("3. added updateCasePhysics to main loop")
else:
    print("3. ERROR: ticker start pattern not found")

with open("index_template.html", "w", encoding="utf-8") as f:
    f.write(h)

print("\nPhysics interaction system implemented!")
print("\n功能说明：")
print("  - 按住机箱可拖动")
print("  - 拖到高处松开：重力下落，砸到地面反弹")
print("  - 向左/右/上/下甩：根据拖动速度赋予初速度")
print("  - 碰到左右墙体、顶部、地面都会反弹衰减")
print("  - 速度足够小时自动静止")
print("  - 窗口resize时自动重置位置到默认")
