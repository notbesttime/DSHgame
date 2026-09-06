with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

# ========== 1. 机箱向右移动：0.16 -> 0.20 ==========
old_case_x = "  pcCase.x = app.screen.width * 0.16;"
new_case_x = "  pcCase.x = app.screen.width * 0.20;"
if old_case_x in h:
    h = h.replace(old_case_x, new_case_x, 1)
    print("1. case x moved to 0.20")
else:
    print("1. ERROR: case x not found")

# ========== 2. 购买面板放大：320x210 -> 360x250 ==========
old_panel_size = "const panelW = 320;\nconst panelH = 210;"
new_panel_size = "const panelW = 360;\nconst panelH = 250;"
if old_panel_size in h:
    h = h.replace(old_panel_size, new_panel_size, 1)
    print("2. panel size enlarged to 360x250")
else:
    print("2. ERROR: panel size not found")

# ========== 3. 购买按钮放大并上移 ==========
old_btn_size = "  const btnW = 42, btnH = 80;"
new_btn_size = "  const btnW = 48, btnH = 92;"
if old_btn_size in h:
    h = h.replace(old_btn_size, new_btn_size, 1)
    print("3a. purchase button enlarged to 48x92")
else:
    print("3a. ERROR: btn size not found")

old_btn_y = "  const baseY = pcCase.y - panelH - 12;"
new_btn_y = "  const baseY = pcCase.y - panelH - 28;"
if old_btn_y in h:
    h = h.replace(old_btn_y, new_btn_y, 1)
    print("3b. purchase button moved up (gap 28)")
else:
    print("3b. ERROR: btn y not found")

# ========== 4. RTX3080购买项放大：280x56 -> 320x68 ==========
old_rtx_btn = "  roundRect(g, 0, 0, 280, 56, 8, bgColor, 0.9);"
new_rtx_btn = "  roundRect(g, 0, 0, 320, 68, 10, bgColor, 0.9);"
if old_rtx_btn in h:
    h = h.replace(old_rtx_btn, new_rtx_btn, 1)
    print("4a. rtx buy button enlarged to 320x68")
else:
    print("4a. ERROR: rtx btn size not found")

old_rtx_hit = "  rtxBuyUI.hitArea = new PIXI.Rectangle(0, 0, 280, 56);"
new_rtx_hit = "  rtxBuyUI.hitArea = new PIXI.Rectangle(0, 0, 320, 68);"
if old_rtx_hit in h:
    h = h.replace(old_rtx_hit, new_rtx_hit, 1)
    print("4b. rtx hit area updated")
else:
    print("4b. ERROR: rtx hit area not found")

# ========== 5. GPU图标放大并向下移动 ==========
old_gpu_icon = """  const gpuIcon = new PIXI.Graphics();
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
  }"""

new_gpu_icon = """  const gpuIcon = new PIXI.Graphics();
  gpuIcon.x = 28; gpuIcon.y = 68;
  gpuIcon.lineStyle(2, 0xffd98a, 0.9);
  gpuIcon.beginFill(0x3a5a7a, 0.6);
  gpuIcon.drawRoundedRect(0, 0, 38, 38, 5);
  gpuIcon.endFill();
  // 芯片内部
  gpuIcon.lineStyle(1.5, 0xffd98a, 0.7);
  gpuIcon.beginFill(0x5a7a9a, 0.5);
  gpuIcon.drawRoundedRect(9, 9, 20, 20, 3);
  gpuIcon.endFill();
  // 引脚
  gpuIcon.lineStyle(1.5, 0xffd98a, 0.6);
  for (let i = 0; i < 5; i++) {
    gpuIcon.moveTo(6 + i * 7, 0); gpuIcon.lineTo(6 + i * 7, -4);
    gpuIcon.moveTo(6 + i * 7, 38); gpuIcon.lineTo(6 + i * 7, 42);
    gpuIcon.moveTo(0, 6 + i * 7); gpuIcon.lineTo(-4, 6 + i * 7);
    gpuIcon.moveTo(38, 6 + i * 7); gpuIcon.lineTo(42, 6 + i * 7);
  }"""

if old_gpu_icon in h:
    h = h.replace(old_gpu_icon, new_gpu_icon, 1)
    print("5. GPU icon enlarged (38x38) and moved down (y=68)")
else:
    print("5. ERROR: gpu icon not found")

