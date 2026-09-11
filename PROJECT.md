# DSH · 地下机房

PixiJS v7.4.0 放置点击类网页游戏:点击赚取 token → 购买 GPU/散热/脚本升级 → 机箱可拖拽抛掷(带物理反弹)。两种构建产物:**单文件 `index.html`**(可离线直接打开,塞「本体」用)与 **`dist/`**(`python build.py --dist`,代码与哈希资源分离,发布 VibeHub 用;需 http 服务)。两者共用同一份 `index_template.html`。

## 项目结构

```
DSHgame/
├── index_template.html    ★ 游戏源码(全部游戏逻辑,约2500行,含少量 CSS/HTML)
├── build.py               ★ 构建脚本:默认单文件 base64 内联 → index.html;`--dist` → dist/(哈希资源拆分)
├── index.html               构建产物(勿手改,重新生成)
├── dist/                    构建产物(勿手改,`python build.py --dist` 生成;网页托管用)
├── server.js              ★ 本地静态服务器(:8765,gzip + ETag 304 + 路径防护 + 目录补 index.html)
├── check_syntax.js        ★ 构建自检(语法 + ASSETS key + 素材文件存在性)
├── PROJECT.md               本文件:工程现状、构建方式、踩过的坑
├── 中转站设计.md            中转站"养模型"玩法的设计草案(属性/公式/真实模型库/待商讨项),
│                            **中转站相关的数值与机制一律以这份文档为准**
├── recompress_assets.py   ★ 资产重压缩:compressed/* → compressed_webp/*.webp(PNG 与背景大图都走这里)
├── cut_chair.py             椅子专用:从 raw 高清原图裁剪 → compressed_webp/chair_hi.webp
├── process_assets.py        早期资产批量处理(仍在用的活脚本之一)
├── lib/pixi.min.js          PixiJS v7.4.0(构建时内联/拆出)
├── assets/
│   ├── raw/                 原始素材(来源,不参与构建)。⚠️ 已加进 .gitignore,但其中 16 个文件
│   │                        在早期被跟踪过、仍在版本库里(walk_video.mp4 等关键原始素材已入库)
│   ├── compressed/          第一代压缩(png/jpg)。**build.py 已不引用**;仍是 recompress_assets.py 的输入
│   └── compressed_webp/     ★ 第二代 WebP(build.py 引用的全部 18 张都在这里)
```

★ = 当前有效流水线 = 根目录只有这 6 个脚本是活的:
`build.py`、`server.js`、`check_syntax.js`、`recompress_assets.py`、`cut_chair.py`、`process_assets.py`。
其余 ~30 个一次性补丁脚本(`add_*` / `fix_*` / `rewrite_*` / `make_*` / 旧的 `process_*` 等)
已于 2026-09-10 清理,只在 git 历史里。**改游戏只改 `index_template.html`,然后跑 `python build.py`。**

## 常用命令

```bash
python build.py            # 单文件模式:一切 base64 内联 → index.html(本体/离线分发用)
python build.py --dist     # 网页托管模式:代码与哈希资源分离 → dist/(发布 VibeHub 用)
node check_syntax.js       # 构建自检:语法 + ASSETS key + 素材文件存在性(退出码非0即出错)
python recompress_assets.py # 素材重压缩(仅换图后需要,依赖 Pillow)
node server.js             # http://localhost:8765(根目录自动补 index.html,可直接预览 /dist/)
```

**两种构建模式(2026-09-10 新增,共用同一份 `index_template.html` 与 `ASSET_FILES`)**：

| | `python build.py` | `python build.py --dist` |
|---|---|---|
| 产物 | 单文件 `index.html` | `dist/index.html` + `dist/pixi.<hash>.js` + `dist/assets/<name>.<hash>.<ext>` |
| 素材形态 | base64 内联(同步可得) | 独立文件(真异步加载),HTML 里只有路径表 |
| 体积 | **1956KB**(整个文件) | 首访 **1597KB**;回访只需重下 75KB 的 index.html |
| 用途 | 塞进「本体」/离线直接双击打开 | 发布到网页托管(配合平台内容哈希长缓存) |
| 能否离线 | 能 | 不能(需要 http 服务) |

改游戏永远只改 `index_template.html`;发布前记得跑 `--dist`,本地看效果跑 `python server.js` 后开 `/dist/`。

## 素材流水线

- `build.py` 顶部 `ASSET_FILES` 字典是**资产唯一数据源**:新增素材加一行即可(旧版清单写两遍的坑已修)。
- 素材走 `recompress_assets.py` 转 WebP(PNG 按游戏内显示尺寸×2 出图,质量 85-88;大背景保持 1920 宽,质量 82-85)。
- 18 个内联素材**已全部是 WebP**(2026-09-10 完成背景迁移,不再有 JPG)。
- 修改 compressed/ 原图后必须重跑 recompress 才会影响构建。

## 当前进度(2026-09-10)

