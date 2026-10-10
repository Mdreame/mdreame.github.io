import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const DAY = 86400000
// 五档成熟度：种子 → 新芽 → 树苗 → 成树 → 果实
// fruit 不只比 tree 更成熟，是"这篇笔记真的帮到过我"：为人处事、专业能力之类
const WEIGHT = { seed: 1, sprout: 2, sapling: 3, tree: 4, fruit: 5 }
const BUNDLE = "garden-island.js"

// ------------------------------------------------------------ git 历史
let historyCache
function loadHistory() {
  if (historyCache) return historyCache
  const map = new Map()
  try {
    const out = execSync('git log --name-only --pretty=format:"%ct"', {
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString()
    let stamp = null
    for (const raw of out.split("\n")) {
      const line = raw.trim()
      if (!line) continue
      if (/^\d+$/.test(line)) {
        stamp = Number(line)
        continue
      }
      if (stamp === null) continue
      if (!map.has(line)) map.set(line, [])
      map.get(line).push(stamp)
    }
  } catch {
    /* git 不可用时降级 */
  }
  historyCache = map
  return map
}

function growthOf(data) {
  const fp = String(data?.filePath ?? "")
  if (!fp) return { revisions: 0, days: 0 }
  const history = loadHistory()
  const list = history.get(`content/${fp}`) ?? history.get(fp) ?? []
  if (list.length === 0) return { revisions: 0, days: 0 }
  const min = Math.min(...list)
  const max = Math.max(...list)
  return { revisions: list.length, days: Math.round((max - min) / DAY) }
}

function toTime(v) {
  const t = v instanceof Date ? v.getTime() : typeof v === "string" ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : null
}

function baseSlug(s) {
  return String(s ?? "").replace(/\/index$/, "")
}

// ------------------------------------------------------------ 数据
function collectNotes(content, opts) {
  const raw = []
  for (const [, vfile] of content) {
    const d = vfile?.data
    if (!d) continue
    const slug = String(d.slug ?? "")
    if (!slug || !d.filePath) continue
    if (slug === "index" || slug === "404" || slug === opts.slug) continue
    if (slug.startsWith("tags/")) continue
    if (d.frontmatter?.unlisted === true) continue
    if (d.frontmatter?.draft === true) continue

    const maturity = String(d.frontmatter?.maturity ?? "")
      .trim()
      .toLowerCase()
    // 不写 maturity 的笔记就是种子；写错的也按种子算，只是提醒一声
    const level = WEIGHT[maturity] ? maturity : "seed"
    if (maturity && !WEIGHT[maturity]) {
      console.warn(
        `[garden] 未知的 maturity "${maturity}"（${slug}）按 seed 处理；可用值：seed / sprout / sapling / tree / fruit`,
      )
    }
    const tags = Array.isArray(d.frontmatter?.tags) ? d.frontmatter.tags.map(String) : []
    const growth = growthOf(d)
    const created = toTime(d.dates?.created ?? d.dates?.modified)
    const modified = toTime(d.dates?.modified ?? d.dates?.created)

    raw.push({
      slug,
      title: String(d.frontmatter?.title ?? baseSlug(slug)),
      maturity: level,
      tags,
      created,
      modified,
      revisions: growth.revisions,
      growthDays: growth.days,
    })
  }

  raw.sort((a, b) => {
    const wa = WEIGHT[a.maturity] ?? 0
    const wb = WEIGHT[b.maturity] ?? 0
    if (wa !== wb) return wb - wa
    return (b.modified ?? 0) - (a.modified ?? 0)
  })

  const all = raw.slice(0, opts.limit)

  const counts = { seed: 0, sprout: 0, sapling: 0, tree: 0, fruit: 0 }
  for (const n of all) counts[n.maturity] += 1

  return { notes: all, counts, total: raw.length }
}

// ------------------------------------------------------------ 页面
function pageHtml(data, opts) {
  const payload = JSON.stringify(data).replace(/</g, "\\u003c")
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>花园 · Jiang</title>
<meta name="description" content="把笔记种成一片可以旋转的园子">
<style>
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background: linear-gradient(180deg, #dff0fb 0%, #f4f9f3 55%, #eaf2e4 100%);
    color: #2f3a2f;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header {
    padding: 1.1rem 1.5rem 0.4rem;
    display: flex; align-items: baseline; gap: 0.8rem; flex-wrap: wrap;
  }
  header h1 { font-size: 1.15rem; margin: 0; font-weight: 700; }
  header .sub { font-size: 0.82rem; color: #7b8b7b; }
  header a { margin-left: auto; font-size: 0.82rem; color: #7b8b7b; text-decoration: none; }
  header a:hover { color: #2f3a2f; }
  #stage { position: relative; flex: 1; min-height: 0; }
  canvas { width: 100%; height: 100%; display: block; touch-action: none; }
  #garden-tip {
    position: absolute; pointer-events: none; display: none; z-index: 3;
    background: rgba(30, 40, 30, 0.9); color: #fff; font-size: 0.78rem;
    padding: 0.2rem 0.5rem; border-radius: 4px; transform: translateX(-50%); white-space: nowrap;
  }
  #garden-card {
    position: absolute; left: 1.2rem; bottom: 1.2rem; max-width: 20rem; display: none; z-index: 3;
    background: rgba(255, 255, 255, 0.94); border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 10px; padding: 0.8rem 1rem; box-shadow: 0 10px 30px rgba(40, 60, 40, 0.16);
  }
  #garden-card h3 { margin: 0 0 0.25rem; font-size: 1rem; }
  #garden-card p { margin: 0 0 0.55rem; font-size: 0.78rem; color: #7b8b7b; }
  #garden-card a { font-size: 0.82rem; color: #3f7d52; text-decoration: none; font-weight: 600; }
  #garden-empty, #garden-loading, #garden-fallback {
    position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    color: #7b8b7b; font-size: 0.9rem; text-align: center; padding: 1.5rem;
  }
  #garden-loading { display: flex; }
  footer {
    padding: 0.6rem 1.5rem 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;
  }
  button {
    font: inherit; font-size: 0.8rem; cursor: pointer; border-radius: 999px;
    border: 1px solid rgba(0, 0, 0, 0.1); background: rgba(255, 255, 255, 0.75);
    color: #2f3a2f; padding: 0.3rem 0.8rem;
  }
  button:hover { background: #fff; }
  button.active { background: #2f3a2f; color: #fff; border-color: #2f3a2f; }
  .hint { margin-left: auto; font-size: 0.72rem; color: #7b8b7b; }
  @media (max-width: 640px) {
    header { padding: 0.8rem 1rem 0.3rem; }
    footer { padding: 0.5rem 1rem 0.8rem; }
    #garden-card { left: 0.8rem; right: 0.8rem; bottom: 0.8rem; max-width: none; }
    .hint { display: none; }
  }
</style>
</head>
<body>
<header>
  <h1>花园</h1>
  <span class="sub">${data.total} 篇笔记 · 地里 ${data.notes.length} 棵 · 拖拽旋转，滚轮缩放，点击查看</span>
  <a href="/">← 返回博客</a>
</header>
<div id="stage">
  <canvas id="garden-canvas"></canvas>
  <div id="garden-tip"></div>
  <div id="garden-loading">正在种树…</div>
  <div id="garden-empty">这个筛选下还没有笔记</div>
  <div id="garden-fallback">
    你的浏览器/设备不支持 WebGL，无法渲染 3D 花园。<br>
    可以<a href="/" style="color:#3f7d52">回首页</a>看看其它笔记。
  </div>
  <div id="garden-card">
    <h3 id="garden-card-title"></h3>
    <p id="garden-card-meta"></p>
    <a id="garden-card-link" href="/">打开笔记 →</a>
  </div>
</div>
<footer>
  <button class="garden-filter active" data-level="all">全部 ${data.notes.length}</button>
  <button class="garden-filter" data-level="seed">种子 ${data.counts.seed}</button>
  <button class="garden-filter" data-level="sprout">新芽 ${data.counts.sprout}</button>
  <button class="garden-filter" data-level="sapling">树苗 ${data.counts.sapling}</button>
  <button class="garden-filter" data-level="tree">成树 ${data.counts.tree}</button>
  <button class="garden-filter" data-level="fruit">果实 ${data.counts.fruit}</button>
  <button id="garden-reset">重置视角</button>
  <span class="hint">一块圈地一个顶层标签 · 新芽嫩绿、果实树常青，其余叶色随打理时间由绿转黄再转枯黄 · 点击树看笔记</span>
</footer>
<script>
  window.__GARDEN__ = ${payload};
  (function () {
    var ok = false;
    try {
      var c = document.createElement("canvas");
      ok = !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      document.getElementById("garden-loading").style.display = "none";
      document.getElementById("garden-fallback").style.display = "flex";
      return;
    }
    var s = document.createElement("script");
    s.type = "module";
    s.src = "./static/${BUNDLE}";
    document.body.appendChild(s);
  })();
</script>
</body>
</html>
`
}

// ------------------------------------------------------------ emitter
var GardenIsland = (userOpts) => {
  const opts = { slug: "garden", limit: 50, ...userOpts }
  return {
    name: "GardenIsland",
    getQuartzComponents() {
      return []
    },
    async *emit(ctx, content) {
      const data = collectNotes(content, opts)
      const html = pageHtml(data, opts)
      const outDir = String(ctx.argv.output ?? "public")

      // 场景脚本（Three.js bundle）
      const bundleSrc = path.join(path.dirname(fileURLToPath(import.meta.url)), BUNDLE)
      const staticDir = path.join(outDir, "static")
      fs.mkdirSync(staticDir, { recursive: true })
      const bundleOut = path.join(staticDir, BUNDLE)
      if (fs.existsSync(bundleSrc)) {
        fs.copyFileSync(bundleSrc, bundleOut)
        yield bundleOut
      }

      const target = path.join(outDir, `${opts.slug}.html`)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, html, "utf-8")
      yield target
    },
  }
}

export { GardenIsland, GardenIsland as default }
