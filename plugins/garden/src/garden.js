import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"

const data = window.__GARDEN__ || { notes: [], counts: {}, total: 0 }
const canvas = document.getElementById("garden-canvas")
const tip = document.getElementById("garden-tip")
const card = document.getElementById("garden-card")
const cardTitle = document.getElementById("garden-card-title")
const cardMeta = document.getElementById("garden-card-meta")
const cardLink = document.getElementById("garden-card-link")
const empty = document.getElementById("garden-empty")
const loading = document.getElementById("garden-loading")
const stage = document.getElementById("stage")

const ISLAND_R = 5 // 岛的建模基准半径，每座岛按自己的 r 缩放
const GRASS_TOP = 0
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// ---------------------------------------------------------------- 分岛
// 一个顶层标签一座岛。标签只取第一段：English/Writing/2026 → English。
// 没有标签的笔记共用一座"未分类"岛。
function topTag(note) {
  const first = note.tags && note.tags.length ? String(note.tags[0]).replace(/^\/+/, "").trim() : ""
  const cut = first.indexOf("/")
  return (cut > 0 ? first.slice(0, cut) : first) || "未分类"
}

const ISLANDS = (() => {
  const byTag = new Map()
  for (const n of data.notes) {
    const key = topTag(n)
    if (!byTag.has(key)) byTag.set(key, [])
    byTag.get(key).push(n)
  }
  const list = [...byTag].map(([key, notes]) => ({
    key,
    notes,
    // 岛的面积跟着笔记数走（r ∝ √n），密度就是恒定的：小标签是小岛，大标签是大岛
    r: clamp(1.03 * Math.sqrt(notes.length), 2.6, 18),
    // 只有塞得特别满的岛才把树稍微缩小
    shrink: clamp((notes.length / 400) ** -0.15, 0.7, 1),
    x: 0,
    z: 0,
  }))
  // 空花园也留一座裸岛，比一片空白好看
  if (list.length === 0) list.push({ key: "未分类", notes: [], r: 2.6, shrink: 1, x: 0, z: 0 })
  return list
})()

// 整片群岛的外接尺寸，相机取景、阳光和阴影范围都按它算
const EXTENT = { x: ISLAND_R, z: ISLAND_R, max: ISLAND_R }

;(function placeIslands() {
  // 岛与岛之间的水面间距
  const GAP = 4.5
  // 大的岛先摆，整片更紧凑，主岛也自然落在前面
  ISLANDS.sort((a, b) => b.notes.length - a.notes.length || a.key.localeCompare(b.key, "zh"))

  // 一行大致摆几座岛：让整片群岛接近方形，而不是排成一条长龙
  const perRow = Math.ceil(Math.sqrt(ISLANDS.length))
  const avgR = ISLANDS.reduce((s, i) => s + i.r, 0) / ISLANDS.length
  const rowW = Math.max(2 * ISLANDS[0].r, perRow * (2 * avgR + GAP) - GAP)

  let x = 0
  let z = 0
  let rowH = 0
  for (const isl of ISLANDS) {
    if (x > 0 && x + isl.r * 2 > rowW + 1e-6) {
      z += rowH + GAP
      x = 0
      rowH = 0
    }
    isl.x = x + isl.r
    isl.z = z + isl.r
    x += isl.r * 2 + GAP
    rowH = Math.max(rowH, isl.r * 2)
  }

  // 整片群岛挪到原点，相机绕着它转
  const minX = Math.min(...ISLANDS.map((i) => i.x - i.r))
  const maxX = Math.max(...ISLANDS.map((i) => i.x + i.r))
  const minZ = Math.min(...ISLANDS.map((i) => i.z - i.r))
  const maxZ = Math.max(...ISLANDS.map((i) => i.z + i.r))
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  for (const isl of ISLANDS) {
    isl.x -= cx
    isl.z -= cz
  }
  EXTENT.x = (maxX - minX) / 2
  EXTENT.z = (maxZ - minZ) / 2
  EXTENT.max = Math.max(...ISLANDS.map((i) => i.r))
})()

// ---------------------------------------------------------------- 工具
function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

