with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

old = """  buyButtons.extraRack = rack.bg;

  // ========== 散热板块 =========="""

new = """  buyButtons.extraRack = rack.bg;

  // 服务器（解锁中转站）
  const server = createBuyItem(mc, 290, (icon) => {
    icon.lineStyle(2, 0xffaa6a, 0.9);
    icon.beginFill(0x5a3a1a, 0.6);
    icon.drawRoundedRect(0, 0, 38, 38, 4);
    icon.endFill();
    icon.lineStyle(1.5, 0xffaa6a, 0.7);
    for (let i = 0; i < 4; i++) {
      icon.drawRect(4, 4 + i * 8, 30, 5);
    }
    icon.beginFill(0x6aff6a, 0.9);
    icon.drawCircle(32, 8, 2);
    icon.endFill();
  }, '服务器', '购买后解锁"中转站"系统', serverPrice, 0xba6a3a, () => {
    state.machines.server.count++;
    updateRelayTabVisibility();
  }, false, () => state.machines.server.count);
  buyButtons.server = server.bg;

  // ========== 散热板块 =========="""

if old in h:
    h = h.replace(old, new, 1)
    with open("index_template.html", "w", encoding="utf-8") as f:
        f.write(h)
    print("Server buy item added")
else:
    print("ERROR: pattern not found")
