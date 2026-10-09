import { jsx, jsxs } from "preact/jsx-runtime"

// ---------------------------------------------------------------- helpers
const h = (type, props, ...kids) => {
  if (kids.length === 0) return jsx(type, props)
  return jsx(type, { ...props, children: kids.length === 1 ? kids[0] : kids })
}

const CELL_W = 64
const CELL_H = 88
const GROUND = 76
const DAY = 86400000

const LEVELS = {
  seedling: { label: "幼苗", order: 0 },
  budding: { label: "抽芽", order: 1 },
  evergreen: { label: "常青", order: 2 },
}

function maturityOf(file) {
  const raw = String(file?.frontmatter?.maturity ?? "")
    .trim()
    .toLowerCase()
  return Object.prototype.hasOwnProperty.call(LEVELS, raw) ? raw : null
}

function titleOf(file) {
  return file?.frontmatter?.title ?? file?.slug ?? "未命名"
}

function slugOf(file) {
  return String(file?.slug ?? "")
}

function modifiedTime(file) {
  const d = file?.dates?.modified ?? file?.dates?.created
  const t = d instanceof Date ? d.getTime() : typeof d === "string" ? Date.parse(d) : NaN
  return Number.isFinite(t) ? t : null
}

function createdTime(file) {
  const d = file?.dates?.created ?? file?.dates?.modified
  const t = d instanceof Date ? d.getTime() : typeof d === "string" ? Date.parse(d) : NaN
  return Number.isFinite(t) ? t : null
}

// 新鲜度：越久没动过越枯黄
function colorFor(file) {
  const t = modifiedTime(file)
  if (t === null) return "hsl(35 15% 62%)"
  const days = (Date.now() - t) / DAY
  if (days <= 30) return "hsl(135 45% 40%)"
  if (days <= 90) return "hsl(105 38% 42%)"
  if (days <= 180) return "hsl(65 32% 45%)"
  return "hsl(35 22% 55%)"
}

function isNote(file) {
  const slug = slugOf(file)
  if (!slug) return false
  // 没有 filePath 的是自动生成的 folder / tag 页，不是真实笔记
  if (!file.filePath) return false
  if (slug === "index" || slug === "404" || slug === "forest") return false
  if (slug.startsWith("tags/")) return false
  return true
}

// ---------------------------------------------------------------- tree svg
function treeNode(file, x0, y0) {
  const maturity = maturityOf(file)
  const color = colorFor(file)
  const title = titleOf(file)
  const levelLabel = maturity ? LEVELS[maturity].label : "未标记"
  const href = `/${slugOf(file)}`

  const tooltip = jsx("title", { children: `${title} · ${levelLabel}` })

  let shape
  if (maturity === "seedling") {
    shape = [
      h("line", {
        x1: x0 + 32,
        y1: y0 + GROUND,
        x2: x0 + 32,
        y2: y0 + 60,
        stroke: color,
        "stroke-width": 2,
      }),
      h("ellipse", {
        cx: x0 + 25,
        cy: y0 + 58,
        rx: 7,
        ry: 4,
        fill: color,
        transform: `rotate(-25 ${x0 + 25} ${y0 + 58})`,
      }),
      h("ellipse", {
        cx: x0 + 39,
        cy: y0 + 58,
        rx: 7,
        ry: 4,
        fill: color,
        transform: `rotate(25 ${x0 + 39} ${y0 + 58})`,
      }),
    ]
  } else if (maturity === "budding") {
    shape = [
      h("line", {
        x1: x0 + 32,
        y1: y0 + GROUND,
        x2: x0 + 32,
        y2: y0 + 52,
        stroke: color,
        "stroke-width": 3,
      }),
      h("polygon", {
        points: `${x0 + 32},${y0 + 18} ${x0 + 18},${y0 + 56} ${x0 + 46},${y0 + 56}`,
        fill: color,
      }),
    ]
  } else if (maturity === "evergreen") {
    shape = [
      h("line", {
        x1: x0 + 32,
        y1: y0 + GROUND,
        x2: x0 + 32,
        y2: y0 + 44,
        stroke: color,
        "stroke-width": 4,
      }),
      h("polygon", {
        points: `${x0 + 32},${y0 + 6} ${x0 + 13},${y0 + 42} ${x0 + 51},${y0 + 42}`,
        fill: color,
      }),
      h("polygon", {
        points: `${x0 + 32},${y0 + 22} ${x0 + 8},${y0 + 58} ${x0 + 56},${y0 + 58}`,
        fill: color,
        opacity: 0.9,
      }),
      h("polygon", {
        points: `${x0 + 32},${y0 + 38} ${x0 + 4},${y0 + 72} ${x0 + 60},${y0 + 72}`,
        fill: color,
        opacity: 0.82,
      }),
    ]
  } else {
    // 未标记成熟度：地上一颗种子
    shape = [h("circle", { cx: x0 + 32, cy: y0 + GROUND - 4, r: 5, fill: "hsl(35 12% 65%)" })]
  }

  return h("a", { href, class: "forest-tree", children: [tooltip, ...shape] })
}