// 叶色三档：绿（还在打理）→ 黄（搁了一阵）→ 枯黄（很久没动，秋天的落叶色）
const FRESH_DAYS = 90
const STALE_DAYS = 365

function leafColor(note) {
  // 新芽永远是嫩的黄绿色，跟新旧无关；种子根本不用叶色（见下面的种子造型）
  if (note.maturity === "sprout") return new THREE.Color().setHSL(0.3, 0.5, 0.58)
  // 结果的树是常青树：叶子不随打理时间变，果子才是它要说的那句话。
  // （叶子要是也转黄，橙果子和枯叶就糊成一片了）
  if (note.maturity === "fruit") return new THREE.Color().setHSL(0.33, 0.45, 0.33)
  const days = note.modified ? (Date.now() - note.modified) / 86400000 : Infinity
  if (days <= FRESH_DAYS) return new THREE.Color().setHSL(0.34, 0.5, 0.38) // 绿
  if (days <= STALE_DAYS) return new THREE.Color().setHSL(0.145, 0.6, 0.52) // 黄
  // 枯黄：干草和落叶那种暖赭色。比中间那档更深、更偏橙，才分得出来。
  // 同样因为灯光泛白，得挑饱和度高的实色，调出来的"理论枯黄"到屏幕上就是土灰
  return new THREE.Color(0xd4a017)
}

// ---------------------------------------------------------------- 场景
const scene = new THREE.Scene()

const FOV = 45
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1400)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.enablePan = false
controls.minPolarAngle = 0.25
controls.maxPolarAngle = 1.32
controls.autoRotate = true
controls.autoRotateSpeed = 0.55

// 取景：把整片花园装进画面。相机会绕圈，所以水平方向按外接圆算；
// 俯角约 17°——再抬一点地平线就被挤出画面，看不见天了；
// 纵深在屏幕上被压扁到 sin(17°) ≈ 0.29
const CAM_DIR = new THREE.Vector3(0, 0.3, 0.955).normalize()
const FIT_TAN = Math.tan((FOV / 2) * (Math.PI / 180))
const _p = new THREE.Vector3()
function frameCamera() {
  const aspect = camera.aspect || 1.6
  const bound = Math.hypot(EXTENT.x, EXTENT.z)
  let d = clamp(
    Math.max((bound + 2) / (FIT_TAN * aspect), (CAM_DIR.y * bound + 3.5) / FIT_TAN),
    14,
    320,
  )

  // 上面那步是按外接圆估的；透视下近处的岛会被放大，光靠它会切掉画面边缘。
  // 再把几处关键点真投影一遍，按实际超出量把距离推远。
  const spots = []
  for (const isl of ISLANDS) {
    // 沿岛缘取点（别取外接方框的角，那会多留 41% 的余量）
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2
      const x = isl.x + Math.cos(a) * isl.r
      const z = isl.z + Math.sin(a) * isl.r
      spots.push([x, 0, z], [x, 3.5, z])
    }
  }
  // 相机会自己绕圈，所以得把一整圈方位角都投影一遍：只按当前角度拟合的话，
  // 转到别的角度时边角的岛会捅出画面（群岛越大越明显）
  const VIEWS = Array.from({ length: 8 }, (_, a) => {
    const ang = (a / 8) * Math.PI * 2
    const cos = Math.cos(ang)
    const sin = Math.sin(ang)
    return new THREE.Vector3(
      CAM_DIR.x * cos - CAM_DIR.z * sin,
      CAM_DIR.y,
      CAM_DIR.x * sin + CAM_DIR.z * cos,
    ).normalize()
  })
  for (let i = 0; i < 5; i += 1) {
    let worst = 0
    for (const dir of VIEWS) {
      camera.position.copy(dir).multiplyScalar(d)
      camera.lookAt(0, 0.6, 0)
      camera.updateMatrixWorld(true)
      for (const [x, y, z] of spots) {
        _p.set(x, y, z).project(camera)
        worst = Math.max(worst, Math.abs(_p.x), Math.abs(_p.y))
      }
    }
    if (worst <= 0.92) break
    d *= Math.min(1.5, worst / 0.92)
  }

  camera.position.copy(CAM_DIR).multiplyScalar(d)
  controls.target.set(0, 0.6, 0)
  controls.minDistance = d * 0.35
  controls.maxDistance = d * 3

  // 雾是给草地收边用的，不是给花园打柔光的：起雾点要远远甩在花园外侧，
  // 只让远处那片空草地化进天色里，树和果子一点都不能糊
  if (scene.fog) {
    const reach = d + Math.hypot(EXTENT.x, EXTENT.z) + EXTENT.max
    scene.fog.near = Math.max(60, reach * 1.6)
    scene.fog.far = scene.fog.near * 3
  }
}