### 中转站行走动画(已完成)
- **人物精灵图**:6帧行走动画,从用户提供的绿幕视频提取中间6帧(第40/48/56/64/72/80帧),用户自行抠绿幕后提供最终精灵图(4320×1280)。
- **帧对齐处理**:原始视频中人物在向左走,每帧水平中心位置不一致(465→273),直接播放会抽搐。处理方式:每帧紧裁剪+统一画布(508×704→缩放158×220)+底部中心对齐。生成 walk_left.webp(948×220,76KB)和镜像 walk_right.webp。
- **休息静态贴图**:walk_idle.webp(用户提供的Q版角色站立图,压缩后23KB),休息时显示,行走时显示动画。休息贴图因有透明边距,额外×1.12补偿。
- **AI行走系统**:walkerAI 状态机(idle/walking),随机8方向+50%概率纯水平移动,碰边界反弹,水平方向自动切换左/右精灵图。行走3~6秒,休息2~4秒随机。速度1.2像素/帧。人物大小=屏幕高×32%。
- **行走边界**:minY=背景图高度×70%(底部最高位置,人物只在屏幕下方30%区域活动),maxY=背景图底部-人物高×12%。边界在 layoutRelayScene() 中用 rbgH*bgScale 计算(不能用 relayBg.height,纹理未加载时=1*bgScale 导致边界错误)。
- **容器架构**:walkerContainer 统一控制位置,内部包含 walker(AnimatedSprite,行走时显示)、walkerIdle(Sprite,休息时显示)、walkerLift(Sprite,拖拽/自由落体时显示)、walkerSit(Sprite,坐姿背影,用户提供的"背影7.png",压缩后31KB)。anchor 均为(0.5,1)底部中心。walkerSit 基础大小比行走人物大15%(坐姿背影更饱满)。
- **人物拖拽系统**:按住人物可拖拽,拖拽时显示 walkerLift 贴图(用户提供的"提干8.png",压缩后64KB),暂停AI行走。松开后开始自由落体(gravity=0.25,无墙壁碰撞/地面反弹),落到目标高度后恢复走路或锁定坐姿。拖拽事件绑定到 walkerContainer(eventMode='static'),四个子元素都能触发。
- **贴图切换统一走 `showWalker('idle'|'walk'|'lift'|'sit')`**(2026-09-10 重构):人物有 4 张贴图,可见性是排他的。原先每个状态分支各自手写 4 行 `xxx.visible = ...`,在 5 个地方重复,已踩过坑(拖拽时背影残留、落体时贴图不显示)。现在全部收敛到一个函数,新增贴图只需加一行,状态分支不再可能漏设。**新增状态/贴图时必须走 showWalker,不要在分支里手写 visible**——尤其拖拽分支会提前 `return`,依赖 updateWalkerAI 的写法必然漏。
- **椅子交互系统**:
  - 椅子描边图(chairOutline,用户自己PS裁剪的椅子轮廓,压缩后75KB):提起人物时显示,替换椅子原图,提示可坐区域;松开后恢复椅子原图。
  - 可坐区域:坐高=椅子底部往上40%(顶部往下60%,比一半低一点),宽度=椅子整个宽度。人物在坐高上方且x在椅子宽度内松开,则落到坐高后锁定坐姿。
  - 坐姿锁定(state='sitting'):人物对齐椅子中心,显示walkerSit背影,不再随机走动。按住可重新拖拽起身。
  - 电脑屏幕描边(screenGlow):人物坐下时,左边主屏幕显示草绿色描边(3px,#7cba3f)。位置经多次微调最终确定:背景图坐标系 x=42.1%, y=29.8%, w=17.4%, h=16.0%。图层在背景之上、人物/椅子之下,不遮挡。起身/拖拽时隐藏。
  - **呼吸动画+悬停常驻**:描边不是常亮,而是4秒周期呼吸(0.4s渐变出现→1.2s保持→0.4s渐变消失→2s等待)。鼠标悬停在描边矩形范围内时 alpha=1 常驻显示,且 timer 停止累积(避免移出时刚好撞上渐变阶段导致跳变被误以为卡顿);移出时用 lerp 平滑过渡(dt*8,约0.125s)恢复呼吸循环。通过 hitArea 设置整个矩形区域响应悬停,不只是边框线。
- **关键参数**:WALK_FRAME_W=158, WALK_FRAME_H=220, WALK_FRAMES=6, animationSpeed=0.25, walkerPhysics.gravity=0.25, chairSeat.sitY=chair底部往上40%。
- **相关代码**(2026-09-10 重构后行号,模板共 2191 行):makeWalkFrames() 第1243行、showWalker() 第1289行(贴图切换唯一入口)、updateWalkerAI() 第1342行(自由落体物理+坐姿锁定)、startWalkerDrag/updateWalkerDrag/endWalkerDrag 第1461行起、layoutRelayScene() 第1565行(椅子描边+屏幕描边绘制)。注:行号会随改动漂移,以函数名搜索为准。

### 性能优化(已完成并实测)
- **索引文件体积(2026-09-10 最新基线)**:`index.html` **1956KB(2003327 字节)**。构成 = PixiJS 445KB + 18 个素材 base64 约 1.36MB(素材原始共 1075KB,base64 膨胀 33%)+ HTML/CSS/JS 骨架约 86KB。
  - 演进:早期 1.56MB → 加行走/面板素材后 2.13MB → 背景迁 WebP 后 **1956KB**(省 222KB)。
  - ⚠️ **WebP 本身已压缩,gzip 对它基本无效**(gzip 主要压 PixiJS 和 base64 头部,整文件 gzip 后约 1398KB → 现在约 1.3MB 量级)。
  - **判断优化时用 1956KB 作基线,不要再引用 1.56MB / 2.13MB**。
- PNG→WebP(当前实测):`compressed_webp/` 19 个文件共 1075KB,`build.py` 全部内联;素材原始尺寸从 1.9MB 量级压到 1.0MB 量级(pc_case 816KB→44KB、fan 456KB→119KB、角色 150KB→28KB/22KB)。
- **背景大图 WebP 迁移(2026-09-10 已执行)**。`bg_dark/bg_light/placeholder/transfer_bg` 4 张 JPG 全部转为同尺寸(1920 宽)有损 WebP,实测 523KB → 352KB:

  | 素材 | JPG | WebP | 省 |
  |---|---|---|---|
  | transfer_bg | 196KB | 93KB | -103KB(51%) |
  | bg_light | 184KB | 141KB | -43KB(22%) |
  | bg_dark | 109KB | 82KB | -27KB(23%) |
  | placeholder | 33KB | 27KB | -6KB(14%) |

  - 单文件 `index.html`:2178KB → **1956KB**(省 222KB,含 base64 的 33% 放大效应)。dist 首访:1764KB → 1597KB。
  - **保留 1920 宽,没有回原生尺寸**。原因:`compressed/` 这几张是从 raw 放大来的(raw `bg_light`/`transfer_bg` 是 1672×941、`bg_dark` 是 1280×720),回原生尺寸能再多省 219KB,但 1672 宽的图在 1920/2560 屏上会被 `fitBg()` 放大 → **大屏清晰度下降**。
    (权衡依据:本轮刚决定全局提高渲染分辨率来改善清晰度,不能同时把背景底图降清晰度;这 219KB 相对 1956KB 只占 11%。若哪天在意流量,把 `recompress_assets.py` 的 `BACKGROUNDS` 尺寸改回原生即可。)
  - **不用无损 WebP**:实测无损后暴涨(`bg_light` 180→953KB、`transfer_bg` 191→842KB),因为源 JPG 已有损,无损会把压缩噪声也忠实存下来。q82-85 有损即可。
  - 背景迁移只省 11%,**优先级仍低于 dist/ 拆分**(后者把回访从 1956KB 降到 75KB)。
- **图片体积账**:base64 内联会给二进制加 33% 体积;若走 `dist/` 拆分方案,这部分膨胀直接消失。
- server.js:内存缓存 + gzip(level 8)+ If-None-Match/304 + Cache-Control + `path.normalize` 越界防护。
- 购买按钮改为脏标记重绘(原先每帧对最多 8 个 Graphics 执行 clear+重画,是最大每帧开销)。
- antialias 关闭;灯效层 `bgDark` 用 visible 切换代替 alpha=0(不参与渲染批次)。
- 浮字对象池(上限池 40 / 同时在屏 30),替代每次点击 new PIXI.Text。
- token 顶栏文字去重(setText 仅在变化时);resize/safeRelayout 用 rAF 节流。
- **中转站场景性能优化(2026-09-10)**:
  - 中转站时**不暂停生产逻辑**(token增加/自动点击/水冷触发/存档继续运行),切回生产时token已增加,不损失收益。
  - 中转站时**隐藏生产场景所有渲染元素**(layers.bg/clickArea/characters/scene/ui/fx 全部 visible=false),PixiJS 跳过这些对象的渲染批次,GPU开销大幅降低。
  - 中转站时**隐藏顶部tokens显示**(topbarBg/tokenLabel/tpsLabel),但保留设置按钮(全局)。
  - 中转站时**跳过生产场景专属更新**(灯效updateLight/角色动画updateCharacters/机箱物理updateCasePhysics/说话气泡/购买按钮updateAllBuyButtons),减少CPU开销。
  - 切回生产时**立即刷新一次购买面板**(updateAllBuyButtons),确保按钮状态(可购买/灰色/价格)与当前token同步,不需要等待下一帧。
  - **Web Worker 评估后不做**:当前游戏逻辑计算量极小(每帧<1ms),主要瓶颈是渲染而非CPU逻辑;Worker不能操作Canvas/PixiJS,重构成本高风险大,收益低甚至负收益(增加postMessage开销)。
- server.js:ETag 304 协商缓存生效;路径越界返回 403。

### 中转站(2026-09-10 二次推进:玩法设计定型为"养模型" + UI 占位)
- **玩法方向(用户拍板)**:中转站是一个**养人物 → 人物扮演 AI 模型上架赚调用费 → 用赚到的钱继续训练**的经营循环。
  设计草案、全部公式与数值、真实模型锚点数据、待商讨项,**统一记录在 `中转站设计.md`**(514 行,单一事实来源)。
  ⚠️ **玩法逻辑尚未实现**;当前只做了 UI 占位和一套可运行的派生量/匹配算法。
- **设计决定(早前用户拍板,仍有效)**:排行榜/社交系统不做;数据包货币/暂存/转运/4 项升级的第一版玩法**已实现过但按用户要求撤空**。
- **底部标签栏改版**:`TABS = [生产 / 中转站 / 调教]` 三个标签**均匀分布**(`layoutNavTabs` 按可见标签数平分屏幕宽度)。
  - 「调教」= **全新场景的占位**(`tuneScene`:全屏深色底 + 标题「调教」+「训练系统 · 施工中」+ 指向 `中转站设计.md`)。
    训练板块的玩法后续单独设计,预留位置见设计文档 11.1。
  - 中转站标签仍受 `updateRelayTabVisibility()` 控制(购买服务器后解锁);标签隐藏时会顺带关闭中转站并重置 `navScene`。
  - `switchScene(name)` 统一处理三个场景的互斥开关;生产场景的显隐抽成 `setProductionLayersVisible(v)` 供三处复用。
- **行走动画**详见上方"中转站行走动画"章节;相关入口 `relayScene`/`openRelayScene`/`closeRelayScene`、`layoutRelayScene`、`updateWalkerAI`、`makeWalkFrames`。
- **代码里已落地的算法最小集**(在 `// ========== 中转站模型养成(设计草案) ==========` 注释块内,改数值只改这里):
  - `ATTR_KEYS` / `ATTR_NAMES` — 9 项基础属性(推理/知识/长上下文/速度/多模态/指令遵循/工具调用/拟合/参数)。
  - `REAL_MODELS` — 20 条真实模型锚点(能力/上下文/知识截止/多模态档/工具调用/官方价),来源见设计文档 3.2。
  - `ctxK()` / `tokPerSec()` / `cutoffMonths()` / `modelCapability(a)` — 四组派生量公式(与属性值互逆)。
  - `modelToAttrs(m)` / `modelCapabilityOf(m)` — 真实模型 → 等效属性(用于雷达图叠影与距离计算)。
  - `closestModel(a)` — 7 维加权距离 + 2 个硬门槛(知识截止、模态档位),返回"最接近的真实模型"与相似度。
- **`state.relay`(存档 v1 已含)**:`{ ability: { 9 项属性 }, listedModel: null, price: 0, pool: 'standard', reputation: 50 }`。
  `saveGame`/`loadGame` 已接上;载入后调 `refreshRelayPanel()` 重绘面板。
  ⚠️ 老存档没有 `relay.ability` 字段时靠 `Object.assign` 合并补默认值,不要改成整体替换。
- **面板左栏改为可点击标签**(模型 / 社区 / 后台),替换原先的三组纯占位菜单;`panelTab` 决定 `drawModelPage`/`drawCommunityPage`/`drawBackendPage`。
  内容全部画进 `panelContentArea`,用**绝对屏幕坐标**(该容器自身位移为 0)。
  - **模型页(已实现)**:最接近的真实模型名 + 相似度 + 综合评分块(评分/速度/上下文)+ **9 轴雷达图**。
  - 社区页 / 后台页:**静态文字占位**,机制设计见设计文档 7、8 节,尚未接逻辑。
- **雷达图 9 轴的坑**:9 项属性里**「拟合」「参数」不是"越高越好"**,直接画会让玩家读反。
  处理方式:拟合轴上额外画一条**绿色最优点刻度**(`CAP_FIT_OPT=70`,配文字"最优 70"),参数照常画;两者排在最末两条轴。
  轴标签按 `anchor 0/1` 贴圆外缘对齐,否则 9 轴下标签会互相压字或压到左下评分块。
  真实模型没有拟合/参数(内部量),`modelToAttrs` 给锚点值,**且这两个键不在 `SIM_W` 里**,所以只影响画图、不影响相似度判定。
- **榜单决策(2026-09-11)**:面板**维持现状**(只显示「最接近的模型」,不做名次 UI)。完整榜单 + 档位分类落在 `中转站设计.md` §3.4;
  用户规划以后加「模型列表」板块(可搜索、显示大致属性),落档在 §3.5。注意 §3.5 记的坑:§3.1 的设计属性值 vs `modelToAttrs` 的硬推值差很多,
  要搬数据前先看那节。
- **左栏宽度改为 `min(200, 屏宽*0.24)`**:竖屏手机上固定 200px 会把内容区挤得没有空间。
- 撤掉的旧玩法可参考 git 历史里的 diff;`state.relay` 早期是空对象占位。

### 电脑屏幕面板系统(2026-09-10)
- **触发**:人物坐下后,电脑屏幕显示草绿色描边(呼吸动画:4s周期,0.4s出现+1.2s保持+0.4s消失+2s等待;悬停时常驻显示,timer暂停,移出时lerp平滑过渡)。点击描边及内部区域打开面板。
- **面板结构**:背景遮罩(alpha=0.72半透明深色,点击关闭,但电脑屏幕区域不关闭)+ 面板主体(米白色#f5f0e8,占屏幕88%×85%,圆角14px)+ 顶部栏(浅米色48px,**大肥鱼站logo**+搜索框占位)+ 左侧栏(浅米色,宽 `min(200, 屏宽*0.24)`,**3 个可点击标签:模型/社区/后台**,选中项暖橙高亮)+ 中间内容区(按标签渲染,见「中转站」章节)。参考 Liminality 面板设计,简约暖色调,不用黑色。
- **面板左上角logo**:大肥鱼站(透明背景PNG,浅蓝色卡通字体+鲸鱼,白色描边)。压缩为WebP(177×48,4.7KB,保留透明通道,质量85),内嵌到单文件HTML。位置:左边距14px,垂直居中,高度=顶部栏高度(48px)。透明背景和顶部栏浅米色自然融合,无需圆角蒙版/模糊滤镜。资产key:`panel_logo`,文件:`assets/compressed_webp/panel_logo.webp`。
- **面板关闭逻辑**:点击面板**外**的遮罩关闭;点击面板**内部**不关闭。实现靠 `panelBody.eventMode = 'static'`——
  Pixi 的命中测试会跳过「`eventMode='auto'` 且没有任何监听器」的对象(auto 的语义是「有监听器才参与交互」),
  所以 panelBody 一旦留默认值,点面板内部时命中目标会直接落到下层遮罩,遮罩一触发就把面板关了(表现为「点面板里面也返回」)。
  设成 `static` 后 panelBody 自己成为命中目标,而遮罩是它的**兄弟节点、不在事件父链上**,面板范围内永远不会命中遮罩。
  另外给 panelBody 设了显式 `hitArea`(随 `layoutScreenPanel()` 更新),比依赖 Graphics 填充几何做命中判定更可靠。
  ⚠️ **`screenPanel` 的子节点里,凡是挡住遮罩的都必须自己 eventMode='static'**,否则点击会穿透到遮罩触发关闭。
- **模型页「数据详情」按钮**:模型页右上角胶囊按钮(纸页图标 + "数据详情"),点开在 `attrDetailLayer` 上画
  **全屏遮罩 + 说明卡片**,列出 9 项属性各自对应什么(`ATTR_DESC`)。遮罩铺满整屏(盖住顶栏与左侧栏——
  该层挂在 `screenPanel` 的**最后一个子节点**才盖得住),点遮罩关闭;卡片自身 `eventMode='static'` + `hitArea`,点卡片内不关。
  切标签页 / 关面板时重置 `showAttrDetail=false`。全屏遮罩同样属于「挡住遮罩的节点」,所以卡片必须自己 `static`。
- **遮罩的屏幕区域豁免**:`panelMask` 里保留了「点击落在电脑屏幕矩形内则不关闭」的判断,作为兜底
  (面板占屏 88%×85%,极端宽高比下电脑屏幕可能露在面板之外)。主防线是上面的 panelBody。
  (历史:该判断原先是为了绕开「命中目标落在遮罩上」的问题;根因修复后它退化为兜底,代码保留。)
- **层级设计**:`layers.panel` 独立层,用 `addChildAt(layers.panel, getChildIndex(layers.topbar))` 插到 relayScene 之上、topbar 之下。最终层级:bg→...→ui→relayScene→**panel**→topbar→fx→settings→nav。面板盖住中转站场景,但设置按钮(topbar)和底部场景切换标签(nav)保持在面板之上可见可点。
- **关键坑**:面板最初放在 `layers.settings` 层,但设置面板关闭时执行 `layers.settings.visible=false`,导致整个层被隐藏,面板 visible=true 也看不到。**父容器 visible=false 会隐藏所有子元素,即使子元素 visible=true**。解决方案:独立 panel 层,不受设置面板开关影响。
- **场景切换**:切回生产(closeRelayScene)时自动调用 closeScreenPanel(),面板只在中转站存在。
- **防重复打开**:openScreenPanel 开头 `if (screenPanelOpen) return`;打开时 `screenGlowHit.eventMode='none'` 禁用屏幕点击,关闭时恢复 'static'。
- **透明点击区域**:screenGlowHit 独立 Graphics(alpha=0.001填充+hitArea双保险),覆盖整个屏幕矩形(描边+内部),比 Graphics 只画边框时的 hitArea 更可靠。移到 relayScene 最上层避免被 walkerContainer/chairSprite 遮挡。

### 其他本轮改动
- **新增 `--dist` 构建模式**(见上方「常用命令」表):代码与内容哈希资源分离,首访 1597KB / 回访 76KB。
- **移动端清晰度(方案 A)**:`RENDER_RESOLUTION = Math.min(devicePixelRatio || 1, 2)` 单一常量 +
  `autoDensity: true`;canvas 加 `touch-action: none`(详见「移动端适配」节)。
- **背景大图迁 WebP**:`bg_dark/bg_light/placeholder/transfer_bg` 4 张 JPG → 同尺寸有损 WebP,省 222KB(详见「性能优化」节)。
- 服务器改为**一次性购买**(固定价格10000,买完即止,oneTime=true)。
- 脚本商品显示名从"自动点击"改回 **"niger"**(用户要求);存档字段仍为 autoClick,兼容旧 niger 字段:`loadGame` 里 `data.autoClick || data.niger`。
- **A100 购买限制**:每购买3台RTX3080才能购买1台A100(锁定条件:`a100.count >= floor(rtx3080.count / 3)`)。未解锁时价格位置显示进度提示(如"需3台3080(1/3)"),按钮灰色不可点击。通过 createBuyItem 新增的 `lockedFn`(锁定条件)和 `lockHintFn`(锁定提示)两个可选参数实现,后续其他物品可复用。
- **设置按钮全局显示**:relayScene 用 `addChildAt(relayScene, getChildIndex(layers.topbar))` 插入到 topbar 层之下,确保设置按钮/顶部栏在所有场景之上始终可见。**关键:Container 的渲染层级由子元素顺序决定,后添加的在上面;场景容器必须插在全局UI层之下,否则会遮挡设置按钮等全局元素。**后续新增场景也必须插在 topbar 之下。
- **设置面板移除重置存档按钮**(2026-09-10):避免用户误触。resetGame() 函数保留,后续首页会有存档/加载/重置等功能。设置面板目前只有音乐/音效滑条(暂无音频消费方,占位)。
- **风扇倍率上调**:心静自然凉从 ×1.1^数量 上调为 ×1.25^数量。
- **水冷改为一次性购买**:固定价格3000,买完即止(原可重复购买但效果不叠加,纯浪费)。

## 存档格式(localStorage key `dshgame_save_v1`)

```json
{ "tokens":0, "rtx3080":0, "a100":0, "extraRack":0, "server":0,
  "fan":0, "waterCooling":0, "autoClick":false, "miracle":false, "savedAt":0 }
```

- 30 秒自动存档;购买时立即存;重置功能暂从设置面板移除(避免误触),后续首页实现。
- 向后兼容字段:`niger`(=autoClick 旧名)。
- **加字段时**:`saveGame`/`loadGame`/`resetGame` 三处同步,数值用 `data.x || 0` 兜底。

## 游戏机制速查

- 点击:基础 1/次;风扇 ×1.25^数量(2026-09-10 从1.1上调);暴击率 0.5%+0.5%/A100,倍率 1.5+1%/机柜。
- 产出:RTX3080 5/s + A100 50/s;每整秒入账。
- 价格:3080=50×1.5^n、风扇=80×1.5^n、A100=2000×1.5^n、机柜=5000×2^n、服务器=10000(一次性)、水冷=3000(一次性,2026-09-10 从可重复购买改为一次性)、niger(自动点击) 800(一次性)、奇迹算法 1500(一次性:机箱砸地 25% 得 tokens×3%)。
- 水冷:每 10-120s 骰一次,19% 得 tokens×20%。
- 机箱:可拖拽抛掷,重力/反弹/墙碰撞;≥9 张 3080 换升级贴图。
- 中转站标签:server>0 时显示。中转站时生产逻辑继续运行(token不暂停),但生产场景渲染元素隐藏以提升性能。

## 代码导航(index_template.html 内的分节注释)

`工具函数` → `补间动画` → `PIXI 初始化` → `层级容器`(bg/clickArea/characters/scene/ui/topbar/fx/settings/nav) → `背景层(灯效)` → `点击增量层` → `角色层` → `场景层(机箱物理)` → `购买面板`(三标签:机器/散热/脚本) → `生产标签/中转站标签+switchScene` → `中转站场景` → `顶部信息栏` → `设置` → `游戏状态` → `本地存档` → `统一布局` → `主循环` → `启动(多重布局保险)`

## 已知事项 / 注意

- 浏览器自动化点击 canvas 测试时:**设置面板开着会挡住底部标签**(遮罩全屏),先关面板再点。cua 坐标=CSS 像素(本机 dpr=1),中转站标签中心 ≈ `(0.62×宽, 高-36)`,生产 ≈ `(0.38×宽, 高-36)`。
- 设置面板的音乐/音效滑条目前是摆设(无音频消费方),接入音频前别让玩家误会。
- 手机竖屏会显示"请横屏游玩"遮罩(`#rotatePrompt`,触屏+竖屏才触发)。
- 启动时序:base64 纹理异步解码,靠 7 个 `texture.on('update')`(bgLight/bgDark/charClosed/charOpen/pcCase/**relayBg/chairSprite**) + 前 60 帧 `layoutFixTicker` 兜底重排,不要删。**新增纹理必须加 update 监听**,否则 layoutRelayScene 等函数会在纹理未就绪时计算,除以0导致 NaN 边界(已踩过坑:中转站行走边界完全失效)。
  - `dist/` 模式下纹理是真·异步 URL 加载(时序比 base64 更晚),**已实测这套兜底仍然够用**(2026-09-10 真实浏览器验证 18 个素材全部就绪、纹理尺寸正确、布局一致)。但以后若新增依赖纹理尺寸的布局,dist 模式要再验一次。
- layoutRelayScene 中有纹理未加载时的默认尺寸保护(rbgW=1672,rbgH=941),避免除以0。新增依赖纹理尺寸的布局函数时建议同样保护。
- **构建自检用 `check_syntax.js`**(旧名 `_check_syntax.js` 已废弃——以 `_` 开头会被 `.gitignore` 的 `_*.js` 规则吃掉)。检查三件事:① 每个 `<script>` 块单独过语法;② 校验 `ASSETS.xxx` 引用的 key 都在 `build.py` 的 `ASSET_FILES` 中有定义(key 拼错时 `PIXI.Sprite.from(undefined)` 静默拿到空纹理、不报错,肉眼也看不出);③ `build.py` 登记的文件在磁盘上真的存在。改完模板/素材跑一次,退出码非 0 即有错。已实测能抓到"拼错 asset key"和"语法错"两类故障。
  ⚠️ **不要再把这个文件名写进 `.gitignore`**。2026-09-10 曾这么干过一次,结果它既进不了版本库、又被随后的清理脚本一起删掉,构建自检整个消失(见坑36)。

## 后续待办(用户规划)

1. **中转站玩法设计**(用户亲自安排——等需求,勿抢先实现)
2. 设置面板音频接入(音乐/音效滑条已就位;若不做音频,应把滑条隐藏,别挂着当摆设)
3. ~~发布 VibeHub 前的适配~~ **已完成**:体积/缓存模型已落地(`--dist` 模式)、移动端适配已做(方案 A + `touch-action:none`)。
   剩下真正发布时的动作见「发布前检查清单」(字体子集化可选、封面截图待备)。
4. 离线收益(存档已有 savedAt,用户说放到后面考虑)

## VibeHub 发布(目标平台调研,2026-09-10)

> **来源**:`https://vibe.lumigrav.space/llms.txt`(平台总览)+ `/api/skill`(CLI Skill)。
> ⚠️ 平台自己规定:**每次任务必须先重新拉取** `/api/skill`,不得凭记忆或旧副本操作。
> 本节只是"为了做开发决策而需要提前知道的事",**不是发布流程本身**;真发布时以当场拉取的 Skill 为准。
> 实际发布用官方 CLI(`deploy` / `update`),**不要手写 HTTP 调 API、不要自己实现上传**。

### 与本地开发直接相关的硬约束

- **必须用 `window.VibeHub`**,禁止自建后端/数据库/WebSocket。我们是纯前端 + localStorage,没有后端,
  这点天然合规(但**不要**把 `server.js` 部署上去,它只是本地开发用的静态服务器)。
- **缓存模型(这条最关键,直接影响构建方式)**:
  - **HTML 和普通资源:60 秒缓存。**
  - **文件名带十六进制内容哈希的资源:1 年 immutable。**
  - 平台明说:「大资源用内容哈希命名以长期缓存,**HTML 保持稳定文件名**」。
  - 👉 "单文件 `index.html` 内联一切"在这个模型下是**最差解**(HTML 只有 60 秒缓存,老玩家每次回来都要重下近 2MB)。
    已用 `build.py --dist` 解决,详见「构建产物形态」一节。
- **部署目录**:静态根目录**顶层必须有 `index.html`**。要排除源码、`node_modules`、`.git`、zip 压缩包。
  → 我们不能直接部署项目根目录(里面有 `.git`、`assets/raw` 28.9MB、`index_template.html`、`*.py`),
  **必须产出独立的 `dist/`**。
- **封面/截图**:必须放在部署目录**内部**,以相对部署目录的路径传给 CLI;平台会自动转 WebP 并复制到独立的 `media/*`。
  上限:**截图最多 6 张,标签最多 20 个**。
- **描述/更新说明**:写到 UTF-8 文件里传给 CLI。描述含玩法说明,**上限 2000 字符**。
  若 CLI 报 UTF-8 非法或连续问号,**要修编码源头,禁止用 `--allow-suspicious-text` 绕过**(我们的文档都是 UTF-8,正常)。
- **分类/标签只能从 `metadata` 返回的既有 ID 里挑**,不许自己编。
- **slug**:只用小写字母/数字/连字符;冲突会报错,要另提一个候选,不能接受静默改名。
- **SDK 通道**:默认用 `/sdk/v3/*` 稳定版;Beta 需用户明确要求才用,**禁止混用通道**。
- **非拉丁文字(中文)必须自带字体**,不能依赖宿主字体(原文这句在 Godot 语境下,但 Web 端同理存在风险,见移动端一节)。
- 平台托管 WebGL/WebGL2/WASM;浏览器不支持时会退化。多线程 WASM 需平台托管(我们不涉及)。
- 首次发布前,CLI 要求**一次性问用户两个独立问题**:①是否开启共创 ②首次发布成功后是否配置 GitHub 自动部署。
  **这两个不能替用户决定**,也不能代用户接受共创协议。
- 官方 CLI 还提供素材生成(BGM/音效/图片/配音),用 `generate quota` 查额度。我们目前无音频,可后续考虑。

### 构建产物形态:单文件 vs 拆分(⚠️ 结论与之前的判断相反)

之前文档写"不要拆单文件"——那个结论是**为本地/离线分发(塞进「本体」)服务的**,在那种场景下成立。
**但面向 VibeHub 网页托管时结论相反**:平台对 HTML 只给 60 秒缓存,对内容哈希命名的资源给 1 年强缓存。
把一切内联进 `index.html` 等于让近 2MB 每次访问都重新下载。

**已实现(2026-09-10)**:`build.py --dist`,两种模式共存,共用同一份模板与 `ASSET_FILES`。

实测对比(基于当前 18 个素材 = WebP 共 1075KB):

| 方案 | 首访 | 回访(60 秒后) |
|---|---|---|
| 单文件 `index.html`(`python build.py`) | 1956KB | **1956KB** |
| 拆分(`python build.py --dist`):`index.html` 76KB + `pixi.<hash>.js` 446KB + `assets/` 1075KB | 1597KB | **76KB** |

拆分还顺带省掉 base64 的 33% 膨胀(1075KB 素材,base64 后是 1433KB;单文件整个 1956KB,拆分首访只有 1597KB)。

- `dist/index.html` 里 `ASSETS` 从 base64 常量换成路径表,`__PIXIES__` 占位替换成 `<script src="pixi.<hash>.js">`。
- **异步加载已单独验证过**:在真实浏览器(Playwright)里实测 dist 版,18 个素材全部加载成功、
  纹理尺寸正确(`bgLight 1920x1081`、`bgDark 1920x1080`、`transfer 1920x1080`)、`bgScaleCover=true`、
  百分比布局与单文件版一致、无控件碰撞。所以「已知事项」里那条 NaN 兜底在拆分下仍然够用。
- `server.js` 已支持目录请求补 `index.html`,本地 `python server.js` 后直接访问 `/dist/` 即可预览构建产物。
- ⚠️ dist 产物不能离线双击打开(需要 http 服务);要塞「本体」仍用单文件模式。

### 移动端适配(2026-09-10 已按方案 A 实现)

**改之前的现状**:`PIXI.Application` 没传 `resolution`,即**默认 1**;只有 `makeText()` 里给每个 Text 设了 `t.resolution = 2`
(所以文字清晰、贴图糊)。`antialias: false`(对纯 sprite 是正确的,别改)。

**问题**:手机 dpr 普遍 2~3。canvas 后备缓冲 = CSS 尺寸 × 1,再由浏览器放大 → 全屏贴图发虚。
文字因为有 `resolution=2` 单独补偿,反而比贴图清楚。

**三种做法与优劣**:

| 方案 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **A. 全局提高分辨率(已采用)** | `resolution: Math.min(dpr, 2)` + `autoDensity: true` | 一行改动,全屏贴图立刻变清晰;`app.screen` 仍是 CSS 像素,**现有百分比布局全部不受影响** | 填充率按分辨率²增长,dpr=2 时是 4 倍像素。低端安卓可能掉帧 |
| B. 自适应降级 | 启动用 A,测前 2~3 秒 FPS,低于阈值自动降到 1 | 高端机清晰、低端机不卡,兼顾 | 多约 20 行代码;切换瞬间可能有一次重排/闪动 |
| C. 折中固定值 | `resolution: Math.min(dpr, 1.5)` | 清晰度与性能的中间点,比 A 稳 | 仍非整数倍,dpr=3 的设备上会有轻微非整数缩放;治标不治本 |

**用户拍板用 A**(理由:放置游戏本身不吃性能)。实现要点:
- 新增单一常量 `const RENDER_RESOLUTION = Math.min(window.devicePixelRatio || 1, 2);`
  `PIXI.Application` 传 `autoDensity: true, resolution: RENDER_RESOLUTION`;`makeText()` 里也用它
  (原先硬编码的 `t.resolution = 2` 已改为引用同一常量,避免两处各写一份而不同步)。
  **以后要调分辨率只改这一个常量。**
- 上限 2 是性能与清晰度的折中(dpr=3 的手机也用 2,填充率不再翻倍)。
- **实测验证**(注入 `devicePixelRatio=2` 后真实浏览器):canvas 后备缓冲 `1280×720`,CSS 尺寸 `640×360`
  —— 正是 `autoDensity` 的正确行为,说明 `app.screen` 仍是 CSS 像素、百分比布局不受影响。
- `antialias: false` 保持不动。

**同时补上的**:
- **`canvas { touch-action: none; }`**。原先 CSS 只有 `user-select:none`,拖拽人物/机箱时移动端浏览器会把
  手势抢去做滚动/下拉刷新。现已加(成本一行,收益明确)。
- 竖屏遮罩(`#rotatePrompt`)已有,触发条件是"触屏 + 竖屏",逻辑未动。
- `viewport` 已设 `maximum-scale=1.0, user-scalable=no`,iOS 上能防双指缩放,保留。
- **中文文字依赖系统字体**(`"PingFang SC" / "Microsoft YaHei"`):Windows/macOS/iOS 没问题,
  但部分安卓和 Linux 没有这些字体,会回退到别的字体 → **字形宽度变化 → 按像素调过的布局会错位**
  (面板左栏、按钮文字位置等)。VibeHub 也要求非拉丁文字自带字体。
  实测:把模板里用到的字符(631 个不同字符,其中 532 个汉字)子集化成 **WOFF2 约 198KB**
  (源字体微软雅黑 19MB)。**可做可不做**:若只面向桌面/主流手机浏览器,风险低;若想稳,就子集化内嵌。

### 发布前检查清单(真正发布时逐条过)

1. 重新拉取 `/api/skill` 并按其步骤安装/更新官方 CLI(不是用本文档的记忆)。
2. `python build.py`(或 `--dist`)产出干净目录,确认顶层有 `index.html`,且不含源码/`.git`/raw 素材。
3. 准备封面 + 截图(≤6 张)放进部署目录内部;准备好 UTF-8 的描述文件(≤2000 字符)与更新说明文件。
4. `vibehub whoami` 已登录则复用,不要重复 `login`。
5. `vibehub metadata` 取真实 category/tag ID,不要自己造。
6. 首次发布前**分两次独立询问**用户:是否开启共创、是否配置 GitHub 自动部署。不得代答、不得代接受协议。
7. 首次发布用 `deploy`(带 `--name/--slug/--dir/--description-file/--note-file/--category-id/--tag-ids/--cover/--screenshots`);
   后续更新用 `update` + `vibehub list` 里的**精确 slug**(禁止用作品 ID/模糊名/标题猜)。
8. 发布成功后回传 CLI 输出的作品链接。


## 仓库状态与提交(2026-09-10)

### 已完成(按时间顺序)
- `5d9bfc7`:新版大肥鱼站 logo + 面板关闭逻辑优化 + 清理临时脚本(**本次失误见下节**)。
- `dc2a079`:修复 `5d9bfc7` 误删的三个活脚本(`recompress_assets.py`/`cut_chair.py`/`process_assets.py`),
  重建 `check_syntax.js`,并从 `.gitignore` 移除误加的那行。
- `418e33a`:清理 3 个真死素材(`compressed/chair.png`、`compressed/relay_bg.jpg`、`compressed_webp/chair.webp`);
  修 `process_assets.py` 写死的绝对路径与 ffmpeg 路径。
- `c8a2275`:补 VibeHub 发布调研 + 背景 WebP 迁移实测数据进文档。
- **本轮(未提交)**:`build.py --dist` 双模式、`index_template.html` 方案 A 分辨率 + `touch-action:none`、
  `recompress_assets.py` 增加背景 WebP、`server.js` 目录补 `index.html`、4 张新背景 WebP、文档更新。

### ⚠️ 这次清理出过一次事故(已修复,详见坑36)——以后做同类清理务必先读这节
提交 `5d9bfc7` 声称"清理一次性临时脚本、仅保留 build.py",实际误删了流水线里的**三个活脚本**
(`recompress_assets.py` / `cut_chair.py` / `process_assets.py`),并把 `check_syntax.js` 写进
`.gitignore` 后连文件一起删掉。**复核时发现,已从 `git checkout 5d9bfc7~1 --` 恢复三个脚本、
重建自检工具、并从 `.gitignore` 移除那行。** 三个脚本能救回来是因为它们在 HEAD~1 里被跟踪过。

**教训固化进流程**:
1. 清理前先建立"保留清单",再对剩余项删,不要反过来凭印象删。保留清单就是上面 ★ 那 6 个。
2. `.gitignore` 不是清理工具。要删就删,不要用"忽略"把文件藏起来——藏起来的文件照样占磁盘、照样会被误删。
3. 任何清理动作之后,必须跑一遍 `python build.py && node check_syntax.js`。这次只要跑一次就会立刻发现工具没了。

### 死素材判定(2026-09-10 已核实并清理)
**判定"死素材"不能只看 build.py 有没有引用**——`assets/compressed/` 里大部分 PNG 不是给 build 直接用的,
而是 `recompress_assets.py` 的**输入**(它是生成 `compressed_webp/` 的源头)。按引用来源分三类:

| 文件 | 谁在用 | 能否删 |
|---|---|---|
| `compressed/bg_dark.jpg` `bg_light.jpg` `placeholder.jpg` `transfer_bg.jpg` | `recompress_assets.py` 的 `BACKGROUNDS` 输入(生成对应 webp 的源) | ❌ |
| `compressed/char1.png` `char2.png` `fan.png` `pc_case.png` `pc_case_upgraded.png` `speech_bubble.png` | `recompress_assets.py` 的输入(删了就无法重新生成对应 webp) | ❌ |
| `compressed/chair.png` `relay_bg.jpg` | 无人引用(已被 `raw/chair.png`→`chair_hi.webp`、`transfer_bg` 取代) | ✅ 已删 |
| `compressed_webp/chair.webp` | 无人引用(被 `chair_hi.webp` 取代) | ✅ 已删 |

已删 3 个文件,删前跑过自检、删后重跑 `build.py` + `check_syntax.js` 均通过。若日后误删,
`git checkout <commit>~1 -- <file>` 可恢复。

### 已知遗留(不打算处理)
- `assets/raw/` 的 28.9MB 中 16 个文件已进 git;`walk_video.mp4`(1.15MB)与 `walk_frame_*.png` 是
  行走动画的**唯一原始来源**,本机没有第二份副本(用户备份目录里只有 `walk_spritesheet.png`)。
  若要瘦身请先自行备份,不要直接删。
- 删除已跟踪文件涉及历史重写,风险大于收益,**不要做 `git filter-branch`**。
- `process_assets.py` 依赖外部 ffmpeg(可用环境变量 `FFMPEG` 覆盖路径)。路径推导已改为从脚本位置出发,
  不再写死绝对路径;但这条流水线整体是"从 raw 重建 compressed"的一次性上游,平时不用跑。

### 不要做
- **不要**改 `index.html` / `dist/` 里的任何东西(都是构建产物,由 `build.py` 生成)。
- **不要**把 `index_template.html` 拆成 ES 模块。它是构建的**唯一源码**,单文件形态是「本体」离线分发的前提;
  `--dist` 只是在**构建输出**层面拆资源,不改源码结构。真要拆源码就得上打包器,成本和风险远超收益。
- **不要**实现中转站玩法(用户明确要亲自安排)。
- **不要**删 ★ 那 6 个活脚本,也不要再把它们写进 `.gitignore`。
- **不要**把背景 `BACKGROUNDS` 改回原生尺寸(1672 宽)来省那 219KB —— 会让大屏清晰度下降,和本轮提分辨率的决定相矛盾。

