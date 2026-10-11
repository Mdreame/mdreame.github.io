import { jsx } from "preact/jsx-runtime"
import { execFileSync } from "node:child_process"
import path from "node:path"

const h = (type, props, ...children) =>
  jsx(type, { ...props, children: children.length === 1 ? children[0] : children })

const DAY = 86_400_000
const zone = "Asia/Shanghai"
const dateParts = new Intl.DateTimeFormat("en-US", {
  timeZone: zone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function dayNumber(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = Object.fromEntries(
    dateParts.formatToParts(date).map(({ type, value }) => [type, value]),
  )
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))
}

function dayLabel(day) {
  const date = new Date(day)
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}

// The date transformer falls back to filesystem birthtime when a note has no
// `created` property. On a fresh CI checkout that would become the deploy day.
function creationDate(file, root = process.cwd()) {
  if (file.frontmatter?.created) return file.dates?.created ?? file.frontmatter.created
  if (file.filePath) {
    try {
      const relative = path.relative(root, path.resolve(root, file.filePath))
      const additions = execFileSync(
        "git",
        ["log", "--follow", "--diff-filter=A", "--format=%aI", "--", relative],
        { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim()
      if (additions) return additions.split("\n").at(-1)
    } catch {
      // A newly created, uncommitted note can still use its local file date.
    }
  }
  return file.dates?.created
}

function noteDays(allFiles, start, today) {
  const days = new Map()
  for (const file of allFiles) {
    if (!file.filePath?.endsWith(".md")) continue
    if (!file.slug || file.slug === "index" || file.slug.startsWith("tags/")) continue
    if (file.frontmatter?.draft === true || file.frontmatter?.unlisted === true) continue
    const note = {
      title: String(file.frontmatter?.title || file.slug),
      href: `/${String(file.slug).split("/").map(encodeURIComponent).join("/")}.html`,
    }
    const created = creationDate(file)
    if (!created) continue
    const day = dayNumber(created)
    if (day === null || day < start || day > today) continue
    const notes = days.get(day) ?? new Map()
    notes.set(file.slug, note)
    days.set(day, notes)
  }
  return days
}

const css = `
.activity-heatmap{margin:.5rem 0 1.5rem;color:var(--gray)}
.activity-heatmap-calendar{max-width:100%;overflow-x:auto;scrollbar-width:none}
.activity-heatmap-calendar::-webkit-scrollbar{display:none}
.activity-heatmap-grid{display:flex;gap:2px;width:max-content}
.activity-heatmap-week{position:relative;display:flex;flex-direction:column;gap:2px;flex:none;width:10px;padding-top:1rem}
.activity-heatmap-month{position:absolute;top:0;left:0;width:max-content;height:1rem;font-size:.64rem;white-space:nowrap}
.activity-heatmap-day{display:block;width:10px;height:10px;border-radius:2px;background:color-mix(in srgb,var(--gray) 20%,var(--light))}
.activity-heatmap-day[data-level="1"]{background:color-mix(in srgb,var(--secondary) 43%,var(--light))}
.activity-heatmap-day[data-level="2"]{background:color-mix(in srgb,var(--secondary) 62%,var(--light))}
.activity-heatmap-day[data-level="3"]{background:color-mix(in srgb,var(--secondary) 80%,var(--light))}
.activity-heatmap-day[data-level="4"]{background:var(--secondary)}
.activity-heatmap-day.is-outside{visibility:hidden}
.activity-heatmap-day[data-notes]{cursor:pointer}
.activity-heatmap-day[data-notes]:focus-visible{outline:1px solid var(--secondary);outline-offset:2px}
.activity-heatmap-popup{position:fixed;z-index:1000;display:none;min-width:170px;max-width:min(280px,calc(100vw - 24px));max-height:min(320px,60vh);overflow-y:auto;padding:.65rem .8rem;border:1px solid var(--lightgray);border-radius:6px;background:var(--light);box-shadow:0 8px 24px #0002;color:var(--dark)}
.activity-heatmap-popup.is-visible{display:block}
.activity-heatmap-popup-date{margin:0 0 .35rem;font-size:.72rem;color:var(--gray)}
.activity-heatmap-popup a{display:block;padding:.2rem 0;font-size:.82rem;line-height:1.4;text-decoration:none;color:var(--dark)}
.activity-heatmap-popup a:hover,.activity-heatmap-popup a:focus-visible{color:var(--secondary);text-decoration:underline}
`

const script = `
document.addEventListener("nav", () => {
  const calendar = document.querySelector(".activity-heatmap-calendar")
  if (!calendar) return
  if (calendar.clientWidth < 500) calendar.scrollLeft = calendar.scrollWidth
  const popup = document.createElement("div")
  popup.className = "activity-heatmap-popup"
  document.body.appendChild(popup)
  let hideTimer
  let activeDay
  const cancelHide = () => clearTimeout(hideTimer)
  const hide = () => { popup.classList.remove("is-visible"); activeDay = null }
  const scheduleHide = () => { cancelHide(); hideTimer = setTimeout(hide, 150) }
  const show = (day) => {
    cancelHide()
    if (activeDay !== day) {
      activeDay = day
      popup.replaceChildren()
      const date = document.createElement("p")
      date.className = "activity-heatmap-popup-date"
      date.textContent = day.dataset.date
      popup.appendChild(date)
      for (const note of JSON.parse(day.dataset.notes)) {
        const link = document.createElement("a")
        link.href = note.href
        link.textContent = note.title
        link.dataset.noPopover = "true"
        popup.appendChild(link)
      }
    }
    popup.classList.add("is-visible")
    const rect = day.getBoundingClientRect()
    const width = popup.offsetWidth
    const height = popup.offsetHeight
    popup.style.left = Math.max(8, Math.min(rect.left - 8, innerWidth - width - 8)) + "px"
    popup.style.top = (rect.bottom + height + 8 < innerHeight ? rect.bottom + 8 : rect.top - height - 8) + "px"
  }
  const days = calendar.querySelectorAll("[data-notes]")
  for (const day of days) {
    const onEnter = () => show(day)
    day.addEventListener("pointerenter", onEnter)
    day.addEventListener("pointerleave", scheduleHide)
    day.addEventListener("focus", onEnter)
  }
  popup.addEventListener("pointerenter", cancelHide)
  popup.addEventListener("pointerleave", scheduleHide)
  popup.addEventListener("focusin", cancelHide)
  popup.addEventListener("focusout", scheduleHide)
  window.addCleanup(() => { cancelHide(); popup.remove() })
})
`

function ActivityHeatmap() {
  const Component = ({ fileData, allFiles }) => {
    if (fileData.slug !== "index") return null
    const today = dayNumber(new Date())
    const date = new Date(today)
    const year = date.getUTCFullYear()
    const start = Date.UTC(year, 0, 1)
    const end = Date.UTC(year, 11, 31)
    const firstMonday = start - ((new Date(start).getUTCDay() + 6) % 7) * DAY
    const lastMonday = end - ((new Date(end).getUTCDay() + 6) % 7) * DAY
    const weekCount = Math.round((lastMonday - firstMonday) / (7 * DAY)) + 1
    const activity = noteDays(allFiles, start, today)
    const labeledMonths = new Set()
    const weeks = Array.from({ length: weekCount }, (_, weekIndex) => {
      const monday = firstMonday + weekIndex * 7 * DAY
      const monthStart = Array.from({ length: 7 }, (_, i) => new Date(monday + i * DAY)).find(
        (date) => date.getUTCDate() === 1 && date.getTime() >= start && date.getTime() <= end,
      )
      const monthNumber = monthStart?.getUTCMonth() ?? (weekIndex === 0 ? 0 : null)
      const month =
        monthNumber !== null && !labeledMonths.has(monthNumber) ? `${monthNumber + 1}月` : ""
      if (monthNumber !== null) labeledMonths.add(monthNumber)
      const cells = Array.from({ length: 7 }, (_, dayIndex) => {
        const day = monday + dayIndex * DAY
        const notes = [...(activity.get(day)?.values() ?? [])]
        const count = notes.length
        const level = count >= 5 ? 4 : count >= 3 ? 3 : count === 2 ? 2 : count === 1 ? 1 : 0
        return h("span", {
          class: `activity-heatmap-day${day < start || day > end ? " is-outside" : ""}`,
          "data-level": level,
          "data-date": count ? dayLabel(day) : undefined,
          "data-notes": count ? JSON.stringify(notes) : undefined,
          tabIndex: count ? 0 : undefined,
          "aria-label": count ? `${dayLabel(day)}，${count}篇笔记` : undefined,
          "aria-hidden": count ? undefined : "true",
        })
      })
      return h(
        "div",
        { class: "activity-heatmap-week" },
        h("span", { class: "activity-heatmap-month" }, month),
        ...cells,
      )
    })
    return h(
      "section",
      { class: "activity-heatmap", "aria-label": `${year}年的笔记热力图` },
      h(
        "div",
        { class: "activity-heatmap-calendar" },
        h("div", { class: "activity-heatmap-grid" }, ...weeks),
      ),
    )
  }
  Component.css = css
  Component.afterDOMLoaded = script
  Component.displayName = "ActivityHeatmap"
  return Component
}

export { ActivityHeatmap, ActivityHeatmap as default, creationDate }
