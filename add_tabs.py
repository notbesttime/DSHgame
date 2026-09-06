with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

# 替换initPurchasePanel中的标题部分为标签切换
old_title = """  const title = makeText('机器', { size: 16, color: '#3a2a1a', weight: 'bold', anchor: 0.5 });
  title.x = panelW / 2; title.y = 24;
  panelContent.addChild(title);

  const tabLine = new PIXI.Graphics();
  tabLine.beginFill(0xd4c4a8, 0.5);
  tabLine.drawRect(20, 44, panelW - 40, 1);
  tabLine.endFill();
  panelContent.addChild(tabLine);"""

new_title = """  // 标签切换：机器 / 风扇
  let currentTab = 'machine';
  const machineTab = makeText('机器', { size: 14, color: '#c4853a', weight: 'bold', anchor: 0.5 });
  const fanTab = makeText('风扇', { size: 14, color: '#8a7a6a', weight: 'bold', anchor: 0.5 });
  machineTab.x = panelW / 2 - 50; machineTab.y = 24;
  fanTab.x = panelW / 2 + 50; fanTab.y = 24;
  machineTab.eventMode = 'static'; machineTab.cursor = 'pointer';
  fanTab.eventMode = 'static'; fanTab.cursor = 'pointer';
  panelContent.addChild(machineTab, fanTab);

  const tabLine = new PIXI.Graphics();
  panelContent.addChild(tabLine);

  const machineContent = new PIXI.Container();
  const fanContent = new PIXI.Container();
  panelContent.addChild(machineContent, fanContent);
  fanContent.visible = false;

  function drawTabLine() {
    tabLine.clear();
    tabLine.beginFill(0xc4853a, 0.8);
    if (currentTab === 'machine') {
      tabLine.drawRect(panelW / 2 - 80, 42, 60, 2);
    } else {
      tabLine.drawRect(panelW / 2 + 20, 42, 60, 2);
    }
    tabLine.endFill();
  }
  drawTabLine();

  machineTab.on('pointerdown', () => {
    currentTab = 'machine';
    machineTab.style.fill = '#c4853a';
    fanTab.style.fill = '#8a7a6a';
    machineContent.visible = true;
    fanContent.visible = false;
    drawTabLine();
  });
  fanTab.on('pointerdown', () => {
    currentTab = 'fan';
    fanTab.style.fill = '#c4853a';
    machineTab.style.fill = '#8a7a6a';
    fanContent.visible = true;
    machineContent.visible = false;
    drawTabLine();
  });

  // 风扇标签占位内容
  const fanPlaceholder = makeText('风扇模块开发中…', { size: 13, color: '#8a7a6a', anchor: 0.5 });
  fanPlaceholder.x = panelW / 2; fanPlaceholder.y = 100;
  fanContent.addChild(fanPlaceholder);"""

if old_title in h:
    h = h.replace(old_title, new_title, 1)
    print("Added machine/fan tab switch")
else:
    print("ERROR: title pattern not found")

# 把RTX3080相关内容从panelContent移到machineContent
old_rtx_ui = """  rtxBuyUI = new PIXI.Graphics();
  rtxBuyUI.x = 20; rtxBuyUI.y = 56;
  panelContent.addChild(rtxBuyUI);

  const gpuIcon = new PIXI.Graphics();
  gpuIcon.x = 30; gpuIcon.y = 60;"""
new_rtx_ui = """  rtxBuyUI = new PIXI.Graphics();
  rtxBuyUI.x = 20; rtxBuyUI.y = 56;
  machineContent.addChild(rtxBuyUI);

  const gpuIcon = new PIXI.Graphics();
  gpuIcon.x = 30; gpuIcon.y = 60;"""
if old_rtx_ui in h:
    h = h.replace(old_rtx_ui, new_rtx_ui, 1)
    print("Moved rtxBuyUI to machineContent")
else:
    print("ERROR: rtxBuyUI pattern not found")

# 替换剩余的panelContent.addChild为machineContent.addChild（RTX3080相关）
old_adds = [
    ("  panelContent.addChild(gpuIcon);", "  machineContent.addChild(gpuIcon);"),
    ("  panelContent.addChild(rtxName);", "  machineContent.addChild(rtxName);"),
    ("  panelContent.addChild(rtxDesc);", "  machineContent.addChild(rtxDesc);"),
    ("  panelContent.addChild(rtxPrice);", "  machineContent.addChild(rtxPrice);"),
]
for old, new in old_adds:
    if old in h:
        h = h.replace(old, new, 1)
        print(f"Moved {old.strip()} to machineContent")
    else:
        print(f"WARNING: {old.strip()} not found")

with open("index_template.html", "w", encoding="utf-8") as f:
    f.write(h)

print("\nTab switch added!")
