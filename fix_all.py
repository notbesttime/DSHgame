import re

with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

# ========== 1. 修复按钮字体模糊：makeText添加resolution=2 ==========
old_maketext = """  const t = new PIXI.Text(text, style);
  if (opts.anchor !== undefined) t.anchor.set(opts.anchor);
  return t;"""
new_maketext = """  const t = new PIXI.Text(text, style);
  t.resolution = 2;
  if (opts.anchor !== undefined) t.anchor.set(opts.anchor);
  return t;"""
if old_maketext in h:
    h = h.replace(old_maketext, new_maketext, 1)
    print("1. fixed text resolution")
else:
    print("1. ERROR: makeText pattern not found")

# ========== 2. 修复按钮越来越大：addPressFeedback清除旧tween ==========
old_press = """function addPressFeedback(obj, scale = 0.92) {
  obj.eventMode = 'static';
  obj.cursor = 'pointer';
  obj.on('pointerdown', () => { tween(obj.scale, { x: scale, y: scale }, 0.08); });
  obj.on('pointerup', () => { tween(obj.scale, { x: 1, y: 1 }, 0.15); });
  obj.on('pointerupoutside', () => { tween(obj.scale, { x: 1, y: 1 }, 0.15); });
}"""
new_press = """function addPressFeedback(obj, scale = 0.92) {
  obj.eventMode = 'static';
  obj.cursor = 'pointer';
  function clearScaleTweens() {
    for (let i = tweens.length - 1; i >= 0; i--) {
      if (tweens[i].target === obj.scale) tweens.splice(i, 1);
    }
  }
  obj.on('pointerdown', () => { clearScaleTweens(); tween(obj.scale, { x: scale, y: scale }, 0.08); });
  obj.on('pointerup', () => { clearScaleTweens(); tween(obj.scale, { x: 1, y: 1 }, 0.15); });
  obj.on('pointerupoutside', () => { clearScaleTweens(); tween(obj.scale, { x: 1, y: 1 }, 0.15); });
}"""
if old_press in h:
    h = h.replace(old_press, new_press, 1)
    print("2. fixed press feedback tween accumulation")
else:
    print("2. ERROR: addPressFeedback pattern not found")

# ========== 3. 角色visible切换 ==========
old_char_init = """const charClosed = PIXI.Sprite.from(ASSETS.char2);
const charOpen = PIXI.Sprite.from(ASSETS.char1);
charOpen.visible = false;
charOpen.alpha = 0;
layers.characters.addChild(charClosed, charOpen);"""
new_char_init = """const charClosed = PIXI.Sprite.from(ASSETS.char2);
const charOpen = PIXI.Sprite.from(ASSETS.char1);
charClosed.visible = true;
charOpen.visible = false;
layers.characters.addChild(charClosed, charOpen);"""
if old_char_init in h:
    h = h.replace(old_char_init, new_char_init, 1)
    print("3a. fixed character init (visible toggle)")
else:
    print("3a. ERROR: char init pattern not found")

old_char_talk = """function triggerCharacterTalk() {
  if (isTalking) { talkTimer = 0.35; return; }
  isTalking = true;
  talkTimer = 0.35;
  charOpen.visible = true;
  tween(charOpen, { alpha: 1 }, 0.06);
  tween(charClosed, { alpha: 0 }, 0.06);
}

function updateCharacters(dt) {
  if (isTalking) {
    talkTimer -= dt;
    if (talkTimer <= 0) {
      isTalking = false;
      tween(charOpen, { alpha: 0 }, 0.1, () => { charOpen.visible = false; });
      tween(charClosed, { alpha: 1 }, 0.1);
    }
  }
}"""
new_char_talk = """function triggerCharacterTalk() {
  if (isTalking) { talkTimer = 0.35; return; }
  isTalking = true;
  talkTimer = 0.35;
  charClosed.visible = false;
  charOpen.visible = true;
}

function updateCharacters(dt) {
  if (isTalking) {
    talkTimer -= dt;
    if (talkTimer <= 0) {
      isTalking = false;
      charClosed.visible = true;
      charOpen.visible = false;
    }
  }
}"""
if old_char_talk in h:
    h = h.replace(old_char_talk, new_char_talk, 1)
    print("3b. fixed character talk (visible toggle)")
