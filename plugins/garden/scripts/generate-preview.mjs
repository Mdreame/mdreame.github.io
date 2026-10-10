import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "../../..")
const template = fs
  .readFileSync(path.join(root, "plugins/garden/src/page.html"), "utf8")
  .replaceAll("__ROOT__", "./")
const topics = [
  ["长篇主题", 50],
  ["次要主题", 25],
  ["轻量主题", 15],
  ["小主题", 7],
  ["果实主题", 3],
]
const notes = []
for (const [topic, size] of topics) {
  for (let index = 0; index < size; index++) {
    const id = notes.length
    const fruit = id % 4 === 0 && id % 5 !== 0
    notes.push({
      slug: `sim-note-${String(id).padStart(3, "0")}`,
      title: `${topic} ${String(index + 1).padStart(3, "0")}`,
      description: `模拟笔记 ${id + 1}，观察三档成长、关联高亮与果实标记。`,
      tags: [topic],
      maturity: fruit ? "tree" : id % 5 === 0 ? "seed" : id % 3 === 0 ? "growing" : "tree",
      fruit,
      links: id ? [`sim-note-${String(id - 1).padStart(3, "0")}`] : [],
      created: Date.UTC(2026, 0, 1),
      modified: Date.UTC(2026, 8, (id % 27) + 1),
      revisions: (id % 17) + 1,
    })
  }
}
const output = template.replace(
  "__PAYLOAD__",
  JSON.stringify({ notes, total: notes.length }).replaceAll("<", "\\u003c"),
)
const destination = path.join(root, "public/__garden-layout-sim.html")
fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.writeFileSync(destination, output)
console.log(`Wrote ${notes.length} mock notes to ${destination}`)