// 光照：太阳和阴影相机都罩住整片园子
scene.add(new THREE.HemisphereLight(0xdff0fb, 0x7bbd68, 1.0))
const sun = new THREE.DirectionalLight(0xffffff, 1.15)
const sunSpan = Math.max(EXTENT.x, EXTENT.z) + EXTENT.max + 4
sun.position.set(0.42, 0.82, 0.48).normalize().multiplyScalar(sunSpan * 2.4)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.near = 1
sun.shadow.camera.far = sunSpan * 8
sun.shadow.camera.left = -sunSpan
sun.shadow.camera.right = sunSpan
sun.shadow.camera.top = sunSpan
sun.shadow.camera.bottom = -sunSpan
sun.shadow.bias = -0.0008
scene.add(sun)
scene.add(new THREE.AmbientLight(0xffffff, 0.25))

// ---------------------------------------------------------------- 草地与圈地
// 所有圈地铺在同一片草地上。草地是一整块大平面，靠雾化进天色里，所以看不到边；
// 圈地只是一畦微微抬起、四周培土的草坪。
const FIELD_COLOR = 0xe6f2f7 // 和页面背景靠近地平线的那一段同色，雾才接得上
const field = new THREE.Mesh(
  new THREE.CircleGeometry(600, 72).rotateX(-Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x7cbb60, roughness: 0.95 }),
)
field.position.y = GRASS_TOP - 0.02
field.receiveShadow = true
scene.add(field)

// 雾的远近要跟着取景距离走，所以在 frameCamera 里重设
scene.fog = new THREE.Fog(FIELD_COLOR, 60, 220)

// 一块圈地：顶上长草、侧面培土。按基准半径建一次，每块地等比缩放
const PLOT_H = 0.16
const PLOT_GEO = new THREE.CylinderGeometry(ISLAND_R, ISLAND_R * 0.99, PLOT_H, 72)
const PLOT_TOP_MAT = new THREE.MeshStandardMaterial({ color: 0x86c96a, roughness: 0.9 })
const PLOT_SIDE_MAT = new THREE.MeshStandardMaterial({ color: 0x8a6f4f, roughness: 1 })

// 圈地名牌：画在 canvas 上贴成精灵，永远正面朝向相机
function makeLabel(name, count) {
  const font = '600 30px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
  const probe = document.createElement("canvas").getContext("2d")
  probe.font = font
  const nameW = probe.measureText(name).width
  const numW = probe.measureText(` · ${count}`).width
  const padX = 18
  const padY = 11
  const cw = Math.ceil(nameW + numW + padX * 2)
  const ch = 30 + padY * 2

  const dpr = 2
  const cvs = document.createElement("canvas")
  cvs.width = cw * dpr
  cvs.height = ch * dpr
  const c = cvs.getContext("2d")
  c.scale(dpr, dpr)

  const r = ch / 2
  c.fillStyle = "rgba(255,255,255,0.86)"
  c.beginPath()
  c.moveTo(r, 0)
  c.lineTo(cw - r, 0)
  c.arc(cw - r, r, r, -Math.PI / 2, Math.PI / 2)
  c.lineTo(r, ch)
  c.arc(r, r, r, Math.PI / 2, (Math.PI * 3) / 2)
  c.closePath()
  c.fill()

  c.font = font
  c.textBaseline = "middle"
  c.fillStyle = "#2f3a2f"
  c.fillText(name, padX, ch / 2 + 1)
  c.fillStyle = "#7b8b7b"
  c.fillText(` · ${count}`, padX + nameW, ch / 2 + 1)

  const tex = new THREE.CanvasTexture(cvs)
  tex.anisotropy = 4
  const sprite = new THREE.Sprite(
    // sizeAttenuation: false —— 名牌在屏幕上始终保持同样大小，缩放到哪都读得清
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false }),
  )
  sprite.userData.aspect = cw / ch
  sprite.renderOrder = 2
  return sprite
}

