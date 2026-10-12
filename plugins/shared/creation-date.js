import { execFileSync } from "node:child_process"
import path from "node:path"

// Quartz falls back to filesystem birthtime when `created` is absent. A fresh
// checkout would then make older notes appear to have been created today.
export function creationDate(file, root = process.cwd()) {
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
      // An uncommitted note can still use its local file date.
    }
  }
  return file.dates?.created
}
