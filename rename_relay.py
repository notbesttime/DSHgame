with open("index_template.html", "r", encoding="utf-8") as f:
    h = f.read()

# 把所有贩卖相关的改成中转站
h = h.replace("贩卖标签（购买3080后解锁）", "中转站标签（购买服务器后解锁）")
h = h.replace("sellTab", "relayTab")
h = h.replace("sellTabBg", "relayTabBg")
h = h.replace("sellTabText", "relayTabText")
h = h.replace("sellPanel", "relayPanel")
h = h.replace("sellPanelBg", "relayPanelBg")
h = h.replace("sellPanelText", "relayPanelText")
h = h.replace("sellPanelOpen", "relayPanelOpen")
h = h.replace("layoutSellTab", "layoutRelayTab")
h = h.replace("updateSellTabVisibility", "updateRelayTabVisibility")
h = h.replace("makeText('贩卖'", "makeText('中转站'")
h = h.replace("贩卖功能开发中…", "中转站功能开发中…")

# 中转站的解锁条件改成购买服务器（state.machines.server）
h = h.replace(
    "relayTab.visible = state.machines.rtx3080.count > 0;",
    "relayTab.visible = state.machines.server.count > 0;"
)
h = h.replace(
    "if (!relayTab.visible) { relayPanel.visible = false; relayPanelOpen = false; }",
    "if (!relayTab.visible) { relayPanel.visible = false; relayPanelOpen = false; }"
)

# 购买RTX3080时不再解锁中转站
h = h.replace("updateRelayTabVisibility();\n    }\n  });\n\n  drawRtxBuyButton", "updateRelayTabVisibility();\n    }\n  });\n\n  drawRtxBuyButton")

with open("index_template.html", "w", encoding="utf-8") as f:
    f.write(h)

print("Renamed 贩卖 to 中转站")
