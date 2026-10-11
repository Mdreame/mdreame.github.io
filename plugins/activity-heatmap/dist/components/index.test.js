import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { creationDate } from "./index.js"

test("heatmap uses the original Git addition for notes without created metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "heatmap-date-"))
  const note = path.join(root, "note.md")
  const git = (args, date) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date,
      },
    })

  try {
    git(["init", "-q"], "2020-02-03T12:00:00+08:00")
    fs.writeFileSync(note, "first")
    git(["add", "note.md"], "2020-02-03T12:00:00+08:00")
    git(
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "add"],
      "2020-02-03T12:00:00+08:00",
    )
    fs.writeFileSync(note, "edited")
    git(["add", "note.md"], "2025-04-05T12:00:00+08:00")
    git(
      ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "edit"],
      "2025-04-05T12:00:00+08:00",
    )

    const file = { filePath: note, frontmatter: {}, dates: { created: new Date("2026-10-11") } }
    assert.equal(creationDate(file, root), "2020-02-03T12:00:00+08:00")
    file.frontmatter.created = "2019-01-01"
    assert.equal(creationDate(file, root), file.dates.created)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