function forestSvg(list, perRow) {
  const rows = Math.max(1, Math.ceil(list.length / perRow))
  const width = perRow * CELL_W
  const height = rows * CELL_H + 8

  const ground = []
  for (let r = 0; r < rows; r++) {
    ground.push(
      h("line", {
        x1: 0,
        y1: r * CELL_H + GROUND,
        x2: width,
        y2: r * CELL_H + GROUND,
        stroke: "var(--lightgray)",
        "stroke-width": 1,
      }),
    )
  }

  const trees = list.map((file, i) => {
    const col = i % perRow
    const row = Math.floor(i / perRow)
    return treeNode(file, col * CELL_W, row * CELL_H)
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
    ...ground,
    ...trees,
  )
}

// ---------------------------------------------------------------- layouts
function byTime(notes) {
  return [...notes].sort((a, b) => {
    const ta = createdTime(a) ?? Infinity
    const tb = createdTime(b) ?? Infinity
    return ta - tb
  })
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

// ---------------------------------------------------------------- component
var css = `
.forest { margin: 1.5rem 0; }
.forest-radio { position: absolute; opacity: 0; pointer-events: none; }
.forest-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
.forest-tabs label {
  cursor: pointer;
  border: 1px solid var(--lightgray);
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  font-size: 0.9rem;
  color: var(--darkgray);
  user-select: none;
}
.forest:has(#forest-view-time:checked) label[for="forest-view-time"],
.forest:has(#forest-view-tag:checked) label[for="forest-view-tag"],
.forest:has(#forest-view-grid:checked) label[for="forest-view-grid"] {
  background-color: var(--highlight);
  color: var(--dark);
}
.forest-view { display: none; }
#forest-view-time:checked ~ .forest-view-time,
#forest-view-tag:checked ~ .forest-view-tag,
#forest-view-grid:checked ~ .forest-view-grid { display: block; }
.forest-stats { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; font-size: 0.9rem; color: var(--darkgray); }
.forest-stats .dot { display: inline-block; width: 0.6rem; height: 0.6rem; border-radius: 50%; margin-right: 0.35rem; vertical-align: middle; }
.forest-group { margin-bottom: 1.5rem; }
.forest-group > h4 { margin: 0 0 0.25rem 0; font-size: 0.95rem; color: var(--darkgray); font-weight: 600; }
.forest-view { overflow-x: auto; }
.forest-canvas { overflow: visible; min-width: 560px; }
.forest-tree { cursor: pointer; }
.forest-tree:hover { opacity: 0.75; }
.forest-empty { color: var(--gray); font-size: 0.9rem; }
`

var Forest = (userOpts) => {
  const opts = { pageSlug: "forest", perRow: 12, ...userOpts }

  const ForestComponent = (props) => {
    // 只在 /forest 页面渲染
    if (slugOf(props.fileData) !== opts.pageSlug) return null

    const notes = (props.allFiles ?? []).filter(isNote)

    if (notes.length === 0) {
      return h("div", { class: "forest" }, h("p", { class: "forest-empty", children: "还没有笔记。" }))
    }

    const counts = { seedling: 0, budding: 0, evergreen: 0, unknown: 0 }
    for (const note of notes) {
      const m = maturityOf(note)
      counts[m ?? "unknown"] += 1
    }

    const stats = h(
      "div",
      { class: "forest-stats" },
      ...Object.entries(LEVELS).map(([key, meta]) =>
        h("span", { class: `forest-stat forest-stat-${key}` }, [
          h("span", { class: "dot", style: `background:${legendColor(key)}` }),
          `${meta.label} ${counts[key]}`,
        ]),
      ),
      h("span", { class: "forest-stat forest-stat-unknown" }, [
        h("span", { class: "dot", style: "background:hsl(35 12% 65%)" }),
        `未标记 ${counts.unknown}`,
      ]),
    )

    const tabs = h("div", { class: "forest-tabs" }, [
      h("label", { for: "forest-view-time", children: "按时间" }),
      h("label", { for: "forest-view-tag", children: "按标签" }),
      h("label", { for: "forest-view-grid", children: "网格" }),
    ])

    const tagGroups = groupedByTag(notes)

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
      tabs,
      h("div", { class: "forest-view forest-view-time" }, forestSvg(byTime(notes), opts.perRow)),
      h(
        "div",
        { class: "forest-view forest-view-tag" },
        ...tagGroups.map(([tag, list]) =>
          h("div", { class: "forest-group" }, [
            h("h4", { children: `${tag} (${list.length})` }),
            forestSvg(list, opts.perRow),
          ]),
        ),
      ),
      h("div", { class: "forest-view forest-view-grid" }, forestSvg(bySlug(notes), opts.perRow)),
    ])
  }

  ForestComponent.css = css
  ForestComponent.displayName = "Forest"
  return ForestComponent
}

function legendColor(key) {
  if (key === "seedling") return "hsl(135 45% 40%)"
  if (key === "budding") return "hsl(105 38% 42%)"
  return "hsl(150 40% 32%)"
}

export { Forest, Forest as default }
