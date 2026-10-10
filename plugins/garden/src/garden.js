import { createGarden } from "./scene.js"
import { linkedNotes } from "./layout.js"
const data = window.__GARDEN__ ?? { notes: [], total: 0, root: "./" }
const notes = data.notes.map((note) => (note.fruit ? { ...note, maturity: "tree" } : note))
let garden = null,
  failed = false
const $ = (id) => document.getElementById(id)
const levels = {
  seed: ["种子", "刚刚收集的灵感"],
  growing: ["生长中", "正在整理与探索"],
  tree: ["常青", "已经清晰，仍会更新"],
}
const noteState = (note) => `${levels[note.maturity][0]}${note.fruit ? " · 结果" : ""}`
const palette = ["#789573", "#b6a071", "#8c9fba", "#ae957e", "#9b9a74"]
let topic = "",
  level = "all",
  query = "",
  view = "map",
  selected = null
const root = data.root || "./"
const topicOf = (note) => note.tags?.[0]?.replace(/^\/+/, "").split("/")[0] || "未分类"
const topics = [...new Set(notes.map(topicOf))].sort((a, b) => a.localeCompare(b, "zh"))
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  )
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))
    : "尚未记录"
function plant(maturity, large = false, fruit = false) {
  const common =
    '<ellipse cx="40" cy="75" rx="23" ry="6" fill="#c7d4b1" opacity=".55"/><path d="M22 75q18-9 36 0" fill="none" stroke="#a6b98a" stroke-width="1.2"/>'
  const stems = '<path d="M40 73V41" stroke="#718953" stroke-width="3" stroke-linecap="round"/>'
  const shapes = {
    seed: '<ellipse cx="40" cy="70" rx="7" ry="4" fill="#b09b6f"/><path d="M40 69v-8" stroke="#81975c" stroke-width="2"/><path d="M40 64q-12 0-12-9 11-2 12 9" fill="#99b575"/>',
    growing:
      stems +
      '<path d="M40 63Q16 61 19 44 38 44 40 63" fill="#88a66a"/><path d="M40 50Q41 31 61 34 60 49 40 50" fill="#9cb879"/><path d="M40 42Q25 32 32 18 48 26 40 42" fill="#73965c"/>',
    tree: '<path d="M40 74V36m0 23L27 45m13 8 13-15" fill="none" stroke="#8c805c" stroke-width="4" stroke-linecap="round"/><path d="M15 40C8 26 21 14 32 16 39 0 61 9 60 23 80 28 70 53 55 51 39 64 16 56 15 40" fill="#6f9565"/><path d="M16 38C13 22 29 17 37 22 38 12 52 11 58 22 52 41 32 48 16 38" fill="#8ead7c"/><path d="M26 49Q48 56 64 38" fill="none" stroke="#527d54" stroke-width="2" opacity=".5"/>',
    fruit:
      '<path d="M40 74V37" stroke="#897750" stroke-width="4"/><path d="M13 39C5 23 22 14 30 16 36 0 60 6 62 23 81 26 73 50 60 50 45 65 13 56 13 39" fill="#4f7c59"/><path d="M13 35C12 20 28 16 36 21 42 7 57 13 61 24 49 41 29 45 13 35" fill="#719565"/><g fill="#d7a35e"><circle cx="26" cy="33" r="4"/><circle cx="49" cy="24" r="4"/><circle cx="57" cy="43" r="4"/><circle cx="36" cy="47" r="4"/></g>',
  }
  return `<svg viewBox="0 0 80 84" fill="none" aria-hidden="true"${large ? ' class="large-plant"' : ""}>${common}${shapes[fruit ? "fruit" : maturity] || shapes.seed}</svg>`
}
function matching() {
  return notes.filter(
    (n) =>
      (!topic || topicOf(n) === topic) &&
      (level === "all" || (level === "fruit" ? n.fruit : n.maturity === level)) &&
      (!query ||
        `${n.title} ${n.tags.join(" ")} ${n.description || ""}`
          .toLocaleLowerCase()
          .includes(query)),
  )
}
function renderTopics() {
  $("topics").innerHTML = [["", "整座花园"], ...topics.map((t) => [t, t])]
    .map(
      ([key, label], i) =>
        `<button class="topic${topic === key ? " active" : ""}" data-topic="${escape(key)}" aria-pressed="${topic === key}"><span class="topic-dot" style="--topic-color:${palette[i % palette.length]}"></span><span class="topic-name">${escape(label)}</span><small>${key ? notes.filter((n) => topicOf(n) === key).length : notes.length}</small></button>`,
    )
    .join("")
}
function renderFilters() {
  $("filters").innerHTML = [["all", ["全部"]], ...Object.entries(levels), ["fruit", ["结果 🍊"]]]
    .map(
      ([key, [label]]) =>
        `<button data-level="${key}" aria-pressed="${level === key}">${label} <span>${notes.filter((n) => (!topic || topicOf(n) === topic) && (key === "all" || (key === "fruit" ? n.fruit : n.maturity === key))).length}</span></button>`,
    )
    .join("")
}
function render() {
  const visible = matching()
  renderTopics()
  renderFilters()
  $("search-results").hidden = !query
  $("search-results").innerHTML =
    visible
      .slice(0, 8)
      .map(
        (n) =>
          `<button data-note="${escape(n.slug)}">${escape(n.title)}<small>${noteState(n)} · ${escape(topicOf(n))}</small></button>`,
      )
      .join("") || "<p>没有找到匹配的笔记</p>"
  if (visible.length > 8)
    $("search-results").insertAdjacentHTML(
      "beforeend",
      "<p>显示前 8 个结果，可在列表中查看全部。</p>",
    )
  $("view-title").textContent = topic || "整座花园"
  $("result-count").textContent = `${visible.length} / ${data.total} 篇笔记`
  $("note-list").innerHTML = visible
    .map(
      (n) =>
        `<button class="note-row" data-note="${escape(n.slug)}" aria-pressed="${selected?.slug === n.slug}">${plant(n.maturity, false, n.fruit)}<span><strong>${escape(n.title)}</strong><small>${escape(topicOf(n))} · ${noteState(n)}</small></span><small>${date(n.modified)}</small></button>`,
    )
    .join("")
  $("empty").hidden = visible.length > 0
  $("map").hidden = view !== "map" && visible.length > 0
  $("map").classList.toggle("no-results", visible.length === 0)
  $("note-list").hidden = view !== "list" || visible.length === 0
  $("map-view").setAttribute("aria-pressed", String(view === "map"))
  $("list-view").setAttribute("aria-pressed", String(view === "list"))
  $("random").disabled = visible.length === 0
  if (selected && !visible.includes(selected)) {
    selected = null
    renderDetail()
  }
  garden?.setState(
    visible.map((n) => n.slug),
    selected?.slug,
    level !== "all" || !!topic || !!query,
  )
  garden?.setVisible(view === "map")
}
function renderDetail() {
  $("detail").classList.toggle("selected", !!selected)
  if (!selected) {
    $("detail-content").innerHTML =
      `<div class="detail-eyebrow">GROWTH GUIDE <span>01 — 03</span></div><div class="specimen">${plant("tree", true)}</div><h2>每个想法，<br>都有自己的节奏。</h2><p class="description">种子、生长中、常青，记录笔记成熟的过程；真正帮到生活的笔记，会结出果实。</p><ul class="growth-legend">${Object.entries(
        levels,
      )
        .map(
          ([key, [label, desc]]) =>
            `<li>${plant(key)}<span>${label}<small>${desc}</small></span></li>`,
        )
        .join(
          "",
        )}<li>${plant("tree", false, true)}<span>果实<small>在实践中产生了价值</small></span></li></ul>`
    return
  }
  const n = selected
  const related = linkedNotes(notes, n.slug)
  const relatedHtml = [...related]
    .map((slug) => notes.find((note) => note.slug === slug))
    .filter(Boolean)
    .map(
      (note) =>
        `<button data-note="${escape(note.slug)}">${escape(note.title)}<small>${noteState(note)}</small></button>`,
    )
    .join("")
  $("detail-content").innerHTML =
    `<div class="detail-eyebrow">FIELD NOTES <button class="close-detail" id="close-detail" aria-label="关闭笔记详情">×</button></div><div class="specimen">${plant(n.maturity, true, n.fruit)}</div><span class="badge">${noteState(n)} · ${levels[n.maturity][1]}</span><h2>${escape(n.title)}</h2><p class="description">${escape(n.description ? n.description.slice(0, 180) + (n.description.length > 180 ? "…" : "") : "这颗想法正在慢慢生长。打开笔记，继续探索它的内容。")}</p><dl><div><dt>种下于</dt><dd>${date(n.created)}</dd></div><div><dt>最近照料</dt><dd>${date(n.modified)}</dd></div><div><dt>历史修订</dt><dd>${n.revisions || 0} 次</dd></div></dl><div class="detail-tags">${n.tags.map((t) => `<span># ${escape(t)}</span>`).join("")}</div>${relatedHtml ? `<div class="related-notes"><h3>关联的想法</h3>${relatedHtml}</div>` : ""}<a class="read-note" href="${escape(root + n.slug.split("/").map(encodeURIComponent).join("/"))}">打开这篇笔记 ↗</a><p class="detail-foot">想法在记录与回访中，慢慢扎根。<br>每次回访，都是一次照料。</p>`
}
function select(slug) {
  selected = notes.find((n) => n.slug === slug) || null
  if (selected && !matching().includes(selected)) {
    topic = ""
    level = "all"
    query = ""
    $("search").value = ""
  }
  render()
  renderDetail()
  if (selected) {
    $("detail").scrollTop = 0
    if (view === "map") garden?.focusNote(slug)
    $("close-detail").focus({ preventScroll: true })
    if (matchMedia("(max-width:700px)").matches)
      $("detail").scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "instant" : "smooth",
        block: "start",
      })
  }
}
if (data.total > notes.length)
  $("map-hint").textContent = `展示 ${notes.length} / ${data.total} 篇 · 点击植物查看`
