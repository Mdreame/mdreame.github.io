import { readFileSync, readdirSync } from "node:fs"
import { basename, extname, join, relative, resolve } from "node:path"
import { parse as parseYaml } from "yaml"

const root = resolve("content")
const ignored = new Set([".obsidian", "private", "templates"])
const files = []
const errors = []

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) walk(join(dir, entry.name))
    } else if (entry.isFile()) {
      files.push(join(dir, entry.name))
    }
  }
}

walk(root)
const pages = files.filter((file) => extname(file) === ".md")
const byName = new Map()
for (const file of pages) {
  const name = basename(file, ".md")
  byName.set(name, [...(byName.get(name) ?? []), file])
}

const published = new Map()
for (const file of pages) {
  const path = relative(root, file)
  const source = readFileSync(file, "utf8")
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) {
    if (basename(file) === "index.md") errors.push(`${path}: index 页面缺少开头的 YAML 属性`)
    continue
  }

  let meta
  try {
    meta = parseYaml(match[1], { uniqueKeys: true })
  } catch (error) {
    errors.push(`${path}: YAML 解析失败：${error.message}`)
    continue
  }
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    errors.push(`${path}: YAML 属性应是键值表`)
    continue
  }
  if (basename(file) === "index.md" && meta.publish !== true) {
    errors.push(`${path}: 入口页面必须明确设置 publish: true`)
  }
  if (meta.publish !== true) continue

  if (meta.draft === true) errors.push(`${path}: publish: true 与 draft: true 冲突`)
  const created = meta.created instanceof Date ? meta.created : new Date(meta.created)
  if (!meta.created || Number.isNaN(created.getTime())) {
    errors.push(`${path}: 已发布笔记需要有效的 created 日期`)
  }
  published.set(file, source.slice(match[0].length))
}

function resolveWiki(sourceFile, target) {
  const name = decodeURIComponent(target.split("#")[0].split("|")[0].trim())
  if (!name) return null
  if (name.startsWith("/")) return resolveRoute(name)
  const clean = name.replace(/^\//, "")
  if (extname(clean) && extname(clean) !== ".md") {
    const asset = resolve(root, clean)
    return files.includes(asset) ? null : `资源不存在：${name}`
  }
  const stem = clean.replace(/\.md$/, "")
  const candidates = stem.includes("/")
    ? [resolve(root, `${stem}.md`), resolve(join(sourceFile, ".."), `${stem}.md`)]
    : (byName.get(stem) ?? [])
  const found = candidates.find((file) => published.has(file))
  if (found) return null
  return `目标不存在或未发布：${name}`
}

function resolveRoute(target) {
  const route = decodeURIComponent(target.split(/[?#]/)[0]).replace(/^\/+|\/+$/g, "")
  if (!route || route === "garden" || route === "tags" || route.startsWith("tags/")) return null
  const page = resolve(root, `${route.replace(/\.html$/, "")}.md`)
  const index = resolve(root, route.replace(/\.html$/, ""), "index.md")
  if (published.has(page) || published.has(index)) return null
  if ([...published.keys()].some((file) => relative(root, file).startsWith(`${route}/`)))
    return null
  return `站内页面不存在：/${route}`
}

for (const [file, body] of published) {
  const path = relative(root, file)
  const prose = body.replace(/```[\s\S]*?```/g, "")
  for (const match of prose.matchAll(/!?\[\[([^\]]+)\]\]/g)) {
    try {
      const error = resolveWiki(file, match[1])
      if (error) errors.push(`${path}: ${error}`)
    } catch {
      errors.push(`${path}: 无法解析链接 ${match[1]}`)
    }
  }
  for (const match of prose.matchAll(/\]\((\/[^)\s]+)(?:\s+[^)]*)?\)|href=["'](\/[^"']+)["']/g)) {
    try {
      const error = resolveRoute(match[1] ?? match[2])
      if (error) errors.push(`${path}: ${error}`)
    } catch {
      errors.push(`${path}: 无法解析站内链接 ${match[1] ?? match[2]}`)
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`✗ ${error}`)
  process.exitCode = 1
} else {
  console.log(`内容检查通过：${published.size} 个已发布页面，内部链接均有效`)
}
