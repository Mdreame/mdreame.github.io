import fs from "node:fs"
import path from "node:path"

function externalHref(href, siteHost) {
  if (!/^https?:\/\//i.test(href) && !href.startsWith("//")) return false
  try {
    const url = new URL(href, `https://${siteHost}`)
    return url.host !== siteHost
  } catch {
    return false
  }
}

export function openExternalLinks(html, baseUrl) {
  const siteHost = new URL(`https://${baseUrl}`).host
  return html.replace(/<a\b[^>]*>/gi, (tag) => {
    const href = tag.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
    if (!href || !externalHref(href[1] ?? href[2] ?? href[3], siteHost)) return tag

    let next = tag
    if (/\starget\s*=/i.test(next)) {
      next = next.replace(/\starget\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, ' target="_blank"')
    } else {
      next = next.replace(/>$/, ' target="_blank">')
    }

    const rel = next.match(/\srel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
    if (!rel) return next.replace(/>$/, ' rel="noopener noreferrer">')
    const values = new Set((rel[1] ?? rel[2] ?? rel[3]).split(/\s+/).filter(Boolean))
    values.add("noopener")
    values.add("noreferrer")
    return next.replace(rel[0], ` rel="${[...values].join(" ")}"`)
  })
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

const ExternalLinks = () => ({
  name: "ExternalLinks",
  getQuartzComponents() {
    return []
  },
  async *emit(ctx) {
    const outDir = String(ctx.argv.output ?? "public")
    if (!fs.existsSync(outDir)) return
    const baseUrl = ctx.cfg.configuration.baseUrl
    for (const file of htmlFiles(outDir)) {
      const html = fs.readFileSync(file, "utf8")
      const next = openExternalLinks(html, baseUrl)
      if (next === html) continue
      fs.writeFileSync(file, next, "utf8")
      yield file
    }
  },
})

export { ExternalLinks, ExternalLinks as default }