// 名牌固定约 22 像素高：关掉 sizeAttenuation 后，屏幕高度 = scale.y × projection[1][1] ÷ 2
const LABEL_PX = 29
const LABEL_K = 2 * Math.tan((FOV / 2) * (Math.PI / 180))
function sizeLabels() {
  const h = canvas.clientHeight || 600
  const y = (LABEL_PX / h) * LABEL_K
  for (const isl of ISLANDS) {
    if (isl.label) isl.label.scale.set(y * isl.label.userData.aspect, y, 1)
  }
}

for (const isl of ISLANDS) {
  const s = isl.r / ISLAND_R
  // 这畦地抬起来多高：树、名牌、小径都得跟着抬，不然会陷进土里
  isl.top = GRASS_TOP + PLOT_H * s

  const g = new THREE.Group()
  const plot = new THREE.Mesh(PLOT_GEO, [PLOT_SIDE_MAT, PLOT_TOP_MAT, PLOT_SIDE_MAT])
  plot.position.y = PLOT_H / 2 // 缩放之后底面正好落在草地上
  plot.castShadow = true
  plot.receiveShadow = true
  g.add(plot)

  // 每畦地按自己的半径等比缩放
  g.scale.setScalar(s)
  g.position.set(isl.x, 0, isl.z)
  scene.add(g)
  isl.group = g

  // 名牌浮在树顶之上
  const label = makeLabel(isl.key, isl.notes.length)
  label.position.set(isl.x, isl.top + 3.4, isl.z)
  scene.add(label)
  isl.label = label
}

// ---------------------------------------------------------------- 树
// 低多边形树：枝干是"圆台段"，树冠是被揉皱的多面体块——比正球自然得多。
// 每棵树最后合并成一个 mesh，顶点色带材质，所以一棵树只要一次 draw call。
const SHAPES = {
  fruit: { trunk: 1.75, crown: 0.63 },
  tree: { trunk: 1.65, crown: 0.6 },
  sapling: { trunk: 0.95, crown: 0.4 },
  sprout: { trunk: 0.42, crown: 0.18 },
  seed: { crown: 0.17 }, // 一粒种子，没有树干
}
// 成树长什么样："pine" 松树（叠锥）/"broadleaf" 阔叶（团簇树冠）
const TREE_STYLE = "pine"
const MOSS = new THREE.Color(0x6f9c58)
const SOIL = new THREE.Color(0xa4906a)
const SEED = new THREE.Color(0xb3a58c)
// 果子要浅、要亮。这里的灯光很"泛白"，会把橙往米黄上冲：
// 试过 HSL(0.08, 0.95, 0.63) 这类"理论上的亮橙"，画出来是米色；
// 反倒是纯正的 #ff9500 在这种光下才站得住，所以用实色而不是调 HSL
const FRUIT = new THREE.Color(0xff9500)

const UP = new THREE.Vector3(0, 1, 0)
const _rv = new THREE.Vector3()

// 顶点按"坐标"抖动而不是按索引：多面体每个面都持有独立顶点，
// 同一个角落在不同面里的坐标相同，抖动一致，表面才不会裂开
function ruffle(geo, amp, seed) {
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i += 1) {
    _rv.fromBufferAttribute(pos, i)
    const key = `${_rv.x.toFixed(3)},${_rv.y.toFixed(3)},${_rv.z.toFixed(3)},${seed}`
    _rv.multiplyScalar(1 + (hash(key) - 0.5) * amp)
    pos.setXYZ(i, _rv.x, _rv.y, _rv.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// 单位树冠块（半径 1）与单位叶片，建一次到处克隆
const BLOBS = Array.from({ length: 6 }, (_, i) =>
  ruffle(new THREE.IcosahedronGeometry(1, 1), 0.42, `b${i}`),
)
const BLADES = Array.from({ length: 4 }, (_, i) =>
  ruffle(new THREE.IcosahedronGeometry(1, 0), 0.4, `l${i}`),
)
// 单位针叶层：底半径 1、高 1 的低多边形圆锥（带底盖），轻微揉皱免得像陀螺
const CONES = Array.from({ length: 3 }, (_, i) =>
  ruffle(new THREE.ConeGeometry(1, 1, 7, 1).toNonIndexed(), 0.12, `c${i}`),
)
// 单位枝干：底半径 1、顶半径 0.62、高 1、无盖（两端都藏在树干/树冠里）
const LIMB = new THREE.CylinderGeometry(0.62, 1, 1, 6, 1, true).toNonIndexed()

const TREE_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.88,
  flatShading: true,
})

