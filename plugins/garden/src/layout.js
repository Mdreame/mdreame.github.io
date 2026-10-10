// Slug-derived slots are independent of content ordering and modification dates.
export function hash(value) {
  let n = 2166136261
  for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619)
  return (n >>> 0) / 4294967296
}
export const growthScale = (slug) => 0.78 + hash(`${slug}:height`) * 0.48
export const topicOf = (note) => note.tags?.[0]?.replace(/^\/+/, "").split("/")[0] || "未分类"
export function linkedNotes(notes, slug) {
  const selected = notes.find((note) => note.slug === slug)
  if (!selected) return new Set()
  return new Set(
    notes
      .filter(
        (note) =>
          note.slug !== slug &&
          ((selected.links || []).includes(note.slug) || (note.links || []).includes(slug)),
      )
      .map((note) => note.slug),
  )
}

export function layoutGarden(notes) {
  const compact = notes.length <= 24
  const islandFor = (note) => (compact ? "main" : topicOf(note))
  const groups = new Map()
  for (const note of notes) {
    const key = islandFor(note)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(note)
  }
  if (!groups.size) groups.set("main", [])
  const usedCenters = []
  const islands = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, members]) => {
      // Area grows with note count, with generous room for the widest tree crowns.
      const radius = compact
        ? Math.max(5, Math.sqrt(members.length) * 1.7)
        : Math.max(5.2, Math.sqrt(members.length) * 2)
      let x = 0,
        z = 0
      if (!compact) {
        const angle = hash(key) * Math.PI * 2
        let distance = 9 + radius
        for (let attempt = 0; attempt < 100; attempt++) {
          x = Math.cos(angle + attempt * 0.34) * distance
          z = Math.sin(angle + attempt * 0.34) * distance
          if (usedCenters.every((p) => Math.hypot(x - p.x, z - p.z) > radius + p.radius + 3)) break
          distance += 0.8
        }
      }
      const island = { key, x, z, radius }
      usedCenters.push(island)
      return island
    })
  const plants = []
  // Pack each topic independently; plants on a neighboring island never affect spacing.
  for (const island of islands) {
    const members = [...groups.get(island.key)].sort((a, b) => a.slug.localeCompare(b.slug))
    const placed = []
    const minSpacing = compact ? 1.45 : 2
    for (const note of members) {
      let point = null
      for (let attempt = 0; attempt < 900; attempt++) {
        const angle = hash(`${note.slug}:angle:${attempt}`) * Math.PI * 2
        const radius = Math.sqrt(hash(`${note.slug}:radius:${attempt}`)) * island.radius * 0.76
        const candidate = {
          x: island.x + Math.cos(angle) * radius,
          z: island.z + Math.sin(angle) * radius,
        }
        if (
          placed.every(
            (other) => Math.hypot(other.x - candidate.x, other.z - candidate.z) >= minSpacing,
          )
        ) {
          point = candidate
          break
        }
      }
      // A crowded topic gets more land instead of silently overlapping its existing trees.
      if (!point) {
        island.radius *= 1.12
        const angle = hash(`${note.slug}:fallback`) * Math.PI * 2
        point = {
          x: island.x + Math.cos(angle) * island.radius * 0.72,
          z: island.z + Math.sin(angle) * island.radius * 0.72,
        }
      }
      placed.push(point)
      plants.push({ note, ...point, island: island.key })
    }
  }
  return { islands, plants, compact }
}
