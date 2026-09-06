with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

# 1. 在主循环的秒级累计中添加 recalcClickPower
old_main = """    secondAccum += dt;
    if (secondAccum >= 1) {
      const add = state.tokensPerSecond * Math.floor(secondAccum);
      if (add > 0) {
        state.tokens += add;
        updateTokenDisplay();
      }
      secondAccum = secondAccum % 1;
    }"""

new_main = """    secondAccum += dt;
    if (secondAccum >= 1) {
      const add = state.tokensPerSecond * Math.floor(secondAccum);
      if (add > 0) {
        state.tokens += add;
        updateTokenDisplay();
      }
      if (state.fans.count > 0) recalcClickPower();
      secondAccum = secondAccum % 1;
    }"""

if old_main in h:
    h = h.replace(old_main, new_main, 1)
    print("1. added recalcClickPower in main loop")
else:
    print("1. SKIP (may already be applied)")

# 2. 购买机器后也重新计算
old_buy = """      state.tokensPerSecond = state.machines.rtx3080.count * 5;
      updateTokenDisplay();
      layoutCase();
      rtxPrice.text = rtx3080Price() + ' token';
      drawRtxBuyButton();"""

new_buy = """      state.tokensPerSecond = state.machines.rtx3080.count * 5;
      recalcClickPower();
      updateTokenDisplay();
      layoutCase();
      rtxPrice.text = rtx3080Price() + ' token';
      drawRtxBuyButton();"""

if old_buy in h:
    h = h.replace(old_buy, new_buy, 1)
    print("2. added recalcClickPower after buying RTX")
else:
    print("2. SKIP (may already be applied)")

# 3. 更新风扇描述文字
old_desc = "  const fanDesc = makeText('点击增益 +1/台（每3台额外+1）', { size: 12, color: '#d4c4a8' });"
new_desc = "  const fanDesc = makeText('点击+1/台，额外获得当前tokens的0.05%/台', { size: 11, color: '#d4c4a8' });"

if old_desc in h:
    h = h.replace(old_desc, new_desc, 1)
    print("3. updated fan description")
else:
    print("3. SKIP (may already be applied)")

with open("index_template.html", "w", encoding="utf-8") as f:
    f.write(h)

print("\nDone!")
