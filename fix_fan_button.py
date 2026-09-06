with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

# ========== 1. 添加全局变量 fanBuyUI ==========
old_global = """let rtxBuyUI = null;
let rtxBtnState = null;"""
new_global = """let rtxBuyUI = null;
let rtxBtnState = null;
let fanBuyUI = null;"""
if old_global in h:
    h = h.replace(old_global, new_global, 1)
    print("1. added global fanBuyUI")
else:
    print("1. ERROR: global vars not found")

# ========== 2. 添加全局 drawFanBuyButton 函数（放在drawRtxBuyButton后面） ==========
old_draw_rtx = """function drawRtxBuyButton() {
  if (!rtxBuyUI) return;
  const g = rtxBuyUI;
  g.clear();
  const canAfford = state.tokens >= rtx3080Price();
  const bgColor = canAfford ? 0x4a7c59 : 0x6b6b6b;
  roundRect(g, 0, 0, 320, 68, 10, bgColor, 0.9);
  rtxBtnState = canAfford ? 'enabled' : 'disabled';
}"""

new_draw_rtx = """function drawRtxBuyButton() {
  if (!rtxBuyUI) return;
  const g = rtxBuyUI;
  g.clear();
  const canAfford = state.tokens >= rtx3080Price();
  const bgColor = canAfford ? 0x4a7c59 : 0x6b6b6b;
  roundRect(g, 0, 0, 320, 68, 10, bgColor, 0.9);
  rtxBtnState = canAfford ? 'enabled' : 'disabled';
}

function drawFanBuyButton() {
  if (!fanBuyUI) return;
  const g = fanBuyUI;
  g.clear();
  const canAfford = state.tokens >= fanPrice();
  const bgColor = canAfford ? 0x3a9a6a : 0x6b6b6b;
  roundRect(g, 0, 0, 320, 68, 10, bgColor, 0.9);
}"""

if old_draw_rtx in h:
    h = h.replace(old_draw_rtx, new_draw_rtx, 1)
    print("2. added global drawFanBuyButton (brighter green 0x3a9a6a)")
else:
    print("2. ERROR: drawRtxBuyButton not found")

# ========== 3. 修改 updateRtxBuyButton，直接调用 drawFanBuyButton ==========
old_update = """function updateRtxBuyButton() {
  const canAfford = state.tokens >= rtx3080Price();
  const newState = canAfford ? 'enabled' : 'disabled';
  if (newState !== rtxBtnState) drawRtxBuyButton();
  // 风扇购买按钮实时刷新
  if (typeof drawFanBuyButton === 'function') {
    drawFanBuyButton();
  }
}"""

new_update = """function updateRtxBuyButton() {
  const canAfford = state.tokens >= rtx3080Price();
  const newState = canAfford ? 'enabled' : 'disabled';
  if (newState !== rtxBtnState) drawRtxBuyButton();
  drawFanBuyButton();
}"""

if old_update in h:
    h = h.replace(old_update, new_update, 1)
    print("3. simplified updateRtxBuyButton")
else:
    print("3. ERROR: updateRtxBuyButton not found")

# ========== 4. 修改 initPurchasePanel 中的 fanBuyUI 声明（去掉const，用全局变量） ==========
old_fan_decl = "  const fanBuyUI = new PIXI.Graphics();"
new_fan_decl = "  fanBuyUI = new PIXI.Graphics();"
if old_fan_decl in h:
    h = h.replace(old_fan_decl, new_fan_decl, 1)
    print("4. changed fanBuyUI to global assignment")
else:
    print("4. ERROR: fanBuyUI decl not found")

# ========== 5. 删除 initPurchasePanel 中的局部 drawFanBuyButton 定义 ==========
old_local_draw = """  function drawFanBuyButton() {
    fanBuyUI.clear();
    const canAfford = state.tokens >= fanPrice();
    const bgColor = canAfford ? 0x2a6a4a : 0x6b6b6b;
    roundRect(fanBuyUI, 0, 0, 320, 68, 10, bgColor, 0.9);
  }
  drawFanBuyButton();"""

new_local_draw = "  drawFanBuyButton();"

if old_local_draw in h:
    h = h.replace(old_local_draw, new_local_draw, 1)
    print("5. removed local drawFanBuyButton, using global")
else:
    print("5. ERROR: local drawFanBuyButton not found")

# ========== 6. 阶梯增益：修改 recalcClickPower ==========
old_recalc = """function recalcClickPower() {
  state.tokensPerClick = 1 + state.fans.count;
}"""

new_recalc = """function recalcClickPower() {
  // 阶梯增益：基础1 + 每台风扇1 + 每3台额外+1（后期不乏力）
  const n = state.fans.count;
  state.tokensPerClick = 1 + n + Math.floor(n / 3);
}"""

if old_recalc in h:
    h = h.replace(old_recalc, new_recalc, 1)
    print("6. implemented staggered click gain (1 + n + floor(n/3))")
else:
    print("6. ERROR: recalcClickPower not found")

# ========== 7. 更新风扇描述文字（反映阶梯增益） ==========
old_fan_desc = "  const fanDesc = makeText('点击获得 token +1/次', { size: 12, color: '#d4c4a8' });"
new_fan_desc = "  const fanDesc = makeText('点击增益 +1/台（每3台额外+1）', { size: 12, color: '#d4c4a8' });"
if old_fan_desc in h:
    h = h.replace(old_fan_desc, new_fan_desc, 1)
    print("7. updated fan description text")
else:
    print("7. ERROR: fan desc not found")

with open("index_template.html", "w", encoding="utf-8") as f:
    f.write(h)

print("\nAll fixes applied!")
print("\n阶梯增益示例：")
print("  0台风扇: 点击+1")
print("  1台风扇: 点击+2 (1+1+0)")
print("  2台风扇: 点击+3 (1+2+0)")
print("  3台风扇: 点击+5 (1+3+1)")
print("  6台风扇: 点击+9 (1+6+2)")
print("  9台风扇: 点击+13 (1+9+3)")
