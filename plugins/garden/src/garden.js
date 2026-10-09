import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

const data = window.__GARDEN__ || { notes: [], edges: [], counts: {}, total: 0 }
const canvas = document.getElementById("garden-canvas")
const tip = document.getElementById("garden-tip")
const card = document.getElementById("garden-card")
const cardTitle = document.getElementById("garden-card-title")
const cardMeta = document.getElementById("garden-card-meta")
const cardLink = document.getElementById("garden-card-link")
const empty = document.getElementById("garden-empty")
const loading = document.getElementById("garden-loading")
const stage = document.getElementById("stage")

const ISLAND_R = 5
const GRASS_TOP = 0

// ---------------------------------------------------------------- 工具
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

function leafColor(note) {
  if (!note.modified) return new THREE.Color().setHSL(0.12, 0.28, 0.56)
  const days = (Date.now() - note.modified) / 86400000
  if (note.maturity === "seedling") return new THREE.Color().setHSL(0.29, 0.46, 0.6)
  if (days <= 30) return new THREE.Color().setHSL(0.38, 0.44, 0.4)
  if (days <= 90) return new THREE.Color().setHSL(0.31, 0.38, 0.44)
  if (days <= 180) return new THREE.Color().setHSL(0.19, 0.34, 0.48)
  return new THREE.Color().setHSL(0.11, 0.26, 0.52)
}

// ---------------------------------------------------------------- 场景
const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
camera.position.set(0, 7.5, 13)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0.6, 0)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.enablePan = false
controls.minDistance = 7
controls.maxDistance = 26
controls.minPolarAngle = 0.25
controls.maxPolarAngle = 1.32
controls.autoRotate = true
controls.autoRotateSpeed = 0.55

// 光照
scene.add(new THREE.HemisphereLight(0xdff0fb, 0x7bbd68, 1.0))
const sun = new THREE.DirectionalLight(0xffffff, 1.15)
sun.position.set(6, 12, 7)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = 40
sun.shadow.camera.left = -9
sun.shadow.camera.right = 9
sun.shadow.camera.top = 9
sun.shadow.camera.bottom = -9
sun.shadow.bias = -0.0008
scene.add(sun)
scene.add(new THREE.AmbientLight(0xffffff, 0.25))

// ---------------------------------------------------------------- 岛屿
const island = new THREE.Group()

const grass = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_R, ISLAND_R * 0.99, 0.5, 72),
  new THREE.MeshStandardMaterial({ color: 0x86c96a, flatShading: false, roughness: 0.9 }),
)
grass.position.y = GRASS_TOP - 0.25
grass.receiveShadow = true
island.add(grass)

// 圆润的岛底：上宽下窄的倒锥台，不是三角形
const soil = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_R * 0.98, ISLAND_R * 0.12, 2.6, 72, 1),
  new THREE.MeshStandardMaterial({ color: 0x8a6f4f, roughness: 1, flatShading: true }),
)
soil.position.y = GRASS_TOP - 0.5 - 1.3
soil.receiveShadow = true
island.add(soil)

// 岛底尖端
const tipCone = new THREE.Mesh(
  new THREE.ConeGeometry(ISLAND_R * 0.12, 0.9, 32),
  new THREE.MeshStandardMaterial({ color: 0x7a6045, roughness: 1, flatShading: true }),
)
tipCone.position.y = GRASS_TOP - 0.5 - 2.6 - 0.45
tipCone.rotation.x = Math.PI
island.add(tipCone)

scene.add(island)

// ---------------------------------------------------------------- 树
function treeSize(note) {
  if (note.maturity === "evergreen") return { trunk: 1.5, crown: 0.72 }
  if (note.maturity === "budding") return { trunk: 0.85, crown: 0.46 }
  if (note.maturity === "seedling") return { trunk: 0.3, crown: 0.2 }
  return { trunk: 0.05, crown: 0.09 }
}

