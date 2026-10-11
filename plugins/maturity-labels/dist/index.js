import fs from "node:fs"
import path from "node:path"

const legacy = { sprout: "growing", sapling: "growing", fruit: "tree" }
const labels = { seed: "种子", growing: "生长中", tree: "常青" }

function growth(frontmatter) {
  const raw = String(frontmatter?.maturity ?? "")
    .trim()
    .toLowerCase()
  const fruit = frontmatter?.fruit === true || raw === "fruit"
  const stage = fruit ? "tree" : labels[raw] ? raw : legacy[raw] || "seed"
  return { stage, label: `${labels[stage]}${fruit ? " · 结果" : ""}` }
}

function badge({ stage, label }) {
  return `<span class="maturity-badge maturity-${stage}">${label}</span>`
}

function slugFromHref(href, pageSlug) {
  try {
    const url = new URL(href, `https://garden.local/${pageSlug}.html`)
    return decodeURIComponent(url.pathname.slice(1))
      .replace(/\.html$/, "")
      .replace(/\/index$/, "")
  } catch {
    return null
  }
}

export function addMaturityLabels(html, pageSlug, stages) {
  let next = html
  const ownStage = stages.get(pageSlug)
  if (ownStage) {
    next = next.replace(/(<h1 class="article-title">[\s\S]*?)(<\/h1>)/, (_, open, close) =>
      open.includes('class="maturity-badge')
        ? `${open}${close}`
        : `${open}${badge(ownStage)}${close}`,
    )
  }

  next = next.replace(
    /(<div class="desc"><h3><a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>)(<\/h3>)/g,
    (whole, open, href, close) => {
      const stage = stages.get(slugFromHref(href, pageSlug))
      return stage ? `${open}${badge(stage)}${close}` : whole
    },
  )

  next = next.replace(
    /(<td data-value="[^"]*"><a\b[^>]*data-slug="([^"]+)"[^>]*>[\s\S]*?<\/a>)(<\/td>)/g,
    (whole, open, slug, close) => {
      const stage = stages.get(slug)
      return stage ? `${open}${badge(stage)}${close}` : whole
    },
  )
  return next
}

function* htmlFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "static") yield* htmlFiles(file)
    } else if (entry.name.endsWith(".html")) {
      yield file
    }
  }
}

const MaturityLabels = () => ({
  name: "MaturityLabels",
  getQuartzComponents() {
    return []
  },
  async *emit(ctx, content) {
    const outDir = String(ctx.argv.output ?? "public")
    if (!fs.existsSync(outDir)) return
    const stages = new Map()
    for (const [, file] of content) {
      const slug = file.data.slug
      if (!file.data.filePath?.endsWith(".md") || !slug || slug === "index") continue
      if (slug.startsWith("tags/") || file.data.frontmatter?.draft === true) continue
      if (file.data.frontmatter?.unlisted === true) continue
      stages.set(slug, growth(file.data.frontmatter))
    }
    for (const file of htmlFiles(outDir)) {
      const pageSlug = path
        .relative(outDir, file)
        .split(path.sep)
        .join("/")
        .replace(/\.html$/, "")
      const html = fs.readFileSync(file, "utf8")
      const next = addMaturityLabels(html, pageSlug, stages)
      if (next === html) continue
      fs.writeFileSync(file, next, "utf8")
      yield file
    }
  },
})

export { MaturityLabels, MaturityLabels as default }