$("topics").addEventListener("click", (e) => {
  const b = e.target.closest("[data-topic]")
  if (b) {
    topic = b.dataset.topic
    render()
    if (view === "map") garden?.focusTopic(topic)
    $("topics")
      .querySelectorAll("button")
      .forEach((el) => {
        if (el.dataset.topic === topic) el.focus()
      })
  }
})
$("filters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-level]")
  if (b) {
    level = b.dataset.level
    render()
    $("filters").querySelector(`[data-level="${level}"]`).focus()
  }
})
for (const id of ["note-list", "search-results"])
  $(id).addEventListener("click", (e) => {
    const b = e.target.closest("[data-note]")
    if (b) {
      if (id === "search-results" && !failed) view = "map"
      select(b.dataset.note)
    }
  })
$("search").addEventListener("input", (e) => {
  query = e.target.value.trim().toLocaleLowerCase()
  render()
})
$("map-view").addEventListener("click", () => {
  if (failed) return
  view = "map"
  render()
})
$("list-view").addEventListener("click", () => {
  view = "list"
  render()
})
$("clear").addEventListener("click", () => {
  topic = ""
  level = "all"
  query = ""
  $("search").value = ""
  render()
  $("search").focus()
})
$("random").addEventListener("click", () => {
  const list = matching()
  if (list.length) select(list[Math.floor(Math.random() * list.length)].slug)
})
function closeDetail() {
  const slug = selected?.slug
  selected = null
  render()
  renderDetail()
  const container = view === "map" ? $("scene-labels") : $("note-list")
  ;[...container.querySelectorAll("[data-note], [data-slug]")]
    .find((b) => (b.dataset.note || b.dataset.slug) === slug)
    ?.focus({ preventScroll: true })
}
$("detail").addEventListener("click", (e) => {
  if (e.target.closest("#close-detail")) closeDetail()
  const linked = e.target.closest(".related-notes [data-note]")
  if (linked) select(linked.dataset.note)
})
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey &&
    !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) &&
    !document.activeElement.isContentEditable
  ) {
    e.preventDefault()
    $("search").focus()
  }
  if (e.key === "Escape" && selected) closeDetail()
})
render()
renderDetail()