function buildTree(note) {
  const group = new THREE.Group()
  const size = treeSize(note)
  const color = leafColor(note)
  const r = hash(note.slug)

  const trunkGeo = new THREE.CylinderGeometry(size.trunk * 0.13, size.trunk * 0.2, size.trunk, 8)
  const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.95 }))
  trunk.position.y = size.trunk / 2
  group.add(trunk)

  const leafMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    flatShading: true,
  })

  if (note.maturity === "evergreen") {
    // 三层低多边形树冠
    const layers = [
      { r: size.crown, y: size.trunk + size.crown * 0.45, dx: 0, dz: 0 },
      { r: size.crown * 0.74, y: size.trunk + size.crown * 1.18, dx: 0.06, dz: -0.08 },
      { r: size.crown * 0.52, y: size.trunk + size.crown * 1.75, dx: -0.05, dz: 0.05 },
    ]
    for (const l of layers) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(l.r, 1), leafMat)
      m.position.set(l.dx, l.y, l.dz)
      m.rotation.set(r * 3, r * 6, r * 2)
      group.add(m)
    }
  } else if (note.maturity === "budding") {
    const main = new THREE.Mesh(new THREE.IcosahedronGeometry(size.crown, 1), leafMat)
    main.position.y = size.trunk + size.crown * 0.7
    main.rotation.set(r * 4, r * 3, r * 2)
    group.add(main)
    const side = new THREE.Mesh(new THREE.IcosahedronGeometry(size.crown * 0.6, 1), leafMat)
    side.position.set(size.crown * 0.5, size.trunk + size.crown * 1.05, -size.crown * 0.2)
    group.add(side)
  } else if (note.maturity === "seedling") {
    // 两片嫩叶 + 顶芽
    for (const dir of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(size.crown, 10, 8), leafMat)
      leaf.scale.set(1.5, 0.34, 0.7)
      leaf.position.set(dir * size.crown * 0.85, size.trunk + 0.1, 0)
      leaf.rotation.z = dir * 0.5
      group.add(leaf)
    }
    const bud = new THREE.Mesh(new THREE.SphereGeometry(size.crown * 0.42, 10, 8), leafMat)
    bud.position.y = size.trunk + size.crown * 0.5
    group.add(bud)
  } else {
    // 未标记：地上的种子
    const seed = new THREE.Mesh(
      new THREE.SphereGeometry(size.crown, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xb3a58c, roughness: 1 }),
    )
    seed.scale.set(1, 0.7, 1)
    seed.position.y = size.crown * 0.7
    group.add(seed)
  }

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  group.rotation.y = r * Math.PI * 2
  return group
}

// ---------------------------------------------------------------- 布局
const trees = []
;(function plant() {
  const byTag = {}
  for (const n of data.notes) {
    const key = n.tags && n.tags.length ? String(n.tags[0]) : "未分类"
    if (!byTag[key]) byTag[key] = []
    byTag[key].push(n)
  }
  const keys = Object.keys(byTag)
  const total = data.notes.length || 1
  let angle = -Math.PI / 2

  for (const key of keys) {
    const list = byTag[key]
    const span = (Math.PI * 2 * list.length) / total
    const a0 = angle
    angle += span

    let inRing = 0
    let ring = 0
    let ringCap = 4
    list.forEach((note, idx) => {
      if (inRing >= ringCap) {
        inRing = 0
        ring += 1
        ringCap = 4 + ring * 3
      }
      const a = a0 + span * ((idx % ringCap) / ringCap) + (hash(note.slug) - 0.5) * 0.22
      const radius = (0.24 + 0.66 * ((ring + 1) / 3)) * ISLAND_R + (hash(note.slug + "r") - 0.5) * 0.3
      inRing += 1

      const group = buildTree(note)
      group.position.set(Math.cos(a) * radius, GRASS_TOP, Math.sin(a) * radius)
      // 轻微随机缩放，避免整齐划一
      const s = 0.9 + hash(note.slug + "s") * 0.25
      group.scale.setScalar(0.001)
      group.userData = { note, target: s, born: idx * 0.06 }
      scene.add(group)
      trees.push(group)
    })
  }
})()

// ---------------------------------------------------------------- 连接线
;(function drawEdges() {
  const bySlug = {}
  for (const t of trees) {
    bySlug[String(t.userData.note.slug).replace(/\/index$/, "")] = t
  }
  const mat = new THREE.LineBasicMaterial({ color: 0x6b8f5a, transparent: true, opacity: 0.5 })
  for (const [from, to] of data.edges || []) {
    const a = bySlug[String(from).replace(/\/index$/, "")]
    const b = bySlug[String(to).replace(/\/index$/, "")]
    if (!a || !b) continue
    const mid = new THREE.Vector3().addVectors(a.position, b.position).multiplyScalar(0.5)
    mid.y = GRASS_TOP - 0.6
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(a.position.x, GRASS_TOP + 0.1, a.position.z),
      mid,
      new THREE.Vector3(b.position.x, GRASS_TOP + 0.1, b.position.z),
    )
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24))
    scene.add(new THREE.Line(geo, mat))
  }
})()

// ---------------------------------------------------------------- 交互
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2(-10, -10)
let hovered = null
let pinned = null
let level = "all"

function visible(note) {
  if (level === "all") return true
  if (level === "unknown") return !note.maturity
  return note.maturity === level
}

function updateVisibility() {
  let shown = 0
  for (const t of trees) {
    const ok = visible(t.userData.note)
    t.visible = ok
    if (ok) shown += 1
  }
  empty.style.display = shown === 0 ? "block" : "none"
}

