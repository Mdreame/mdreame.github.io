import fs from "node:fs"
import path from "node:path"
import { resolveRelative, slugTag } from "@quartz-community/utils"

// ---------------------------------------------------------------------------
// bases 表格把标签渲染成一串纯文本：
//   <td data-value="howto"><span class="bases-list"><span class="bases-text">howto</span></span></td>
// 而在标签页 / 文件夹页里，同样的标签是可点的胶囊。这里在页面生成之后
// 把标签列（data-column 是 file.tags、note.tags 这类）里的每个值换成
// 和 PageList 完全一样的链接：
//   <a class="internal tag-link" href="./tags/howto">howto</a>
// 只改 .base 页面里 class="bases-table" 的表格，表格里只有列名以 tags
// 结尾的列会被动，其它列（含分组标题行）原样保留。
// ---------------------------------------------------------------------------

const TAG_COLUMN = /(^|\.)tags$/

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }
const unescapeHTML = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ENTITIES[e])

/** 把一格里的每个标签值换成标签页链接；href 用和站内一致的 slug 规则 */
function linkifyCell(cell, pageSlug) {
  return cell.replace(/<span class="bases-text">([^<]*)<\/span>/g, (whole, raw) => {
    const tag = unescapeHTML(raw).trim()
    if (tag.length === 0) return whole
    const href = resolveRelative(pageSlug, `tags/${slugTag(tag)}`)
    return `<a class="internal tag-link" href="${href}">${raw}</a>`
  })
}

/** 找到表头里所有标签列的下标，只在这些列上做替换 */
function linkifyTable(table, pageSlug) {
  const thead = table.match(/<thead[\s\S]*?<\/thead>/)
  if (!thead) return table

  const tagColumns = new Set(
    [...thead[0].matchAll(/data-column="([^"]*)"/g)]
      .map((m, i) => (TAG_COLUMN.test(m[1]) ? i : -1))
      .filter((i) => i >= 0),
  )
  if (tagColumns.size === 0) return table

  return table.replace(/<tr\b[\s\S]*?<\/tr>/g, (row) => {
    if (row.includes("colspan")) return row // 分组标题行只有一格，不是数据
    let column = -1
    return row.replace(/<td\b[^>]*>[\s\S]*?<\/td>/g, (cell) => {
      column += 1
      return tagColumns.has(column) ? linkifyCell(cell, pageSlug) : cell
    })
  })
}

function linkifyBaseTags(html, pageSlug) {
  return html.replace(/<table class="bases-table"[\s\S]*?<\/table>/g, (table) =>
    linkifyTable(table, pageSlug),
  )
}

function* htmlFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "static") yield* htmlFiles(full)
    } else if (entry.name.endsWith(".html")) {
      yield full
    }
  }
}

var BaseTags = () => ({
  name: "BaseTags",
  getQuartzComponents() {
    return []
  },
  async *emit(ctx) {
    const outDir = String(ctx.argv.output ?? "public")
    if (!fs.existsSync(outDir)) return

    for (const file of htmlFiles(outDir)) {
      if (!file.endsWith(".base.html")) continue
      const html = fs.readFileSync(file, "utf-8")
      const slug = path.relative(outDir, file).split(path.sep).join("/").replace(/\.html$/, "")
      const next = linkifyBaseTags(html, slug)
      if (next === html) continue
      fs.writeFileSync(file, next, "utf-8")
      yield file
    }
  },
})

export { BaseTags, BaseTags as default }