function fallback(message) {
  failed = true
  garden = null
  view = "list"
  $("scene-status").textContent = message
  $("scene-status").hidden = false
  $("map-view").disabled = true
  $("map-view").title = "当前设备无法显示 3D，仍可阅读全部笔记"
  $("map-hint").textContent = "点击列表中的笔记，继续探索"
  document.querySelector(".scene-controls").hidden = true
  $("garden-canvas").hidden = true
  render()
}
try {
  garden = createGarden({
    canvas: $("garden-canvas"),
    labels: $("scene-labels"),
    notes,
    onSelect: select,
    onFail: fallback,
    onRoamChange: (active) => {
      $("roam").setAttribute("aria-pressed", String(active))
      $("roam").textContent = active ? "Ⅱ 暂停" : "▷ 漫游"
    },
  })
  $("scene-status").hidden = true
  render()
} catch (error) {
  console.warn("Garden 3D unavailable", error)
  fallback("这个设备暂时无法显示 3D 花园，可以在列表里继续探索。")
}
$("overview").addEventListener("click", () => {
  garden?.overview()
})
$("zoom-in").addEventListener("click", () => garden?.zoom(0.8))
$("zoom-out").addEventListener("click", () => garden?.zoom(1.25))
$("roam").addEventListener("click", () =>
  garden?.setRoam($("roam").getAttribute("aria-pressed") !== "true"),
)
