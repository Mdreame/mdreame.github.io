import assert from "node:assert/strict"
import test from "node:test"
import { addMaturityLabels } from "./index.js"

const stages = new Map([
  ["博客", { stage: "seed", label: "种子" }],
  ["day1", { stage: "tree", label: "常青 · 结果" }],
])

test("shows the same stage in note titles, tag lists, and the archive", () => {
  const note = '<h1 class="article-title">博客</h1>'
  const list = '<div class="desc"><h3><a href="../博客" class="internal">博客</a></h3></div>'
  const archive = '<td data-value="Day1"><a href="./day1" data-slug="day1">Day1</a></td>'

  assert.match(
    addMaturityLabels(note, "博客", stages),
    /博客<span class="maturity-badge maturity-seed">种子<\/span>/,
  )
  assert.match(
    addMaturityLabels(list, "tags/evernote", stages),
    /博客<\/a><span class="maturity-badge maturity-seed">种子<\/span>/,
  )
  assert.match(
    addMaturityLabels(archive, "全部笔记.base", stages),
    /Day1<\/a><span class="maturity-badge maturity-tree">常青 · 结果<\/span>/,
  )
})

test("does not mark tag headings or duplicate a note badge", () => {
  const tag = '<h1 class="article-title">evernote</h1>'
  const note = '<h1 class="article-title">博客</h1>'
  const once = addMaturityLabels(note, "博客", stages)
  assert.equal(addMaturityLabels(tag, "tags/evernote", stages), tag)
  assert.equal(addMaturityLabels(once, "博客", stages), once)
})
