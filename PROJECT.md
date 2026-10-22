# DSH · 地下机房

PixiJS v7.4.0 放置点击类网页游戏:点击赚取 token → 购买 GPU/散热/脚本升级 → 机箱可拖拽抛掷(带物理反弹)。两种构建产物:**单文件 `index.html`**(可离线直接打开,塞「本体」用)与 **`dist/`**(`python build.py --dist`,代码与哈希资源分离,发布 VibeHub 用;需 http 服务)。两者共用同一份 `index_template.html`。

## 项目结构

```
DSHgame/
├── index_template.html    ★ 游戏源码(全部游戏逻辑,2026-10-22 实测 9184 行 / 459KB,含少量 CSS/HTML)
├── build.py               ★ 构建脚本:默认单文件 base64 内联 → index.html;`--dist` → dist/(哈希资源拆分)
├── index.html               构建产物(勿手改,重新生成)
├── dist/                    构建产物(勿手改,`python build.py --dist` 生成;网页托管用)
├── server.js              ★ 本地静态服务器(:8765,gzip + ETag 304 + 路径防护 + 目录补 index.html)
├── check_syntax.js        ★ 构建自检(语法 + ASSETS key + 素材文件存在性)
├── check_all.py           ★ 一条龙自检:构建 → 语法 → 305 项断言 → 30 天仿真 → dist(失败即停)
├── make_sfx.py            ★ 四个操作音效的程序化合成器(点击/购买/挥鞭/消除;改音色重跑)
├── PROJECT.md               本文件:工程现状、构建方式、踩过的坑
├── 中转站设计.md            中转站"养模型"玩法的设计草案(属性/公式/真实模型库/待商讨项),
│                            **中转站相关的数值与机制一律以这份文档为准**
├── 社区日报池.md            社区日报文案草稿池(用户改这里;定稿后再进代码 NEWS_POOL)
├── 考试文案池.md            考试内心戏/提示卡文案池(用户改这里;跑 `sync_exam_text.py` 进代码,§17.8)
├── server.py                本地服务 + POST /api/save-overrides(编辑器「保存到文档」)
├── recompress_assets.py   ★ 资产重压缩:compressed/* → compressed_webp/*.webp(PNG 与背景大图都走这里)
├── cut_chair.py             椅子专用:从 raw 高清原图裁剪 → compressed_webp/chair_hi.webp
├── process_assets.py        早期资产批量处理(仍在用的活脚本之一)
├── make_font_subset.py    ★ 兜底字体子集:从 Noto Sans SC 按模板用字出 woff2(改文案后必须重跑)
├── sync_exam_text.py      ★ 考试文案池扫描器:《考试文案池.md》池A–O内心戏+池P提示卡 → 写进模板(勿手改生成区)
├── lib/pixi.min.js          PixiJS v7.4.0(构建时内联/拆出)
├── assets/
│   ├── raw/                 原始素材(来源,不参与构建)。⚠️ 已加进 .gitignore,但其中 16 个文件
│   │                        在早期被跟踪过、仍在版本库里(walk_video.mp4 等关键原始素材已入库)
│   ├── compressed/          第一代压缩(png/jpg)。**build.py 已不引用**;仍是 recompress_assets.py 的输入
│   ├── compressed_webp/     ★ 第二代 WebP:`build.py` 的 `ASSET_FILES` 引用其中 **26 张**(全部内联)
│   │                        (历史遗留的未引用 `tune_desk_girl.webp` 已于 2026-10-18 深夜清理)
│   └── audio/               ★ 三首 BGM(AAC 64k `.m4a`,~2.9M)+ 四个操作音效(`sfx_*.wav`,~43KB)—— **只外链、绝不内联**(见「两种构建模式」)
├── sim/                   ★ 仿真/标定脚手架(不参与构建;改数值前先在这里算,别靠手感)
│   ├── startup_loop.js      起步期 30 天经济诊断(日表 + 汇总 + ⚖平账校验);
│   │                        `module.exports = { makeSim, CODE, INIT }`,只在 `require.main===module` 时跑仿真 → 供其他测试复用沙箱
│   ├── window_check.py      ★ 四窗口复核器:并行跑 D30/D60/D90/D180,打印「诚实÷跑分」表(改中转站数值前后各跑一次)
│   ├── p2_scan.py           ★ P2 随机机制扫描器:变体 × 窗口 × **≥3 种子取均值±sd**(单种
│   │                        子对照结论无效,见备料 §7.4)
│   ├── long_window_report.js  四窗口汇总:把 D30/D60/D90/D180 输出目录并成「诚实÷跑分」对照表
│   ├── subsidy_scan.py      ★ 补贴定价扫描器:PR_SUBSIDY_RATE 三档 × 窗口 × 3 种子(§8.2;别设 P2_EVENT_*——模板已原生落码,会双重生效)
│   ├── verify_gouge.js      层5「虚标成交折价」断言 20 项(秒级,不跑仿真)
│   ├── verify_users.js      base/cap 两条人数约束断言 42 项(含 §17.7 userBoost 逐位回退锚;秒级)
│   ├── verify_price_legs.js  断言 191 项:[8b]保价/[10]P2 22/[11]热点/[12]考试/[13]公关/[14]文案池/[15]期待值/[16]说明弹层/[17]预警横幅/[18]发布确认(秒级;含变异自检)── ★ 动经济机制与面板链必跑
│   ├── tune_gouge_scan.js   虚标罚系数扫描(EXP 网格)   tune_users_scan.js  信誉→客流联合扫描(base×cap)
│   ├── tune_board_scale/shape/scan.js、tune_coverage.js、tune_landscape.js  棋盘扩色与属性覆盖调参
│   └── layout_check.js      各屏尺寸下「列车」棋盘布局是否溢出/压底栏
```

★ = 当前有效流水线 = 根目录这些脚本是活的:
`build.py`、`sync_models.py`、`server.js`、`server.py`、`check_syntax.js`、`check_all.py`、`make_sfx.py`、
`recompress_assets.py`、`cut_chair.py`、`process_assets.py`、`make_font_subset.py`、`sync_exam_text.py`,
以及 `sim/` 下 16 个脚本:13 个 JS(1 诊断 + 3 断言 + 7 调参 + 1 布局检查 + 1 四窗口汇总 `long_window_report.js`)
+ 3 个复核/扫描器(`window_check.py` 四窗口、`p2_scan.py` P2 多种子、`subsidy_scan.py` 补贴定价)。
其余 ~30 个一次性补丁脚本(`add_*` / `fix_*` / `rewrite_*` / `make_*` / 旧的 `process_*` 等)
已于 2026-09-10 清理,只在 git 历史里。**改游戏只改 `index_template.html`,然后跑 `python build.py`。**
⚠️ `.gitignore` 有 `_*.js` 规则 —— **不要用 `_` 开头命名活脚本**(曾因此删掉过 `check_syntax.js`,见坑36)。

> ⚠️ **`index_template.html` 里的 `REAL_MODELS` 是生成物,不要手改。**
> 真实模型库的唯一数据源是《中转站设计.md》§3.1 的数据表(改文档就能离线调榜,不用进游戏)。
> 改完跑 `python sync_models.py --write` 重新生成(先不带 `--write` 跑一次看 diff)。

## 常用命令

```bash
python check_all.py        # ★ 一条龙自检:构建→语法→305项断言(42+20+243)→30天仿真→dist(失败即停;--skip-sim/--skip-dist 跳步)
python sim/subsidy_scan.py --days 30,90,180  # ★ 补贴定价剂量曲线(RATE×窗口×3种子;§8.2)
python sync_exam_text.py   # ★ 考试文案同步:`--check` 只报告,默认写入模板(改《考试文案池.md》后跑)
python build.py            # 单文件模式:一切 base64 内联 → index.html(本体/离线分发用)
python build.py --dist     # 网页托管模式:代码与哈希资源分离 → dist/(发布 VibeHub 用)
python build.py --release  # 发布模式:剔除调试块 + 断言零调试痕迹(可与 --dist 组合;发布必跑)
node check_syntax.js       # 构建自检:语法 + ASSETS key + 素材文件存在性(退出码非0即出错)
python sync_models.py      # 模型库:报告《中转站设计.md》§3.1 与 REAL_MODELS 的差异(不动文件)
python sync_models.py --write  # 同上,并把文档表写进 index_template.html
python recompress_assets.py # 素材重压缩(仅换图后需要,依赖 Pillow)
python sim/window_check.py # ★ 四窗口复核:D30/D60/D90/D180 并行,打印「诚实÷跑分」比值表(改数值前后各跑一次)
python sim/window_check.py 90 --both   # 只跑 D90,且 sim/price 双策略
python sim/p2_scan.py --days 30,90     # ★ P2 机制扫描:变体×3种子,输出均值±sd 与 σ 判读
python make_font_subset.py             # ★ 兜底字体子集:改文案后必须重跑(新字在兜底设备缺字)
node server.js             # http://localhost:8765(根目录自动补 index.html,可直接预览 /dist/)
```

**仿真 / 数值回归(改经济数值前后都要跑;`sim/` 不参与构建)**:

```bash
node sim/startup_loop.js         # 30 天经济诊断:诚实线 vs 跑分线 + ⚖平账校验 + 瓶颈链路
node sim/verify_users.js         # base/cap 两条人数约束断言(秒级,改人数相关必跑)
node sim/verify_gouge.js         # 层5 虚标折价断言(秒级,改价格/信誉层必跑)
node sim/verify_price_legs.js   # 大套断言(191):单价腿/保价/P2/考试/公关/文案池/期待值/弹层/横幅/发布确认(秒级;动经济或面板链必跑)
node sim/tune_users_scan.js      # 信誉→客流 参数联合扫描(base × cap,5 档)
CONC=5 node sim/tune_users_scan.js   # 并发跑扫描(单档 30 天数秒~十几秒)
```

脚手架的环境变量开关(`startup_loop.js`,用来做「改动前后同源码对照」,**不用手抄旧值**):

| 变量 | 作用 |
|---|---|
| `DAYS=30` | 仿真天数(调参可 `DAYS=15` 砍成本) |
| `SUMMARY_ONLY=1` | 只打 `SUMMARY|` 一行 + 汇总块(扫描用) |
| `LIST_POLICY=sim\|price` | `sim`=挑最像的(诚实线)/ `price`=挑收入最高(投机线)。**默认 `price`;读「诚实线」结论必须显式传 `sim`** |
| `BASE_REP_DIV` / `BASE_MCAP_DIV` / `BASE_MCAP_FLOOR` | 覆盖 `relayBaseUsers` 三项(信誉项分母 / 能力项分母 / 能力门槛) |
| `CAP_K` | 覆盖 `relayUserCap` 的 toolCall 系数(现 0.2) |
| `SIM_OVER_K` / `REP_LOSS_MUL` / `TOK_START` / `TOK_MOVE` | 覆盖相似度折扣 / 跑分扣信誉 / 小游戏 token 成本 |

⚠️ **这些覆盖块是 if 链,新增时务必逐个 env 单独传一次验证** —— 曾经写成
`if (BASE_MCAP_DIV) { …BASE_REP_DIV… }`,于是**只传 `BASE_REP_DIV` 时整块跳过**、扫出「改了等于没改」的假结论(§20.12 5c)。

**两种构建模式(2026-09-10 新增,共用同一份 `index_template.html` 与 `ASSET_FILES`)**：

| | `python build.py` | `python build.py --dist` |
|---|---|---|
| 产物 | 单文件 `index.html` | `dist/index.html` + `dist/pixi.<hash>.js` + `dist/assets/<name>.<hash>.<ext>` |
| 素材形态 | base64 内联(同步可得) | 独立文件(真异步加载),HTML 里只有路径表 |
| 体积(2026-10-19 晚 §19.9~11 UI 优化后) | **2593KB**(整个文件) | 首访 **5428KB** = HTML **418KB** + `pixi.<hash>.js` **446KB** + `assets/` **4564KB**(BGM 2866 + 26 张 WebP 1296 + 中文字体子集 357 + 音效 43);回访只需重下 **418KB** 的 index.html |
| 用途 | 塞进「本体」/离线直接双击打开 | 发布到网页托管(配合平台内容哈希长缓存) |
| 能否离线 | 能 | 不能(需要 http 服务) |

> 体积构成(为什么单文件涨到 2.5M):图片仍全部内联;**3 首 BGM 走外链**(`assets/audio/*.m4a` 共 ~2.9M,绝不内联)
> ⇒ **单文件「本体」不再完全自包含**,离线分发要连 `assets/audio/` 一起拷。
> `--dist` 侧 `assets/` 的 4.4M 里约 2.9M 是这三首音频,其余 = 26 张 WebP(1.3M)+ DSHGameCN 字体子集(336KB,2026-10-16 起外链)。改素材后体积会变,**以当场测得为准**。

改游戏永远只改 `index_template.html`;发布前记得跑 `--dist`,本地看效果跑 `python server.js` 后开 `/dist/`。

## 素材流水线

- `build.py` 顶部的 `ASSET_FILES`(**图片**)与 `AUDIO_FILES`(**音频**)是**资产唯一数据源**:新增素材加一行即可
  (旧版清单写两遍的坑已修)。2026-10-12 实为 **26 张 WebP + 3 首 m4a**。
- 素材走 `recompress_assets.py` 转 WebP(PNG 按游戏内显示尺寸×2 出图,质量 85-88;大背景保持 1920 宽,质量 82-85)。
- **26 个内联素材已全部是 WebP**(2026-09-10 完成背景迁移,不再有 JPG);音频不走这条线,直接放 `assets/audio/`。
- 修改 `compressed/` 原图后必须重跑 recompress 才会影响构建。
- ⚠️ 新增纹理后**必须补 `texture.on('update')` 监听**,否则依赖纹理尺寸的布局会在未解码时算出 NaN 边界(见「已知事项」)。

## 当前进度

> **最新一轮:2026-10-12(§20.11 / §20.12)** —— 中转站经济的两条链都收口了:
> **定价链**(虚标罚换锚 + 相似度闸 + 幂律)与**人数链**(客源/并发两旋钮一起松),
> 30 天快照里**诚实线首次反超跑分线(1.15×)**。完整推导、扫描表与踩坑见《中转站设计.md》§20.5–§20.12。

### 当前生效数值链(2026-10-18 对账)

> 这一节写的是「**现在代码里真的是多少**」,不是设计意图。改数值前先读这里,改完跑 `python check_all.py`(201 项断言 + D30 仿真)。

**人数(客流)—— 两条腿,谁小谁说话:**

| 量 | 公式 | 真实上限 |
|---|---|---|
| 客源基数 `relayBaseUsers` | `(2 + floor(信誉/8) + floor(max(0, 能力分−20)/8)) × (1 + userBoost.pct)` | **24**(信誉硬顶 100→+12,能力分满 100→+10);boost 到期逐位回退(断言锚) |
| 考试过关加成 `userBoost` | `{untilH, pct}`;`pct = ex.usersPct × 0.7^(k-1)`,市级以上才发(方案 B) | 临时、带过期;**前 4 场小考只给 token,不给信誉/用户** |
| 并发上限 `relayUserCap` | `floor(2 + toolCall × 0.2)` | **22**(toolCall 100) |

- 门槛 20 ⇒ **开局 base 恒 2**(防早熟通胀);开局 `cap` 由 2 抬到 3,但 `min(base,cap)` 仍是 2 ⇒ **起步期数值完全不变**。
- 稳态人数 ≈ `base × 增长概率 × 在网时长`,但发放处是 `add = min(add, cap − 在站自然用户)` —— **cap 满了 base 再大也一个不加**。
- ⚠️ **改一个必须同时看另一个**:2026-10-12 之前 `cap` 上限只有 **12** < `base` 上限 24,
  base 从 12 往上那半条(信誉项 + 能力项)**整条是死的** —— 当时只提信誉分辨率,诚实收益 `2.09 → 2.09` 一分不动。
- ⚠️ 信誉是**硬顶 100**(`Math.min(100,…)`),算天花板必须用可达值(`信誉=200` 会算出一条游戏里到不了的假天花板)。
- 自研模式(不标榜)不走 `relayBaseUsers`,用固定 `SELF_BASE_USERS = 1` ⇒ 与上面两旋钮无关。

**定价 / 成交 —— `relaySellPayMul` 三层:**

- 硬价格带:标榜模型官价 `×0.5 ~ ×1.5`(`PRICE_MIN/MAX`),每小时重钳一次(防新闻改官价后漂出带外)。
- 增长线 ≤ 官价×0.8(以上按 `GROW_FALLOFF` 线性衰减到 0);续约线 ≤ 官价×1.1(以上概率衰减,保底 25%)。
- 人均用量:`> 官价×0.8` 后 `relayUsageMul` 下探(高价 = 低留存 + 低单用户用量)。
- **层5 虚标折价**(2026-10-12,§20.11):`相似度闸(SIM_GATE)` + 阈值 = **法定上限价** `fairPriceOf × 1.5` + 幂律 `(1/over)^GOUGE_PAY_EXP`,
  `GOUGE_PAY_EXP: 1`。语义:**你标多贵,都只按「你实际值的法定上限价」成交**。
  `GOUGE_PAY_K` 已不存在(改名为 `GOUGE_PAY_EXP`,`grep GOUGE_PAY_K` 应为空)。
  ⚠️ `SIM_GATE` 属于 **`PUBLISH_CFG`**,不在 `RELAY_BIZ` —— 放错对象会取到 `undefined`,`x >= undefined` **恒为 false** ⇒
  闸门静默失效、误伤照旧,而 `check_syntax.js` 与仿真**都不会报错**(只有单元断言抓得到)。
- ⚠️ `sim ≥ 80` 属诚实线,**层5 故意豁免**(与 `relayRepSettle` 的 `<80` 分支对齐);高价由既有三层收费,不重复收费。

**当前平衡快照(§17.7 新基线,取代 §20.13~§20.16 各表;首种子口径)**:

| 线 | D30 | D60 | D90 | D180 |
|---|---|---|---|---|
| 诚实线 | **1.89** | 10.73 | 21.09 | 60.39 |
| 跑分线 | 1.13 | 9.42 | 16.05 | 38.38 |
| **诚实 ÷ 跑分** | 1.673 | **1.139** ✅ | 1.314 | 1.573 |

