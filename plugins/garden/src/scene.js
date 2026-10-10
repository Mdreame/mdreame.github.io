import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { growthScale, hash, layoutGarden, linkedNotes, topicOf } from "./layout.js"

export function createGarden({ canvas, labels, notes, onSelect, onFail, onRoamChange }) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)")
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog("#e9eee5", 65, 180)
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.09
  controls.minPolarAngle = 0.18
  controls.maxPolarAngle = Math.PI * 0.47
  controls.minDistance = 4
  controls.maxDistance = 150
  controls.autoRotate = false
  controls.autoRotateSpeed = 0.45
  controls.screenSpacePanning = true
  controls.touches.ONE = THREE.TOUCH.ROTATE
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN
  const hemi = new THREE.HemisphereLight("#fff7df", "#879877", 2.0)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight("#fff1d3", 2.5)
  sun.position.set(-15, 24, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.06
  scene.add(sun)
  const fill = new THREE.DirectionalLight("#d3e9ed", 1.1)
  fill.position.set(12, 6, -15)
  scene.add(fill)

  const materials = new Map()
  const geometries = new Set()
  const paleColor = new THREE.Color("#d5dfcf")
  function mat(color) {
    if (!materials.has(color))
      materials.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }),
      )
    return materials.get(color)
  }
  function mesh(geo, color, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    geometries.add(geo)
    const m = new THREE.Mesh(geo, mat(color))
    m.position.set(x, y, z)
    m.scale.set(sx, sy, sz)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const rockGeo = new THREE.IcosahedronGeometry(1, 0)
  const leafGeo = new THREE.IcosahedronGeometry(1, 1)
  const sphereGeo = new THREE.IcosahedronGeometry(1, 1)
  const stemGeo = new THREE.CylinderGeometry(0.055, 0.08, 1, 6)
  const fruitGeo = new THREE.IcosahedronGeometry(0.13, 1)
  function stem(parent, from, to, width = 1, color = "#7c654a") {
    const start = new THREE.Vector3(...from),
      end = new THREE.Vector3(...to),
      direction = end.clone().sub(start)
    const m = mesh(stemGeo, color, parent)
    m.position.copy(start.add(end).multiplyScalar(0.5))
    m.scale.set(width, direction.length(), width)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
    return m
  }
  function leaf(parent, x, y, z, rotation, scale = 1, color = "#83a85d") {
    const m = mesh(leafGeo, color, parent, x, y, z, 0.23 * scale, 0.55 * scale, 0.105 * scale)
    m.rotation.z = rotation
    m.rotation.y = 0.35
    return m
  }
  function plantModel(note) {
    const g = new THREE.Group()
    const maturity = note.maturity
    const form =
      maturity === "growing" ? (hash(note.slug + ":form") < 0.5 ? "sprout" : "sapling") : maturity
    const earth = mesh(sphereGeo, "#a4936d", g, 0, 0.045, 0, 0.42, 0.11, 0.34)
    earth.castShadow = false
    if (form === "seed") {
      mesh(sphereGeo, "#a37748", g, 0, 0.19, 0, 0.16, 0.2, 0.12).rotation.z = -0.4
      stem(g, [0, 0.15, 0], [0.02, 0.35, 0], 0.32, "#75965b")
      leaf(g, 0.12, 0.36, 0, -1.1, 0.35, "#a4bc79")
    } else if (form === "sprout") {
      stem(g, [0, 0.12, 0], [0, 0.8, 0], 0.55, "#75965b")
      leaf(g, -0.25, 0.68, 0, 0.9, 0.8, "#80a75b")
      leaf(g, 0.24, 0.9, 0.03, -0.8, 0.8, "#a1bd72")
    } else if (form === "sapling") {
      stem(g, [0, 0.1, 0], [0, 1.65, 0], 0.85)
      stem(g, [0, 0.6, 0], [-0.4, 1, 0], 0.5, "#789659")
      leaf(g, -0.45, 1.08, 0, 1.05, 0.95)
      leaf(g, 0.38, 1.38, 0.04, -0.9, 1.05, "#9cb972")
      leaf(g, -0.08, 1.8, 0, 0.25, 0.75, "#729652")
    } else {
      stem(g, [0, 0, 0], [0, 2.1, 0], 2)
      stem(g, [0, 1, 0], [-0.7, 1.85, 0], 1)
      stem(g, [0, 1.5, 0], [0.65, 2.15, 0.1], 1.1)
      const colors = note.fruit
        ? ["#527c51", "#71945c", "#89a16c"]
        : ["#6d8f59", "#8ba66d", "#a1b67d"]
      const crowns = [
        [-0.55, 2.1, 0, 0.85],
        [0.45, 2.35, 0.05, 0.9],
        [0, 2.9, 0, 0.88],
        [0, 2.25, 0.5, 0.65],
        [0.15, 2.15, -0.5, 0.75],
      ]
      crowns.forEach(([x, y, z, s], i) =>
        mesh(sphereGeo, colors[i % 3], g, x, y, z, s, s * 0.92, s),
      )
      if (note.fruit)
        [
          [-1.3, 2.05, 0.1],
          [-1.12, 2.55, 0.34],
          [-0.82, 1.93, 0.48],
          [-0.6, 2.8, 0.76],
          [-0.35, 2.34, 0.95],
          [-0.2, 3.05, -0.76],
          [0, 2.3, 1.12],
          [0.12, 2.72, -0.94],
          [0.28, 1.92, -0.96],
          [0.4, 3.35, 0.55],
          [0.55, 2.9, -0.73],
          [0.78, 2.18, 0.82],
          [0.92, 2.62, 0.2],
          [1.08, 2.02, -0.28],
          [1.26, 2.3, 0.12],
          [-0.92, 2.18, -0.55],
          [-0.28, 2.02, -0.42],
          [0.72, 2.42, -0.48],
        ].forEach(([x, y, z], index) => {
          const color = index % 3 === 0 ? "#e47f39" : index % 3 === 1 ? "#e9ad42" : "#ce6840"
          mesh(fruitGeo, color, g, x, y, z, 1.38, 1.38, 1.38)
          stem(g, [x, y + 0.12, z], [x + 0.02, y + 0.23, z], 0.24, "#688349")
        })
    }
    g.rotation.y = hash(note.slug + "rotation") * Math.PI * 2
    return g
  }
  const layout = layoutGarden(notes)
  function terrain(island) {
    const group = new THREE.Group()
    group.position.set(island.x, 0, island.z)
    scene.add(group)
    const count = 52
    const edge = Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2
      const r = island.radius * (1 + Math.sin(a * 3 + 0.5) * 0.07 + Math.cos(a * 5) * 0.04)
      return [Math.cos(a) * r, Math.sin(a) * r]
    })
    // Concentric triangulated rings form a solid irregular floating island, not a flat sprite.
    function band(topY, bottomY, topScale, bottomScale, color) {
      const positions = []
      for (let i = 0; i < count; i++) {
        const j = (i + 1) % count,
          a = edge[i],
          b = edge[j]
        const p = [a[0] * topScale, topY, a[1] * topScale],
          q = [b[0] * topScale, topY, b[1] * topScale]
        const r = [a[0] * bottomScale, bottomY, a[1] * bottomScale],
          s = [b[0] * bottomScale, bottomY, b[1] * bottomScale]
        positions.push(...p, ...q, ...r, ...q, ...s, ...r)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
      geo.computeVertexNormals()
      mesh(geo, color, group)
    }
    band(0.02, -0.23, 1, 1.02, "#94a872")
    band(-0.23, -0.85, 1.02, 1, "#b5a080")
    band(-0.85, -2.8, 1, 0.92, "#8d8974")
    band(-2.8, -4.2, 0.92, 0.45, "#797d6d")
    const verts = [],
      colors = []
    for (let i = 0; i < count; i++) {
      const a = edge[i],
        b = edge[(i + 1) % count]
      verts.push(0, 0.02, 0, b[0], 0.02, b[1], a[0], 0.02, a[1])
      const color = new THREE.Color(i % 3 === 0 ? "#a4b985" : i % 3 === 1 ? "#afbf91" : "#aaba8b")
      for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b)
    }
    const topGeo = new THREE.BufferGeometry()
    topGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3))
    topGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    topGeo.computeVertexNormals()
    geometries.add(topGeo)
    const topMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
    materials.set("terrain-" + island.key, topMat)
    const top = new THREE.Mesh(topGeo, topMat)
    top.receiveShadow = true
    group.add(top)
    // A pale gravel path encircles the central meadow.
    const path = new THREE.Mesh(
      new THREE.RingGeometry(island.radius * 0.29, island.radius * 0.34, 64),
      mat("#c9c7a4"),
    )
    geometries.add(path.geometry)
    path.rotation.x = -Math.PI / 2
    path.position.y = 0.035
    path.receiveShadow = true
    group.add(path)
    // A shallow pond and a few reed clusters supply scenery without inventing note trees.
    mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 0.045, 24),
      "#babba0",
      group,
      -island.radius * 0.16,
      0.05,
      -island.radius * 0.13,
      1,
      0.7,
      0.7,
    )
    const water = mesh(
      new THREE.CylinderGeometry(0.94, 0.94, 0.045, 24),
      "#83b6ad",
      group,
      -island.radius * 0.16,
      0.075,
      -island.radius * 0.13,
      1,
      1,
      0.7,
    )
    water.castShadow = false
    for (let j = 0; j < 5; j++) {
      const x = -island.radius * 0.16 - 0.85 + j * 0.14,
        z = -island.radius * 0.13 - 0.4
      stem(group, [x, 0.08, z], [x + 0.07, 0.35 + hash(j) * 0.25, z], 0.3, "#728456")
    }
    for (let i = 0; i < Math.max(12, 58 / layout.islands.length); i++) {
      const a = hash(island.key + i + "a") * Math.PI * 2,
        r = island.radius * (0.82 + hash(i + "r") * 0.14)
      const x = Math.cos(a) * r,
        z = Math.sin(a) * r
      if (i % 5 === 0) {
        const s = 0.13 + hash(i + "size") * 0.22
        mesh(rockGeo, i % 2 ? "#b8b9a4" : "#919b83", group, x, 0.1, z, s * 1.5, s, s)
      } else {
        const height = 0.14 + hash(i + "grass") * 0.26
        const g = mesh(new THREE.ConeGeometry(0.055, height, 3), "#809c60", group, x, height / 2, z)
        g.rotation.z = (hash(i + "lean") - 0.5) * 0.7
        if (i % 7 === 0) mesh(sphereGeo, "#e8d7a0", group, x, height, z, 0.065, 0.06, 0.065)
      }
    }
    // Stepping stones gently lead outwards from the pond.
    for (let i = 0; i < 6; i++)
      mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 0.06, 7),
        "#d3c7a8",
        group,
        0.7 + i * 0.33,
        0.06,
        0.15 + i * 0.35,
        1,
        1,
        0.7,
      )
    const groundShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(island.radius * 4, island.radius * 4),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.22,
      }),
    )
    geometries.add(groundShadow.geometry)
    materials.set("shadow-" + island.key, groundShadow.material)
    groundShadow.rotation.x = -Math.PI / 2
    groundShadow.position.set(island.x, -5.3, island.z)
    scene.add(groundShadow)
  }
  const shadowCanvas = document.createElement("canvas")
  shadowCanvas.width = 128
  shadowCanvas.height = 128
  const ctx = shadowCanvas.getContext("2d")
  const grad = ctx.createRadialGradient(64, 64, 5, 64, 64, 64)
  grad.addColorStop(0, "#657664")
  grad.addColorStop(0.45, "#657664aa")
  grad.addColorStop(1, "#65766400")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas)
  layout.islands.forEach(terrain)
  const extent = Math.max(8, ...layout.islands.map((i) => Math.hypot(i.x, i.z) + i.radius))
  controls.maxDistance = extent * 15
  camera.far = extent * 30
  scene.fog.near = extent * 7
  scene.fog.far = extent * 25
  sun.shadow.camera.left = -extent
  sun.shadow.camera.right = extent
  sun.shadow.camera.top = extent
  sun.shadow.camera.bottom = -extent
  sun.shadow.camera.far = extent * 4 + 20
  sun.position.set(-extent, extent * 2, extent)
  const plants = new Map(),
    hitTargets = [],
    labelEntries = [],
    relatedRings = new Map()
  const filterRingGeometry = new THREE.RingGeometry(0.72, 0.82, 32)
  const filterRingMaterial = new THREE.MeshBasicMaterial({
    color: "#6a9558",
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
    depthTest: false,
    depthWrite: false,
  })
  geometries.add(filterRingGeometry)
  materials.set("filter-ring", filterRingMaterial)
  for (const entry of layout.plants) {
    const { note, x, z } = entry
    const plantScale = growthScale(note.slug)
    const group = plantModel(note)
    group.scale.setScalar(plantScale)
    group.position.set(x, 0.08, z)
    const bed = mesh(new THREE.CylinderGeometry(0.64, 0.7, 0.06, 12), "#bac59c", scene, x, 0.04, z)
    bed.castShadow = false
    scene.add(group)
    const filterRing = new THREE.Mesh(filterRingGeometry, filterRingMaterial)
    filterRing.rotation.x = -Math.PI / 2
    filterRing.position.set(x, 0.18, z)
    filterRing.renderOrder = 4
    filterRing.visible = false
    scene.add(filterRing)
    // Independent materials allow unrelated trees to fade when a note is selected.
    group.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = obj.material.clone()
        obj.userData.baseColor = obj.material.color.clone()
        materials.set(note.slug + obj.uuid, obj.material)
      }
    })
    const form =
      note.maturity === "growing"
        ? hash(note.slug + ":form") < 0.5
          ? "sprout"
          : "sapling"
        : note.maturity
    const height = ({ seed: 0.5, sprout: 1.2, sapling: 2.2, tree: 3.5 }[form] || 0.5) * plantScale
    const hit = mesh(
      new THREE.CylinderGeometry(height > 3 ? 1.3 : 0.6, 0.6, height, 8),
      "#ffffff",
      scene,
      x,
      height / 2,
      z,
    )
    hit.visible = false
    hit.userData.slug = note.slug
    hitTargets.push(hit)
    const button = document.createElement("button")
    button.className = "scene-label"
    button.type = "button"
    const title = document.createElement("span")
    title.className = "scene-label-title"
    title.textContent = note.title
    button.append(title)
    const topicLabel = document.createElement("small")
    topicLabel.textContent = `${topicOf(note)}${note.fruit ? " · 结果" : ""}`
    button.append(topicLabel)
    button.setAttribute("aria-label", `${note.title}，查看笔记`)
    button.dataset.slug = note.slug
    button.addEventListener("click", () => onSelect(note.slug))
    labels.append(button)
    labelEntries.push({ button, position: new THREE.Vector3(x, height + 0.3, z), slug: note.slug })
    plants.set(note.slug, {
      group,
      filterRing,
      note,
      position: new THREE.Vector3(x, 0.5, z),
      height,
      active: true,
      growthScale: plantScale,
    })
  }
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.64, 0.72, 48),
    new THREE.MeshBasicMaterial({
      color: "#f8edbb",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    }),
  )
  geometries.add(ring.geometry)
  materials.set("selection-ring", ring.material)
  ring.rotation.x = -Math.PI / 2
  ring.visible = false
  scene.add(ring)
  let edges = []
  function clearEdges() {
    for (const edge of edges) {
      scene.remove(edge)
      edge.geometry.dispose()
      edge.material.dispose()
    }
    edges = []
  }
  function linkedSlugs(slug) {
    return linkedNotes(
      [...plants.values()].map((plant) => plant.note),
      slug,
    )
  }
  function connections(slug) {
    clearEdges()
    const origin = plants.get(slug)
    const relatedSlugs = new Set([...linkedSlugs(slug)].filter((key) => plants.get(key)?.active))
    for (const [otherSlug, marker] of relatedRings) marker.visible = relatedSlugs.has(otherSlug)
    if (!origin) return
    for (const otherSlug of relatedSlugs) {
      const other = plants.get(otherSlug)
      if (!other) continue
      let marker = relatedRings.get(otherSlug)
      if (!marker) {
        const geometry = new THREE.RingGeometry(0.9, 1.03, 48)
        const material = new THREE.MeshBasicMaterial({
          color: "#e9b454",
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.96,
          depthWrite: false,
        })
        geometries.add(geometry)
        materials.set(`related-ring-${otherSlug}`, material)
        marker = new THREE.Mesh(geometry, material)
        marker.rotation.x = -Math.PI / 2
        scene.add(marker)
        relatedRings.set(otherSlug, marker)
      }
      marker.position.set(other.position.x, 0.16, other.position.z)
      marker.visible = true
    }
    for (const other of plants.values()) {
      if (other === origin || !other.active) continue
      if (
        !(origin.note.links || []).includes(other.note.slug) &&
        !(other.note.links || []).includes(slug)
      )
        continue
      const a = origin.position.clone(),
        b = other.position.clone()
      a.y = 1.35
      b.y = 1.35
      const mid = a.clone().lerp(b, 0.5)
      mid.y = 3.3 + a.distanceTo(b) * 0.12
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
      const line = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 48, 0.055, 6, false),
        new THREE.MeshBasicMaterial({
          color: "#d89b35",
          transparent: true,
          opacity: 0.82,
          depthTest: false,
          depthWrite: false,
        }),
      )
      line.renderOrder = 5
      scene.add(line)
      edges.push(line)
    }
  }
  let selected = null,
    hovered = null,
    transition = null,
    visible = true,
    dead = false,
    frame = 0,
    lastTime = 0,
    mode = "overview"
  const homeTarget = new THREE.Vector3(0, -0.7, 0)
  const homeDir = new THREE.Vector3(0.9, 0.85, 1.15).normalize()
  function homeDistance() {
    return (
      (extent * 1.32) /
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) /
      Math.min(1, camera.aspect)
    )
  }
  function moveTo(target, distance, instant = false, direction = null) {
    distance = THREE.MathUtils.clamp(distance, controls.minDistance, controls.maxDistance)
    controls.autoRotate = false
    onRoamChange(false)
    const dir = direction || camera.position.clone().sub(controls.target).normalize()
    if (instant || reduced.matches) {
      controls.target.copy(target)
      camera.position.copy(target).addScaledVector(instant ? homeDir : dir, distance)
      controls.update()
      transition = null
    } else
      transition = {
        start: performance.now(),
        from: camera.position.clone(),
        fromTarget: controls.target.clone(),
        to: target.clone().addScaledVector(dir, distance),
        target: target.clone(),
      }
    invalidate()
  }
  function overview(instant = false) {
    mode = "overview"
    moveTo(homeTarget, homeDistance(), instant, homeDir)
  }
  function focusNote(slug) {
    const p = plants.get(slug)
    if (p) {
      const connected = [p, ...[...linkedSlugs(slug)].map((key) => plants.get(key)).filter(Boolean)]
      const target = new THREE.Vector3()
      for (const plant of connected) target.add(plant.position)
      target.divideScalar(connected.length)
      target.y += p.height * 0.18
      const radius = Math.max(0, ...connected.map((plant) => plant.position.distanceTo(target)))
      mode = "focus"
      moveTo(
        target,
        Math.max(13, ((radius + 4.5) * 1.1) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
          Math.min(1, camera.aspect),
      )
    }
  }
  function focusTopic(topic) {
    const list = [...plants.values()].filter((p) => topicOf(p.note) === topic)
    if (!topic || !list.length) {
      overview()
      return
    }
    const center = new THREE.Vector3()
    list.forEach((p) => center.add(p.position))
    center.divideScalar(list.length)
    mode = "focus"
    const radius = Math.max(2, ...list.map((p) => p.position.distanceTo(center)))
    moveTo(center, Math.max(10, radius * 3) / Math.min(1, camera.aspect))
  }
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    projected = new THREE.Vector3()
  function hitAt(event) {
    const rect = canvas.getBoundingClientRect()
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    return (
      raycaster
        .intersectObjects(hitTargets)
        .map((h) => h.object.userData.slug)
        .find((slug) => plants.get(slug).active) || null
    )
  }
  const pointers = new Set()
  let down = null,
    moved = false
  canvas.addEventListener("pointerdown", (e) => {
    pointers.add(e.pointerId)
    down = { x: e.clientX, y: e.clientY }
    if (pointers.size > 1) moved = true
    else moved = false
    transition = null
    setRoam(false)
  })
  canvas.addEventListener("pointermove", (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) moved = true
    if (e.pointerType === "mouse" && !pointers.size) {
      hovered = hitAt(e)
      canvas.style.cursor = hovered ? "pointer" : "grab"
      invalidate()
    }
  })
  canvas.addEventListener("pointerup", (e) => {
    const select = down && !moved && pointers.size === 1 && e.button === 0
    pointers.delete(e.pointerId)
    if (select) {
      const slug = hitAt(e)
      if (slug) onSelect(slug)
    }
    if (!pointers.size) down = null
  })
  canvas.addEventListener("pointercancel", (e) => {
    pointers.delete(e.pointerId)
    down = null
    moved = true
  })
  canvas.addEventListener("pointerleave", () => {
    hovered = null
    invalidate()
  })
  controls.addEventListener("start", () => {
    mode = "manual"
    transition = null
    setRoam(false)
  })
  controls.addEventListener("change", () => invalidate())
  function updateLabels() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight
    const visibleCount = [...plants.values()].filter((plant) => plant.active).length
    const related = selected
      ? new Set([...linkedSlugs(selected)].filter((key) => plants.get(key)?.active))
      : new Set()
    const occupied = []
    const positioned = labelEntries
      .map((entry) => {
        projected.copy(entry.position).project(camera)
        return {
          ...entry,
          x: (projected.x * 0.5 + 0.5) * w,
          y: (-projected.y * 0.5 + 0.5) * h,
          outside:
            projected.z > 1 ||
            projected.z < -1 ||
            Math.abs(projected.x) > 0.94 ||
            Math.abs(projected.y) > 0.88,
        }
      })
      .sort((a, b) => Number(b.slug === selected) - Number(a.slug === selected) || a.y - b.y)
    for (const entry of positioned) {
      const button = entry.button
      const isRelated = related.has(entry.slug)
      const isHighlighted = entry.slug === selected || entry.slug === hovered || isRelated
      button.classList.toggle("is-selected", entry.slug === selected)
      button.classList.toggle("is-hovered", entry.slug === hovered)
      button.classList.toggle("is-related", !!isRelated)
      button.classList.toggle("compact", notes.length > 20)
      button.setAttribute("aria-pressed", String(entry.slug === selected))
      button.hidden =
        !plants.get(entry.slug).active || entry.outside || (visibleCount > 35 && !isHighlighted)
      if (button.hidden) continue
      const width = button.offsetWidth,
        height = button.offsetHeight
      const x = THREE.MathUtils.clamp(entry.x, width / 2 + 5, w - width / 2 - 5)
      let y = entry.y
      for (let attempt = 0; attempt < 6; attempt++) {
        const overlaps = occupied.filter(
          (box) =>
            Math.abs(box.x - x) < (box.width + width) / 2 + 4 &&
            y > box.y - box.height - 5 &&
            y - height < box.y + 5,
        )
        if (!overlaps.length) break
        y = Math.min(...overlaps.map((box) => box.y - box.height - 7))
      }
      // Keep crowded far-away labels as compact targets; the list remains fully accessible.
      if (y < 60 && entry.slug !== selected && entry.slug !== hovered) {
        button.classList.add("compact")
        y = entry.y
      }
      occupied.push({ x, y, width, height })
      button.style.setProperty("--stem-height", `${Math.max(4, entry.y - y + 4)}px`)
      button.style.transform = `translate(-50%, -100%) translate(${x}px,${y}px)`
    }
  }
  function setState(slugs, slug, filtered = false) {
    const allowed = new Set(slugs)
    selected = slug
    const related = linkedSlugs(slug)
    for (const [key, p] of plants) {
      p.active = allowed.has(key)
      p.group.visible = p.active
      p.filterRing.visible = filtered && p.active && !slug
      const emphasized = key === slug || related.has(key)
      const focusScale = slug
        ? key === slug
          ? 1.12
          : emphasized
            ? 1.08
            : 1
        : filtered && p.active && p.note.maturity === "seed"
          ? 1.7
          : 1
      p.group.scale.setScalar(p.growthScale * focusScale)
      p.group.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = p.active && (!slug || emphasized)
          obj.material.color
            .copy(obj.userData.baseColor)
            .lerp(paleColor, slug && !emphasized ? 0.58 : 0)
          obj.material.transparent = !p.active && !slug
          obj.material.opacity = !p.active && !slug ? 0.14 : 1
          obj.material.depthWrite = p.active || !!slug
        }
      })
    }
    ring.visible = !!plants.get(slug)
    if (ring.visible) {
      const p = plants.get(slug)
      ring.position.set(p.position.x, 0.14, p.position.z)
    }
    connections(slug)
    renderer.shadowMap.needsUpdate = true
    updateProjection()
    invalidate()
  }
  function setRoam(value) {
    controls.autoRotate = value
    onRoamChange(value)
    invalidate()
  }
  function updateProjection() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight
    if (!w || !h) return
    const offset =
      selected && matchMedia("(min-width:701px) and (max-width:1349px)").matches ? 130 : 0
    camera.setViewOffset(w, h, offset, 0, w, h)
  }
  function resize() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    updateProjection()
    if (mode === "overview") overview(true)
    invalidate()
  }
  let dirty = true
  function invalidate() {
    dirty = true
    if (!frame && !dead && visible && !document.hidden) frame = requestAnimationFrame(animate)
  }
  function animate(now) {
    frame = 0
    if (dead || !visible || document.hidden) return
    if (now - lastTime < 32) {
      invalidate()
      return
    }
    const dt = Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now
    if (transition) {
      const t = Math.min(1, (now - transition.start) / 850),
        e = 1 - (1 - t) ** 3
      camera.position.lerpVectors(transition.from, transition.to, e)
      controls.target.lerpVectors(transition.fromTarget, transition.target, e)
      if (t === 1) transition = null
      dirty = true
    }
    if (!reduced.matches && notes.length <= 80) {
      for (const [slug, p] of plants) {
        p.group.rotation.z = Math.sin(now * 0.00075 + hash(slug) * 6) * 0.014
      }
      dirty = true
    }
    controls.update(dt)
    if (dirty) {
      updateLabels()
      renderer.render(scene, camera)
      dirty = false
    }
    if ((!reduced.matches && notes.length <= 80) || transition || controls.autoRotate) invalidate()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas.parentElement)
  const visibilityObserver = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting
      if (visible) invalidate()
      else {
        cancelAnimationFrame(frame)
        frame = 0
      }
    },
    { threshold: 0.01 },
  )
  visibilityObserver.observe(canvas)
  function visibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(frame)
      frame = 0
    } else invalidate()
  }
  document.addEventListener("visibilitychange", visibilityChange)
  function contextLost(e) {
    e.preventDefault()
    dispose()
    onFail("3D 场景暂时无法显示，已切换到笔记列表。")
  }
  canvas.addEventListener("webglcontextlost", contextLost)
  function dispose() {
    if (dead) return
    dead = true
    cancelAnimationFrame(frame)
    resizeObserver.disconnect()
    visibilityObserver.disconnect()
    document.removeEventListener("visibilitychange", visibilityChange)
    canvas.removeEventListener("webglcontextlost", contextLost)
    controls.dispose()
    clearEdges()
    geometries.forEach((g) => g.dispose())
    materials.forEach((m) => m.dispose())
    shadowTexture.dispose()
    renderer.dispose()
    labels.replaceChildren()
  }
  window.addEventListener("pagehide", (e) => {
    if (!e.persisted) dispose()
    else {
      cancelAnimationFrame(frame)
      frame = 0
    }
  })
  window.addEventListener("pageshow", () => {
    if (!dead) invalidate()
  })
  canvas.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "Home"].includes(e.key))
      return
    e.preventDefault()
    mode = "manual"
    setRoam(false)
    if (e.key === "Home") {
      overview()
      return
    }
    if (["+", "=", "-"].includes(e.key)) {
      moveTo(
        controls.target,
        camera.position.distanceTo(controls.target) * (e.key === "-" ? 1.2 : 0.8),
      )
      return
    }
    transition = null
    const spherical = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    )
    if (e.key === "ArrowLeft") spherical.theta -= 0.15
    if (e.key === "ArrowRight") spherical.theta += 0.15
    if (e.key === "ArrowUp") spherical.phi -= 0.12
    if (e.key === "ArrowDown") spherical.phi += 0.12
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi,
      controls.minPolarAngle,
      controls.maxPolarAngle,
    )
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical))
    controls.update()
    invalidate()
  })
  resize()
  overview(true)
  invalidate()
  return {
    setState,
    focusNote,
    focusTopic,
    overview: () => overview(),
    setRoam,
    zoom: (factor) => {
      mode = "focus"
      moveTo(controls.target, camera.position.distanceTo(controls.target) * factor)
    },
    setVisible: (value) => {
      if (value === visible) return
      visible = value
      if (value) {
        resize()
        invalidate()
      } else {
        cancelAnimationFrame(frame)
        frame = 0
      }
    },
    dispose,
  }
}