// 给一块几何体刷上纯色，合并后就是顶点色
function paint(geo, color) {
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = color.r
    arr[i * 3 + 1] = color.g
    arr[i * 3 + 2] = color.b
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3))
  return geo
}

// 树冠底暗顶亮的渐变档数
const SHADES = 6

// 按高度给顶点上色：底部压暗到 color × dark，顶部是原色
function shade(geo, color, halfHeight, dark) {
  const pos = geo.attributes.position
  const n = pos.count
  const arr = new Float32Array(n * 3)
  const lut = Array.from({ length: SHADES }, (_, s) =>
    color
      .clone()
      .multiplyScalar(dark)
      .lerp(color, s / (SHADES - 1)),
  )
  for (let i = 0; i < n; i += 1) {
    const t = clamp((pos.getY(i) / halfHeight + 1) * 0.5, 0, 1)
    const c = lut[Math.round(t * (SHADES - 1))]
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3))
  return geo
}

function buildTree(note) {
  const group = new THREE.Group()
  const r = hash(note.slug)
  const parts = []

  const wood = new THREE.Color().setHSL(0.074, 0.26, 0.2 + hash(note.slug + "w") * 0.09)
  const woodDark = wood.clone().multiplyScalar(0.78)
  const leaf = leafColor(note)
  const leafDark = leaf.clone().multiplyScalar(0.82)
  const leafLight = leaf.clone().lerp(new THREE.Color(0xffffff), 0.16)

  // 从 a 连到 b 的一段枝干
  const limb = (ax, ay, az, bx, by, bz, radius, color = wood) => {
    const dir = new THREE.Vector3(bx - ax, by - ay, bz - az)
    const len = dir.length()
    if (len < 1e-4) return
    const geo = LIMB.clone()
    geo.scale(radius, len, radius)
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()))
    geo.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
    parts.push(paint(geo, color))
  }

  // 一团树冠：压扁过的多面体块。底部顶点压暗，自带一点环境光遮蔽，
  // 看起来才像一坨叶子而不是一块石头
  const blob = (x, y, z, radius, flatten, variant, color) => {
    const geo = BLOBS[variant % BLOBS.length].clone()
    geo.scale(radius, radius * flatten, radius)
    shade(geo, color, radius * flatten, 0.7)
    geo.translate(x, y, z)
    parts.push(geo)
  }

  // 一层针叶：低多边形圆锥，同样底暗顶亮
  const tier = (x, y, z, radius, height, variant, color) => {
    const geo = CONES[variant % CONES.length].clone()
    geo.scale(radius, height, radius)
    shade(geo, color, height / 2, 0.78)
    geo.translate(x, y, z)
    parts.push(geo)
  }

  // 一片叶子：沿自身长轴拉长、压扁，再翘起来
  const blade = (x, y, z, len, tilt, yaw, variant, color) => {
    const geo = BLADES[variant % BLADES.length].clone()
    geo.scale(len, len * 0.26, len * 0.58)
    geo.rotateZ(tilt)
    geo.rotateY(yaw)
    geo.translate(x, y, z)
    parts.push(paint(geo, color))
  }

  if (note.maturity === "tree" || note.maturity === "fruit") {
    const s = SHAPES[note.maturity]
    const lean = (r - 0.5) * 0.18
    limb(0, 0, 0, 0, 0.24, 0, 0.24, woodDark) // 根部外扩，落地更稳
    limb(0, 0, 0, lean, s.trunk, lean * 0.4, 0.15)
    if (TREE_STYLE === "pine") {
      // 松树：四层针叶层层叠着往上收，底下留一截光树干。
      // 层与层在高度上大幅重叠，轮廓才连得起来，不会像叠起来的甜筒
      const c = s.crown
      const tiers = [
        [0.75, 1.2, 1.5, 0, leafDark],
        [1.02, 0.98, 1.4, 1, leaf],
        [1.26, 0.72, 1.25, 2, leafLight],
        [1.465, 0.45, 1.1, 0, leaf],
      ]
      // 结果的树：下面几层针叶的边缘挂一圈橙色果子，越靠上的层越细，挂得越小也越少
      const BERRIES = [4, 3, 2]
      for (let i = 0; i < tiers.length; i += 1) {
        const [ky, kr, kh, variant, color] = tiers[i]
        // 每层稍微偏一点点，免得像根对称的陀螺
        const dx = i === 0 ? 0 : (hash(note.slug + "tx" + i) - 0.5) * 0.09
        const dz = i === 0 ? 0 : (hash(note.slug + "tz" + i) - 0.5) * 0.09
        const cx = lean + dx
        const cz = lean * 0.4 + dz
        tier(cx, s.trunk * ky, cz, c * kr, c * kh, variant, color)

        if (note.maturity === "fruit" && i < BERRIES.length) {
          // 果子挂在针叶下缘最宽的地方，半嵌进锥面，看着才像长在枝上
          const rim = c * kr
          const y = s.trunk * ky - (c * kh) / 2 + c * kh * 0.2
          const size = Math.min(c * 0.19, rim * 0.22)
          for (let k = 0; k < BERRIES[i]; k += 1) {
            const a = (k / BERRIES[i]) * Math.PI * 2 + hash(`${note.slug}fa${i}.${k}`) * 1.2
            const rr = rim * (0.74 + hash(`${note.slug}fr${i}.${k}`) * 0.16)
            const grow = 0.85 + hash(`${note.slug}fs${i}.${k}`) * 0.35
            blob(
              cx + Math.cos(a) * rr,
              y + (hash(`${note.slug}fy${i}.${k}`) - 0.5) * c * 0.14,
              cz + Math.sin(a) * rr,
              size * grow,
              0.92, // 果子比树叶圆
              4 + ((i + k) % 2),
              FRUIT,
            )
          }
        }
      }
    } else {
      // 三根斜枝托住树冠，枝梢收在冠里，不会露出光秃秃的一截
      for (let i = 0; i < 3; i += 1) {
        const a = r * 6.3 + i * 2.39
        const y = s.trunk * (0.52 + i * 0.17)
        limb(
          lean * (y / s.trunk),
          y,
          0,
          Math.cos(a) * 0.4 + lean,
          y + 0.5,
          Math.sin(a) * 0.4,
          0.075,
        )
      }
      // 七团树冠挤成一顶有起伏的伞
      const c = s.crown
      const crown = [
        [-0.34, s.trunk + c * 0.5, 0.12, 0.88, 0.86, 0, leaf],
        [0.36, s.trunk + c * 0.58, -0.1, 0.84, 0.84, 1, leafLight],
        [0, s.trunk + c * 0.76, -0.3, 0.8, 0.86, 2, leafDark],
        [-0.08, s.trunk + c * 0.86, 0.32, 0.78, 0.86, 3, leaf],
        [0.02, s.trunk + c * 1.4, 0, 0.8, 0.9, 4, leafLight],
        [-0.24, s.trunk + c * 1.18, -0.16, 0.6, 0.86, 5, leafDark],
        [0.22, s.trunk + c * 1.14, 0.2, 0.58, 0.86, 0, leaf],
      ]
      for (const [x, y, z, kr, flat, variant, color] of crown) {
        blob(x, y, z, c * kr, flat, variant, color)
      }
    }
  } else if (note.maturity === "sapling") {
    const s = SHAPES.sapling
    const lean = (r - 0.5) * 0.12
    limb(0, 0, 0, 0, 0.14, 0, 0.15, woodDark)
    limb(0, 0, 0, lean, s.trunk, lean * 0.4, 0.085)
    // 刚分叉的两根细枝
    for (let i = 0; i < 2; i += 1) {
      const a = r * 6.3 + i * 3.1
      limb(
        lean * 0.8,
        s.trunk * 0.62,
        0,
        Math.cos(a) * 0.22 + lean,
        s.trunk + 0.3,
        Math.sin(a) * 0.22,
        0.04,
      )
    }
    const c = s.crown
    blob(0, s.trunk + c * 0.5, 0, c * 1.15, 0.86, 0, leaf)
    blob(-0.24, s.trunk + c * 1.0, 0.06, c * 0.85, 0.84, 1, leafDark)
    blob(0.22, s.trunk + c * 1.05, -0.05, c * 0.8, 0.84, 2, leafLight)
    blob(0, s.trunk + c * 1.5, 0, c * 0.72, 0.88, 3, leaf)
  } else if (note.maturity === "sprout") {
    const s = SHAPES.sprout
    const lean = (r - 0.5) * 0.1
    blob(0, 0.008, 0, 0.2, 0.12, 5, MOSS) // 脚下一小片深色的草，别像只花盆
    limb(0, 0, 0, lean, s.trunk, lean * 0.5, 0.032)
    // 两片子叶从茎顶向两侧张开，微微上翘
    const base = r * 6.3
    for (let i = 0; i < 2; i += 1) {
      const a = base + i * Math.PI
      blade(
        Math.cos(a) * s.crown + lean,
        s.trunk - 0.01,
        Math.sin(a) * s.crown,
        s.crown * 1.05,
        i === 0 ? 0.55 : -0.55,
        -a,
        i,
        leaf,
      )
    }
    blob(lean * 1.2, s.trunk + 0.05, 0, s.crown * 0.5, 0.9, 3, leafLight) // 顶芽
  } else {
    // 种子（也是没写 maturity 时的默认形态）：地上一粒种子
    const c = SHAPES.seed.crown
    blob(0, 0.01, 0, c, 0.16, 0, SOIL) // 脚下一小撮土
    blob(0.01, c * 0.53, 0, c * 0.59, 0.85, 2, SEED)
  }

  const merged = mergeGeometries(parts, false)
  merged.computeBoundingBox()
  const mesh = new THREE.Mesh(merged, TREE_MATERIAL)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  group.rotation.y = r * Math.PI * 2
  group.rotation.x = (hash(note.slug + "t") - 0.5) * 0.05 // 各长各的，别都笔直
  group.rotation.z = (hash(note.slug + "t2") - 0.5) * 0.05
  group.userData.top = merged.boundingBox.max.y
  return group
}

