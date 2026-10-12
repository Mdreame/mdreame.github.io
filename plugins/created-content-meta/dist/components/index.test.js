import assert from "node:assert/strict"
import test from "node:test"
import render from "preact-render-to-string"
import { CreatedContentMeta } from "./index.js"

test("the date below a note title uses creation rather than modification time", () => {
  const ContentMeta = CreatedContentMeta({ showReadingTime: false })
  const html = render(
    ContentMeta({
      cfg: { locale: "zh-CN" },
      fileData: {
        text: "A note",
        frontmatter: { created: "2020-02-03" },
        dates: {
          created: new Date("2020-02-03T00:00:00Z"),
          modified: new Date("2025-04-05T00:00:00Z"),
        },
        defaultDateType: "modified",
      },
    }),
  )

  assert.match(html, /datetime="2020-02-03T00:00:00\.000Z"/)
  assert.doesNotMatch(html, /2025-04-05/)
})
