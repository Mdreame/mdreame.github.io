import { jsx } from "preact/jsx-runtime"
import { execSync } from "node:child_process"

// ------------------------------------------------------------------ utils
const h = (type, props, ...kids) => {
  if (kids.length === 0) return jsx(type, props)
  return jsx(type, { ...props, children: kids.length === 1 ? kids[0] : kids })
}

const DAY = 86400000
const CELL_W = 96
const CELL_H = 132
const TOP_PAD = 12
const ROOT_ZONE = 34

const LEVELS = {
  seedling: { label: "幼苗", order: 0 },
  budding: { label: "抽芽", order: 1 },
  evergreen: { label: "常青", order: 2 },
}

function slugOf(f) {
  return String(f?.slug ?? "")
}
function titleOf(f) {
  return f?.frontmatter?.title ?? slugOf(f) ?? "未命名"
}
function maturityOf(f) {
  const raw = String(f?.frontmatter?.maturity ?? "").trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(LEVELS, raw) ? raw : null
}
function toTime(v) {
  const t = v instanceof Date ? v.getTime() : typeof v === "string" ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : null
}
function createdTime(f) {
  return toTime(f?.dates?.created ?? f?.dates?.modified)
}
function modifiedTime(f) {
  return toTime(f?.dates?.modified ?? f?.dates?.created)
}

// 确定性伪随机：同一篇笔记每次构建长出来的树完全一样
function hashString(str) {
  let x = 2166136261
  for (let i = 0; i < str.length; i++) {
    x ^= str.charCodeAt(i)
    x = Math.imul(x, 16777619)
  }
  return x >>> 0
}
function makeRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ------------------------------------------------------- git 成长历史
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
    // git 不可用时降级：所有笔记按无历史处理
  }
  historyCache = map
  return map
}

function growthOf(file) {
  const fp = String(file?.filePath ?? "")
  if (!fp) return { revisions: 0, days: 0 }
  const list = loadHistory().get(`content/${fp}`) ?? loadHistory().get(fp) ?? []
  if (list.length === 0) return { revisions: 0, days: 0 }
  const min = Math.min(...list)
  const max = Math.max(...list)
  return { revisions: list.length, days: Math.round((max - min) / DAY) }
}

// ------------------------------------------------------- 配色
function leafColor(file) {
  const t = modifiedTime(file)
  let sat = 42
  let light = 40
  if (t === null) return { fill: "hsl(38 14% 56%)", accent: "hsl(38 16% 48%)" }
  const days = (Date.now() - t) / DAY
  if (days <= 30) {
    sat = 46
    light = 40
  } else if (days <= 90) {
    sat = 40
    light = 43
  } else if (days <= 180) {
    sat = 34
    light = 46
  } else {
    sat = 26
    light = 50
  }
  // 按创建季节轻微偏移色相，让林子不是清一色
  const created = createdTime(file)
  const season = created ? new Date(created).getMonth() : null
  let hue = 128
  if (season !== null) {
    if (season >= 2 && season <= 4) hue = 118
    else if (season >= 5 && season <= 7) hue = 134
    else if (season >= 8 && season <= 10) hue = 82
    else hue = 150
  }
  return {
    fill: `hsl(${hue} ${sat}% ${light}%)`,
    accent: `hsl(${hue} ${sat + 6}% ${light - 8}%)`,
  }
}

function trunkColor(file) {
  const { revisions } = growthOf(file)
  const light = Math.max(22, 34 - Math.min(revisions, 8))
  return `hsl(26 24% ${light}%)`
}