// ---------------------------------------------------------------- 布局
const trees = []
;(function plant() {
  const total = data.notes.length || 1
  // 出场动画的总时长固定，笔记多了也不会等太久
  const stagger = Math.min(0.06, 2.5 / total)
  let planted = 0

  ISLANDS.forEach((isl, index) => {
    const list = isl.notes
    if (list.length === 0) return

    const R = isl.r
    const TREE_GAP = 0.95 * isl.shrink // 相邻两棵树的最小间距（世界单位）
    const rIn = 0.3 * R
    const rOut = 0.88 * R
    const span = Math.PI * 2

    // 圈层：半径收在岛内 30%~88%，每圈能站几棵按"弧长 ÷ 树间距"推算，
    // 所以岛变大、树变小时，一圈自然能容纳更多树；圈数同时受岛半径限制，
    // 免得圈与圈之间挤在一起
    const maxRings = Math.max(1, Math.min(16, 1 + Math.floor((rOut - rIn) / TREE_GAP)))
    function ringPlan(count) {
      // 岛上只有一棵树时让它待在近中央，别偏到岛边上去
      if (count === 1) return { caps: [1], radii: [0.3 * R] }
      let plan = null
      for (let n = 1; n <= maxRings; n += 1) {
        const radii =
          n === 1 ? [0.59 * R] : Array.from({ length: n }, (_, i) => (0.3 + (0.58 * i) / (n - 1)) * R)
        // 1.35 是给抖动留的余量：就算两棵树各自抖到最近处，也还剩得下间距
        const caps = radii.map((r) => Math.max(1, Math.floor((span * r) / (TREE_GAP * 1.35))))
        plan = { caps, radii }
        if (caps.reduce((a, b) => a + b, 0) >= count) break
      }
      return plan
    }

    const { caps, radii } = ringPlan(list.length)

    // 按各圈容量比例分树。笔记多到超过整座岛的容量时，是整体一起变密，
    // 而不是把多出来的树堆在最外圈——那样会两棵叠在一起
    const capSum = caps.reduce((a, b) => a + b, 0)
    const alloc = caps.map((c) => Math.max(1, Math.round((list.length * c) / capSum)))
    let drift = list.length - alloc.reduce((a, b) => a + b, 0)
    for (let i = 0; drift !== 0; i += 1) {
      const k = i % alloc.length
      if (drift > 0) {
        alloc[k] += 1
        drift -= 1
      } else if (alloc[k] > 1) {
        alloc[k] -= 1
        drift += 1
      }
    }

    let idx = 0
    alloc.forEach((placed, ring) => {
      const r = radii[ring]
      const gap = ring === 0 ? r : r - radii[ring - 1]
      // 整圈平分，没有扇区边界要躲，所以不留空槽
      const slotW = span / placed

      for (let slot = 0; slot < placed; slot += 1, idx += 1) {
        const note = list[idx]
        // 抖动跟着局部间距缩放，笔记密的时候不会把两棵树叠在一起
        const a = -Math.PI / 2 + slotW * (slot + 0.5) + (hash(note.slug) - 0.5) * slotW * 0.4
        const jitter = (hash(note.slug + "r") - 0.5) * Math.min(gap, 0.3 * R) * 0.3
        const radius = Math.min(r + jitter, 0.99 * R)

        const group = buildTree(note)
        // 种在这畦地的皮面上，不是草地平面上——地皮是抬起来的
        group.position.set(isl.x + Math.cos(a) * radius, isl.top, isl.z + Math.sin(a) * radius)
        // 轻微随机缩放，避免整齐划一；再乘上密度系数
        const s = (0.9 + hash(note.slug + "s") * 0.25) * isl.shrink
        group.scale.setScalar(0.001)
        group.userData = {
          ...group.userData,
          note,
          target: s,
          born: planted * stagger,
          island: index,
          islandR: R,
          groundY: isl.top,
        }
        planted += 1
        scene.add(group)
        trees.push(group)
      }
    })
  })
})()