四窗口比值全部 ≥1.0(**长窗口不再翻转**,§20.13 的 0.65 已被单价腿 C2+C4 与方案 B 修掉);
D60 比值正中设计目标(1.0~1.2);四窗口残差达标(1.4e-4 ~ 2.6e-2)。
⚠️ 仍是**首种子值** —— 多种子均值更薄(§20.14 发现 5),调平衡别拿首种子当准绳。
诚实线长窗口偏强(D180 60.39),若继续收紧可降市级以上信誉奖励 —— **待观察,不先动**。

- ⚠️ **「诚实首次反超」是 D30 假象 —— 窗口一拉长就翻转,且看不到收敛**:
  `1.15 → 0.88 → 0.75 → 0.65` 单调下滑。数据、机制与候选修法见《中转站设计.md》**§20.13**。
  > **更正指针(2026-10-18)**:该下滑已由 §20.14 单价腿(C2+C4)+ §17.7 考试方案 B 修复,
  > 现行四窗口比值见本节上方新基线表;本段保留作 §20.13 历史口径。
- ✅ **但 §20.12 那半句是站得住的**:「信誉能换客流」在长窗口下**更强** —— D180 诚实线 **18 人** / 信誉 **100(触顶)** /
  baseU 23 / 已卖 184M;跑分线 **0 人** / 信誉恒 0 / baseU 12 / 已卖 22M。**病根不在客流,在变现单价。**
- ⚠️ **口径铁律**:`刀乐` 是**现金余额**,跑分线会把它砸进训练道具 ⇒ **收益必须算 `刀乐 + 道具$`**。
  只用刀乐比会得出**完全相反**的结论(§20.11 一;上一轮「诚实反超」的假结论就是这么来的)。
- **更正指针(2026-10-12 晚)**:这里原本记着一条「投机线(`LIST_POLICY=price`)毛收益 2.64 → 2.64(0.0%)」,
  用它证明「改动是定向的、没有泄漏到虚标那一侧」。**判断成立,但措辞会误导,已更正如下**:
  `LIST_POLICY` **只作用于诚实线** —— 跑分线一旦 `publish.active` 就跳过标榜分支
  (`sim/startup_loop.js` 的 `if (!R.publish.active) { …选标榜对象… }`),所以 `price` / `sim` 两版里
  那条「跑分线」**是同一条线**,它纹丝不动是必然的、不是"对照成立"的证据。
  真正成组的对照只有 `LIST_POLICY=sim` 这一组,D30~D180 的完整数据见本节上方表格。

### 自检体系(2026-10-12 搭好,2026-10-20 扩;全链 305 项 = `python check_all.py` 的 42+20+243)

| 层 | 手段 | 抓什么 |
|---|---|---|
| 构建 | `node check_syntax.js` | 语法 / `ASSETS` key 拼错 / 素材缺失 |
| 单元 | `sim/verify_users.js`(42)、`sim/verify_gouge.js`(20)、`sim/verify_price_legs.js`(243,含考试[12]/公关[13]/文案池[14]/期待值[15]/说明弹层[16]/预警横幅[17]/发布确认[18]/UI优化[19]/相似度[20]) | **静默失效的闸门与死项** —— 不报错、不变慢,只会悄悄改平衡 |
| 扫描 | `sim/tune_users_scan.js`、`sim/tune_gouge_scan.js` | 系数取值 + 「两旋钮一起扫」的交叉对照 |
| 端到端 | `sim/startup_loop.js`(日表 + 汇总 + 平账) | 闭环走没走通、平没平账、瓶颈在哪条腿 |
| 界面 | `local-ui-verify`(Edge + CDP,`uidiag.js`) | 真实产物渲染 / JS 异常 / **canvas 文案宽度** |

⚠️ `verify_*.js` 的**除数/门槛/系数是从源码文本正则取的**,不手抄进测试 —— 这样"落进代码的值"与"扫描选出的值"
对不上时会当场 FAIL。`verify_*.js` 复用 `startup_loop.js` 导出的 `makeSim` 沙箱,不再各抄一份抽取清单。

---

> 以下为 2026-09-12 起的既有内容(**未失效**,仍是当前实现):
> 本轮还包含:全局鲸鱼光标、调教道具/鞭子、课桌落座、Q 版 idle、日报文案闭源修正等,细节见下「调教场景」与「社区日报」。

### 协作约定(用户)
- **文档写法**:用户累于严格格式,内容偏口头交流、不一定分类。读用户改的 md 时**按语义理解**,不要苛求章节/字段齐全;我这边仍可维护结构化章节。
- 日报文案用户改 `社区日报池.md`;机制以 `中转站设计.md` §15 为准。

### 调教场景(2026-09-12,与中转站同步解锁 + 双人物 + 课桌/道具/光标)
- **解锁**:买服务器后与中转站一起放行;未买时点「调教」提示「暂未解锁 · 购买服务器后开放」。
- **占位文案已删**;背景 `tune_bg.webp`(1920 宽 q85 ≈115KB)。
- **人物架构**:`createWalkerRig(idleKey?, sitKey?)` 工厂 + **两套独立实例**:
  - `relayWalker`:插在椅子下层(坐椅人在椅后)。
  - `tuneWalker`:首次进调教创建;停顿/坐桌用 **`tune_idle` Q 版**(不用背影 `walker_sit`);走路 6 帧;开场直接走。
  - **禁止 reparent 同一 container**(会打乱椅子/课桌层级,坑54)。
- **地面边界(调教)**:上沿 0.74 · 站立线 0.90 · 初始 0.83。中转站 0.70 / 贴底。
- **朝向坑(坑55)**:`syncWalkFacing` 开场/落地/idle→walk/每帧校正。
- **课桌**:`tune_desk.webp` 居中约屏宽 18%;**人物图层在课桌之下**(桌盖人,2026-09-12 用户定稿;勿再改回“人前桌后”)。层级:bg → shade → 人物 → 课桌 → UI;拖入桌宽范围**直接落座**(不起落体),显示 Q 版 idle,不走动。**坐高**:`floorY - min(deskH*0.35, 72)`(地面～桌面之间,腿在桌后);头顶若仍被桌沿挡,再微调到高出桌沿 ≥2% 屏高。**勿抬到桌面**(用户反馈太高)。
- **消失坑(2026-09-12 已修,坑56)**:调教人物「走到边缘/过一会儿/坐上桌会持续消失」有两个叠加根因,改 `applyWalkerMetrics` / `layoutTuneScene` 时别回退:
  1. **行走边界按背景矩形算**。背景是 cover 缩放(超宽屏/非16:9 会比屏幕大并被裁切),`maxY`/`sitY` 可能算到 `y > h` → 人走进屏幕外或坐到屏外。边界必须再与屏幕 `[0,w]×[0,h]` 求交;`floorY`/`deskSeat.sitY` 同样夹回屏内。
  2. **`tune_idle` 纹理未解码时 `height=0/1`**,`scale = 目标高 / texture.height` 得到 Infinity/NaN → 停顿/坐桌切到 idle 贴图整张画不出来(走路帧用常量 `WALK_FRAME_H` 所以 walking 时正常,一 idle/坐下就“消失”)。缩放走 `safeSpriteScale`(height≤1 用 fallback);启动就 `Texture.from(ASSETS.tune_idle)`,并在 `texture.on('update')` 时重跑 `layoutTuneScene`。
- **道具抽屉**:右侧 48×92 窄条(对齐生产「购买」),展开向左;第一件「鞭子」。
- **鞭子**:仅调教空白区生效;指到道具/面板/底栏/设置/电脑面板 → 鲸鱼光标;点击挥鞭(whip_idle↔whip_crack 短暂切换);光标锚点与缩放可调。
- **全局鲸鱼光标**:默认跟随(图1常态/按下图2);`custom-cursor` CSS `!important` 盖 Pixi 写回;先隐藏待首次 pointermove。
- **性能**:`updateWalkerAI` 只推进打开场景的 rig。
- **相关代码**:搜 `createWalkerRig` / `tuneDeskSprite` / `deskSeat` / `tune_idle` / `isOverUIChrome` / `whaleCursor` / `whipCursor`。

### 中转站经营玩法 v1(已落地最小闭环 + 后续修正)
- **§14 / §14.10 / §14.11**:刀乐、1 现实秒=1 游戏分、信誉初始 1、用户初始 2、tokens 单池、后台页上架。
- **有效相似度**:`rawSimilarityTo × capMulTo`(`capMul=(myCap/listCap)^0.5`,0.4~6,无 1.5 封顶);可 >100。`SIM_SAT=1.0`。**A 软化(2026-09-12)**:`SIM_KEYS` 含参数;权重降序 推理0.24 > 多模态0.16 > 参数0.13 > 长上下文0.11 > 知识0.09(指令/工具0.10、速度0.07);硬门槛 知识0.35→**0.18**、多模态0.30→**0.20**。
- **无市场价**(2026-09-12):只留官方参考价 `blendPrice`;增长 ≤ 官价×0.8,续约 ≤ 官价×1.1。
- **速度属性**:一般 ≤100;Mercury 2 / Celeris-1 的 **tokens/s 顶 ≤120 且不同**(100 与 120),速度属性 33/40,cap 与名次未动。
- **UI**:标榜文案、选中即显有效相似(绿≥80/红<80)、后台「数据详情」(信誉/用户怎么涨跌)、中转站顶栏 HUD(刀乐/用户/时钟)不遮面板。
- **存档迁移**:老存档无 dollars → reputation=1、users=2。
- **相关代码**:`RELAY_BIZ`、`updateRelayBusiness`、`similarityTo`/`rawSimilarityTo`/`capMulTo`、`drawBackendPage`、`relayHud`。

