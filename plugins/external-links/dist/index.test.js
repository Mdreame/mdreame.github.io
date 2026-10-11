import assert from "node:assert/strict"
import test from "node:test"
import { openExternalLinks } from "./index.js"

test("external web links open safely in a new tab across page markup", () => {
  const html = [
    '<a href="https://example.com/a">正文</a>',
    '<a href="//quartz.jzhao.xyz/" rel="nofollow">页脚</a>',
    '<a href="https://mdreame.github.io/garden">本站</a>',
    '<a href="/tags/evernote">标签</a>',
    '<a href="mailto:hello@example.com">邮件</a>',
  ].join("")
  const actual = openExternalLinks(html, "mdreame.github.io")
  assert.match(actual, /href="https:\/\/example.com\/a" target="_blank" rel="noopener noreferrer"/)
  assert.match(actual, /href="\/\/quartz.jzhao.xyz\/" rel="nofollow noopener noreferrer"/)
  assert.match(actual, /href="https:\/\/mdreame.github.io\/garden">本站/)
  assert.match(actual, /href="\/tags\/evernote">标签/)
  assert.match(actual, /href="mailto:hello@example.com">邮件/)
  assert.equal(openExternalLinks(actual, "mdreame.github.io"), actual)
})

test("existing target is replaced for an external link", () => {
  assert.equal(
    openExternalLinks(
      '<a target="_self" rel="ugc" href="http://example.org">x</a>',
      "mdreame.github.io",
    ),
    '<a target="_blank" rel="ugc noopener noreferrer" href="http://example.org">x</a>',
  )
})