// 不再画笔记之间的连线：同一畦地本来就是一个主题，谁连着谁看图不如看笔记页里的
// 局部关系图和 backlinks 清楚，画在地上只是给草地添乱

// ---------------------------------------------------------------- 交互
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2(-10, -10)
let hovered = null
let pinned = null
let level = "all"

function visible(note) {
  return level === "all" || note.maturity === level
}

function updateVisibility() {
  let shown = 0
  const perIsland = new Map()
  for (const t of trees) {
    const ok = visible(t.userData.note)
    t.visible = ok
    if (ok) {
      shown += 1
      perIsland.set(t.userData.island, (perIsland.get(t.userData.island) || 0) + 1)
    }
  }
  // 整座岛都没树可看时，连岛带名牌一起收起来；一片空花园则留一座裸岛
  const bare = trees.length === 0
  ISLANDS.forEach((isl, i) => {
    const alive = (perIsland.get(i) || 0) > 0 || (bare && i === 0)
    if (isl.group) isl.group.visible = alive
    if (isl.label) isl.label.visible = (perIsland.get(i) || 0) > 0
  })
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

  tree.getWorldPosition(anchorVec)
  anchorVec.y += (tree.userData.top || 1) * tree.userData.target
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
  const labels = { seed: "种子", sprout: "新芽", sapling: "树苗", tree: "成树", fruit: "果实" }
  meta.push(labels[note.maturity] ?? "种子")
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
  frameCamera()
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
  sizeLabels()
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
    // 悬停只显示标题浮层；详情卡片仅在点击后出现
    if (hovered && !pinned) {
      tip.style.display = "block"
      tip.textContent = hovered.userData.note.title
    } else {
      tip.style.display = "none"
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
  if (pinned) positionCard(pinned)
  else card.style.display = "none"
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

resize()
frameCamera()
updateVisibility()
if (loading) loading.style.display = "none"
animate()