# ========== 6. RTX3080名称/描述/价格位置调整（因为图标放大了） ==========
old_rtx_name = """  const rtxName = makeText('RTX 3080', { size: 14, color: '#fff5e6', weight: 'bold' });
  rtxName.x = 68; rtxName.y = 62;
  machineContent.addChild(rtxName);

  const rtxDesc = makeText('token生成效率 +5/s', { size: 11, color: '#d4c4a8' });
  rtxDesc.x = 68; rtxDesc.y = 82;
  machineContent.addChild(rtxDesc);"""

new_rtx_name = """  const rtxName = makeText('RTX 3080', { size: 16, color: '#fff5e6', weight: 'bold' });
  rtxName.x = 80; rtxName.y = 72;
  machineContent.addChild(rtxName);

  const rtxDesc = makeText('token生成效率 +5/s', { size: 12, color: '#d4c4a8' });
  rtxDesc.x = 80; rtxDesc.y = 96;
  machineContent.addChild(rtxDesc);"""

if old_rtx_name in h:
    h = h.replace(old_rtx_name, new_rtx_name, 1)
    print("6a. rtx name/desc repositioned and enlarged")
else:
    print("6a. ERROR: rtx name not found")

old_rtx_price = """  const rtxPrice = makeText('', { size: 13, color: '#ffd98a', weight: 'bold', anchor: 1 });
  rtxPrice.x = panelW - 24; rtxPrice.y = 76;"""
new_rtx_price = """  const rtxPrice = makeText('', { size: 15, color: '#ffd98a', weight: 'bold', anchor: 1 });
  rtxPrice.x = panelW - 24; rtxPrice.y = 88;"""
if old_rtx_price in h:
    h = h.replace(old_rtx_price, new_rtx_price, 1)
    print("6b. rtx price repositioned and enlarged")
else:
    print("6b. ERROR: rtx price not found")

# ========== 7. 标签文字放大 ==========
old_tabs = """  const machineTab = makeText('机器', { size: 14, color: '#c4853a', weight: 'bold', anchor: 0.5 });
  const fanTab = makeText('风扇', { size: 14, color: '#8a7a6a', weight: 'bold', anchor: 0.5 });
  machineTab.x = panelW / 2 - 50; machineTab.y = 24;
  fanTab.x = panelW / 2 + 50; fanTab.y = 24;"""
new_tabs = """  const machineTab = makeText('机器', { size: 16, color: '#c4853a', weight: 'bold', anchor: 0.5 });
  const fanTab = makeText('风扇', { size: 16, color: '#8a7a6a', weight: 'bold', anchor: 0.5 });
  machineTab.x = panelW / 2 - 55; machineTab.y = 26;
  fanTab.x = panelW / 2 + 55; fanTab.y = 26;"""
if old_tabs in h:
    h = h.replace(old_tabs, new_tabs, 1)
    print("7. tab text enlarged to 16px")
else:
    print("7. ERROR: tabs not found")

# 标签下划线位置调整
old_tab_line = """    if (currentTab === 'machine') {
      tabLine.drawRect(panelW / 2 - 80, 42, 60, 2);
    } else {
      tabLine.drawRect(panelW / 2 + 20, 42, 60, 2);
    }"""
new_tab_line = """    if (currentTab === 'machine') {
      tabLine.drawRect(panelW / 2 - 85, 46, 60, 2);
    } else {
      tabLine.drawRect(panelW / 2 + 25, 46, 60, 2);
    }"""
if old_tab_line in h:
    h = h.replace(old_tab_line, new_tab_line, 1)
    print("7b. tab line repositioned")
else:
    print("7b. ERROR: tab line not found")

# 风扇占位文字位置
old_fan_ph = """  const fanPlaceholder = makeText('风扇模块开发中…', { size: 13, color: '#8a7a6a', anchor: 0.5 });
  fanPlaceholder.x = panelW / 2; fanPlaceholder.y = 100;"""
new_fan_ph = """  const fanPlaceholder = makeText('风扇模块开发中…', { size: 14, color: '#8a7a6a', anchor: 0.5 });
  fanPlaceholder.x = panelW / 2; fanPlaceholder.y = 120;"""
if old_fan_ph in h:
    h = h.replace(old_fan_ph, new_fan_ph, 1)
    print("7c. fan placeholder repositioned")
else:
    print("7c. ERROR: fan placeholder not found")

with open("index_template.html", "w", encoding="utf-8") as f:
    f.write(h)

print("\nAll UI adjustments applied!")
