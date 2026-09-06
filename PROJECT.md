# DSH · 地下机房

PixiJS v7.4.0 放置点击类网页游戏:点击赚取 token → 购买 GPU/散热/脚本升级 → 机箱可拖拽抛掷(带物理反弹)。单文件构建,可直接离线打开 `index.html`,或用 `server.js` 起本地服务。

## 项目结构

```
DSHgame/
├── index_template.html    ★ 游戏源码(全部游戏逻辑,约1400行 JS + CSS)
├── build.py               ★ 构建脚本:把 PixiJS + 素材 base64 内联进模板 → index.html
├── index.html               构建产物(勿手改,重新生成)
├── server.js              ★ 本地静态服务器(:8765,gzip + ETag 304 + 路径防护)
├── recompress_assets.py   ★ 资产重压缩:compressed/*.png → compressed_webp/*.webp
├── lib/pixi.min.js          PixiJS v7.4.0(构建时内联)
├── assets/
│   ├── raw/                 原始素材(来源,不参与构建)
│   ├── compressed/          第一代压缩(png/jpg,build.py 仍引用其中 4 张)
│   └── compressed_webp/     ★ 第二代 WebP(大部分素材来自这里)
└── add_*.py / fix_*.py / rewrite_*.py / ...   ⚠️ 历史一次性补丁脚本,已被 git 历史
                              取代的可归档删除;不要在新流程中使用
```

★ = 当前有效流水线。**改游戏只改 `index_template.html`,然后跑 `python build.py`。**

## 常用命令

```bash
python build.py            # 重新构建 index.html(改模板/素材后必跑)
python recompress_assets.py # 素材重压缩(仅换图后需要,依赖 Pillow)
node server.js             # http://localhost:8765
```

## 素材流水线

- `build.py` 顶部 `ASSET_FILES` 字典是**资产唯一数据源**:新增素材加一行即可(旧版清单写两遍的坑已修)。
- PNG 素材走 `recompress_assets.py` 转 WebP(按游戏内显示尺寸×2 出图,质量 85-88)。目前 `bg_dark/bg_light/placeholder/transfer_bg` 四张仍用 compressed/ 的 JPG(全屏大图 WebP 收益低,未迁移)。
- 修改 compressed/ 原图后必须重跑 recompress 才会影响构建。

## 当前进度(2026-09-06)

### 性能优化(已完成并实测)
- 索引文件 4.0MB → 1.56MB;gzip 传输后约 943KB;ETag 304 协商缓存生效;路径越界返回 403。
- PNG→WebP:pc_case 816KB→44KB、fan 456KB→119KB、角色 150KB→28KB/22KB 等,12 张共约 1.9MB→264KB。
- server.js:内存缓存 + gzip(level 8)+ If-None-Match/304 + Cache-Control + `path.normalize` 越界防护。
- 购买按钮改为脏标记重绘(原先每帧对最多 8 个 Graphics 执行 clear+重画,是最大每帧开销)。
- antialias 关闭;灯效层 `bgDark` 用 visible 切换代替 alpha=0(不参与渲染批次)。
- 浮字对象池(上限池 40 / 同时在屏 30),替代每次点击 new PIXI.Text。
- token 顶栏文字去重(setText 仅在变化时);resize/safeRelayout 用 rAF 节流。

### 中转站(仅 UI 框架,玩法待安排 ⚠️)
- **设计决定(用户拍板)**:排行榜/社交系统不做(那是其他 AI 意外加的);数据包货币/暂存/转运/4 项升级的第一版玩法**已实现过但按用户要求撤空**,中转站玩法由用户后续安排,不要自行实现。
- 现状:底部「生产 / 中转站」双标签常驻(新增 `layers.nav` 置顶层,场景切换后标签仍可见可点),点击切换场景;中转站解锁条件=购买服务器(`updateRelayTabVisibility`);场景内目前只有背景+椅子占位。
- 相关代码入口:`switchScene()`(场景切换+标签高亮)、`relayScene`/`openRelayScene`/`closeRelayScene`、`layoutRelayScene`。
- `state.relay` 是空对象占位;存档 v1 没有中转站字段。撤掉的玩法可参考 git 历史里的本次提交前后 diff。

### 其他本轮改动
- 脚本商品 `niger` 改名 `autoClick`(显示名"自动点击");存档兼容:`loadGame` 里 `data.autoClick || data.niger`。

## 存档格式(localStorage key `dshgame_save_v1`)

```json
{ "tokens":0, "rtx3080":0, "a100":0, "extraRack":0, "server":0,
  "fan":0, "waterCooling":0, "autoClick":false, "miracle":false, "savedAt":0 }
```

- 30 秒自动存档;购买时立即存;重置走设置面板。
- 向后兼容字段:`niger`(=autoClick 旧名)。
- **加字段时**:`saveGame`/`loadGame`/`resetGame` 三处同步,数值用 `data.x || 0` 兜底。

## 游戏机制速查

- 点击:基础 1/次;风扇 ×1.1^数量;暴击率 0.5%+0.5%/A100,倍率 1.5+1%/机柜。
- 产出:RTX3080 5/s + A100 50/s;每整秒入账。
- 价格:3080=50×1.5^n、风扇=80×1.5^n、A100=2000×1.5^n、机柜=5000×2^n、服务器=10000×2^n、水冷=3000×1.8^n、自动点击 800(一次性)、奇迹算法 1500(一次性:机箱砸地 25% 得 tokens×3%)。
- 水冷:每 10-120s 骰一次,19% 得 tokens×20%。
- 机箱:可拖拽抛掷,重力/反弹/墙碰撞;≥9 张 3080 换升级贴图。
- 中转站标签:server>0 时显示。

## 代码导航(index_template.html 内的分节注释)

`工具函数` → `补间动画` → `PIXI 初始化` → `层级容器`(bg/clickArea/characters/scene/ui/topbar/fx/settings/nav) → `背景层(灯效)` → `点击增量层` → `角色层` → `场景层(机箱物理)` → `购买面板`(三标签:机器/散热/脚本) → `生产标签/中转站标签+switchScene` → `中转站场景` → `顶部信息栏` → `设置` → `游戏状态` → `本地存档` → `统一布局` → `主循环` → `启动(多重布局保险)`

## 已知事项 / 注意

- 浏览器自动化点击 canvas 测试时:**设置面板开着会挡住底部标签**(遮罩全屏),先关面板再点。cua 坐标=CSS 像素(本机 dpr=1),中转站标签中心 ≈ `(0.62×宽, 高-36)`,生产 ≈ `(0.38×宽, 高-36)`。
- 设置面板的音乐/音效滑条目前是摆设(无音频消费方),接入音频前别让玩家误会。
- 手机竖屏会显示"请横屏游玩"遮罩(`#rotatePrompt`,触屏+竖屏才触发)。
- 启动时序:base64 纹理异步解码,靠 5 个 `texture.on('update')` + 前 60 帧 `layoutFixTicker` 兜底重排,不要删。
- `_check_syntax.js` 已删;需要语法自检可用 `node -e "new Function(require('fs').readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/g).join('\n'))"` 之外的方式逐块检查(建议自建脚本)。

## 后续待办(用户规划)

1. **中转站玩法设计**(用户亲自安排——等需求,勿抢先实现)
2. 设置面板音频接入(音乐/音效滑条已就位)
3. 低优先:背景大图 WebP 迁移、offline 收益(存档已有 savedAt 可算离线时长)