// 卡片跟着被选中的树浮动：每帧把树顶投影到屏幕坐标
const anchorVec = new THREE.Vector3()
function positionCard(tree) {
  if (!tree) return
  const w = stage.clientWidth
  const h = stage.clientHeight

  // 窄屏交给 CSS 固定在底部，避免浮动卡片出界
  if (w < 640) {
    card.style.left = ""
    card.style.top = ""
    card.style.right = ""
    card.style.bottom = ""
    return
  }

  const note = tree.userData.note
  const size = treeSize(note)
  tree.getWorldPosition(anchorVec)
  anchorVec.y += (size.trunk + size.crown * 1.7) * tree.userData.target
  anchorVec.project(camera)

  // 树转到相机背后时先隐藏
  if (anchorVec.z > 1) {
    card.style.display = "none"
    return
  }
  card.style.display = "block"

  const sx = (anchorVec.x * 0.5 + 0.5) * w
  const sy = (-anchorVec.y * 0.5 + 0.5) * h
  const cw = card.offsetWidth || 260
  const ch = card.offsetHeight || 90

  let left = sx + 18
  let top = sy - ch / 2
  if (left + cw > w - 8) left = sx - cw - 18 // 贴右边界时翻到左侧
  if (left < 8) left = 8
  if (top < 8) top = 8
  if (top + ch > h - 8) top = h - ch - 8

  card.style.right = "auto"
  card.style.bottom = "auto"
  card.style.left = `${left}px`
  card.style.top = `${top}px`
}

function showCard(note) {
  if (!note) {
    card.style.display = "none"
    return
  }
  card.style.display = "block"
  cardTitle.textContent = note.title
  const meta = []
  const labels = { evergreen: "常青", budding: "生长", seedling: "幼苗" }
  meta.push(note.maturity ? labels[note.maturity] : "未标记")
  if (note.revisions > 0) meta.push(`修订 ${note.revisions} 次`)
  if (note.growthDays > 0) meta.push(`生长 ${note.growthDays} 天`)
  if (note.tags && note.tags.length) meta.push(note.tags.join(" / "))
  cardMeta.textContent = meta.join(" · ")
  cardLink.href = `/${note.slug}`
}

canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect()
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  if (e.pointerType === "mouse") {
    tip.style.left = `${e.clientX - rect.left}px`
    tip.style.top = `${e.clientY - rect.top - 30}px`
  }
})

canvas.addEventListener("pointerdown", () => {
  controls.autoRotate = false
})

canvas.addEventListener("click", () => {
  if (hovered) {
    pinned = hovered
    showCard(pinned.userData.note)
  } else {
    pinned = null
    showCard(null)
  }
})

canvas.addEventListener("pointerleave", () => {
  pointer.set(-10, -10)
})

for (const btn of document.querySelectorAll(".garden-filter")) {
  btn.addEventListener("click", () => {
    level = btn.dataset.level
    pinned = null
    showCard(null)
    updateVisibility()
    for (const b of document.querySelectorAll(".garden-filter")) {
      b.classList.toggle("active", b === btn)
    }
  })
}

document.getElementById("garden-reset").addEventListener("click", () => {
  camera.position.set(0, 7.5, 13)
  controls.target.set(0, 0.6, 0)
  controls.autoRotate = true
  pinned = null
  showCard(null)
})

function resize() {
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / Math.max(1, h)
  camera.updateProjectionMatrix()
}
window.addEventListener("resize", resize)

// ---------------------------------------------------------------- 动画
const clock = new THREE.Clock()

function animate() {
  const t = clock.getElapsedTime()

  // 载入：依次弹出生长
  for (const tree of trees) {
    const d = tree.userData
    const progress = Math.max(0, Math.min(1, t - d.born))
    const eased = 1 - Math.pow(1 - progress, 3)
    tree.scale.setScalar(Math.max(0.001, d.target * eased))
  }

  // hover 命中
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(trees, true)
  let found = null
  for (const hit of hits) {
    let obj = hit.object
    while (obj && !obj.userData.note) obj = obj.parent
    if (obj && obj.visible) {
      found = obj
      break
    }
  }

  if (found !== hovered) {
    hovered = found
    canvas.style.cursor = hovered ? "pointer" : "grab"
    if (hovered && !pinned) {
      tip.style.display = "block"
      tip.textContent = hovered.userData.note.title
      showCard(hovered.userData.note)
    } else {
      tip.style.display = "none"
      if (!pinned) showCard(null)
    }
  }

  // hover 轻微放大
  for (const tree of trees) {
    if (!tree.visible) continue
    const base = tree.userData.target
    const want = tree === hovered || tree === pinned ? base * 1.12 : base
    const cur = tree.scale.x
    tree.scale.setScalar(cur + (want - cur) * 0.15)
  }

  controls.update()
  const cardTarget = pinned || hovered
  if (cardTarget) positionCard(cardTarget)
  else card.style.display = "none"
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

resize()
updateVisibility()
if (loading) loading.style.display = "none"
animate()