else:
    print("3b. ERROR: char talk pattern not found")

# ========== 4. 机箱和占位图向左上移动 ==========
old_case_pos = """  pcCase.x = app.screen.width * 0.25;
  const bottomMargin = Math.min(80, app.screen.height * 0.06);
  pcCase.y = app.screen.height - caseH - bottomMargin;"""
new_case_pos = """  pcCase.x = app.screen.width * 0.16;
  const bottomMargin = Math.min(80, app.screen.height * 0.06);
  pcCase.y = app.screen.height - caseH - bottomMargin - 40;"""
if old_case_pos in h:
    h = h.replace(old_case_pos, new_case_pos, 1)
    print("4. moved case to upper-left (16%, -40px)")
else:
    print("4. ERROR: case position pattern not found")

# ========== 5. 添加CPU图标到购买面板 ==========
old_rtx_name = """  const rtxName = makeText('RTX 3080', { size: 14, color: '#fff5e6', weight: 'bold' });
  rtxName.x = 32; rtxName.y = 62;
  panelContent.addChild(rtxName);

  const rtxDesc = makeText('token生成效率 +5/s', { size: 11, color: '#d4c4a8' });
  rtxDesc.x = 32; rtxDesc.y = 82;
  panelContent.addChild(rtxDesc);"""
new_rtx_name = """  // CPU/GPU图标
  const gpuIcon = new PIXI.Graphics();
  gpuIcon.x = 30; gpuIcon.y = 60;
  gpuIcon.lineStyle(1.5, 0xffd98a, 0.9);
  gpuIcon.beginFill(0x3a5a7a, 0.6);
  gpuIcon.drawRoundedRect(0, 0, 28, 28, 3);
  gpuIcon.endFill();
  // 芯片内部
  gpuIcon.lineStyle(1, 0xffd98a, 0.7);
  gpuIcon.beginFill(0x5a7a9a, 0.5);
  gpuIcon.drawRoundedRect(6, 6, 16, 16, 2);
  gpuIcon.endFill();
  // 引脚
  gpuIcon.lineStyle(1, 0xffd98a, 0.6);
  for (let i = 0; i < 4; i++) {
    gpuIcon.moveTo(5 + i * 6, 0); gpuIcon.lineTo(5 + i * 6, -3);
    gpuIcon.moveTo(5 + i * 6, 28); gpuIcon.lineTo(5 + i * 6, 31);
    gpuIcon.moveTo(0, 5 + i * 6); gpuIcon.lineTo(-3, 5 + i * 6);
    gpuIcon.moveTo(28, 5 + i * 6); gpuIcon.lineTo(31, 5 + i * 6);
  }
  panelContent.addChild(gpuIcon);

  const rtxName = makeText('RTX 3080', { size: 14, color: '#fff5e6', weight: 'bold' });
  rtxName.x = 68; rtxName.y = 62;
  panelContent.addChild(rtxName);

  const rtxDesc = makeText('token生成效率 +5/s', { size: 11, color: '#d4c4a8' });
  rtxDesc.x = 68; rtxDesc.y = 82;
  panelContent.addChild(rtxDesc);"""
if old_rtx_name in h:
    h = h.replace(old_rtx_name, new_rtx_name, 1)
    print("5. added GPU icon to purchase panel")
else:
    print("5. ERROR: rtx name pattern not found")

# 调整价格标签位置（因为图标占了左边空间）
old_price = """  const rtxPrice = makeText('', { size: 13, color: '#ffd98a', weight: 'bold', anchor: 1 });
  rtxPrice.x = panelW - 32; rtxPrice.y = 76;"""
new_price = """  const rtxPrice = makeText('', { size: 13, color: '#ffd98a', weight: 'bold', anchor: 1 });
  rtxPrice.x = panelW - 24; rtxPrice.y = 76;"""
if old_price in h:
    h = h.replace(old_price, new_price, 1)
    print("5b. adjusted price label position")
else:
    print("5b. ERROR: price pattern not found")

with open("index_template.html", "w", encoding="utf-8") as f:
    f.write(h)

print("\nAll fixes applied to template!")
