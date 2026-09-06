with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

# RTX 3080
h = h.replace(
    "  }, false, () => false);\n  buyButtons.rtx3080 = rtx.bg;",
    "  }, false, () => false, () => state.machines.rtx3080.count);\n  buyButtons.rtx3080 = rtx.bg;"
)

# A100
h = h.replace(
    "  }, false, () => false);\n  buyButtons.a100 = a100.bg;",
    "  }, false, () => false, () => state.machines.a100.count);\n  buyButtons.a100 = a100.bg;"
)

# 额外机柜
h = h.replace(
    "  }, false, () => false);\n  buyButtons.extraRack = rack.bg;",
    "  }, false, () => false, () => state.machines.extraRack.count);\n  buyButtons.extraRack = rack.bg;"
)

# 风扇
h = h.replace(
    "  }, false, () => false);\n  buyButtons.fan = fan.bg;",
    "  }, false, () => false, () => state.cooling.fan.count);\n  buyButtons.fan = fan.bg;"
)

# 水冷
h = h.replace(
    "  }, false, () => false);\n  buyButtons.waterCooling = wc.bg;",
    "  }, false, () => false, () => state.cooling.waterCooling.count);\n  buyButtons.waterCooling = wc.bg;"
)

# niger (一次性)
h = h.replace(
    "  }, true, () => state.scripts.niger);\n  buyButtons.niger = niger.bg;",
    "  }, true, () => state.scripts.niger, null);\n  buyButtons.niger = niger.bg;"
)

# 奇迹算法 (一次性)
h = h.replace(
    "  }, true, () => state.scripts.miracle);\n  buyButtons.miracle = miracle.bg;",
    "  }, true, () => state.scripts.miracle, null);\n  buyButtons.miracle = miracle.bg;"
)

with open("index_template.html", "w", encoding="utf-8") as f:
    f.write(h)

print("All createBuyItem calls updated with countFn")
