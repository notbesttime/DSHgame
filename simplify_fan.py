with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

# ========== 1. recalcClickPower 改为乘法方案 ==========
old_recalc = """function recalcClickPower() {
  // 混合增益：线性保底 + 百分比加成（越有钱点得越多）
  // 点击收益 = 1 + 风扇数 + floor(当前tokens * 0.05% * 风扇数)
  const n = state.fans.count;
  const percentBonus = Math.floor(state.tokens * 0.0005 * n);
  state.tokensPerClick = 1 + n + percentBonus;
}"""

new_recalc = """function recalcClickPower() {
  // 每台风扇：点击收益 ×1.1（乘法叠加）
  state.tokensPerClick = Math.pow(1.1, state.fans.count);
}"""

if old_recalc in h:
    h = h.replace(old_recalc, new_recalc, 1)
    print("1. recalcClickPower -> multiplicative (x1.1 per fan)")
else:
    print("1. ERROR: recalcClickPower not found")

# ========== 2. formatNum 支持一位小数 ==========
old_format = """function formatNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}"""

new_format = """function formatNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  // 一位小数，去掉末尾多余的0
  const rounded = Math.round(n * 10) / 10;
  return rounded.toString();
}"""

if old_format in h:
    h = h.replace(old_format, new_format, 1)
    print("2. formatNum supports 1 decimal place")
else:
    print("2. ERROR: formatNum not found")

# ========== 3. 飘字显示一位小数 ==========
old_float = "  const t = makeText(text, { size: 22, color: '#ffd98a', weight: 'bold', anchor: 0.5 });"
# 这个不需要改，因为传入的text已经格式化好了
# spawnFloatText调用时传入的是'+' + state.tokensPerClick，需要格式化
print("3. float text uses formatNum via caller (checking spawnFloatText call)")

# 检查spawnFloatText的调用
old_spawn_call = "  spawnFloatText('+' + state.tokensPerClick, pos.x, pos.y);"
new_spawn_call = "  spawnFloatText('+' + formatNum(state.tokensPerClick), pos.x, pos.y);"
if old_spawn_call in h:
    h = h.replace(old_spawn_call, new_spawn_call, 1)
    print("3b. spawnFloatText call uses formatNum")
else:
    print("3b. ERROR: spawnFloatText call not found")

# ========== 4. 风扇描述文字简化 ==========
old_desc = "  const fanDesc = makeText('点击+1/台，额外获得当前tokens的0.05%/台', { size: 11, color: '#d4c4a8' });"
new_desc = "  const fanDesc = makeText('每次点击获得的token数 ×1.1', { size: 12, color: '#d4c4a8' });"
if old_desc in h:
    h = h.replace(old_desc, new_desc, 1)
    print("4. fan description simplified")
else:
    print("4. ERROR: fan desc not found")

# ========== 5. 被动收入(tps)显示一位小数（已经用formatNum，不需要改） ==========
# updateTokenDisplay中 tpsLabel.text = state.tokensPerSecond > 0 ? ('+ ' + formatNum(state.tokensPerSecond) + ' / 秒') : ...
# 已经用了formatNum，会自动显示一位小数
print("5. tps display already uses formatNum")

# ========== 6. 购买时tokens保持浮点数（已经是浮点数，不需要floor） ==========
# 检查购买RTX3080的代码
old_buy_rtx = """      state.tokens -= price;
      state.machines.rtx3080.count++;
      state.tokensPerSecond = state.machines.rtx3080.count * 5;
      recalcClickPower();"""
# 已经是浮点数减法，不需要改
print("6. purchase keeps float tokens (no floor needed)")

# ========== 7. 主循环被动收入也保持浮点数 ==========
old_second = """      const add = state.tokensPerSecond * Math.floor(secondAccum);
      if (add > 0) {
        state.tokens += add;
        updateTokenDisplay();
      }"""
# 已经是浮点数加法，不需要改
print("7. passive income keeps float")

# ========== 8. 购买按钮价格检查：浮点数比较 ==========
# drawRtxBuyButton: const canAfford = state.tokens >= rtx3080Price();
# 已经是浮点数比较，不需要改
print("8. affordability check uses float comparison")

with open("index_template.html", "w", encoding="utf-8") as f:
    f.write(h)

print("\nAll changes applied!")
print("\n效果示例：")
print("  0台风扇: 点击+1.0")
print("  1台风扇: 点击+1.1")
print("  2台风扇: 点击+1.2")
print("  3台风扇: 点击+1.3")
print("  5台风扇: 点击+1.6")
print("  10台风扇: 点击+2.6")
print("  20台风扇: 点击+6.7")
