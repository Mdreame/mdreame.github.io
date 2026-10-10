import test from "node:test"
import assert from "node:assert/strict"
import { growthScale, layoutGarden, linkedNotes } from "./layout.js"
const notes = Array.from({ length: 20 }, (_, i) => ({
  slug: `note-${i}`,
  tags: [`topic-${i % 5}`],
  maturity: "seed",
}))
const positions = (result) => result.plants.map(({ note, x, z }) => [note.slug, x, z])
test("layout ignores incoming order, dates, and maturity edits", () => {
  assert.deepEqual(
    positions(layoutGarden(notes)),
    positions(
      layoutGarden(
        [...notes].reverse().map((n) => ({ ...n, modified: Date.now(), maturity: "fruit" })),
      ),
    ),
  )
})
test("small gardens share one island and plants fit on its surface", () => {
  const layout = layoutGarden(notes)
  assert.equal(layout.islands.length, 1)
  for (const p of layout.plants) assert.ok(Math.hypot(p.x, p.z) < layout.islands[0].radius)
  for (let i = 0; i < layout.plants.length; i++)
    for (let j = i + 1; j < layout.plants.length; j++) {
      assert.ok(
        Math.hypot(
          layout.plants[i].x - layout.plants[j].x,
          layout.plants[i].z - layout.plants[j].z,
        ) > 1.4,
      )
    }
})
test("large gardens split by topic with no overlapping islands", () => {
  const many = Array.from({ length: 200 }, (_, i) => ({ ...notes[i % 20], slug: `note-${i}` }))
  const layout = layoutGarden(many)
  assert.equal(layout.islands.length, 5)
  assert.equal(layout.plants.length, 200)
  for (let i = 0; i < layout.islands.length; i++)
    for (let j = i + 1; j < layout.islands.length; j++) {
      const a = layout.islands[i],
        b = layout.islands[j]
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > a.radius + b.radius)
    }
  for (const p of layout.plants) {
    const island = layout.islands.find((i) => i.key === p.island)
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z))
    assert.ok(Math.hypot(p.x - island.x, p.z - island.z) < island.radius * 0.77)
  }
  for (let i = 0; i < layout.plants.length; i++)
    for (let j = i + 1; j < layout.plants.length; j++)
      if (layout.plants[i].island === layout.plants[j].island)
        assert.ok(
          Math.hypot(
            layout.plants[i].x - layout.plants[j].x,
            layout.plants[i].z - layout.plants[j].z,
          ) >= 2,
        )
})
test("island area grows as a topic accumulates more notes", () => {
  const few = layoutGarden(Array.from({ length: 4 }, (_, i) => ({ slug: `few-${i}` })))
  const many = layoutGarden(Array.from({ length: 20 }, (_, i) => ({ slug: `many-${i}` })))
  assert.ok(many.islands[0].radius > few.islands[0].radius)
})
test("linked notes include outgoing and incoming references", () => {
  const linked = linkedNotes(
    [
      { slug: "a", links: ["b"] },
      { slug: "b", links: ["c"] },
      { slug: "c", links: [] },
      { slug: "unrelated", links: [] },
    ],
    "b",
  )
  assert.deepEqual([...linked].sort(), ["a", "c"])
})
test("individual plants have stable, varied heights independent of note ordering", () => {
  const scales = notes.map((note) => growthScale(note.slug))
  assert.ok(scales.every((scale) => scale >= 0.78 && scale < 1.26))
  assert.ok(new Set(scales).size > 15)
  assert.deepEqual(
    scales,
    [...notes]
      .reverse()
      .reverse()
      .map((note) => growthScale(note.slug)),
  )
})
test("empty garden still has a finite island", () => {
  const layout = layoutGarden([])
  assert.equal(layout.plants.length, 0)
  assert.equal(layout.islands.length, 1)
  assert.ok(Number.isFinite(layout.islands[0].radius))
})