// ------------------------------------------------------- 有机树生成
function growTree(level, rand, file) {
  const height = level === "seedling" ? 30 : level === "budding" ? 64 : 104
  const depth = level === "seedling" ? 0 : level === "budding" ? 1 : 2
  const baseWidth = level === "seedling" ? 1.6 : level === "budding" ? 3.2 : 5.2
  const { revisions } = growthOf(file)
  const trunkScale = 1 + Math.min(revisions, 10) * 0.02

  const branches = []
  const tips = []

  function branch(x, y, angle, len, width, d) {
    const len2 = len * (0.92 + rand() * 0.16)
    const angle2 = angle + (rand() - 0.5) * 0.34
    const x2 = x + Math.cos(angle2) * len2
    const y2 = y + Math.sin(angle2) * len2
    const cx = x + Math.cos(angle2 - 0.22) * len2 * 0.55
    const cy = y + Math.sin(angle2 - 0.22) * len2 * 0.55
    branches.push({
      d: `M${x.toFixed(1)} ${y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      w: +width.toFixed(2),
    })
    const lenScale = 0.66 + rand() * 0.1
    const widthScale = 0.58
    if (d > 0) {
      const spread = 0.46 + rand() * 0.22
      branch(x2, y2, angle2 - spread, len2 * lenScale, width * widthScale, d - 1)
      branch(x2, y2, angle2 + spread, len2 * lenScale, width * widthScale, d - 1)
    } else {
      tips.push({ x: x2, y: y2 })
    }
  }

  const segs = level === "seedling" ? 1 : 3
  const segLen = height / segs
  let x = 0
  let y = 0
  let angle = -Math.PI / 2
  for (let i = 0; i < segs; i++) {
    const len = segLen * (0.9 + rand() * 0.2)
    const x2 = x + Math.cos(angle) * len
    const y2 = y + Math.sin(angle) * len
    const cx = x + Math.cos(angle - 0.3) * len * 0.6
    const cy = y + Math.sin(angle - 0.3) * len * 0.6
    branches.push({
      d: `M${x.toFixed(1)} ${y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
      w: +(baseWidth * trunkScale * (1 - i / (segs + 1))).toFixed(2),
    })
    x = x2
    y = y2
    angle += (rand() - 0.5) * 0.16
  }

  if (level !== "seedling") {
    branch(x, y, angle - 0.5, segLen * 0.8, baseWidth * trunkScale * 0.5, depth - 1)
    branch(x, y, angle + 0.5, segLen * 0.8, baseWidth * trunkScale * 0.5, depth - 1)
  }
  tips.push({ x, y })

  return { branches, tips, width: baseWidth * trunkScale }
}

// ------------------------------------------------------- 单棵树 SVG
function treeGroup(file, level, index) {
  const rand = makeRandom(hashString(slugOf(file)))
  const { branches, tips, width } = growTree(level, rand, file)
  const colors = leafColor(file)
  const trunk = trunkColor(file)
  const delay = index * 70

  const branchEls = branches.map((b) =>
    h("path", {
      class: "forest-branch",
      d: b.d,
      stroke: trunk,
      "stroke-width": Math.max(0.8, b.w),
      "stroke-linecap": "round",
      fill: "none",
      pathLength: "100",
      style: `animation-delay:${delay}ms`,
    }),
  )

  const leafEls = []
  for (const tip of tips) {
    const blobs = level === "evergreen" ? 3 : level === "budding" ? 2 : 1
    for (let i = 0; i < blobs; i++) {
      const rx = (level === "seedling" ? 3.4 : 7.5) + rand() * 3.2
      const ry = rx * (0.68 + rand() * 0.3)
      leafEls.push(
        h("ellipse", {
          class: "forest-leaf",
          cx: +(tip.x + (rand() - 0.5) * 9).toFixed(1),
          cy: +(tip.y - rand() * 7).toFixed(1),
          rx: +rx.toFixed(1),
          ry: +ry.toFixed(1),
          fill: i === 1 ? colors.accent : colors.fill,
          opacity: i === 1 ? 0.85 : 0.95,
          style: `animation-delay:${delay + 380 + i * 40}ms`,
        }),
      )
    }
  }

  // 幼苗：贴地的两片子叶
  if (level === "seedling") {
    for (const dx of [-6.5, 6.5]) {
      leafEls.push(
        h("ellipse", {
          class: "forest-leaf",
          cx: dx,
          cy: -9,
          rx: 6.5,
          ry: 3.4,
          fill: colors.fill,
          transform: `rotate(${dx < 0 ? -24 : 24} ${dx} -9)`,
          style: `animation-delay:${delay + 380}ms`,
        }),
      )
    }
  }

  return [...branchEls, ...leafEls]
}

// ------------------------------------------------------- 布局与视图
function place(list, perRow) {
  return list.map((file, i) => ({
    file,
    col: i % perRow,
    row: Math.floor(i / perRow),
  }))
}

function svgHeader(id) {
  return [
    h("defs", {}, [
      h(
        "linearGradient",
        { id: `sky-${id}`, x1: "0", y1: "0", x2: "0", y2: "1" },
        h("stop", { offset: "0%", "stop-color": "var(--light)" }),
        h("stop", { offset: "100%", "stop-color": "var(--lightgray)", "stop-opacity": "0.35" }),
      ),
      h(
        "linearGradient",
        { id: `soil-${id}`, x1: "0", y1: "0", x2: "0", y2: "1" },
        h("stop", { offset: "0%", "stop-color": "hsl(30 22% 72%)" }),
        h("stop", { offset: "100%", "stop-color": "hsl(30 18% 62%)", "stop-opacity": "0.25" }),
      ),
    ]),
  ]
}

function forestScene(list, perRow, viewId, indexBase = 0) {
  const rows = Math.max(1, Math.ceil(list.length / perRow))
  const width = perRow * CELL_W
  const skyH = rows * CELL_H + TOP_PAD
  const height = skyH + ROOT_ZONE

  // 链接 -> 坐标
  const placed = place(list, perRow)
  const coords = new Map()
  for (const p of placed) {
    coords.set(p.file.slug, p)
    const alt = p.file.slug.replace(/\/index$/, "")
    if (!coords.has(alt)) coords.set(alt, p)
  }

  const roots = []
  const seen = new Set()
  placed.forEach((p, idx) => {
    const links = p.file.links ?? []
    for (const raw of links) {
      const target = String(raw).replace(/\/index$/, "")
      const other = coords.get(String(raw)) ?? coords.get(target)
      if (!other || other.file.slug === p.file.slug) continue
      const key = [p.file.slug, other.file.slug].sort().join("|")
      if (seen.has(key)) continue
      seen.add(key)

      const x1 = p.col * CELL_W + CELL_W / 2
      const y1 = p.row * CELL_H + TOP_PAD + (CELL_H - TOP_PAD - 12)
      const x2 = other.col * CELL_W + CELL_W / 2
      const y2 = other.row * CELL_H + TOP_PAD + (CELL_H - TOP_PAD - 12)
      const midX = (x1 + x2) / 2
      const dist = Math.abs(x1 - x2) + Math.abs(y1 - y2)
      const sag = Math.min(26, 6 + dist * 0.06)
      roots.push(
        h("path", {
          class: "forest-root",
          d: `M${x1} ${y1} Q${midX} ${Math.max(y1, y2) + sag} ${x2} ${y2}`,
          stroke: "hsl(28 20% 58%)",
          "stroke-width": 1.4,
          fill: "none",
          opacity: 0.5,
          pathLength: "100",
          style: `animation-delay:${(indexBase + idx) * 70 + 200}ms`,
        }),
      )
    }
  })

  const trees = placed.map((p, idx) => {
    const x = p.col * CELL_W + CELL_W / 2
    const groundY = p.row * CELL_H + TOP_PAD + (CELL_H - TOP_PAD - 12)
    const level = maturityOf(p.file)
    const growth = growthOf(p.file)
    const parts = level
      ? treeGroup(p.file, level, indexBase + idx)
      : [
          // 未标记成熟度：地上一颗种子
          h("ellipse", {
            class: "forest-leaf",
            cx: 0,
            cy: -4,
            rx: 5,
            ry: 3.6,
            fill: "hsl(35 12% 62%)",
            style: `animation-delay:${(indexBase + idx) * 70 + 300}ms`,
          }),
        ]

    const tip =
      `${titleOf(p.file)} · ${level ? LEVELS[level].label : "未标记"}` +
      (growth.revisions > 0 ? ` · 修订 ${growth.revisions} 次` : "") +
      (growth.days > 0 ? ` · 生长 ${growth.days} 天` : "")

    return h(
      "a",
      { href: `/${p.file.slug}`, class: "forest-tree", transform: `translate(${x} ${groundY})` },
      [h("title", { children: tip }), ...parts],
    )
  })

  return h(
    "svg",
    {
      viewBox: `0 0 ${width} ${height}`,
      width: "100%",
      height: height,
      class: "forest-canvas",
      role: "img",
    },
    ...svgHeader(viewId),
    h("rect", { x: 0, y: 0, width, height: skyH, fill: `url(#sky-${viewId})`, rx: 8 }),
    h("rect", { x: 0, y: skyH - 1, width, height: ROOT_ZONE + 2, fill: `url(#soil-${viewId})` }),
    ...roots,
    ...trees,
  )
}

// ------------------------------------------------------- 数据整理
function isNote(file) {
  const slug = slugOf(file)
  if (!slug) return false
  if (!file.filePath) return false
  if (slug === "index" || slug === "404" || slug === "forest") return false
  if (slug.startsWith("tags/")) return false
  return true
}

function byTime(notes) {
  return [...notes].sort((a, b) => (createdTime(a) ?? Infinity) - (createdTime(b) ?? Infinity))
}
function bySlug(notes) {
  return [...notes].sort((a, b) => slugOf(a).localeCompare(slugOf(b), "zh"))
}
function groupedByTag(notes) {
  const groups = new Map()
  for (const note of notes) {
    const tags = note.frontmatter?.tags
    const tag = Array.isArray(tags) && tags.length > 0 ? String(tags[0]) : "未分类"
    if (!groups.has(tag)) groups.set(tag, [])
    groups.get(tag).push(note)
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([tag, list]) => [tag, byTime(list)])
}

// ------------------------------------------------------- 样式
var css = `
.forest { margin: 1.5rem 0; }
.forest-radio { position: absolute; opacity: 0; pointer-events: none; }
.forest-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
.forest-tabs label {
  cursor: pointer; border: 1px solid var(--lightgray); border-radius: 999px;
  padding: 0.25rem 0.85rem; font-size: 0.85rem; color: var(--darkgray); user-select: none;
}
.forest:has(#forest-view-time:checked) label[for="forest-view-time"],
.forest:has(#forest-view-tag:checked) label[for="forest-view-tag"],
.forest:has(#forest-view-grid:checked) label[for="forest-view-grid"] {
  background-color: var(--highlight); color: var(--dark);
}
.forest-view { display: none; overflow-x: auto; }
#forest-view-time:checked ~ .forest-view-time,
#forest-view-tag:checked ~ .forest-view-tag,
#forest-view-grid:checked ~ .forest-view-grid { display: block; }
.forest-stats { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; font-size: 0.85rem; color: var(--darkgray); }
.forest-stats .dot { display: inline-block; width: 0.6rem; height: 0.6rem; border-radius: 50%; margin-right: 0.35rem; vertical-align: middle; }
.forest-legend { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem; font-size: 0.75rem; color: var(--gray); }
.forest-group { margin-bottom: 1.5rem; }
.forest-group > h4 { margin: 0 0 0.25rem 0; font-size: 0.95rem; color: var(--darkgray); font-weight: 600; }
.forest-canvas { overflow: visible; min-width: 640px; }
.forest-tree { cursor: pointer; transition: opacity 0.2s ease; }
.forest-tree:hover { opacity: 0.72; }
.forest-branch {
  stroke-dasharray: 100; stroke-dashoffset: 100;
  animation: forest-draw 0.9s cubic-bezier(0.22, 0.8, 0.3, 1) forwards;
}
.forest-leaf {
  transform-box: fill-box; transform-origin: center;
  transform: scale(0); animation: forest-pop 0.55s cubic-bezier(0.34, 1.4, 0.64, 1) forwards;
}
.forest-root {
  stroke-dasharray: 100; stroke-dashoffset: 100;
  animation: forest-draw 1.1s ease-out forwards;
}
@keyframes forest-draw { to { stroke-dashoffset: 0; } }
@keyframes forest-pop { to { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .forest-branch, .forest-leaf, .forest-root { animation: none; stroke-dashoffset: 0; transform: none; }
}
.forest-empty { color: var(--gray); font-size: 0.9rem; }
`

function legendColor(key) {
  if (key === "seedling") return "hsl(128 42% 52%)"
  if (key === "budding") return "hsl(128 44% 42%)"
  return "hsl(140 46% 34%)"
}

// ------------------------------------------------------- 组件
var Forest = (userOpts) => {
  const opts = { pageSlug: "forest", perRow: 8, ...userOpts }

  const ForestComponent = (props) => {
    if (slugOf(props.fileData) !== opts.pageSlug) return null
    const notes = (props.allFiles ?? []).filter(isNote)

    if (notes.length === 0) {
      return h("div", { class: "forest" }, h("p", { class: "forest-empty", children: "还没有笔记。" }))
    }

    const counts = { seedling: 0, budding: 0, evergreen: 0, unknown: 0 }
    let linkCount = 0
    const linkKeys = new Set()
    for (const note of notes) {
      counts[maturityOf(note) ?? "unknown"] += 1
    }
    for (const note of notes) {
      for (const raw of note.links ?? []) {
        const target = String(raw).replace(/\/index$/, "")
        const hit = notes.find((n) => slugOf(n).replace(/\/index$/, "") === target)
        if (hit && hit.slug !== note.slug) {
          const key = [slugOf(note), slugOf(hit)].sort().join("|")
          if (!linkKeys.has(key)) linkKeys.add(key)
        }
      }
    }
    linkCount = linkKeys.size

    const stats = h("div", { class: "forest-stats" }, [
      ...Object.entries(LEVELS).map(([key, meta]) =>
        h("span", { class: `forest-stat forest-stat-${key}` }, [
          h("span", { class: "dot", style: `background:${legendColor(key)}` }),
          `${meta.label} ${counts[key]}`,
        ]),
      ),
      h("span", { class: "forest-stat forest-stat-unknown" }, [
        h("span", { class: "dot", style: "background:hsl(35 12% 62%)" }),
        `未标记 ${counts.unknown}`,
      ]),
      h("span", { class: "forest-stat" }, `连接 ${linkCount}`),
    ])

    const legend = h("div", { class: "forest-legend" }, [
      "颜色越绿表示最近还在打理，偏黄说明很久没动过；树下的曲线是笔记之间的链接。",
    ])

    const tabs = h("div", { class: "forest-tabs" }, [
      h("label", { for: "forest-view-time", children: "按时间" }),
      h("label", { for: "forest-view-tag", children: "按标签" }),
      h("label", { for: "forest-view-grid", children: "网格" }),
    ])

    const tagGroups = groupedByTag(notes)
    let indexBase = 0

    return h("div", { class: "forest" }, [
      h("input", {
        class: "forest-radio",
        type: "radio",
        name: "forest-view",
        id: "forest-view-time",
        checked: true,
      }),
      h("input", { class: "forest-radio", type: "radio", name: "forest-view", id: "forest-view-tag" }),
      h("input", {
        class: "forest-radio",
        type: "radio",
        name: "forest-view",
        id: "forest-view-grid",
      }),
      stats,
      legend,
      tabs,
      h("div", { class: "forest-view forest-view-time" }, forestScene(byTime(notes), opts.perRow, "time", 0)),
      h(
        "div",
        { class: "forest-view forest-view-tag" },
        ...tagGroups.map(([tag, list]) => {
          const scene = forestScene(list, Math.min(opts.perRow, Math.max(2, list.length)), `tag-${indexBase}`, indexBase)
          indexBase += list.length
          return h("div", { class: "forest-group" }, [
            h("h4", { children: `${tag} (${list.length})` }),
            scene,
          ])
        }),
      ),
      h("div", { class: "forest-view forest-view-grid" }, forestScene(bySlug(notes), opts.perRow, "grid", 0)),
    ])
  }

  ForestComponent.css = css
  ForestComponent.displayName = "Forest"
  return ForestComponent
}

export { Forest, Forest as default }
