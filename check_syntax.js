// 构建自检,改完模板/素材后跑一次,退出码非 0 即有错。
//   用法: node check_syntax.js [index.html|index_template.html]   默认 index.html
// 检查三件事:
//   ① 每个 <script> 块单独过一遍语法(new Function 只解析、不执行)
//   ② 模板里 ASSETS.xxx 引用的 key,在 build.py 的 ASSET_FILES 里都有定义
//      (key 拼错时 PIXI.Sprite.from(undefined) 会静默拿到空纹理,不报错,肉眼也看不出来)
//   ③ build.py 里登记的素材文件在磁盘上真的存在(否则 build.py 会抛 Python 堆栈)
//
// ⚠️ 本文件曾在 .gitignore 里被显式忽略过一次,导致它既进不了版本库、又被清理脚本删掉。
//    如果你要改 .gitignore,不要把这个文件名加进去。
const fs = require('fs');

const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
let fail = 0;

// ---- ① 逐块语法检查 ----
const codeBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
codeBlocks.forEach((code, k) => {
  if (!code.trim()) return; // 模板里的 __PIXIES__ / __ASSETS__ 占位块
  try {
    new Function(code);
    console.log(`script #${k + 1}: OK (${(code.length / 1024) | 0} KB)`);
  } catch (e) {
    fail++;
    console.log(`script #${k + 1}: SYNTAX ERROR -> ${e.message}`);
  }
});

// ---- ② ASSETS key 是否对得上 build.py ----
const code = codeBlocks.join('\n');
const buildPy = fs.readFileSync('build.py', 'utf8');
const entries = [...buildPy.matchAll(/^\s{4}"(\w+)":\s*\("([^"]+)",\s*"([^"]+)"\)/gm)]
  .map((m) => ({ key: m[1], file: m[2], mime: m[3] }));
const defined = new Set(entries.map((e) => e.key));
const used = new Set([...code.matchAll(/ASSETS\.(\w+)/g)].map((m) => m[1]));

const missing = [...used].filter((k) => !defined.has(k));
// 间接引用(如 makeWalkFrames('walk_left'))不算「未使用」
const unused = [...defined].filter((k) => !used.has(k) && !code.includes(`'${k}'`) && !code.includes(`"${k}"`));

if (missing.length) {
  fail++;
  console.log(`ASSETS 引用但未定义: ${missing.join(', ')}`);
} else {
  console.log(`ASSETS: ${used.size} 个引用全部有定义`);
}
if (unused.length) console.log(`(提示) 定义了但模板未引用: ${unused.join(', ')}`);

// ---- ③ 登记的文件是否真的在磁盘上 ----
const absent = entries.filter((e) => !fs.existsSync(e.file));
if (absent.length) {
  fail++;
  console.log('素材文件不存在: ' + absent.map((e) => `${e.key} -> ${e.file}`).join('; '));
} else {
  console.log(`素材文件: ${entries.length} 个全部存在`);
}

process.exit(fail ? 1 : 0);
