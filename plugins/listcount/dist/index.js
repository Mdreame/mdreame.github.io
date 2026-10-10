import fs from "node:fs"
import path from "node:path"

// ---------------------------------------------------------------------------
// tag-page / folder-page 插件会在列表前面写一整句篇数，比如
//   "1 item with this tag."（/tags/writing、/tags）
//   "1 item under this folder."（/english、/english/writing …）
// 这里在页面生成之后把它摘掉，只把数字做成小胶囊挪到标题旁边：
//   标签页/文件夹页  <h1 class="article-title">English<span class="list-count">1</span></h1>
//   标签索引页        <h2><a class="tag-link">writing</a><span class="list-count">1</span></h2>
// 句子由插件按 locale 生成，默认覆盖 en-US / en-GB / zh-CN / zh-TW；
// 换用其它语言时给 patterns 传一组新的正则即可，匹配不上就原样保留。
// ---------------------------------------------------------------------------

// 篇数超过每页上限时，插件会在同一个 <p> 里再补一个 span（"Showing first 10 tags."）
const TAIL = String.raw`(?:\s*<span>([^<]*)</span>)?`

const DEFAULT_PATTERNS = [
  // 标签页
  `<p>(\\d+)\\s+items? with this tag\\.${TAIL}</p>`, // en-US / en-GB
  `<p>此标[签籤]下有\\s*(\\d+)\\s*[条條]笔[记記]。${TAIL}</p>`, // zh-CN
  `<p>此標籤下有\\s*(\\d+)\\s*條筆記。${TAIL}</p>`, // zh-TW
  // 文件夹页
  `<p>(\\d+)\\s+items? under this folder\\.${TAIL}</p>`, // en-US / en-GB
  `<p>此文件夹下有\\s*(\\d+)\\s*条笔记。${TAIL}</p>`, // zh-CN
  `<p>此資料夾下有\\s*(\\d+)\\s*條筆記。${TAIL}</p>`, // zh-TW
]

const LISTING_OPEN = '<div class="page-listing">'
const H1_OPEN = '<h1 class="article-title">'

/**
 * 篇数所属的标题：
 * - 标签索引页（/tags）里每个标签各有一条列表，标题是标签名所在的 h2
 * - 其余页面（标签页、文件夹页）整页只有一条列表，标题就是页面标题 h1
 */
function findHeading(html, at) {
  // 往前面逐个找 h2，两个条件把正文里的小标题排除掉：
  // 1. h2 里得是指向标签页的链接；2. h2 到列表之间不能隔着 </div>/</article> 这类块级闭合标签
  let searchBefore = at
  for (;;) {
    const h2 = html.lastIndexOf("<h2>", searchBefore)
    if (h2 === -1) break
    const h2End = html.indexOf("</h2>", h2)
    if (h2End === -1 || h2End >= at) break
    const between = html.slice(h2End + "</h2>".length, at)
    if (html.slice(h2, h2End).includes("tag-link") && !/<\/(div|article|section)>/.test(between)) {
      return h2End
    }
    searchBefore = h2 - 1
  }

  const h1 = html.lastIndexOf(H1_OPEN, at)
  if (h1 !== -1) {
    const h1End = html.indexOf("</h1>", h1)
    if (h1End !== -1) return h1End
  }
  return null
}

/** 把一页 HTML 里的篇数挪进标题，返回改好的 HTML（没匹配到就原样返回） */
function moveCounts(html, patterns) {
  const edits = []

  for (const re of patterns) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(html)) !== null) {
      const head = html.slice(0, m.index)
      const open = head.lastIndexOf(LISTING_OPEN)
      // 只会摘列表开头的那一句，正文里出现同样的话不动
      if (open === -1 || open + LISTING_OPEN.length !== m.index) continue
      const titleEnd = findHeading(html, m.index)
      if (titleEnd === null) continue

      const [, count, note] = m
      edits.push({
        start: m.index,
        end: m.index + m[0].length,
        text: note ? `<p class="list-count-note">${note.trim()}</p>` : "",
      })
      edits.push({
        start: titleEnd,
        end: titleEnd,
        text: `<span class="list-count">${count}</span>`,
      })
    }
  }

  if (edits.length === 0) return html
  edits.sort((a, b) => b.start - a.start) // 从后往前改，前面的下标才不会失效
  let out = html
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end)
  }
  return out
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

var ListCount = (userOpts) => {
  const opts = { patterns: DEFAULT_PATTERNS, ...userOpts }
  const patterns = opts.patterns.map((p) => {
    const re = p instanceof RegExp ? p : new RegExp(p)
    // exec 循环要靠 g 标志推进，没带就补上
    return re.global ? re : new RegExp(re.source, re.flags + "g")
  })

  return {
    name: "ListCount",
    getQuartzComponents() {
      return []
    },
    async *emit(ctx) {
      const outDir = String(ctx.argv.output ?? "public")
      if (!fs.existsSync(outDir)) return

      for (const file of htmlFiles(outDir)) {
        const html = fs.readFileSync(file, "utf-8")
        const next = moveCounts(html, patterns)
        if (next === html) continue
        fs.writeFileSync(file, next, "utf-8")
        yield file
      }
    },
  }
}

export { ListCount, ListCount as default }
