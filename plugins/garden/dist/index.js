import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const DAY = 86400000
// 三档成熟度，果实单独表示笔记在实践中产生的价值。
const WEIGHT = { seed: 1, growing: 2, tree: 3 }
const LEGACY = { sprout: "growing", sapling: "growing", fruit: "tree" }
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
    const level = WEIGHT[maturity] ? maturity : LEGACY[maturity] || "seed"
    const fruit = d.frontmatter?.fruit === true || maturity === "fruit"
    if (maturity && !WEIGHT[maturity] && !LEGACY[maturity]) {
      console.warn(
        `[garden] 未知的 maturity "${maturity}"（${slug}）按 seed 处理；可用值：seed / growing / tree`,
      )
    }
    const tags = Array.isArray(d.frontmatter?.tags) ? d.frontmatter.tags.map(String) : []
    const growth = growthOf(d)
    const created = toTime(d.dates?.created ?? d.dates?.modified)
    const modified = toTime(d.dates?.modified ?? d.dates?.created)

    raw.push({
      slug,
      title: String(d.frontmatter?.title ?? baseSlug(slug)),
      maturity: fruit ? "tree" : level,
      fruit,
      description: String(d.description ?? d.frontmatter?.description ?? ""),
      tags,
      links: Array.isArray(d.links) ? d.links.map(String) : [],
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
    if (a.fruit !== b.fruit) return Number(b.fruit) - Number(a.fruit)
    return (b.modified ?? 0) - (a.modified ?? 0)
  })

  const all = raw.slice(0, opts.limit)

  const counts = { seed: 0, growing: 0, tree: 0, fruit: 0 }
  for (const n of all) counts[n.maturity] += 1
  counts.fruit = all.filter((n) => n.fruit).length

  return { notes: all, counts, total: raw.length }
}

// ------------------------------------------------------------ 页面
function pageHtml(data, opts) {
  const depth = opts.slug.split("/").length - 1
  const root = "../".repeat(depth) || "./"
  const payload = JSON.stringify({ ...data, root }).replace(/</g, "\\u003c")
  return fs
    .readFileSync(new URL("../src/page.html", import.meta.url), "utf8")
    .replaceAll("__ROOT__", root)
    .replace("__PAYLOAD__", payload)
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

      // 可视化页面资源
      const bundleSrc = path.join(path.dirname(fileURLToPath(import.meta.url)), BUNDLE)
      const staticDir = path.join(outDir, "static")
      fs.mkdirSync(staticDir, { recursive: true })
      const bundleOut = path.join(staticDir, BUNDLE)
      if (fs.existsSync(bundleSrc)) {
        fs.copyFileSync(bundleSrc, bundleOut)
        yield bundleOut
      }

      fs.copyFileSync(
        new URL("../src/garden.css", import.meta.url),
        path.join(staticDir, "garden.css"),
      )
      yield path.join(staticDir, "garden.css")

      const target = path.join(outDir, `${opts.slug}.html`)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, html, "utf-8")
      yield target
    },
  }
}

export { GardenIsland, GardenIsland as default }