### 社区日报 v1(2026-09-12 已实现逻辑 + UI)
- **§15 + §15.1**:每 6 游戏时一篇、活 24 时、最多 3 条;类型 price/traffic/station/pool/gossip。
- **代码**:`NEWS_POOL`(文案从《社区日报池.md》整理)、`spawnNews`/`newsTick`/`applyNewsFx`、`officialPriceOf` 含活跃 price 系数。
- **去重**:同 id 活跃期禁止再抽;price 同目标**覆盖不叠乘**;型号级优先厂商级。
- **社区页**:列表滚轮;点进详情(全文+效果;赞/转/藏生成时随机假数据);右上角「发帖」。
- **发帖(占位)**:引导 → 同厂下一篇权重 ×2.2(12 游时);中和 → 负面有概率立刻缓解(信誉回一半/提前撤稿)。
- **后台**:有调价时显示 原价划线 → 现价(降绿/涨红);增长/续约线也吃有效官价。
- **文风**:厂商直写;创始人戏称(奥特曼/梁子→梁圣/a//哈基米/老马/唐哥);body=`主体。【画外音】`。
- **未做**:评论、配图、独立收集册弹窗(列表已显示收集 x/n)。
- **文案**:用户继续改 `社区日报池.md`,定稿后同步 `NEWS_POOL`。
- **IP**:若收赞助,建议全链路模型化名(如 Kimi→Kity),目前未改。
  **2026-10-18 对账**:§9 伪装流从未实装,「伪装」仅为标榜+相似度数值机制的称呼、冒用对象全是虚构版本号
  ⇒ 免费期**不改化名**;变现前重拍,详见《中转站设计.md》§13-12 更正块。
- **相关代码**:搜 `NEWS_POOL` / `spawnNews` / `drawCommunityPage` / `handleCommunityPost`。

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
- **经营活字节流(2026-09-13)**:`updateRelayBusiness` 里的后台页活字(6 条 Text)与中转站 HUD(2 条)
  从每帧 set 改为 **0.25s 节流**(`relayUiAccum`,模块级变量不进存档)——卖出进行时 dollars 每帧都变,
  不节流的话这些 PIXI.Text 每帧都重栅格化(与购买按钮每帧重绘同类的问题)。改动别回退。
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
  - `REAL_MODELS` — 真实模型锚点生成物(**59 条在售**),由 `python sync_models.py --write` 从设计文档 §3.1 生成,**勿手改**。
    退役模型已按用户要求从源表整行移除(原先 51 条含 25 条退役),`legacy` 字段保留但全部为 0。
    v0.3 参考 `wycode.cn/gaokao` 补了一批大众型号(排除 Meta 与该榜名次 ≥70 的),名次/cap 未照抄该榜,按讨论热度与厂商定位重排。
    v0.4 补 Hunyuan Hy4 / Agnes 2.5 Pro & Flash,`DeepSeek V4.1` → `V4.1 Flash` 并改原生多模态(cap 62,排在 V4 Pro 之上)。
    v0.5(2026-09-12)**速度全面校准**:43 条 tok/s 按 Artificial Analysis 输出速度中位数覆写,新增
    `Gemini 3.5 Flash-Lite`(346 t/s)/ `Mercury 2`(750 t/s)/ `Celeris-1`(1370 t/s,全场最快)3 条;
    字节/腾讯/百度/华为/商汤/Qwen2.5-7B 站上无数据维持粗估(详见设计文档 §3.2)。数据快照存 `_aa_data.json`。
    v0.6(2026-09-12)**cap 顺序按 AA 智能指数重排**:47 条有 ii 的模型贪心重定 cap(37 条调整,
    如 `GPT-5.5` 73→33、`Gemini 3.8 Flash` 61→37),13 条 AA 查无数据的保持原 cap(清单见设计文档 §3.2)。
    ⚠️ 只动了 cap,**速度/知识截止两列未改**(用户明令);派生属性(推理/指令/速度锚点)随 cap 自动变化。
    v0.7(2026-09-12)**§13.11 落地:属性搬进数组**——设计属性列升 9 维(补拟合/参数),
    全 59 行按用户游戏内调参成果(导出全榜 CSV)写入,`sync` 生成 `ax` 字段(9 元数组,顺序同列);
    `deriveModelAttrs` **优先采用 ax**,无 ax 的行才退回 cap 推导。至此类属性是第一手数据,
    调它要改 §3.1 设计属性列再 `--write`,cap/名次不再牵动属性。
    ⚠️ **档位 `t` 按「厂商内部定位」分,不代表绝对强度** —— 一条 `轻量` 的 Flash 可能强过别家的 `中端`(见设计文档 §3.4)。
    ⚠️ **型号 / 性能 / 价格均为虚构设定**,设计文档 §3.1 顶部与榜单页页脚都有声明;要商业化前先看 §13 的 IP 风险条目。
  - `ctxK()` / `tokPerSec()` / `cutoffMonths()` / `modelCapability(a)` — 四组派生量公式(与属性值互逆)。
    2026-09-11 数值定稿:① 上下文区间改 **0k~1000k**(平移对数 `ctxK = 1000*(50^(LC/100)-1)/49`,新增精确逆映射 `ctxAttr()`;原 20k 起步会把 8k 小模型顶死在 0);② **速度 1 分 = 3 tok/s**(`TOK_PER_SPEED_POINT = 3`,原 2);
    ③★ **知识乘区也受推理闸门**(2026-09-12 用户定稿):`knowMul = 1 + ±25% × (推理/100)` ——
    推理越高知识倍率越大,推理 0 时知识不起作用。**排序零变化**(排序键是静态 cap,公式只影响综合评分显示);
    同轮把第 10 名之后相邻 cap 差压缩到 ≤ 2.5(11 条上调、顺序不变,见设计文档 §3.2 v0.8)。
    ③ **能力公式加三项**(用户定稿,都 × 推理/100 闸门):速度 0.06、长上下文 0.06/0.09(60 分两档)、
    多模态 0.10/0.04/0.13(<40 / 40-60 / >60 三档,文图档最小、真全模态最高)。
    权重常量在 `CAP_SPEED_W` / `CAP_CTX_W_LO·HI` / `CAP_MM_W_LOW·MID·HIGH`;高档配置会顶到 100 上限,调权重见设计文档 §12。
    ④ **速度锚定 AA 实测值(2026-09-12 最终态,一天内三改)**:速度属性 = `ts / 3`(§3.1 的 AA 实测 tok/s),
    榜单 tokens/s 列 = `ts` 原值。经历:接进 ts/3 → 撤回改 cap 反推 → cap 重排把速度拖着变,
    用户重申"不要轻易修改速度属性"→ **最终锚定回 ts**。此后速度只随 §3.1 数据变,cap/名次怎么调都不影响;
    能力公式速度项 0.06×推理闸门,锚定切换单项影响 <1 分。⚠️ 属性上限 100 = 300 tok/s,
    超速模型(Celeris-1 1370 等)属性记 100、榜单显示 AA 原值。
    ⑤★ **面板重绘必须 destroy(坑52,2026-09-12)**:`layoutScreenPanel` 每次新建一两百个 Text/Graphics,
    清空时只 removeChildren 会泄漏纹理 → 编辑器里反复改数值越用越卡。已改为「延迟销毁」
    (removeChildren 后 setTimeout(0) 逐个 destroy,避开事件派发途中析构);同轮清 radarCounters/editRef。
    新增往面板容器里加内容的人注意:这个销毁模式对你是透明的,但要记得别把池化对象(如 floatTexts)放进这三个容器。
    ⑤ **知识截止日期联动**(2026-09-12):编辑器改「知识」后,编辑卡片左上角与榜单截止列都按
    `effectiveCutoff()`(= `monthsStr(cutoffMonths(有效知识))`)实时跟着变;⚠️ `monthsStr` 的月份是
    **1-indexed**(年*12+月),曾按 0-indexed 还原导致所有日期显示差一个月(坑51)。
  - `modelToAttrs(m)` / `modelCapabilityOf(m)` — 真实模型 → 等效属性(用于雷达图叠影与距离计算)。
    ⚠️ 坑:`knowledge` 曾写成 `5 + (m.k ? 5 : 0)`,`m.k` 是 `'YYYY-MM'` 字符串恒为真 → **每个模型知识恒 10**,
    `closestModel` 的「知识不如它新 +0.35」门槛连模型对自己都触发,53 条里 34 条最近邻都是 Qwen2.5-7B。
    2026-09-11 改为用 `monthsFromStr(m.k)` 反推(与 `cutoff()` 互逆),实测 56/56 各自命中自己,新手锚点不变。改这块前先看设计文档 §3.5。
  - `closestModel(a)` — 7 维加权距离 + 2 个硬门槛(知识截止、模态档位),返回"最接近的真实模型"与相似度。
  - `deriveModelAttrs(m)` / `modelToAttrs(m)` — 拆成两层:前者是纯推导(不含覆盖),后者在末尾合并 `MODEL_ATTR_OVERRIDE`;
    **不要**把覆盖合并搬回 deriveModelAttrs —— `effectiveCap` 的 Δ 要分别算"改前/改后"两次能力。
    ⚠️ v0.7 起推导顺序:**`m.ax`(9 维,来自 §3.1 设计属性列)优先**,无 ax 才走 cap 推导;
    ax 的 9 元顺序 = 列内顺序(推理/知识/长上下/速度/多模态/指令/工具/拟合/参数),与 RADAR_KEYS 顺序不同,取值时按下标映射,别按 RADAR_KEYS 顺序读。
  - `effectiveCap(m)` / `boardOrder()` — 【临时调试】榜单实时重排:有效 cap = 静态 cap + 覆盖引起的派生能力 Δ;
    `boardOrder()` 按 有效 cap 降序(平手按原表序),drawLeaderboardPage 按它渲染,`#` 列 = 实时名次。
    Δ 方案(而非直接按派生值排)是为了刻度对齐:没改的模型 Δ=0,顺序与 §3.1 完全一致,改多少挪多少。
  - `blendPrice(m)` — 榜单单列价 = `(pi + po*3)/4`(混合参考价);`REAL_MODELS` 存拆开的 `pi`/`po`,
    sync_models.py 按「出价=3倍入价」拆回 ⇒ pi=0.4×价、po=1.2×价,**round-trip 保真**(拆完再合恰好还原)。
- **`state.relay`(存档 v1 已含)**:`{ ability: { 9 项属性 }, listedModel: null, price: 0, pool: 'standard', reputation: 50 }`。
  `saveGame`/`loadGame` 已接上;载入后调 `refreshRelayPanel()` 重绘面板。
  ⚠️ 老存档没有 `relay.ability` 字段时靠 `Object.assign` 合并补默认值,不要改成整体替换。
- **面板左栏改为可点击标签**(模型 / 榜单 / 社区 / 后台),替换原先的三组纯占位菜单;`panelTab` 决定 `drawModelPage`/`drawLeaderboardPage`/`drawCommunityPage`/`drawBackendPage`。
  内容全部画进 `panelContentArea`,用**绝对屏幕坐标**(该容器自身位移为 0)。
  - **模型页(已实现)**:最接近的真实模型名 + 相似度 + 综合评分块(评分/速度/上下文)+ **9 轴雷达图**。
    - 雷达图带**开启动画(用户定稿:边界不动,内部生长,数字滚动)**:网格/轴线完全静止;两个数据多边形 +
      拟合最优点刻度画进 pivot 在图心的 `dataLayer`,打开面板或切回模型页时 scale 从 0.01 补间到 1(0.45s)。
      **轴标签数字同时从 0 滚到当前值**:`radarCounters` 注册 + `radarTicker`(挂主循环)按同一条缓动逐帧推进,
      播完定格清空;非动画重绘直接定格。平时零开销(ticker 首行 return)。
    - ⚠️ `tween(target, delta, ...)` 的第二个参数是**增量**,不是目标值:要从 0.01 到 1 得写 `0.99`。
      `tween` 会把 target 上的 expando(如 `scale.__radar`)透传进补间记录,`radarTicker` 靠它找雷达补间;
      ⚠️ 页面失焦时 rAF 停摆、补间不推进 —— 自动化测试要手动 `updateTweens(dt)` + `radarTicker()` 推帧。
  - **榜单页(已实现)**:`REAL_MODELS` 的表格(名次/模型/厂商/档位/**截止**/上下文/**tokens/s**/价$/cap,共 9 列),斑马纹 + cap 橙色加粗。
    右上角「**导出全榜 CSV**」按钮(2026-09-12):下载 `dshgame-leaderboard.csv`(带 BOM,Excel 直开)。
    **搜索框**(榜单上方,DOM input 叠画布):输模型/厂商关键字 → 下拉命中(前 10 条)→ 点击跳转该行 +
    淡蓝描边(移动鼠标消失);**输入 `/admodel` 回车切换调试态**——调试态下行可点开编辑器(可改数值、
    已改标记、保存到文档等),玩家态(默认)行只打开只读属性面板、零调试痕迹。入口不写在玩家可见文案里。
    内容 = **修改后的有效值**(2026-09-12 用户要求):名次按实时排序,截止/cap 取有效值,
    并新增 9 列属性(推理…参数,均含编辑器覆盖)+「手改项」列标明动了哪些;
    唯例外是 tokens/s 列固定显示 AA 实测原值(不随覆盖变)。
    **截止列显示有效日期**(编辑器改「知识」后跟着变,`effectiveCutoff`);
    **tokens/s 列**(2026-09-12)= 游戏内自洽速度(属性 ×3),**不是** §3.1 的 AA 外部实测值(那列是留痕);
    **价$ 单列**(2026-09-11 用户要求简化):混合参考价 `blendPrice = (pi + po×3)/4`,与设计文档 §3.1 同公式;
    `REAL_MODELS` 仍存拆开的 `pi`/`po`(sync 按「出价≈3倍入价」拆回),后台定价读拆分值。价格是虚构参考,不追求真实行情。
    只收在售模型(退役行已从源表移除);行高 30 / 字号 13(用户要求放宽),56 行一屏放不下(1280×720 实测一屏 13 行),滚轮每格翻 3 行,页脚左边显示进度、**右边固定「非真实榜单 · 型号与数值均为虚构」**。
    **悬停高亮(用户要求)**:鼠标在哪行,那行就出现淡蓝描边(`#7ab8d4`);一块共享 `hoverRect`,行热区 `pointerover/out` 负责画/藏。
    **排名实时跟随编辑器数值(2026-09-11 用户要求,推翻前版"不重排")**:显示顺序 = `boardOrder()` 按
    **有效 cap** 降序(`effectiveCap()` = 静态 cap + 覆盖值引起的派生能力 Δ),cap 列同步显示有效值(一位小数);
    Δ 方案保证没改的模型 Δ=0、顺序与 §3.1 完全一致,改多少挪多少。`REAL_MODELS` 数组不动,`closestModel` 不受影响。
    调榜工作流:游戏里试数值 → 誊回 §3.1 → `sync_models.py --write` 固化。
    ⚠️ 滚轮**挂在 `app.view` 的 DOM `wheel` 上**(`screenPanel.on('wheel')` 实测收不到真实浏览器 wheel),`{ passive: true }`,且只在「面板开着 + 榜单页」时生效。
  - **榜单行点击 → 模型属性编辑器(⚠️ 临时调试工具,上线前必须删)**:点行打开 `drawModelAttrEditor`
    覆层(复用 `attrDetailLayer`),**左右分栏**(参考 artificialanalysis 信息架构),卡片与面板内容区**同比例、
    占满 97%**(实测 1093×593 vs 内容区 1126×612),行高随窗口高度均分 9 行(≥36),
    标题 20px / 属性名 16px / 说明 13px;标题里的「第 N 名」是 boardOrder() 的实时名次:
    左栏 9 项属性各一个可点数值框(输入数字 → 回车提交);**右栏与「模型」页同款** —— 综合评分块 +
    9 轴雷达图(`drawRadar` 直传 `attrDetailLayer`,不播开启动画),左栏改数值右栏实时变。
    值写进 `MODEL_ATTR_OVERRIDE`(localStorage,key = 模型名),`modelToAttrs()` 末尾合并覆盖值,
    于是**雷达图灰影 + closestModel + 榜单名次实时变**。不碰 `REAL_MODELS`(生成物)、不进存档。
    敲键只更新当前 `Text`(`editRef`)不整页重绘;输入中 ESC handler 先 `if (editingKey) return;`。
    撤销点(全部标了 `【临时调试】`):`MODEL_ATTR_OVERRIDE` 定义块 / `modelToAttrs` 末尾合并(`deriveModelAttrs` 拆分)/
    `effectiveCap`·`boardOrder` / 榜单行 `hit`+悬停描边 / `drawModelAttrEditor`·`saveModelOverrides`·`commitModelAttrEdit` / keydown 的 `editingKey` 段。
  - 社区页 / 后台页:**静态文字占位**,机制设计见设计文档 7、8 节,尚未接逻辑。
- **底部标签栏收拢 + 左移**(2026-09-11):`layoutNavTabs()` 用 104×42 / 间距 18,先按屏宽居中再整体左移,
  上限是「人物左缘 - 16px」(人物宽按 `min(340, 屏高*0.4)` 估,同 `layoutCharacters`)。原因:旧版均分整屏宽,最后一个标签正好压在右下角人物身上(生产界面最明显)。
  (间距先定 10 太挤,用户要求"分开一些",改成 18。)
  ⚠️ 标签数量会变(中转站买了服务器才解锁),位置必须每次在 `layoutNavTabs()` 里按**当前可见标签**重算,不能写死。
- **雷达图 9 轴的坑**:9 项属性里**「拟合」「参数」不是"越高越好"**,直接画会让玩家读反。
  处理方式:拟合轴上额外画一条**绿色最优点刻度**(`CAP_FIT_OPT=70`,配文字"最优 70"),参数照常画;两者排在最末两条轴。
  轴标签按 `anchor 0/1` 贴圆外缘对齐,否则 9 轴下标签会互相压字或压到左下评分块。
  真实模型没有拟合/参数(内部量),`modelToAttrs` 给锚点值,**且这两个键不在 `SIM_W` 里**,所以只影响画图、不影响相似度判定。
- **榜单决策(2026-09-11)**:面板**不做名次排名 UI**(只显示「最接近的模型」)。完整榜单 + 档位分类落在 `中转站设计.md` §3.4;
  游戏内只读全量表以「榜单」标签页落地(数据仍以 §3.1 为唯一源,`sync_models.py --write` 生成)。
  用户规划以后加「模型列表」板块(可搜索、显示大致属性),落档在 §3.5。注意 §3.5 记的坑:§3.1 的设计属性值 vs `modelToAttrs` 的硬推值差很多,
  要搬数据前先看那节。
- **左栏宽度改为 `min(200, 屏宽*0.24)`**:竖屏手机上固定 200px 会把内容区挤得没有空间。
- 撤掉的旧玩法可参考 git 历史里的 diff;`state.relay` 早期是空对象占位。

### 电脑屏幕面板系统(2026-09-10)
- **触发**:人物坐下后,电脑屏幕显示草绿色描边(呼吸动画:4s周期,0.4s出现+1.2s保持+0.4s消失+2s等待;悬停时常驻显示,timer暂停,移出时lerp平滑过渡)。点击描边及内部区域打开面板。
- **面板结构**:背景遮罩(alpha=0.72半透明深色,点击关闭,但电脑屏幕区域不关闭)+ 面板主体(米白色#f5f0e8,占屏幕88%×85%,圆角14px)+ 顶部栏(浅米色48px,**大肥鱼站logo**+搜索框占位)+ 左侧栏(浅米色,宽 `min(200, 屏宽*0.24)`,**4 个可点击标签:模型/榜单/社区/后台**,选中项暖橙高亮)+ 中间内容区(按标签渲染,见「中转站」章节)。参考 Liminality 面板设计,简约暖色调,不用黑色。
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
- **中转站经济(速查,2026-10-12)**:
  - 时间:1 现实秒 = 1 游戏分,24 现实分 = 1 游戏日;存档 30 秒自动落盘。
  - 信誉:初始 1,**硬顶 100**;每 10 游戏时结算一次(按对**当前标榜模型**的有效相似度分档:>100 只升 / 80~100 双向 / <80 主跌且越低越狠);未上架不结算;断供每小时 −1。
  - 用户:初始 2;每小时刷新 = ① 到期续约(概率吃信誉,封顶 95%)② 概率增长(基数 `relayBaseUsers`,**不看当前人数**,防复利)③ 兜底(人归零且已标榜有价 → 每时约 35% 送回 1~2 个尝鲜)。
  - 收益:每秒刀乐 = `min(需求, 产出) × 定价 / 1e6`;需求 = `用户 × 速度 × 活跃系数 × 人均用量 × 成交折价`。
  - 产能:RTX3080 5 tok/s + A100 50 tok/s;库存见底 → 服务中断(收入 0 且掉信誉)。
  - 调教小游戏(主要成长引擎):每局烧 `TOKEN_START(3e4) + 14 × TOKEN_PER_MOVE(5e3) ≈ 0.1M` tok。
  - 数值细节与公式推导见《中转站设计.md》§14 / §20.x;**改数值前先读 PROJECT.md「当前生效数值链」**。

## 代码导航(index_template.html 内的分节注释)

`工具函数` → `补间动画` → `PIXI 初始化` → `层级容器`(bg/clickArea/characters/scene/ui/topbar/fx/settings/nav) → `背景层(灯效)` → `点击增量层` → `角色层` → `场景层(机箱物理)` → `购买面板`(三标签:机器/散热/脚本) → `生产标签/中转站标签+switchScene` → `中转站场景` → `顶部信息栏` → `设置` → `游戏状态` → `本地存档` → `统一布局` → `主循环` → `启动(多重布局保险)`

## 已知事项 / 注意

- 浏览器自动化点击 canvas 测试时:**设置面板开着会挡住底部标签**(遮罩全屏),先关面板再点。cua 坐标=CSS 像素(本机 dpr=1),中转站标签中心 ≈ `(0.62×宽, 高-36)`,生产 ≈ `(0.38×宽, 高-36)`。
- 设置面板「音乐音量」滑条**已接 BGM 且已持久化**:拖动即时改正在播的轨(`setBgmVolume`),换轨淡入也以 `musicVolume` 为目标;音量存进存档 `settings.{music,sfx}`(`saveGame`/`loadGame`,拖动防抖 400ms 落盘),刷新/换设备(同浏览器 localStorage)会跟随用户设置——VibeHub 上即随玩家本地存档持久。默认 0.7。「音效音量」滑条**已接 SFX(2026-10-13)**:四种操作音效由 `playSfx(name)` 池化播放(池上限 8、超出丢弃),音量每次播放取 `sfxVolume`;素材由 `make_sfx.py` 程序化合成,想换音色直接替换 `assets/audio/sfx_*.wav`。
- 设置卡片**只有点背景虚影(全屏遮罩)才关闭**;卡片本体 `bg` 设了 `eventMode='static'` + `hitArea` + `pointerdown` 吸收点击,防止点在卡内空白处误触关闭。改 `drawSettingsPanel` 时别把 `bg` 的交互去掉,否则卡内点击会穿透到遮罩又变成一点就关。
- **后台「收益速率」用 `formatRate` 自适应精度**(`$ /秒`,早期 `users×speed×coef×price/1e6` 极小,固定 `toFixed(3)` 会显示成 `0.000`,像"一直是0")。别退回固定 3 位小数。
- **强化训练贴图坐标坑**:`tuneGameTiles` 每格 Graphics **必须画在局部坐标(0,0起)、`position` 设成绝对格位、`pivot` 设成局部中心**(缩放/弹跳绕自身中心)。踩过的坑:画在绝对坐标又同时 `pivot.set(绝对中心)+position(0,0)` → 渲染时整体偏移 `-(pivot)`,所有方块堆到左上角 = "棋盘空白、无法游玩"。`hitArea` 也要用局部 `(0,0,cell,cell)`。
- **「闭关训练…」标签**:统一头顶标签 `sessionLabel`(挂 `layers.topbar`,亮金 `#ffe9a8` + 深色描边),每帧 `syncSessionLabel()` 跟随**当前可见场景**的人物头顶(调教→`tuneWalker`、中转站→`relayWalker`、生产→`charClosed`),文案用「Nmin」;无疗程隐藏。不再只在调教场景、不再钉死课桌。**坑:它在 topbar,层级在 `layers.panel` 之上,任何整屏覆盖层一开,倒计时就穿帮盖住它们。已在 `syncSessionLabel` 开头让位隐藏:`screenPanelOpen`(电脑屏幕)或 `gameState && tuneSceneOpen`(强化训练棋盘)任一真即 `visible=false`。**(2026-09-26:中转站打开电脑面板时标签浮在屏幕之上,即此坑。)
- 手机竖屏会显示"请横屏游玩"遮罩(`#rotatePrompt`,触屏+竖屏才触发)。
- 启动时序:base64 纹理异步解码,靠 7 个 `texture.on('update')`(bgLight/bgDark/charClosed/charOpen/pcCase/**relayBg/chairSprite**) + 前 60 帧 `layoutFixTicker` 兜底重排,不要删。**新增纹理必须加 update 监听**,否则 layoutRelayScene 等函数会在纹理未就绪时计算,除以0导致 NaN 边界(已踩过坑:中转站行走边界完全失效)。
  - `dist/` 模式下纹理是真·异步 URL 加载(时序比 base64 更晚),**已实测这套兜底仍然够用**(2026-09-10 真实浏览器验证 18 个素材全部就绪、纹理尺寸正确、布局一致)。但以后若新增依赖纹理尺寸的布局,dist 模式要再验一次。
- layoutRelayScene 中有纹理未加载时的默认尺寸保护(rbgW=1672,rbgH=941),避免除以0。新增依赖纹理尺寸的布局函数时建议同样保护。
- **WebGL 上下文兜底(2026-10-13)**:移动端切后台时系统可能强制回收 WebGL context(Pixi 自身有丢失/恢复处理:preventDefault + 纹理重传)。模板「启动」段补了玩家侧:丢失瞬间 `saveGame()` + 全屏 DOM 提示 `#ctxLostPrompt`(8 秒未恢复改提示刷新,进度已存),恢复后 `safeRelayout()` 强制重排。⚠️ 自带的 `e.preventDefault()` 不能删——不调则 `webglcontextrestored` 永远不触发;与 Pixi 的监听并存、幂等无冲突。
- **构建自检用 `check_syntax.js`**(旧名 `_check_syntax.js` 已废弃——以 `_` 开头会被 `.gitignore` 的 `_*.js` 规则吃掉)。检查三件事:① 每个 `<script>` 块单独过语法;② 校验 `ASSETS.xxx` 引用的 key 都在 `build.py` 的 `ASSET_FILES` 中有定义(key 拼错时 `PIXI.Sprite.from(undefined)` 静默拿到空纹理、不报错,肉眼也看不出);③ `build.py` 登记的文件在磁盘上真的存在。改完模板/素材跑一次,退出码非 0 即有错。已实测能抓到"拼错 asset key"和"语法错"两类故障。
  ⚠️ **不要再把这个文件名写进 `.gitignore`**。2026-09-10 曾这么干过一次,结果它既进不了版本库、又被随后的清理脚本一起删掉,构建自检整个消失(见坑36)。
- **BGM 音频的坑(2026-09-26)**:
  - **始终外链、绝不 base64 内联**(三首 AAC 共 2.9M,内联会把单文件 HTML 撑爆)。副作用:**单文件「本体」不再自包含**,离线双击要连 `assets/audio/` 一起拷走(图片仍内联,只有音频外置)。上传 VibeHub 走 `--dist` 不受影响(音频已进 `dist/assets/`)。
  - **浏览器自动播放限制**:页面加载后不会立刻有声,要等**首次用户手势**(`startBGMOnGesture` 挂在一次性 pointerdown/keydown 上)才起播。别在 `openTuneScene` 里期待 `setBGM` 马上出声——手势前 `setBGM` 只记目标轨、不播。
  - 本地 `server.js` 把 `.m4a` 报成 `application/octet-stream`,`<audio>` 靠内容嗅探仍能播(实测 `canPlayType('audio/mp4;…mp4a.40.2')`=probably、时长可解码);VibeHub 若给正确 MIME 更稳,无需为此改 server.js。
  - 换轨是**交叉淡入淡出**(`bgmFade` 用 setInterval 改 volume),不是硬切;`closeTuneScene` 会先 `settleGame` 再切回上一首,别把这两步顺序写反。
  - **轨懒加载(2026-10-13)**:`initBGM` 不再启动即建满 3 首 Audio(原先全 preload='auto',首访一次性拉 2.9MB);建轨改走 `ensureBgmTrack(k)` 按需创建——init 只预载当前场景那一轨(默认地下室),`setBGM`/`startBGMOnGesture` 都是先 ensure 再取。只玩生产的玩家不再下载中转站/调教两首(省 ~1.8MB);首次切场景该轨现缓冲,由交叉淡入遮延迟。⚠️ 别把建轨逻辑搬回 `initBGM`(会退回全量预载)。
- **SFX 的坑(2026-10-13)**:四个操作音效(`make_sfx.py` 程序化合成,`assets/audio/sfx_*.wav` 共 ~43KB)由 `playSfx(name)` 池化播放。⚠️ **触发点必须挂手动入口,别塞进 `doClick`** —— 自动点击脚本(niger,每秒 3 次)复用 `doClick`,塞进去会 3 次/秒连响。现在挂的四处:`clickMask` 手动点击 / `createBuyItem` 扣款点 / 挥鞭按下 / 强化训练成组消除。

- **中转站人数:`relayBaseUsers`(客源)与 `relayUserCap`(并发)是一对耦合约束,改一个必须同时看另一个**。
  发放处是 `add = min(add, cap − 在站自然用户)`,**谁小谁说话**。2026-10-12 前 `cap` 上限 12 < `base` 上限 24,
  base 从 12 往上那半条整条是死的 —— 于是「只提信誉分辨率」实测收益一分不动,极易被误读成「信誉对客流没影响」。
  ⇒ 改完**必须**跑 `node sim/verify_users.js`(42 项,秒级)与 `sim/tune_users_scan.js`(两旋钮交叉对照)。
  信誉**硬顶 100**,算天花板别用 >100 的值(会得出游戏里到不了的假上限)。
- **中转站「瓶颈提示」是两行不换行绘制(2026-10-13 起)** —— 每行各自不折行,超了不报错、JS 无异常,只会静静画出面板边界。
  可用宽 = `(屏宽×0.88 − min(200, 屏宽×0.24)) × 0.92` → **1440 屏 982px / 768 屏 452px / 390 屏 230px**。
  槽位:每行占 22px,`priceY` 的算式里用 `bnLines`(0/1/2,由**本帧**的 `relayBottleneckInfo` 现算,别用上一帧的 `backendLive` 残留)。
  改文案前先量,**底线是「每行都不比旧单行更长」**。两种测量口径(2026-10-13 实测相互吻合到 0.5px 以内):
  ① 浏览器:`local-ui-verify` 的 `uidiag.js` → `canvas.measureText`(字体串必须与 `makeText` 的 `TextStyle` 逐字一致);
  ② 本机离线:`powershell` + `System.Drawing`(`Microsoft YaHei`, 12, Bold, Pixel)的 `MeasureString` ——
  实测 339.5 / 366.8 / 314.9px,对上历史浏览器记录的 339 / 367 / 315px,**可直接用它量**(见 `relayBottleneckInfo` 上方注释里的实测表)。
- **中转站数值改动前后一律按这个顺序跑一遍**(2026-10-13 起可一条命令 `python check_all.py`,失败即停):`node check_syntax.js` →
  `node sim/verify_users.js` + `node sim/verify_gouge.js` + `node sim/verify_price_legs.js` → `node sim/startup_loop.js`(看平账与瓶颈)→ `python build.py`。
  `verify_*.js` 是**唯一**能抓住「闸门静默失效 / 恒 0 死项」的手段(语法检查与仿真都不会报)。

## 后续待办(用户规划)

1. **中转站玩法设计**(用户亲自安排——等需求,勿抢先实现)
   - 截至 2026-10-18 的进度:**经济数值已四轮收口**(§20.11 定价链 / §20.12 人数链 / §20.14 单价腿 C2+C4 / §20.15~§20.16+§8.1 P2 四机制全部落码),考试体系两步也落了(§17.7)。现在等星光下一轮的需求。
    - **2026-10-13 §20.13 六 的候选修法已扫描完毕**(四条候选 × 四窗口,零游戏代码改动),报告见《P1单价腿决策报告.md》。
    - **2026-10-13 已落地**:C2 极价负增长 + C4 信誉愿付溢价(各 K=0.6)已进游戏代码,四窗口比值
      **1.617 / 1.375 / 1.220 / 1.157**(基线 1.15 / 0.88 / 0.75 / 0.65,长窗口不再翻转),详见《中转站设计.md》§20.14。
   - ~~P2 备料等拍板~~ **P2 四机制已全部落码收口(2026-10-15~10-17)**:§20.15 翻车+隐蔽度、§20.16 热点、§8.1 公关三(+后台面板 UI)。备料里的预警兑现:池打折 0.7 落地、方案 B 后回调到 0.85。
   - 已知未动的三处(详见《中转站设计.md》§20.11 九、§20.12 八):
     - ~~`doPublish` **保价 UX 坑**~~ **2026-10-13 已修(纯提示,不改数值)**:换标榜后价格会按新官价重钳,
     - ~~**60/90 天长窗口验证未跑**~~ **2026-10-12 晚已跑完（并补了 D180）—— 结论翻转：诚实÷跑分 1.15(D30) → 0.65(D180)**。
       好消息是「信誉换客流」长期稳固（D180 诚实线 18 人 / 信誉触顶 vs 跑分线 0 人），**病根在变现单价（$0.16 vs $60）不在客流**。
       完整数据与候选修法见《中转站设计.md》**§20.13**；**下一步该动「单价」那条腿，候选三条列在 §20.13 六，等星光定**。
     - ~~**≤768 宽屏下中转站「瓶颈提示」整行溢出**~~ **2026-10-13 已修**:拆两行(`text`/`text2`)+`priceY` 槽位算式改用 `bnLines`;
2. ~~音频补全~~ **已完成(2026-10-13)**:BGM 三场景各一首(外置、轨懒加载)+ 四个操作音效(点击/购买/挥鞭/消除,`make_sfx.py` 程序化合成)已接进 `playSfx()`,消费「音效音量」滑条。想换更精致的音色,替换 `assets/audio/sfx_*.wav` 即可,代码零改动。
3. ~~发布 VibeHub 前的适配~~ **已完成**:体积/缓存模型已落地(`--dist` 模式)、移动端适配已做(方案 A + `touch-action:none`)。
   剩下真正发布时的动作见「发布前检查清单」(字体子集化**已完成 2026-10-16**:DSHGameCN 兜底子集 344KB;封面截图待备)。
4. 离线收益:**tokens 离线补发已实现**(模板「离线收益」段,`loadGame` 按 savedAt 差补);剩余 = **中转站侧离线推进**(离线时刀乐/信誉/用户要不要结算、封顶怎么算)——用户说放到后面考虑
5. ~~考试体系重构(未落码)~~ **已两步落码(2026-10-17,§17.7)**:60 天 8 档阶梯 + 会话式状态机 +
   隐藏阈值(先降后升)+ 作文比赛式限时提示点选 + 方案 B(小考只给 token;市级以上给信誉/用户)。
   文案池也已入库(§17.8:54 条内心戏 + 12 张提示卡,改文案跑 `python sync_exam_text.py` + `make_font_subset.py`)。
   **剩余尾巴**:① ~~补贴定价粗估~~ **2026-10-18 已重标(§8.2)**:现行 0.005 全窗口验收通过,保留;
   ② 事前预警只做了浮字,还没做成可点入口;③ 诚实线长窗口偏强(D180 60.39)——**待观察,不先动**。详见 §17.7 六 / §8.1 五 / §8.2。

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
- **全局资源域名开关 `ASSET_BASE`**(2026-09-22 加):`build.py` 顶部读环境变量 `ASSET_BASE`(默认空 = 同源相对 `assets/…`),非空自动补结尾斜杠,同时前缀到 `ASSET_FILES` 路径表**和** pixi 外链。**决策:不用对象存储**——图片继续随 `dist/` 一起上传 VibeHub、吃平台 1 年哈希强缓存(实测 dist 版内联 base64 图片 0 个、外链 webp 25 个)。此变量只是留口:将来真要搬 OSS/COS/R2 或 CDN,`ASSET_BASE=https://域名/ python build.py --dist` 一行切换、代码零改动(届时先过跨域 WebGL 纹理的 CORS + 平台 CSP 两关)。单文件模式不受影响(仍 base64 内联供离线双击)。
- **背景音乐 BGM(2026-09-26 加,始终外置)**:三首场景曲(`assets/audio/` 下 `bgm_basement`主生产 / `bgm_relay`中转站 / `bgm_tune`调教)。源 mp3 先 ffmpeg 压 128k MP3,再改 **AAC 64k(.m4a)**——`地下室 1.1M / 中转站 0.6M / 调教 1.2M`,合计 **11.4M→2.9M**;AAC 同码率音质优于 MP3 且 iOS/安卓/桌面全支持(浏览器 `canPlayType('audio/mp4; codecs="mp4a.40.2"')`=probably,实测元数据可解码)。`build.py` 顶部 `AUDIO_FILES` 清单 + 模板 `<script>__AUDIO__</script>` 注入 `const AUDIO` 路径表。**关键:音频两种模式都走外链、绝不 base64 内联**(否则单文件 HTML 会从 2.4M 暴涨)——单文件 `index.html` 引相对路径 `assets/audio/*.m4a`,dist 引 `ASSET_BASE + assets/bgm_<name>.<hash>.m4a`(哈希强缓存)。⚠️ **代价:单文件「本体」不再完全自包含**,离线双击要带上 `assets/audio/` 文件夹一起(图片仍内联,只有音频外置)。游戏内 `BGM` 模块(`initBGM/setBGM/startBGMOnGesture`)用 `new Audio` 循环 + 交叉淡入淡出,按 `openTuneScene/openRelayScene` 及各自 close 切场景;**受浏览器自动播放限制,首次用户手势后才起播**。

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
  实测:把模板里用到的字符(631 个不同字符,其中 532 个汉字)子集化成 **WOFF2 约 198KB**。
  **字体选择(2026-10-13 定)**:源字体别用微软雅黑 —— 其许可不允许再分发子集文件,发布即踩版权坑;
  改用开源可嵌入字体(思源黑体 Source Han Sans 等 OFL 授权),子集化后随 dist 分发零风险。
  **可做可不做**:若只面向桌面/主流手机浏览器,风险低;若想稳,发布前子集化内嵌。

### 发布前检查清单(真正发布时逐条过)

1. 重新拉取 `/api/skill` 并按其步骤安装/更新官方 CLI(不是用本文档的记忆)。
2. **`python build.py --dist --release`** 产出干净目录(2026-10-13 起发布必须带 `--release`:自动剔除调试块,
   并对产物做「零调试痕迹」断言 —— 密令开关、覆盖表读写、编辑器调试按钮、编辑键盘输入全部消失;
   只读属性面板与搜索框是玩家功能,保留;有残留会直接构建报红)。确认顶层有 `index.html`,且不含源码/`.git`/raw 素材。
   ⚠️ dist 含三首 BGM(`dist/assets/bgm_*.m4a`,约 2.9M)+ 四个音效(`dist/assets/sfx_*.wav`,~43KB):首访会下载它们(之后吃 1 年哈希缓存)。别误当"多余文件"删掉。
3. 准备封面 + 截图(≤6 张)放进部署目录内部;准备好 UTF-8 的描述文件(≤2000 字符)与更新说明文件。
4. `vibehub whoami` 已登录则复用,不要重复 `login`。
5. `vibehub metadata` 取真实 category/tag ID,不要自己造。
6. 首次发布前**分两次独立询问**用户:是否开启共创、是否配置 GitHub 自动部署。不得代答、不得代接受协议。
7. 首次发布用 `deploy`(带 `--name/--slug/--dir/--description-file/--note-file/--category-id/--tag-ids/--cover/--screenshots`);
   后续更新用 `update` + `vibehub list` 里的**精确 slug**(禁止用作品 ID/模糊名/标题猜)。
8. 发布成功后回传 CLI 输出的作品链接。


## 仓库状态与提交

> 更早提交史见下方各分节;`index.html` / `dist/` 按 `.gitignore` 不入库,`.workbuddy/`(会话记忆)也不入库。

### 2026-10-22 §24 考试独立场景(星光:考试不是正常游戏,是来到考试的环境)

- **素材**:考场试卷照 2529KB → **90KB**(1280 宽 webp q82)、思考气泡 10KB;注册进 `ASSET_FILES`
  + 模板 `ASSETS.exam_bg / ASSETS.think_bubble`(单文件 2621→2768KB)。
- **examScene**(照 tuneScene 模式):背景 cover 铺满 + 压暗 0.34;`setProductionLayersVisible(false)` 隐生产 UI;
  只留左上角进度条(剩余游戏时 + 得分 + 已抓灵感数);`openExamScene/closeExamScene` 挂进 `startExam/settleExam`。
- **灵感卡放大 2×**:52~120×26 → 104~240×52,字号 22;**命中与绘制统一走 `examHintRect()`**
  (两处各写一份 = 卡片放大后点空,这正是上一轮「无法点击」的元凶之一)。
- **右下角模型 + think_bubble 气泡**显示内心戏;`examThinkLine` 统一剥句末标点、以「……」收尾(星光要求)。
- ⚠️ 坑:`examSceneOpen`/`examHintRect` 是模块级函数/变量,沙箱抽 `examTick` 时进不去 ⇒
  必须 `typeof` 守卫 + `exF` 抽取(否则仿真 ReferenceError,§20.14 同类)。
- `/test` 指令改为**直接进考场**(startExam 内部 openExamScene),不再跳训练面板。

### 2026-10-22 §24b 考场八项修正(总根因:清空容器的一行被误删)

- **一个 bug 解释三个现象**:清理误插代码时把 `examLayer.removeChildren()` 删了,而该函数每 0.25s 重绘一次 ⇒
  每次叠一整层、旧的永不销毁 → ①**气泡叠印**(看着两个聊天框) ②**卡片不消失** ③**点不中**(点到过期命中层)。
- **层级**:`examScene` 原照抄 tuneScene 插在 topbar 之下 ⇒ topbar/底部标签/**未关的榜单面板**全盖在考场上并继续吃点击。
  改为 stage 最上层;开场景时 `closeScreenPanel()` + 隐 topbar/TABS/生产 speechBubble,关场景全部还原;
  背景与压暗层加全屏 hitArea 吃点击(否则漏到下层)。
- **时长**:1 游戏时 = 60 现实秒 ⇒ 旧 4~48 游戏时 = **罚站 4~48 分钟**。八场全压到 1.0~3.2(60~192 秒);
  卡节奏同步重排:间隔 27~15 秒 → **8~4.5 秒**,存活 66~27 秒 → **13~7 秒且后 40% 淡出**,首张 18 秒 → 4 秒
  (旧配置整场只冒 2~4 张:既没有《中国式家长》「灵光一闪赶紧抓」的手速感,又像卡挂着不走)。
- **内心戏占空比**:`thinkUntilH` +2.5 游戏时(150 秒,比整场考试还长)→ 0.1~0.16(6~10 秒),说话才显示。
- **人物大小**:旧 190×260 偏小 → 与 `layoutCharacters()` **同一套公式**(targetH=min(340,h*0.4),基准 400)同源,不再两处各写一份。
- **进度条避让**:`barY` 20 → 82(左上 62px 是设置按钮活动区)。
- **面板兜底**:上一版把面板内渲染写成 `&& false` = **永久关掉**(存档重载时正卡考试会两眼一抹黑);
  改为「考场没开才退回面板渲染」。
- **两条断言的设计缺陷暴露**:时长一短就误报,因硬编码跑 60 tick(恰等于旧 1 游戏时),违反「断言从沙箱读值」铁律;
  改从会话反推 `halfTicks = ceil((endH-startH)*60*0.5)` 且只跑半场,结算留给后面的 while(⑨的 st0/rt0 不被污染)。
- 全链 42+20+**243**=**305**。⚠️ 一次链失败查明是**跑长仿真时并行跑其它 node 抢内存**掐断跑分线
  (手动重跑 exit 0、两线 SUMMARY 完整、stderr 空)——不是代码问题;已进 MEMORY「长仿真期间禁止并行 node」。

### 2026-10-21 §23 管理员指令 `/test`(考试选择器)

- **入口**:榜单搜索框(中转站→榜单)输入 **`/test`** 回车 → 下拉列出全部 **8 场考试**
  (名称 / 开考天 / 持续游戏时 / **隐藏及格线** / 是否已过 / 当前是否在考)→ 点任意一场
  **直接开考并跳到训练面板**。
- **实现**:复用 `startExam(idx)`(与正式流程同一个函数,不另造 examSession) + `panelTab='train'` + `layoutScreenPanel()`。
  不检查考试阶段/天数限制 —— 纯调试,用来快速验证文案、卡片手感、结算逻辑。
- **⚠️ 刻意不放进 `__DEBUG_STRIP__` 块**:这是**管理员功能**,发布后仍需可用(线上排查全靠它);
  与 `/admodel`(开发者调试,`--release` 会整块剔除成 `return false`)性质不同。实测 `--release` 产物:
  `/test` 完整保留、`/admodel` 已失效 —— 符合预期。
- 修了一个自己写出的结构错误:初版把 `tryTestCmd` 插进了 `tryAdmodel` 内部(多了一行函数头),
  语法能过但函数嵌套错误 ⇒ 已删多余函数头。**这类「语法通过但结构错」的错误,`check_syntax` 抓不到**,靠人工读结构。
- 断言 [19] +3(`/test` 存在且挂载顺序 / 复用 startExam 与跳面板 / 列全 8 场含及格线);全链 42+20+**243**=**305**。

### 2026-10-21 §22-C 考试文案趣味化(星光:「可以搜搜 b站或者贴吧,例如说大肥鱼等」)

- **动机**:原池 A–O 整体偏「技术自嘲 + 报告体」(如池 C「结果显而易见了」「事实核对完成」),B 站/贴吧味不足;
  池 O 里只有零星两条梗(大肥鱼 / 爱华tv)。
- **做法**:给**每个池**补「弹幕口吻」类条目,不只是堆在池 O:
  - 答对池:「这波我赢麻了」「有手就行。诶我没有手」「**弹幕**:已过 / 在大气层」;
  - 答错池:「这波是我菜了,下次一定」「**弹幕**:就这? / 破防了 / 建议回炉重造」;
  - 工具调用:「我把 String 写成了 Sting,系统沉默了 3 秒」「面向报错编程」;
  - 多模态:「视力 5.0 / 建议换眼镜」;
  - 速度:「抢答了,抢在问题说完之前」。
- **大肥鱼主线**(DeepSeek 鲸鱼梗,B 站「闹鱼灾」「大肥鱼成精刷 B 站」那批):池 O 从 1 条扩到 6 条:
  「大肥鱼又摸鱼了,这题是我硬扛的」「闹鱼灾了,算力被大肥鱼拿去刷短视频」
  「大肥鱼在 B 站刷视频,让我先顶着」「这波啊,这波是大肥鱼的胜利」。
- **贴吧口吻**补进池 O:「前排,蹲一个大佬解答」「沙发。这题我坐下了」「已阅,建议加大训练强度」
  「我寻思这不是 RAG 吗」「这模型还行吧,就是有点呆」。
- **灵感卡(池 P)从 12 条扩到 24 条**,且**属性覆盖补齐**(7 维 2~4 条不等),
  短句都控制在一行内(卡片只有 26px 高):「这题有手就行,别想太复杂」「这是 2024 年的事,别编 2025」
  「用户要 3 句,就 3 句」「别再说『希望能帮到你』」「数清楚,别多算两个」。
- 流程:`改考试文案池.md → python sync_exam_text.py → make_font_subset.py → build`,代码里 EXAM_HINTS 是**生成物**。
- 池 A–O 共 130 条、池 P 24 条(原 39+12);字体子集从 1465 → **1502 字**。

### 2026-10-21 §22-A4 拟合惩罚下调 + 考试按比例回拉(星光定)

- **`CAP_FIT_PENALTY` 0.35 → 0.18**:fit=30 的降幅从 -18% 降到 **-9.2%**(两端最大扣 29%→15%)。
  欠拟合开局「有代价但不致命」,又不锁死经济 —— 这是 §22-A 诊断出「30 天买不起道具」后的对症处置。
- **考试回拉:固定 -4 → 按偏离度成比例(双向)**,`newFit = 70 + (fit-70)×(1-0.35)`:
  - 双向:低于 70 往上涨、高于 70 往下降;
  - 越远离 70 给得越多:偏离 40 → +14 点,偏离 10 → -3.5 点;
  - **单调不会拉过头**:80→76.5、75→73.25,`76.5 > 73.25` ✓(正是星光要求的那条);
  - 5 场考试能把 30 拉到 65.4(固定步长要 10 场),且**不花刀乐**。
- **效果(D30 诚实线)**:刀乐 $1.16 → **$2.16(+86%)**、用户 0→**1 人**、已卖 0.98M→1.30M、翻车/识破 24/45→14/30;
  跑分线 $2.56,**跑分÷诚实 1.19**(原始基线 4.71,健康带内)。
- ⚠️ **道具仍是 0 次**(刀乐 $2.16 < 最便宜 $3)⇒ 证明「考试给拟合度」这条不花钱的路是**必要兜底**,不是锦上添花。
- 断言 [19] +2(惩罚常量 / 按比例双向拉 + 沙箱实测单调性);全链 42+20+**240**=**302**。

### 2026-10-21 §22b 购买概览显示拟合度变化(星光澄清:要的是**购买时的概览**,不是只有机制)

- 第一版只做了机制(fit 训练时涨),**漏了道具卡概览行** —— 玩家买之前看不见后果。
- 概览行: `得到 推理+1.2  ·  拟合 42→49`(用 → 而非只报增量:拟合是有最优点 70 的**状态量**,
  玩家要判断的是「会不会越过去」);
- 代价行: `fitNext > 70` 时追加 **「· 拟合将过优(掉能力)」** 并整行转紫(过拟合=紫,与 HUD/雷达图一致);
- 布局兜底:概览行变长 ⇒ 超宽按比例缩字号(遵守「canvas 文案单行不换行」),代价行同理。
- 断言 [19] +3;全链 42+20+**238**=**300**。

### 2026-10-21 §22 拟合度养成闭环(星光:初值改低为 30 / 训练伴随拟合度涨落 / 玩家关注维持)

- **初值 70→30**:《设计》§43 原始值就是 10,2026-10-03 改 70 是权宜(当时 fit 无提升途径怕摁死玩家);
  §22 补了涨落途径 ⇒ 前提解除。开局 fitMul≈0.72(掉 22~28% 能力),雷达图拟合轴明显缩进 = 一眼看出欠拟合。
  能力曲线实测:fit 10→2.84 / 30→3.29 / 50→3.70 / 70→4.01 / 100→3.50。
- **三条涨落规则**(对齐《设计》§585「训练方法给 Δ属性 + Δ拟合,玩家自己决定何时收手」):
  ① 训练推高:每件道具自带 fitDrift,**练得越专一推得越猛**(toolkit 7 / eyes·ear 6 / gym 5 / 双维 3~3.5 / 小道具 1.5),
     全部练满总推力 431 点(30→70 只要 40 点,可达性充足);
  ② 空闲回落:每游戏时 1.2 点,**只收超出最优点(70)的部分** —— 欠拟合侧不自动改善(那必须靠练);
  ③ 考试回落:每场 -4 点(考试=泛化检验,现实里 eval 就是在发现过拟合)。
- **界面**:训练页 HUD 显示「拟合 42 欠拟合」,三态配色(欠拟合橙 / 良好绿 / 过拟合紫)。
- ⚠️ **基线迁移**:诚实线刀乐 2.38→**1.16**、用户 4→**0 人**。但根因是**仿真没有买训练道具的逻辑**
  (startup_loop 全文没有 useTrainItem)⇒ fit 永远停在 30 ⇒ 永远欠拟合。
  fit=70 时「不训练也能用」、fit=30 时「不训练就废」—— 恰好说明拟合度成了真约束。
  **下一轮必须先给仿真补训练策略**,否则测的是玩家不会走的路线。
- 断言 [19] +6;全链 42+20+**235**=**297**。

### 2026-10-21 §19.15 训练页卡片放大 + 消耗写明

- **卡片放大**:高 40~60→**48~76**、间距 8→10、图标 ≤36→**≤44**、名称 14→**16**、价格/代价 12/11→**13/12**;
  新增右侧**「使用」按钮**(圆角块 + 使用/进行中/已满 三态,独立 hitArea,与整卡热区等价)。
  动机:原来整卡是热区但**没有按钮观感**,像只读列表。
- **消耗写明**(星光「写清楚进入消耗」):
  `$1.20 · 8算力` → **`消耗 $1.20 + 8 算力`**;`进入 2算力 · 12.0K token` → **`消耗 2 算力 + 12.0K token 开局`**;
  `每步 -120` → **`每步消耗 120`**;`闭关 30min` → **`闭关中 剩 30 分钟`**。
  动机:原文案把花费和所得混在一行、用 符号区分,玩家得自己推「这数字是我付出去还是拿到的」。**付费信息必须直说。**
- 断言 [19] +5;全链 42+20+**229**=**291**。
- ⚠️ 踩坑:按行号 splice 插断言时插到了另一条 ok() 的**续行**中间,把条件挤开、`}` 提前闭合 ⇒ 语法崩。
  教训:**插断言前先确认目标行是「断言开头」不是「续行」**。

### 2026-10-21 §19.14b 结算卡死真因:ticker 裸读 gameState(二次反馈「还是会卡住」)

- §19.14 判断错层(以为是 pointerdown 里摧毁事件目标),延帧重建**没修好**。
- **真因**:§19.13 加的 `updateTallyPulse` 由**主 ticker 每帧**调用,里面裸读 `gameState.mode.colors[i]`;
  `settleGame()` 置 null 后下一帧抛 TypeError ⇒ **PIXI ticker 整条终止** ⇒ 画面冻结+点击全无响应(永久假死)。
- 为什么兜底的 `!tuneGameTallyTexts.length` 挡不住:`layoutTuneScene` 延帧才清数组,这期间它是旧的非空数组。
- 修:`if (!gameState || !tuneGameTallyTexts || ...) return;` + `const cols = (gameState.mode && gameState.mode.colors) || [];`;
  同类加固 `gameRefreshHud()` 开头补 `if (!gameState) return;`(会被坠落 setTimeout 调到)。
- 通则:**ticker/rAF/setTimeout 里碰全局状态一律按可空处理**(抛异常=整条循环挂,不是画错一帧);
  **判空要看真正被解引用的那个变量**,不是旁边那个。
- 断言 [19] +3;变异 M9/M10 全抓;全链 42+20+**224**=**286**。

### 2026-10-21 §19.14 结算卡死修复 + 方块重力坠落

- **结算卡死根因**:`sg.on('pointerdown')` 里调 `settleGame()+layoutTuneScene()`,后者 destroy 掉
  `tuneGameLayer`(含正在派发事件的 `sg` 自身)⇒ PIXI 冒泡途中失去目标 ⇒ 后续点击全落空(方块/结算都静默 return)= 死区。
- **修法**:`tuneGameSettling` 锁 + **延到下一帧重建**;`rebuildTuneGameLayer` 同样延帧(`tuneGameRebuildQueued` 合并);
  同步版另存 `rebuildTuneGameLayerNow()`。通则:**事件处理器里别摧毁自身**。
- **重力坠落**:`clearAndDrop` 返回 `{board, moves:[{c,toR,fromR}]}`(`fromR=-1` = 顶部新生成);
  视觉层按 moves 逐格 `gtween` 从源行补到目标行(0.34s),新块从棋盘上方错开高度掉入;坠落期锁输入。
- 新增 `cancelTweensOf()`:同对象两条同属性 tween 会互扯(都以当前值为起点),摆位前先清。
- 断言 [19] +5(结算不自杀/重建延帧/moves 映射/坠落补间/旧 tween 清理),全链 42+20+**221**=**283**。

### 2026-10-21 §21.3 相似度三次收紧 + 调教小游戏三项反馈(星光:「严格一点吧」+ 维度特效/步数/拒绝反馈)

- **相似度**:`CAP_SIM_T0` 0.35→**0.25**(容差 1.42×→1.28×)、`CAP_SIM_W` 0.3→**0.4**;
  偏科 cap57 从 Hy3 c41.7(0.73) 跳到 **Hunyuan Hy4 c65.6 旗舰(1.15)**;偏低/满配不变(1.02/0.92)。
  均衡画像仍 0.78 —— 属性太平均,再收紧会拆散相邻档的正常配对,故停在此(已写进设计 §21.3)。
- **维度数值**(§19.13):14→**17px**;块数变化时 scale 冲 1.32× 回落(260ms)+ 变亮绿,由主 ticker 驱动(不新开 rAF);
- **剩余步数**:18→**24px**,按紧张度配色(>8 米白 / ≤8 橙 / **≤3 红**);
- **点不动给反馈**:原来静默 return ⇒ 加 `gameReject()`:棋盘抖 220ms + `sfx_reject`(程序化 220→110Hz 双音下坠)+ 步数闪红;
  覆盖三种拒绝(步数用完/token 不够/点孤块);抖动基准存 `tuneGameShakeBase` 防漂移;
  拒绝音进 `SFX.names` + `build.py:AUDIO_FILES` + `make_sfx.py`(生成 21KB wav)。
- 断言 [19] +5 项,全链 42+20+**216**=**278**。基线:诚实 2.22→**2.38**、跑分 2.60→**2.73**,跑分÷诚实 1.15。

### 2026-10-20 深夜 §21.2 相似度再收紧:门槛后平方(星光:「可以稍微严格一点」)

- §21.1 的线性 cap 项把中高段拉正(偏科→Hy4 比值 1.15、均衡→Grok 4.5 0.96),但**低段仍贴低档**(cap33→cap16 0.48)。
- 改为 **相称容差 + 门槛后平方**:`|log比| ≤ 0.35`(1.42 倍内)不罚,超出部分 `× (超出/0.35)² × 4`;
  差半档几乎不痛、差一倍明显痛(罚 0.42,远超属性距离典型值 0.05~0.3)、差四倍基本排除。
- 8 组候选标定扫描:W=0.3/T0=0.35/平方 最优(偏低 1.02、满配 0.92 两个极端都相称)。
- ⚠️ **偏科/均衡停在 0.73~0.78 不是缺陷**:这两个画像属性上本就与低 cap 模型更近,
  拉住它们的是属性距离而非 cap;强行对齐会破坏「属性相似」这个核心判定。练什么就标榜相近属性的模型 = 设计本意。
- **基线(vs §21.1)**:诚实线刀乐 1.38→**2.22**(用户 2→**4 人**、已卖 1.22M→1.55M,经营更健康);
  跑分 1.73→**2.60**;跑分÷诚实 1.25→**1.17**(更贴近设计意图;原始版是 4.71)。
- 断言 [20]① 阈值 0.4→**0.6**(实测 0.73 留余量);全链 273 不变。
- ⚠️ 诊断方法教训进 MEMORY:**手写复刻算法会因沙箱常量名不匹配而静默产生 NaN**,
  本轮「扫描五档取 0.3」的依据全是废数。诊断必须调沙箱本体函数,要试参数就改模板常量重跑。

### 2026-10-20 夜 §21.1 相似度判定:最近邻必须能力相称(星光:「cap这么高,接近的模型还是很低级的」)

- **病灶**:`closestModel` 只用 8 维属性距离(cap 是派生量、不在 SIM_KEYS),叠加 `SIM_OVER_K=0.3`
  「我更强按 0.3 折减」⇒ 全面碾压弱模型几乎零代价,最近邻系统性偏向全库最弱那批:
  实测偏科学员 cap57 的最近邻是 **cap16 Qwen2.5-7B**(相称价 $0.20)。
- **修法**:距离加 `CAP_SIM_W × |log(我cap / 它cap)|`(capW 扫 {0,0.15,0.3,0.6,1.0} 取 0.3);
  只改 `closestModel`、不动 `rawSimilarityTo`(cap 已在 capMul 里,再塞会重复计入)。
  效果:cap57→DeepSeek V4 Pro(c57 中端)、cap50→GPT-5.4(c51)、cap100→GPT-6 Astra(不变);档位单调上升。
- ⚠️ **踩坑回退**:先试过给 `capMulTo` 加软饱和消除 200 撞顶,但它整体抬高 similarityTo ⇒
  越过 SIM_GATE(80) ⇒ 虚标折价闸整层失效(刀乐 +558%)。已回退,`CAP_MUL_SAT_K=0` 留作实验旋钮。
- **基线迁移(预期内)**:已卖/标榜/价格/翻车/识破**逐项一致**,只有刀乐动:诚实 0.24→**1.38**、跑分 1.13→**1.73**;
  跑分÷诚实 **4.71 → 1.25** —— 修前那个 4.71 是「相称价判错 ⇒ 惩罚比例判错」的产物。
- 断言 **[20] 段 6 项**(最近邻 cap 比值/高配溢出/撞顶只影响显示/档位单调/cap20 停低档/cap100 到旗舰),全链 42+20+211=**273**。
- ⚠️ 事故:[20] 第一版插在结果行之后 ⇒ 假绿(实为没跑);`$'` 陷阱复发;内存两次耗尽导致 worker 崩溃。三条已进 MEMORY。

### 2026-10-20 晚 §19.12 右列「标签+状态同行」+ 弹窗整体放大(星光截图二连:「略有重叠,放开一点,字体大一点」)

- **右列重排**:增长/续约的「状态」不再独占一行(会压到下一个标签),改为与标签**同行**(状态 x 链在标签宽后 +10);
  行距 30、字号 12→13;用量合并行、速度行同步。右列 4 行到 infoY+90,均在警告行(124)之上。
- **弹窗整体放大**(§19.10 的追加):三个内容弹窗上限 640/780/860→**720/900/980**、桌面占比 0.74/0.86/0.9→0.8/0.9/0.94;
  发帖 760→860/占比 0.92/高 0.78;公关/发布确认 460→520、桌面占比 0.8;
  **窄屏字号增益 fsK ×1.15**(三个内容弹窗,星光:「小屏看的清」——窄屏卡片相对更大,字也跟着抬一档)。
- 断言 [19] 段 +5(同行×2/字号行距/增益/上限),全链 42+20+205=**267**;变异 M7(回退上下排)/M8(删增益)全抓。
- 字体子集重跑 1450 字(358KB);单文件 2594KB、dist 首访 5430KB。

### 2026-10-20 午 §19.11b 后台数据区 v2:修三层叠印(星光截图「中转站的字体重叠了」)

- **根因**:v1 把 22px 大数(占高 ~31px)与结论(+20)/公式(+44)按「基线偏移」排相邻行,全落进大字字面范围 ⇒ 三行叠印。
- **v2**:大字与「偏涨/掺水」结论**同行**(横向链式 x,`vdT.x = simBig.x + simBig.width + 10`);公式/参考价各占整行;
  右列阈值线行距 18→20/24;瓶颈/priceY 基准 116→124、警告增量 22→24;参考价数值与大字左缘对齐(+62)。
- 断言 [19] 三锚同步 v2(从模板 grep 原样复制);变异 M5(回退叠印)/M6(槽位回退)全抓。全链 42+20+202=**264**。
- ⚠️ 流程教训进 MEMORY:**断言锚必须 grep 实际文本再嵌**,别凭设计稿记忆(v2 连红两轮:labY+32 记成 +30、*22 记成 *24)。

### 2026-10-19 晚 §19.9~11 四件 UI 优化(星光截图反馈:鞭打掉椅 / 弹窗小屏 / 数据重排 / 音乐淡变)

- **鞭打坐姿保护**:受击恢复的 `ai.state='idle'` 无条件写 → 加 `!== 'sitting'` 守卫(坐着挨打完继续坐);
  受击冻结分支内补贴桌对齐(防受击期间改窗口尺寸「滑出椅子」)。根因:受击期间 state 一直是 sitting,
  是恢复那一下把坐姿抹成 idle ⇒ 观感「被打飞下椅」。
- **弹层自适应**:`popupGeom` 助手(窄屏 pw<560 占比 0.97 + 卡片高钳进可视区 + 行高均分 + fsK 缩字),
  接入属性/经营/训练说明三弹窗;发帖与公关/发布两确认弹窗窄屏也放大。桌面几何几乎不变(行高上限放宽 1.3×)。
- **后台数据区重排(图1)**:左列决策三件套(标谁 / 有效相似 22px 大字 + 偏涨/掺水 / 参考价带划线),
  右列增长·续约·用量三线状态着色 + 速度换算;删 cap/门槛/行尾定价冗余;`priceY` 槽位公式同步。
- **BGM 淡变 300ms→1s**;淡出完 `pause()` 保留 Audio 对象(下次切换零等待、暂停不占 CPU)——回答「会不会变慢」:不会。
- 断言 [19] 段 11 项 → 全链 42+20+202=**264**;变异 4/4(补 M3 漏网后的钳高锚)。
  另补「左列公式行不含 cap」一致性锚(文档说删了、代码却留着 → 按文档口径删,顺带解决手机横屏 3px 余量压右列)。
- ⚠️ 三条新教训进 MEMORY:① `String.replace` 替换串含 `$'` 会崩(拼代码用 slice+join);
  ② slice 截断重建误删 [17][18] 只跑 177 项却「全绿」→ **改测试必核对总数**;③ 结构断言只钉调用点钉不住
  helper 内部语句(M3 变异漏网)→ 钉到实现语句。

### 2026-10-19 下午 §8.4 发布确认弹窗(「点一下不得直接发布」在发布页的落实)

- 星光的原始痛点其实落在**发布页**:策略选择点了只是下一步,但「实话实说」与模型列表行**点一下就真发布**
  (立即生效+锁标榜+自动存档)。§8.3 只处理了公关策略,本轮把同一条「行为一致律」推到 doPublish 的全部入口。
- 实现:确认弹窗 `drawPublishConfirmBox`(接模态链**最前**,先于公关确认)——显示策略/相似度/锁定期/信誉代价预览,
  对标不达相似度门槛时给「确认也会被退回」警示;**「确认发布」handler 先清 publishConfirm 再 doPublish(防重入双发)**。
- 护栏加一圈:关面板/切 tab/back()/预警跳转四处复位;弹窗开着时滚轮不翻背后的模型列表;可见性链纳入 publishConfirm。
- 断言 [18] 段 8 项(含 doPublish 调用点总数=1 的反证式锚、handler 只置弹窗、重入顺序、滚轮护栏),
  全链 42+20+191=**253**;变异 3/3(回退直接发布→双锚报红/确认不清状态→顺序锚/删滚轮护栏)。
- ⚠️ [17] 的 visible 链锚写死了行尾 `);`,§8.4 在链尾追加后它立刻变红——断言应钉「存在行」不钉「位置」,已改。
  教训:**会追加新分支的链条,锚别把「自己那行恰好是最后一行」写进期望**。
- 字体子集重跑无新字(357KB,弹窗用字与既有池重合);单文件 2590KB、dist 首访 5424KB。

### 2026-10-19 午 §8.3 预警可点横幅 + 公关确认弹窗(星光「开 A」+「点一下不能直接执行」)

- 预警不再只有飘 0.9 秒的浮字:右上角常驻横幅(风险 N% + 点击直达后台并一次性强高亮公关栏),
  随 `relayHourlyRefresh` 刷新、到期自动隐藏;`prWarnBannerState` 抽纯函数可沙箱直测。
- 四个公关选项**一律**点击→确认弹窗→「确认」才写 `prPolicy`(选项 handler 不再直接赋值);
  弹窗带补贴实时价 + 买不起提示,并钉死口径「确认=只改策略,执行仍在下次事件结算时」。
- ⚠️ 自查抓出:prFocus 高亮最初没有消费点(会永久高亮)→ drawPrPanel 末尾消费 + 断言 ⑪ 钉住位置。
- 断言 [17] 段 15 项,全链 42+20+183=**245**;变异 3/3(回退直接执行/注释挂点/到期判断写反)。
  另更新 2 条 [13] 陈旧锚(「点了才生效」语义已变为「点=开弹窗,确认才写」)。
- 字体子集重跑 356→357KB;单文件 2584KB、dist 首访 5419KB。§8.1 五的两条尾巴全部划掉。

### 2026-10-18 深夜 §18.3 训练页「说明」按钮落码（纯 UI+文案，零数值改动）

- 训练页右上角「训练说明」纸页按钮 + shade/card 弹层六行：算力 / 压力 / 客户期待值 /
  **期待值只打折从不奖励**（§18.2 教学化）/ 测评阶梯 / 考试点选；文案与代码逐条核对
  （AP 每现实秒回 1、压力 ÷250、8 档隐藏阈值、重考 7 天 ×0.7、δ 每场 ≤6 点）。
- trainHelpOpen 三处复位（关面板 / 切 tab / shade 关闭）；字体子集重跑 336→356KB（新字进子集，铁律）。
- 断言 [16] 段 9 项 → 全链 42+20+167=**229**，check_all 全链 exit 0；变异 3/3。
  ⚠️ [16] 首版锚用 includes，「注释掉那行」的变异抓不到（§20.16 老坑第三次重犯）→ 改行首锚正则修正。

### 2026-10-18 晚 §18.2 客户期待值→增长倍率落码(星光「按推荐来」)

- **三条推荐全采纳并落码**:每小时、只作用增长侧(信誉结算不碰,§20.10 已有闸不双重收费);
  无门槛纯缩放(79→80 无断崖,与 cheapness/relayGrowWeight 同族);封顶 1.0(只打折从不奖励,
  防给 §17.7 已偏强的 D180 诚实线喂雪球)。
- **实现**:`RELAY_BIZ.EXPECT_GROW_FLOOR=0.4 / EXPECT_GROW_CAP=1.0` + `relayExpectMul()`(自研恒 1,§5.4)
  + 挂点 `expAdd = expAddRaw > 0 ? expAddRaw × mul : expAddRaw`(C2 净流失分支不乘,防「期待值低反而流失少」)。
- **四窗口实测逐位不变**(1.89/1.13、10.73/9.42、21.09/16.05、60.39/38.38 = §17.7)——**定位精准不是 bug**:
  追踪脚本实测诚实线 sim=136.7(钳到 1.0 零影响),跑分线走 surge 注入 + expAdd≤0 通道(不经过倍率);
  倍率真正服务中间段(sim 40~100 且定价老实)的玩家。中间段影响待 §18.2 尾的设计问题拍板(要不要咬 surge)。
- **断言**:新增 [15] 段 11 项,全链 42+20+158=**220**;变异自检 3/3(CAP→6 / 挂点删 / FLOOR→0 全抓)。
  ⚠️ 过程踩坑两次:① 断言段 new_string 漏一个闭合大括号(语法直接挂,套件首跑才发现——**写完断言先跑再写文档**);
  ② 「能力堆满⇒sim>100」的期望模型猜错(实测满配 sim=99.7),改为沙箱覆写 `similarityTo` 直测钳位分支。
- ⚠️ `check_all.py` 的经济仿真步本轮首跑遇 **exit 134(OOM)**:机器上挂着其他 node 应用、可用内存 <2GB 所致
  (同脚本单独跑 20+ 次全过)。内存紧张时跑 `--skip-sim` 或错峰;断言/构建/语法/仿真单步均单独验证过。
- 文档:§18.2 就地更正(旧「影响 relayRepSettle」设想划掉,拍板三条+实现+实测全记录,含中间段设计问题);§18.3 说明按钮解禁可建。

### 2026-10-18 下午 补贴定价重标 + 基线随机流污染修复(§8.2/§17.9)

- **重标结论:现行价保留**。`sim/subsidy_scan.py`(新工具)扫 RATE {0.005,0.02,0.05} × D30/90/180 × 3 种子:
  D30 −66.8% / D90 −11.0% / D180 −0.3%(噪声内),三档验收全过(早期别赌 / 后期近乎免费保险,§8.1 的
  「策略随进度演化」成立)。诚实线三窗口逐种子不动、36 跑全平账。
- **⚠️ 附带发现:`PR_SUBSIDY_RATE` 是死参数(早期)** —— 三档 D30 逐位同值,因为定价被
  `PR_SUBSIDY_MIN=0.5M` 地板主导(跑分线刀乐存量 ≤2,×RATE×4 天 够不着地板)。
  **要调早期价格必须连 MIN 一起扫**(§20.12 耦合坑的镜像:参数在公式里 ≠ 参数有效)。记 §8.2 三。
- **基线漂移修复**:§17.7 的 D30 基线 1.89/1.13 在 HEAD 复现不出(1.93/0.93)。worktree 逐提交二分钉死
  根因 = `a5b4a1b` 文案池把 `examThinkLine` 的展示抽取接进 `settleExam`,**每场考试多消耗一次主随机流**
  ⇒ 全轨迹重掷(§20.14 发现 3 同源,但这次是正式代码不是实验注入)。改自增游标后**逐位复现 1.89/1.13**。
  教训与锚见 §17.9;新增 8 项断言(补贴率 5 + 随机流卫生 3),全链 42+20+147=**209 项**。
- 文档:§8.1 五的「补贴粗估」划掉挂 §8.2;§17.7 六两条陈旧项(P2-2 未拍板)同步更正。

### 2026-10-18 文档对账:PROJECT.md 追上 10-16~10-17 两轮落码(本轮零代码改动)

- 上一轮(10-16/10-17)连着落了**考试体系两步(§17.7)+ P2-2 公关三选一与 UI(§8.1)+ 考试文案池(§17.8)+ 字体子集**,
  代码/断言/提交都在(`a5b4a1b` 为止,`origin/main` 已同步,无未推送提交),但 PROJECT.md 的数值链、快照、待办
  还停在 10-13 —— 本轮把「当前生效数值链 / 平衡快照 / 自检计数 / 待办 1·3·5 / 体积」全部对齐到代码实况。
- **对账时实测确认**(不是照抄设计文档):模板 8136 行 / 393KB;断言 42+20+139=201 全绿;单文件 2569KB、
  dist 首访 5382KB;`relayBaseUsers` 现含 `userBoost` 项(过期逐位回退,断言锚在)。
- ⚠️ 发现 PROJECT.md 项目结构图有一处**串行排版 bug**:根目录的 `make_font_subset.py` 被插进了 `sim/` 树里,
  与 `p2_scan.py` 那行截断文本粘连(10-16 提交带进来的)。本轮已修:根目录列表补齐,`p2_scan.py` 续行归位,
  并补记 `long_window_report.js`(10-12 转正后一直没进结构图)。

### 2026-10-17 考试体系 §17.7 两步落码 + P2-2 公关(§8.1)+ 文案池 + 公关 UI(提交 `1002ef0`…`a5b4a1b`)

- **考试**:8 档 60 天阶梯 + `startExam/examTick/settleExam` 会话状态机(替换瞬间结算的 `fireExam`);
  隐藏阈值**先降后升**(0.40/0.20/0.18/0.18/0.20/0.25/0.30/0.35);重考 7 天、奖励 ×0.7^(k-1)、重考 token **三折**
  (全额会刷出 D30 供给 28M→74M 的落榜刷钱);方案 B:前 4 场小考只给 token。**两个死锁坑**(月考卡死 / 刷钱)见 §17.7 一。
- **点选交互**:限时提示卡 +N 分(只进本场)+δ 属性(唯一带出局外,每场 ≤6 点);7 类提示对应 7 维度。
- **P2-2 公关**:诡辩(失败罚客流 ×0.36+3 天)/ 道歉 / 补贴(必成功、按收入定价)+ 事前预警;**剂量曲线**
  D30 三策略皆负(道歉 −12% / 诡辩 −20% / 补贴 −73%),**但补贴 D90 反转 +650%** ⇒ 策略随进度演化是特性不是 bug(§8.1 二)。
- **公关 UI**:后台页底部面板,事件/预警时出现,四选项写回 `R.p2.prPolicy`(`5611bb7`)。
- **文案池**:《考试文案池.md》(用户手改)+ `sync_exam_text.py` 扫描器 → 54 条内心戏 + 12 张提示卡进模板;断言 [14] 文案池段,总数 **201**(`a5b4a1b`)。
- **新基线**(首种子):1.89/10.73/21.09/60.39 vs 1.13/9.42/16.05/38.38 → 比值 1.673/**1.139**/1.314/1.573,
  **四窗口不再翻转**;取代 §20.16 表。

### 2026-10-16 P2-3 热点落码修正 + 字体子集(提交 `37d648b`…`c3fb94b`)

- `37d648b` 那次 `tools.write` 全文重写**超读取上限把《中转站设计.md》截断了**,由 `ca155fd` 自 HEAD~1 恢复 +
  按锚点追加 —— **教训:大文件(>2000 行)禁止全文重写,只用锚点 edit**。
- P2-3 热点:对称档 ±60/±20、逐段推进调度(修「时钟大跳热点整段缺席」)、type=heat 见报;断言 [11] 14 项,变异 4/4。
- **字体子集**:Noto SC 按模板用字出 woff2 兜底字体 DSHGameCN(344KB),`build.py FONT_FILES` 外链、栈末位零布局影响;
  ⚠️ **改文案必须重跑 `make_font_subset.py`**(新字在兜底设备缺字)。

### 2026-10-15 P2-3 热点档位落码(§20.16;对称档 + 逐段推进调度)

- **落码 4 处**:常量 `HEAT_*`(对称档 ±60/±20,均值 0)、`HEAT_CATS + p2CategoryOf`
  (类别 = 派生属性最突出一维,可替换简化)、`p2HeatTick`(挂 relayHourlyRefresh 开头:调度/过期/**见报** ——
  type=heat 日报条目让玩家看到「现在什么热」,这是 §7 换赛道决策的前提)、`p2HeatMul` × 进 base
  (命中当前标榜类别才生效;自研恒 1)。
- **落码即抓出调度 bug**(变异 3/5 漏网 1 的根因):初版 `heatNextH = H + 间隔` 从当前时钟起跳 ⇒
  while 永远只跑一轮 ⇒ **离线回归/时钟大跳时热点整段缺席**。修为逐段推进(`heatNextH += 间隔`),
  HEAT_MAX 天然限流(离线大跳也不刷屏)。
- **断言**:`verify_price_legs.js` 新增 **[11] 热点段 14 项**(对称性/调度/类别命中/叠加**硬编码**上限/
  过期回落/自研免疫/见报/源码锚×2),总数 **42+20+92 = 154 项**;热点变异 **4/4**。
  ⚠️ 锚正则必须排除注释行(`^  p2HeatTick\\(\\);` 带 /m 行首锚)—— 否则把挂点注释掉也算「在位」。
- **sim 防双重生效**:P2-3 注入停用(`exF p2CategoryOf/p2HeatTick/p2HeatMul + exC HEAT_CATS` 改为抽取游戏实现)。
- **自测**:`check_all` 全链 exit 0(154 项);四窗口复跑(§20.16):
  首种子 2.558/1.550/1.320/1.340 —— 诚实线 Δ≤2.3%、比值方向不一致 ⇒ 对称档是**纯方差扰动**,
  无水位线效应(对称性验收整窗口成立)。
### 2026-10-15 P2 第一批落码:P2-4 隐蔽度 + P2-1 翻车事件(§20.15)

- **落码范围**:`RELAY_BIZ.RISK_*` 14 常量 + `p2Smoothstep/p2StealthMul/p2Ensure/
  `p2FlowMul/p2PoolMul/p2CrashNews/p2RiskSettle` 函数组 + 三挂点(`relayRepSettle` 尾钩 /
  `relayHourlyRefresh` 留存与新增 ×flowMul / `doPublish` 池抽量 ×poolMul)+ `P2_RECLAMP=1` 编译期开关。
  **P2-2 公关未做(缓做);P2-3 热点仍在 sim 实验**。
- **⚠️ 险些出事故的坑**:`RISK_*` 常量最初插在了 **`PUBLISH_CFG` 里**(`SIM_GATE: 80`
  这个键同时存在于 RELAY_BIZ 与 PUBLISH_CFG,`exC` 的花括号配对在 RENEW_FLOOR 后就闭合了)⇒ 沙箱里
  `RB.RISK_*` 全 undefined ⇒ 识破永不触发,而 **118 项断言全绿、构建全过、语法全过** ——
  只有专门写的 [10] 行为断言红了。**教训:新常量必须有一条「从沙箱读出来断言值」的用例**,光靠既有套件防不住插错对象。
  已用行号搬迁挪进 RELAY_BIZ(`RENEW_FLOOR` 之后)。
- **断言升级**:`verify_price_legs.js` 新增 **[10] P2 段 22 项**(识破/事件/乘数/翻车报道/诚实线免疫/
  常量护栏/源码形态锚/RECLAMP 行为级),总数 42+20+**78** = **140 项**;变异自检 **6/6**
  (首版 2/6,漏网原因 = 同义反复断言与源码锚缺失,已全部改为硬编码期望或行为级)。
- **sim 侧防双重生效**:P2-1/P2-4 注入规则停用(模板已有,`exF` 改为直接抽取游戏函数;
  补 `exC NEWS_LIFE_H/NEWS_MAX_ACTIVE/P2_RECLAMP`)。P2-3 热点注入保留(未落模板)。
- **自测**:`check_all` 全链 exit 0(140 项断言);四窗口**新基线**(§20.15):首种子
  2.149/1.786/1.474/1.412 —— 诚实线四窗口 Δ≤0.6%(正交性成立),跑分线 −18~−25%(与池系数预测的 79% 吻合)。
### 2026-10-14 P2 拍板落实现 + 池系数剂量曲线(D30/D90 × 3 种子)

- **两处定稿已落**:`P2_EVENT_RECLAMP` 默认 1(翻车=**按概率发**,CAP 成为真上限);
  热档改**期望对称**(默认 ±60/±20,均值 0;设计稿 +80…−60 均值 +4% 已弃用)。
- **新增开关** `P2_EVENT_POOL_MUL`(发现 1 的补救:事件期 `doPublish` 池抽量打折,默认 1 = 不折)。
- **池系数剂量曲线(D30 均值;基线跑分 2.76、sd 0.64)**:1.0 → +0.2σ(打不到,证实发现 1)、0.85 → −0.1σ、
  **0.70 → −1.6σ 且跑分保留 63%**、0.50 → −3.5σ(打死,违反验收第 3 条)。
  **D90 复算支持 0.70**:−3.3σ、保留 79%、诚实线 **Δ=+0.00**(完全正交),比值 sd 还从 0.144 降到 0.071(更稳)。
- **发现 5(要记牢)**:**基线自己强烈依赖种子** —— BASE 比值 D30 = 1.617/1.253/1.039、D90 = 1.220/0.960/0.980。
  §20.14 记的 1.617 / 1.220 是**首种子值**,多种子均值只有 1.303 / 1.053 ⇒ 诚实线领先幅度比文档看起来薄,
  D90 均值已接近 1.0 临界。**以后调平衡别拿首种子当准绳**;`sim/p2_scan.py` 默认输出 sd 与 σ 判读。
- **自测**:全关 BASE 首种子 D30 = 1.617、D90 = 1.220 **逐位 = §20.14** ⇒ 注入未污染基线 ✓。
### 2026-10-14 P2 开关骨架 + 冒烟四发现(零游戏代码改动)

- **骨架**:P2 四机制(翻车事件 / 公关三选一 / 热点档位 / 过拟合隐蔽度)已在 `sim/startup_loop.js`
  做成 env 开关(`applyP2Patches` 字符串注入,**不动 `index_template.html`)。
  五组旋钮 `P2_EVENT_* / P2_PR_* / P2_HEAT_* / P2_STEALTH_* / P2_DETECT_*` + 私有种子 `P2_SEED`;
  SUMMARY 行带机制计数器(翻车 / 识破 / 公关成·用 / 热点轮 / 补贴M)。
- **实验卫生两条**:① 机制一律走私有 PRNG `p2rnd()`,**绝不消耗游戏主随机流**
  (首版直接吃 `Math.random` ⇒ 主流程随机流错位,单种子对照全是噪声 —— 踩过并已修);
  ② **全关 = 与 §20.14 四窗口逐位一致**(D30 3.33/2.06/1.617),这是注入未污染基线的唯一证据。
- **冒烟四发现**(详见《P2风险玩法备料.md》§七,此处摘要):
  1. 翻车事件按设计稿实现**罚不到投机线的钱**(信誉恒 0 ⇒ 声誉罚空转;收入全来自 surge ⇒ 客流罚打空集)
     —— 实测触发 43 次而跑分线 2.06 → **2.13(微升)**;要做必须补「事件期发布池抽量打折」;
  2. 设计稿「先 clamp 再乘模态×4/知识×3」⇒ 0.2×12=2.4>1 ⇒ **CAP 形同虚设、事件必发**;
     已加 `P2_EVENT_RECLAMP`(默认 1)修成真旋钮(触发 72 → 17/28/43 单调);
  3. **随机机制单种子不可比**:CAP 变大时跑分收益在 1.83 / 2.39 / 2.13 间跳 ⇒ 扫描协议改为
     **≥3 种子取均值 + 优先 D90/D180**;D30 单种子只能做存在性检查,否则会得出「CAP 越大越赚钱」的假结论;
  4. 公关 best_ev 让跑分线 2.39 → **2.47**(公关 8/25 成)⇒ 与「给虚标甜头」叠加,需用 `P2_PR_SEV_K` 定方向。
- **自测**:`python check_all.py` 全链 exit 0(118 项断言);四窗口全关基线复核通过
  (D30 3.33/2.06/1.617、D90 19.99/16.39/1.220、D180 47.42/40.99/1.157 —— 全部逐位 = §20.14)。
- ⚠️ **同一轮抓出复核工具 `sim/window_check.py` 的三个自伤 bug(数值一直是对的,只是显示错)**:
  ① 字段名把「刀乐」写成了**「刃乐」**(差一个形近字)⇒ 正则永不命中 ⇒ 毛收益少算整个刀乐项;
  ② 中文是以 `\\u5203\\u4e50` **字面转义**写进文件的(Python 里它不是中文),与 ① 同源;
  ③ 把「局数」标成了「用户」。修完显示:刀乐 0.35+12.38=12.73(D60)等全部对上。
  **教训(与坑36/§20.12-5c 同类)**:工具/脚本里的中文,**必须验「解析出来的值对不对」**,不能只看有没有报错 ——
  静默取不到字段时 `dict.get(k, 0)` 会当 0 算,数字看着"合理"其实是错的。
### 2026-10-13 P0 收尾:`doPublish` 保价提示 + 瓶颈提示拆两行(均零经济影响)

- **`doPublish` 保价 UX 坑**(§20.11 九 遗留 2,挂了两个月的坑):换标榜后价格按**新官价**每小时重钳,
  而玩家按旧标的定价 ⇒ 发布完可能「增长停了/用户开始走」却看不出原因。取设想里的**提示**一路:
  把「现价会被重钳到 $X / 是新官价几倍 / 净流失还是增长停 / 该降到哪」追加进 `doPublish` 返回的 `msg`
  (面板本来就显示它)**零新增 UI 管线**;只读状态、**不改任何数值**(重钳仍归每小时 refresh)。
- **瓶颈提示单行 → 两行**(根治 ≤768 溢出):`relayBottleneckInfo` 返回 `text`/`text2`;
  `drawBackendPage` 画两行、`priceY` 槽位算式改用 `bnLines`(0/1/2,**本帧现算** —— 顺带修掉用上一帧
  `backendLive` 残留导致多留空槽的隐患);节流刷新同步刷第二行。文案压缩:「产能只用」→「产能」,「库存可撑」挪第二行。
- **宽度实测(两种口径吻合到 0.5px)**:`canvas.measureText` 与本机 `System.Drawing.MeasureString`
  (Microsoft YaHei 12px Bold)实测历史值 339.5 / 366.8 / 314.9px ↔ 浏览器记录 339 / 367 / 315px ⇒ **后者可离线量文案**。
  改后最长行 **223.7px** ⇒ 连 390 屏(230px)**都不溢出**(旧单行 339/367px 是装不下的旧账)。
- **零经济影响已证**:四窗口复核 **逐位一致**(D30 1.617 / D60 1.375 / D90 1.220 / D180 1.157,连刀乐/道具$分项相同)。
- **断言**:`verify_users` 35→**42**(两行制、每行 ≤ 旧单行、极端值 ≤ 390 屏预算);`verify_price_legs` 50→**56**([8b] 6 条保价提示,含「doPublish 本身不改定价」)。合计 **118 项**。
- ⚠️ **踩坑**:`window_check.py` 的解析器曾把中文写成了 `\uXXXX` 字面量(TS 模板串里多写了一层转义)⇒ 刀乐字段静默丢失、
  显示值偏小。已改为真中文并实测通过。**教训**:脚本里的中文正则要验一次「解析出来的数对不对」,别只看有没有报错。
### 2026-10-13 单价腿断言护栏(`verify_price_legs.js` 50 项)+ 变异自检

- **为什么**:§20.14 刚落地的 C2/C4 两条腿,失败模式都是**静默**的 ——
  C2 被改回「权重 0」只会让数值悄悄回退到 §20.13 的翻转曲线;C4 若被写进 `relaySellPayMul`(层4/层5 里)
  就会连虚标罚的语义一起改动,忘了 `listed` 守卫还会让自研线(§5.4 明确不触发信誉)吃到溢价。
  语法、平账、原有 55 项断言**一个都不会报**。
- **新增** `sim/verify_price_legs.js`(50 项,秒级):常量护栏 / 阈值边界(1.39 不罚、1.4 起罚,`>=` 语义)/
  单调性 / **配对对照**(同一随机串下「关 C2」vs「开 C2」跑 6 小时,量级 ≈ base×pct)/ surge 先走 /
  自研豁免 / **不碰标价、不进层4层5** / 合法价区间与旧公式逐点一致 / 信誉 0·50·100 的倍率(1·1.3·1.6)。
- **变异自检(确认断言不是摆设)**:临时注入 5 种回归 —— C2 恒 0、C2 阈值改 2.0(带内成死项)、
  C4 去掉 listed 守卫、C4 污染层4/层5、C2 踢人块失效 —— **5/5 全部被抓红**(exit 1),还原后模板 sha 一致。
- **接入**:`check_all.py` 新增该步骤 ⇒ 一条龙与 CI 自动覆盖,**105 项断言**(35+20+50)。全链 exit 0。
- ⚠️ 写断言时踩到一次**自己的**误判:原以为「合法价 ⇒ 层5 = 1」,实测 0.0094 —— 因为测试能力分低于
  `SIM_GATE`(80)时层5 本来就在罚(与信誉无关)。已改成「结算前后同一次取值比对」。
  **教训**:断言要钉的是「我改的那个东西没动」,而不是「某个恰好相关的量等于某值」。
### 2026-10-13 P1「单价腿」落地:C2 极价负增长 + C4 信誉愿付溢价(已实施)

- **依据**:《P1单价腿决策报告.md》(四条候选 × 四窗口扫描)⇒ 选 C2+C4 双臂,各 K=0.6 / ratio 1.4;
  C1(按人数递减)判否(两条线一起废)、C3(道具涨价)判否(毛收益口径下空转)。
- **改了什么**(`index_template.html` 共 7 处):`RELAY_BIZ` 新增 `GROW_NEG_K`/`GROW_NEG_RATIO`/`TRUST_PRICE_K`;
  `relayGrowWeight` 极价转负;`relayHourlyRefresh` 负增长按 |add| 踢人(`keep.pop()`,surge 先走);
  `updateRelayBusiness` 的 `payMul` × 信誉溢价(**仅标榜线**,自研按 §5.4 保持 1);
  顶栏 HUD 与后台页收益率同步加因子;后台页增长状态文案区分「净流失」与「增长已停」。
- **效果(毛收益 = 刀乐 + 道具$)**:诚实÷跑分 **1.617 / 1.375 / 1.220 / 1.157**(D30/60/90/180),
  基线 1.15 / 0.88 / 0.75 / 0.65 ⇒ **长窗口翻转已消除**;验收五条全过(报告 §5.2)。
- **端口校验**:落地后四窗口与扫描期 C24 **逐位一致**(连刀乐/道具$分项都相同)⇒ 零漂移。
- **断言**:`verify_users` 35/35、`verify_gouge` 20/20 原样通过(未动价格带与层5 语义);`check_all.py` 全链 exit 0。
- **工具变更**:`sim/p1_scan.py` 删除 → `sim/window_check.py`(四窗口并行复核器);
  `sim/startup_loop.js` 移除 P1 实验补丁块(C2/C4 已进模板,**留着会双重生效**)。
- ⚠️ **踩坑记录**:用 PowerShell `Get-Content -Raw | Set-Content -Encoding UTF8` 改含中文的 `config`/`.gitignore`
  会把内容**双重编码**成乱码(GBK 读 → UTF8 写),且 BOM 一起带进去。改这类文件一律走编辑器/工具链,别用 PS 文本管道。
### 2026-10-13 P1「单价腿」候选修法扫描(§20.13 六,零游戏代码改动)

- **产出**:《P1单价腿决策报告.md》—— 四条候选 × 三档参数 × D30/D60/D90/D180 四窗口的完整扫描,
  结论:**推荐 C2+C4 双臂(各 K≈0.6)**,四窗口比值 **1.617 / 1.375 / 1.220 / 1.157**(基线 1.15 → 0.65 单调下滑)。
  C1(单价随人数递减)**判否**:D30 实测两条线一起废(诚实 3.03→1.62/0.88),且收入加权反推显示它打跑分线更狠
  (跑分 u≈20-28 vs 诚实 u≈9,发布注入的 surge 用户是买单方)——但连带损伤不可接受。
  C3(道具价随 toolCall)**判否**:三档窗口全部无感,根因是**毛收益口径把道具支出也算财富**,钱只是换了个口袋。
- **工具**:`sim/startup_loop.js` 新增 P1 实验开关(`applyP1Patches()` 源码字符串替换注入,不设 env 时零补丁、
  基线与历史逐位一致);`sim/p1_scan.py` 多配置并行扫描器(输出对照表 + UTF-8 报告到 `sim/p1_out/`,已 gitignore)。
- **基线校准**:四条窗口的 BASE 全部与 §20.13 逐位一致(D30 3.03/2.64/1.148、D60 10.82/12.31/0.879、
  D90 16.18/21.64/0.748、D180 33.74/52.19/0.646)⇒ 扫描器口径无漂移。
- **自测**:`python check_all.py` 全链通过(exit 0)。
- **下一步**:等星光拍板参数档位 + 确认两个实现细节(C2 的 surge 用户是否参与流失、C4 的自研模式是否豁免),
  再落 sim 默认参数 → 游戏代码 → `verify_*` 断言 → §20.13 更新。
### 2026-10-13 自检一条龙 + CI + 发布模式开关 + 操作音效(本轮)

- **`check_all.py` 一条龙自检**:固定顺序 `build.py` → `check_syntax.js` → `verify_users`(35) → `verify_gouge`(20) → `verify_price_legs`(50) →
  `startup_loop`(D30,`LIST_POLICY=sim`) → `build.py --dist`,**失败即停**、退出码非 0;`--skip-sim`/`--skip-dist` 可跳步。
  ⚠️ 页面/脚本里别用 ✓ ✗ 这类符号:Windows GBK 控制台 print 会直接 `UnicodeEncodeError` 把整条链判红
  (本轮踩过:6 步全过、只有收尾那行 print 崩了 → 退出码 1,已改 ASCII 文案 + stdout 强制 UTF-8 兜底)。
- **CI(`.github/workflows/ci.yml`)**:push / PR 触发,ubuntu-latest + node 20 + python 3.12,只跑一条 `python check_all.py`,
  产物不入库。零依赖(pure stdlib + node 内置),不需要 npm install。首个 CI 运行若因环境差异挂了,照报错修 workflow 即可。
- **`build.py --release` 发布模式**:模板里用 `// __DEBUG_STRIP_BEGIN__` / `// __DEBUG_STRIP_END__` 标了 5 处调试块
  (覆盖表 localStorage 读写、编辑器调试按钮整块、覆盖落盘+提交函数、编辑器键盘输入、密令开关),`--release` 整块剔除;
  块内可写 `// __RELEASE__`,保留其后内容作正式版实现(密令函数替换为恒 `false` → 输入当普通搜索词,调用点零改动)。
  产物再做「零调试痕迹」断言(**去掉行注释**的代码上查 6 个串:密令字面量/覆盖表键/编辑器函数名/调试按钮文案),有残留直接报红。
  实测:`--release` 后 `saveModelOverrides`/`commitModelAttrEdit`/`保存到文档`/`清空全部`/覆盖表键全 0,
  只读属性面板(`drawModelAttrEditor`)与 `playSfx` 保留,产物语法自检同样过;普通构建一切照旧。
- **操作音效(消费「音效音量」滑条)**:`make_sfx.py` 用纯标准库合成 4 个音效(点击/购买/挥鞭/成组消除),
  落到 `assets/audio/sfx_*.wav`(共 ~43KB,外链);`playSfx(name)` 池化播放(上限 8、超出丢弃),音量取 `sfxVolume`。
  触发点全挂手动入口(`clickMask` 手动点击 / `createBuyItem` 扣款点 / 挥鞭按下 / 成组消除),**避开 `doClick`**(自动点击复用它会 3 次/秒连响)。
- **自测**:`python check_all.py` 全链通过(exit 0)—— 语法 4 块 OK / ASSETS 24 key / 素材 26 文件 / 35+20 断言 /
  D30 毛收益 诚实 3.03(刀乐 0.03 + 道具 3.00)· 跑分 2.64(平账残差 8e-6 与 -3.4e-4,与 §20.13 基线一致)/
  单文件 **2522KB**、dist 首访 **4999KB**(HTML 347 + pixi 446 + 素材 4206,其中音效 43KB)。
  模板 **7329 行 / 348KB**(行数以 node 计;PowerShell `Get-Content`/`Measure-Object` 会少算几十行,别用它对账)。
- 附带:模板行尾本轮统一为 LF(此前 CRLF),单文件产物因此 2529KB → 2522KB(体积差 ≈ 行数 × 1 字节),非代码删减。

### 2026-10-13 工程加固:WebGL 兜底 + BGM 懒加载 + 一次性脚本归档(已推送 `d412e7b`)
- **WebGL 上下文兜底**(模板「启动」段,`visibilitychange` 旁):丢失瞬间 `saveGame()` + 全屏 DOM 提示 `#ctxLostPrompt`(8s 未恢复改提示刷新)+ 恢复后 `safeRelayout()` 强制重排;Pixi 内部的丢失/恢复处理不变,两套监听并存、preventDefault 幂等。
- **BGM 轨懒加载**:`initBGM` 不再启动即建满 3 首(原先全 preload='auto' = 首访拉 2.9MB),改 `ensureBgmTrack(k)` 按需建,init 只预载当前场景那一轨;只玩生产的玩家省 ~1.8MB。行为差异:首次切场景该轨现缓冲,由交叉淡入遮延迟。
- **根目录一次性脚本归档**:17 个 `_` 前缀补丁脚本(引用扫描零命中)移入 `attic/`(gitignore 已加显式规则);`_aa_data.json` 被两份文档引用且已被 git 跟踪,保留原位。按坑36 流程:先列保留清单 → 移动(不删,可随时搬回)→ 重跑 build + check_syntax 均过。
- 自测:`check_syntax` / `verify_users`(35)/ `verify_gouge`(20)全绿;`python build.py` 单文件 **2529KB**、`--dist` 首访 **4963KB**(HTML 354 + pixi 446 + assets 4163);`LIST_POLICY=sim DAYS=30` 诚实/跑分毛收益 **3.03/2.64**,与 §20.13 基线逐位一致(本轮未触经济数值)。

### 2026-10-12 晚 长窗口验证(§20.13 · 已推送)

- `c3d4112` **D30 的「诚实反超」是假象:诚实÷跑分 1.15(D30) → 0.65(D180)**
  - 跑了 `LIST_POLICY=sim` 的 **D30/D60/D90/D180** 四档,**12 条仿真全部平账**(残差 ≤ 0.004);
    D30 那列与 `f96f427` 入库的 3.03 / 2.64 / 1.15 **逐位复现** ⇒ 翻转不是跑歪了。
  - 诚实线 `3.03 / 10.82 / 16.18 / 33.74`,跑分线 `2.64 / 12.31 / 21.64 / 52.19`
    ⇒ 比值 **1.15 → 0.88 → 0.75 → 0.65**,**单调劣化、看不到收敛**。
  - **病根在变现单价,不在客流**:D180 诚实线 **18 人** / 信誉 **100(触顶)** / 已卖 184M,
    跑分线 **0 人** / 信誉恒 0 / 已卖 22M —— §20.12「信誉换客流」成立且**长期更强**;
    但定价 `$0.160` vs `$60.000`(**375 倍**)让跑分线一个自然用户没有照样赢。
  - 更正:`LIST_POLICY` **只作用于诚实线**(跑分线 `publish.active` 后跳过标榜分支)
    ⇒ 旧的「投机线 `price` 2.64 → 2.64(0.0%)」本质是把同一条跑分线跑了两次,不是有效对照。
  - 新增 `sim/long_window_report.js`(汇总器);候选修法三条见 §20.13 六,**本轮未动游戏代码**。

### 2026-10-12 中转站经济两端收口(§20.11 定价链 + §20.12 人数链 · 已推送)
- `f96f427` **信誉换客流:`base`/`cap` 双旋钮一起松 + 瓶颈提示分腿(§20.12)**
  - `relayBaseUsers` 信誉分母 `25 → 8`(与能力项同分母);`relayUserCap` 系数 `0.1 → 0.2`(上限 22,与 base 上限 24 差 ≤2)。
  - **真因**:改前 `cap` 上限 12 < `base` 上限 24 ⇒ `base` 从 12 往上那半条(信誉项 + 能力项)**整条是死的**;
    只提信誉分辨率时诚实收益 `2.09 → 2.09`,一分不动。
  - `relayBottleneckInfo` 的卡客流分支按 `baseU/capU` 分岔:「客源封顶 → 练属性/攒信誉」/「并发封顶 → 练工具调用」。
  - 实测(30 天,`LIST_POLICY=sim`,毛收益 = 刀乐 + 道具$):诚实 `2.09 → 3.03`、用户 `7 → 14`、
    **诚实÷跑分 `0.79 → 1.15`(首次反超)**;投机线 `2.64 → 2.64`(**0.0%**,定向改动不泄漏);
    开局不变(`base` 2→2 / `cap` 2→3 / `min` 仍 2);token 平账残差 `8e-6`。
  - 新增 `sim/verify_users.js`(35 断言)、`sim/tune_users_scan.js`;
    `startup_loop.js` 修掉 `BASE_REP_DIV` 的 no-op(覆盖块只判了 `BASE_MCAP_DIV`)、新增 `CAP_K`、抽取 `relayBottleneckInfo`。
- `a2ac1e9` **虚标罚三连修:换锚「能力相称价」+ 相似度闸 + 幂律(§20.11)**
  - `relayGougePayMul` 重写:① `SIM_GATE` 相似度闸(修「高配低标」被误罚)② 阈值抬到**法定上限价** `fairPriceOf × 1.5`
    (=「虚标」的精确定义,且不再对合法带上半段双重收费)③ 开方改**幂律**。
  - 新增 `GOUGE_PAY_EXP: 1` 取代 `GOUGE_PAY_K`;`relayRepSettle` 阈值 `RENEW_LINE → PRICE_MAX`。
  - ⚠️ **口径纠正**:`刀乐` 是现金余额、不是收益(跑分线会把它砸进道具)⇒ 一律用 **刀乐 + 道具$**;
    上一轮用现金口径得出的「诚实反超」结论据此作废(EXP=0 时虚标真实差距是 **51 倍**,不是 5.5 倍)。
  - 新增 `sim/verify_gouge.js`(20 断言)、`sim/tune_gouge_scan.js`;`startup_loop.js` 导出 `{ makeSim, CODE, INIT }` 供复用。

### 2026-10-11 相似度与人数上限诊断(§20.9 / §20.10 · 已推送)
- `cf5aecd` **D-1 强化:`base` 加「模型能力」项 + 信誉归零真因纠正**
  > ⚠️ **这一笔实际打包了 §20.4–§20.8 的一整轮工作**,提交信息只写了 D-1,查东西别只按信息找:
  - **棋盘扩盘(§20.6)**:7×7/4 色 → **14×9/6 色**(`toolCall` 死锁解除);属性列改到棋盘下方横排(2 列,标签压短防撑爆)。
  - **token 墙下调(§20.7)**:`TOKEN_START 3e6→3e4`、`TOKEN_PER_MOVE 5e5→5e3` ⇒ 30 天可玩局数 **0 → 83(诚实)/108(跑分)**,
    `relayUserCap` 由死锁的 **2** 抬到 **8/9**。
  - **仿真脚手架首次入库(§20.4)**:`sim/startup_loop.js`、`sim/layout_check.js`、`sim/tune_board_scale/shape/scan.js`、`sim/tune_coverage.js`、`sim/tune_landscape.js`。
  - `relayBaseUsers` 追加能力项 `floor(max(0, 能力分−20)/8)`(门槛 20 ⇒ 起步期数值不变);
    信誉恒 0 的**真因** = 标榜对象与自身能力不像(相似 <80 走主跌),**不是**跑分扣信誉。
  - 新增 `.gitignore` 条目(`.workbuddy/`、`_sim_out.txt`、`__pycache__/` 等)。
- `aeefa36` **相似度单向化:「不像就主跌」罚错了方向** —— 引入 `SIM_OVER_K`;
  `rawSimilarityTo` 对「超额交付」(有效相似 >100)不再重复惩罚。

### 2026-09-26 调教养成 v1 收口(本轮提交，含新素材首次入库)
- **强化训练消消乐进调教场景**(非电脑面板):`GAME_CFG`/`startGame`/`settleGame`/`buildTuneGameLayer`，开局 3 算力 + token、**每步也扣 token 且随游玩天数涨价**(`gameTokenMul`);切场景**不自动结算**、回调教保持这局(防白耗算力)。修了棋盘多个渲染坑(贴图坐标 pivot/position、臃肿弹跳 `gtween`、消除后新块未刷新的空洞)。
- **属性比例制**:`TRAIN_ITEMS` `delta→rate`，结算 `A[k]+=(100-A[k])*rate*trainGainMul()`——越高越难涨、基于当前能力而非购买次数;`trainGainMul` 加压力软惩罚(叠加原摆烂硬锁);7 个道具改梗名。
- **调教场景**:受击 `tune_hit.webp`(鞭打命中换图并停下，尺寸对齐 `tune_idle`);`tuneHud` 显示美刀/token/时间;时长文案「占x分」统一改「训练需xmin」。
- **闭关头顶标签 `sessionLabel`**:亮金 `#ffe9a8`、每帧跟随当前场景人物头顶、生产/中转站/调教都显示、单位 min。**本轮修**:它挂在 `layers.topbar`(在 `layers.panel` 之上)，开电脑面板/强化训练棋盘时会穿帮盖住整屏覆盖层 → `syncSessionLabel` 开头加 `screenPanelOpen` 让位隐藏(中转站开屏幕不再被标签盖)。
- **场景 BGM 外置**:`build.py` 新增 `AUDIO_FILES`(3 首 AAC 64k `.m4a`)，**两模式都外链、绝不 base64 内联**;⚠️ 单文件本体不再完全自包含(离线双击要带 `assets/audio/`)。音量滑条接线 + 持久化进存档 `settings`;设置卡片只有点背景遮罩才关(防误触)。
- **新素材入库**:`assets/audio/bgm_*.m4a`(3 首 ~2.9M)、`assets/compressed_webp/tune_hit.webp`(21KB)——首次提交;`index.html`/`dist/` 仍按 `.gitignore` 不入库。
- 已跑 `node check_syntax.js` + `python build.py`(单文件 2466KB)/`--dist`(合计 4900KB);浏览器 evaluate 行为断言(标签让位·属性涨·疗程结算·切场景不结算)全绿。文档写回 `中转站设计.md` §16.9/16.10/§17/19.2 + 本文坑位。

### 2026-09-12 调教消失修复 + 经营定价带(本轮未提交)
- **坑56**:调教人物走到边缘 / 停顿 idle / 坐上桌持续消失 → `applyWalkerMetrics` 边界与屏幕求交 + `safeSpriteScale` 防 texture.height=0/1 把 scale 算成 Infinity;启动预载 `tune_idle` 并在 `texture.on('update')` 重布局。
- **底部标签栏**:三标签同一套选中逻辑(`layoutNavTabs`: `navScene===key ? on : off`)。生产 off `0x2a1f16`;中转站/调教 off 曾误用 `0x6a3a2a`(≈生产 on)导致未选中不显暗,已改为 `0x3d2818`。
- **图层定稿**:人物在课桌**下**(桌盖人),层级 `bg → shade → 人物 → 课桌 → UI`;layout 固定人物 index=2、课桌 index=3;落座 `wi>di→di` / `wi<di-1→di-1`,勿改回人前桌后。
- **坐高定稿**:`deskSeat.sitY = floorY - min(deskH*0.35, 72)`(地面～桌面之间;贴地挡头、坐桌面太高,都已否掉)。
- **定价硬带(用户拍板·宽紧适中)**:标榜官价 **×0.5 ~ ×1.5**(`RELAY_BIZ.PRICE_MIN/MAX`);后台显示区间提示,超界自动钳制并 flash。参照 **标榜官价**(非最接近模型),与增长 0.8 / 续约 1.1 同一套三条线。
- **成交软惩罚(层2+层4)**:收入吃 `relaySellPayMul` = 价格系数 × 弱标榜系数。价格 >官价×1.1 后 `pow(1.1/ratio,0.85)` 下探约 0.55;有效相似 <80 再乘 `sim/80`(下限 0.5)。速率显示同步。
- **跑分防刷(层3)**:抽量贵则减量(`RICH_MUL_MIN=0.5`,官价×1.5 → 池×0.5);跑分扣信誉乘溢价 `(prem-1)×1.5`。
- **信誉卡 0 说明**:代码是 `Math.max(0,…)` **无隐藏负债**;长期 0 多因有效相似 <80 只跌不涨,或行业新闻 −3~−6 一次砸穿。缓解:① 后台给「建议标榜=最接近模型」;② 标的就是最接近模型 → 跌幅×0.5;③ sim 70~79 → 跌幅×0.4;④ 信誉<10 时负面新闻减半。×1.5 = `capMul` 上限,救不回 raw 属性不像。
- **能力倍率改版(2026-09-12 用户定稿)**:**去掉固定 ×1.5 封顶**;`capMul = clamp((myCap/listCap)^0.5, 0.4, 6)`(指数 0.4→0.5 曲率加大),有效相似上限 140→**200**。足够强即可「击破」属性相似不足(如 raw 50% × cap 比 4 倍 → ×2.0 → 100%)。展示统一 `simBreakdown`:**基础X% × 能力Y× = 有效相似Z%**(后台/活字/列表行/建议标榜)。
- **SIM_SAT 0.6→1.0(2026-09-12)**:旧值下知识门槛 +0.35 与多模态门槛 +0.30 一叠就 ≥0.6 → raw 恒 0 → 能力倍率乘不动(0×mul=0),「比我们弱很多的模型也显示 0%」。上调后属性较像 + 双门槛 ≈35% 起,弱模型不再一片 0。
- **价格区间提示位置**:必须画在 DOM 输入框右侧(`padX+96+88+12`),叠在 input 下会被盖成「区[框]价×0.5~×1.5)」(用户截图坑)。
- **显示**:`fmt2` 四舍五入最多两位小数;后台速度/`tokens/s`、模型页 score、榜单 tokens/s 列统一;单位写全 `tokens/s`。
- 改动文件:`index_template.html`、`PROJECT.md`、`踩过的坑(人看的).docx`;已跑 `node check_syntax.js` + `python build.py`。

### 2026-09-11(当天提交 3 笔 + 本轮未提交)
- `52a529e`:榜单去掉退役模型 + 底部导航按钮收拢左移(间距 18)。
- `37a7d09`:模型库扩到 53 条(参考 wycode 高考榜选型)+ 修 `modelToAttrs` 知识恒 10 的 bug(坑43)。
- `770f820`:补 Hy4/Agnes + DeepSeek V4.1 Flash 原生多模态 + 档位改厂商内部定位 + 榜单加价与虚构声明(共 56 条)。
- **本轮(未提交)**:面板交互大轮 —— 榜单 9 列(价$ 单列 + AA 实测速列)+ 行悬停淡蓝描边 + 行点击打开属性编辑器
  (临时调试,localStorage 覆盖值)+ 榜单实时重排(`effectiveCap`/`boardOrder`,Δ 方案)+
  雷达开启动画(边界不动/数据层生长/数字滚动,`radarTicker`)+ 能力公式加速度/长上下/多模态三项(推理闸门)+
  上下文区间 0k~1000k + 速度 1分=3tok/s + GPT-6 价 20 + sync_models.py 适配 14 列价$ 与保真拆分(pi=0.4p/po=1.2p)
  + 速度数据源换成 AA 实测(`ts` 字段,59 条)+ 中转站标签常显(未解锁点击冒提示)+ 模型库扩到 59 条(v0.5)
  + **§13.11 落地(v0.7)**:9 维设计属性进数组(`ax` 字段,来自用户调参导出的全榜 CSV),`deriveModelAttrs` 优先采用;
    面板重绘改延迟 destroy 修掉"越改越卡"的纹理泄漏(坑52);编辑器加导出/导入调整 + 导出全榜 CSV 按钮。
  + **「保存到文档」+ server.py(2026-09-12,用户要求"直接修改数据,不需要反复导入导出")**:
    新增 `server.py`(静态服务 + `POST /api/save-overrides`),启动方式 `python server.py [端口,默认8765]`,
    只监听 127.0.0.1。编辑器页脚「保存到文档」把当前覆盖(payload 附带有效 `__cap`/`__k`)POST 给它,
    服务端把属性合并进 §3.1 设计属性列、cap/截止写入对应列,自动 `sync --write` + `build.py`,前端 F5 即固化。
    ⚠️ 双击 file:// 打开时该按钮不可用(fetch 受限)→ 用导出/导入;`__cap` 必须随属性一起落库,
    否则属性固化了 cap 会退回静态值(用户报告过)。同轮:cap 支持一位小数(sync float 解析/`%g` 渲染)。
  + 新增小米 `MiMo-X Flash Preview`(cap 56.5,DeepSeek V4 Pro 之下)/ `MiMo-X Pro Preview`(cap 55,GPT-5.5 之下)
    —— **flash 不一定比 pro 弱**(用户定稿);AA 查无数据全列粗估;同轮修正 `Qwen3.8-27B` 速度 66→39(校准漏网)、
    `Mercury 2` 750→734(以接口值为准)。61 条。
  + 「中转站暂未解锁」提示改**原地保持 1.6s → 缓慢淡出 1.2s**(用户要求不要一闪而过);
    「清空全部」现在会**先自动下载备份 json 再清**(覆盖层一清没导出的调整就真没了)。

### 2026-09-10 深夜收尾(此前记为"本轮未提交",已随 `0c20c0d`/`1bb8872` 入库)
- `build.py --dist` 双模式、方案 A 分辨率 + `touch-action:none`、背景 WebP 重压、中转站椅子独立图层、行走动画素材。

### 2026-09-10 及以前
- `5d9bfc7`:新版大肥鱼站 logo + 面板关闭逻辑优化 + 清理临时脚本(**本次失误见下节**)。
- `dc2a079`:修复 `5d9bfc7` 误删的三个活脚本(`recompress_assets.py`/`cut_chair.py`/`process_assets.py`),
  重建 `check_syntax.js`,并从 `.gitignore` 移除误加的那行。
- `418e33a`:清理 3 个真死素材(`compressed/chair.png`、`compressed/relay_bg.jpg`、`compressed_webp/chair.webp`);
  修 `process_assets.py` 写死的绝对路径与 ffmpeg 路径。
- `c8a2275`:补 VibeHub 发布调研 + 背景 WebP 迁移实测数据进文档。

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

