import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

const DAY = 86400000
const WEIGHT = { evergreen: 3, budding: 2, seedling: 1 }

// ------------------------------------------------------------ git 历史
let historyCache
function loadHistory() {
  if (historyCache) return historyCache
  const map = new Map()
  try {
    const out = execSync('git log --name-only --pretty=format:"%ct"', {
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString()
    let stamp = null
    for (const raw of out.split("\n")) {
      const line = raw.trim()
      if (!line) continue
      if (/^\d+$/.test(line)) {
        stamp = Number(line)
        continue
      }
      if (stamp === null) continue
      if (!map.has(line)) map.set(line, [])
      map.get(line).push(stamp)
    }
  } catch {
    /* git 不可用时降级 */
  }
  historyCache = map
  return map
}

function growthOf(data) {
  const fp = String(data?.filePath ?? "")
  if (!fp) return { revisions: 0, days: 0 }
  const history = loadHistory()
  const list = history.get(`content/${fp}`) ?? history.get(fp) ?? []
  if (list.length === 0) return { revisions: 0, days: 0 }
  const min = Math.min(...list)
  const max = Math.max(...list)
  return { revisions: list.length, days: Math.round((max - min) / DAY) }
}

function toTime(v) {
  const t = v instanceof Date ? v.getTime() : typeof v === "string" ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : null
}

function baseSlug(s) {
  return String(s ?? "").replace(/\/index$/, "")
}

// ------------------------------------------------------------ 数据
function collectNotes(content, opts) {
  const raw = []
  for (const [, vfile] of content) {
    const d = vfile?.data
    if (!d) continue
    const slug = String(d.slug ?? "")
    if (!slug || !d.filePath) continue
    if (slug === "index" || slug === "404" || slug === "forest" || slug === opts.slug) continue
    if (slug.startsWith("tags/")) continue
    // 不公开 / 草稿的笔记不进入花园
    if (d.frontmatter?.unlisted === true) continue
    if (d.frontmatter?.draft === true) continue

    const maturity = String(d.frontmatter?.maturity ?? "").trim().toLowerCase()
    const level = WEIGHT[maturity] ? maturity : null
    const tags = Array.isArray(d.frontmatter?.tags) ? d.frontmatter.tags.map(String) : []
    const growth = growthOf(d)
    const created = toTime(d.dates?.created ?? d.dates?.modified)
    const modified = toTime(d.dates?.modified ?? d.dates?.created)
    const links = Array.isArray(d.links) ? d.links.map(String) : []

    raw.push({
      slug,
      title: String(d.frontmatter?.title ?? baseSlug(slug)),
      maturity: level,
      tags,
      linkCount: links.length,
      created,
      modified,
      revisions: growth.revisions,
      growthDays: growth.days,
    })
  }

  // 优先常青，其次最近修改
  raw.sort((a, b) => {
    const wa = WEIGHT[a.maturity] ?? 0
    const wb = WEIGHT[b.maturity] ?? 0
    if (wa !== wb) return wb - wa
    return (b.modified ?? 0) - (a.modified ?? 0)
  })

  const all = raw.slice(0, opts.limit)

  // 链接关系（仅保留入选笔记之间的连接）
  const present = new Set(all.map((n) => baseSlug(n.slug)))
  const edges = []
  const seen = new Set()
  for (const [, vfile] of content) {
    const d = vfile?.data
    if (!d) continue
    const from = baseSlug(d.slug)
    if (!present.has(from)) continue
    for (const l of d.links ?? []) {
      const to = baseSlug(String(l))
      if (!present.has(to) || to === from) continue
      const key = [from, to].sort().join("|")
      if (seen.has(key)) continue
      seen.add(key)
      edges.push([from, to])
    }
  }

  const counts = {
    seedling: all.filter((n) => n.maturity === "seedling").length,
    budding: all.filter((n) => n.maturity === "budding").length,
    evergreen: all.filter((n) => n.maturity === "evergreen").length,
    unknown: all.filter((n) => !n.maturity).length,
  }

  return { notes: all, edges, counts, total: raw.length }
}

// ------------------------------------------------------------ 页面
function engineScript() {
  return `
(function () {
  var data = window.__GARDEN__;
  var canvas = document.getElementById("garden-canvas");
  var ctx2d = canvas.getContext("2d");
  var tip = document.getElementById("garden-tip");
  var card = document.getElementById("garden-card");
  var cardTitle = document.getElementById("garden-card-title");
  var cardMeta = document.getElementById("garden-card-meta");
  var cardLink = document.getElementById("garden-card-link");
  var empty = document.getElementById("garden-empty");

  var FLATTEN = 0.52;
  var rotation = -0.6;
  var zoom = 1;
  var viewScale = 1;
  var dragging = false;
  var lastX = 0;
  var lastY = 0;
  var autoRotate = true;
  var hovered = null;
  var pinned = null;
  var start = performance.now();
  var level = "all";

  var positions = [];
  var screen = [];
  var dpr = 1;

  // ---- 确定性抖动：同一篇笔记位置稳定
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }

  var groups = [];
  (function layout() {
    var byTag = {};
    data.notes.forEach(function (n) {
      var key = n.tags && n.tags.length ? String(n.tags[0]) : "未分类";
      if (!byTag[key]) byTag[key] = [];
      byTag[key].push(n);
    });
    var keys = Object.keys(byTag);
    var totalTrees = data.notes.length || 1;
    var angle = -Math.PI / 2;
    keys.forEach(function (key) {
      var list = byTag[key];
      var span = (Math.PI * 2 * list.length) / totalTrees;
      var a0 = angle;
      var a1 = angle + span;
      angle = a1;
      var placedInRing = 0;
      var ring = 0;
      var ringCap = 4;
      list.forEach(function (n, idx) {
        if (placedInRing >= ringCap) {
          placedInRing = 0;
          ring += 1;
          ringCap = 4 + ring * 3;
        }
        var t = placedInRing / Math.max(1, ringCap - 1);
        var jitterA = (hash(n.slug) - 0.5) * 0.35;
        var a = a0 + (a1 - a0) * ((idx % ringCap) / ringCap) + jitterA * 0.3;
        var rings = 3;
        var r = 0.22 + 0.72 * ((ring + 1) / rings);
        var jitterR = (hash(n.slug + "r") - 0.5) * 0.12;
        var radius = (r + jitterR) * 1;
        placedInRing += 1;
        positions.push({
          note: n,
          x: Math.cos(a) * radius,
          z: Math.sin(a) * radius,
          group: key,
          seed: hash(n.slug),
        });
      });
    });
  })();

  function visible(note) {
    if (level === "all") return true;
    if (level === "unknown") return !note.maturity;
    return note.maturity === level;
  }

  function project(x, y, z, cx, cy, scale) {
    var cos = Math.cos(rotation);
    var sin = Math.sin(rotation);
    var rx = x * cos - z * sin;
    var rz = x * sin + z * cos;
    return {
      sx: cx + rx * scale,
      sy: cy + rz * scale * FLATTEN - y * scale,
      depth: rz,
    };
  }

  // 尺寸为世界单位（岛半径为 1），绘制时再乘 scale
  function treeSize(note) {
    if (note.maturity === "evergreen") return { trunk: 0.078, crown: 0.062 };
    if (note.maturity === "budding") return { trunk: 0.044, crown: 0.038 };
    if (note.maturity === "seedling") return { trunk: 0.017, crown: 0.019 };
    return { trunk: 0.006, crown: 0.008 };
  }

  function hsl(c, dl) {
    var l = Math.max(10, Math.min(92, c.l + (dl || 0)));
    return "hsl(" + c.h + " " + c.s + "% " + l + "%)";
  }

  function colorOf(note) {
    if (!note.modified) return { h: 44, s: 28, l: 56 };
    var days = (Date.now() - note.modified) / 86400000;
    if (note.maturity === "seedling") return { h: 104, s: 46, l: 60 };
    if (days <= 30) return { h: 138, s: 44, l: 40 };
    if (days <= 90) return { h: 112, s: 38, l: 44 };
    if (days <= 180) return { h: 68, s: 34, l: 48 };
    return { h: 40, s: 26, l: 52 };
  }

  // 不规则树冠：极坐标半径加叶状起伏，形成云朵轮廓而不是椭圆
  function canopy(cx, cy, rx, ry, seed, lobes) {
    ctx2d.beginPath();
    var n = 26;
    for (var i = 0; i <= n; i++) {
      var a = (i / n) * Math.PI * 2;
      var bump =
        1 + 0.16 * Math.sin(a * lobes + seed * 6.28) + 0.07 * Math.sin(a * (lobes * 2 + 1) + seed * 2.7);
      var x = cx + Math.cos(a) * rx * bump;
      var y = cy + Math.sin(a) * ry * bump;
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.closePath();
  }

  // 真正的叶片形状：两段二次曲线合成的尖叶
  function leafPath(x, y, len, wid, angle) {
    ctx2d.save();
    ctx2d.translate(x, y);
    ctx2d.rotate(angle);
    ctx2d.beginPath();
    ctx2d.moveTo(0, 0);
    ctx2d.quadraticCurveTo(len * 0.45, -wid, len, 0);
    ctx2d.quadraticCurveTo(len * 0.45, wid, 0, 0);
    ctx2d.closePath();
    ctx2d.fill();
    ctx2d.restore();
  }

  function drawTree(p, s, scale, alpha, hover) {
    var note = p.note;
    var size = treeSize(note);
    var col = colorOf(note);
    ctx2d.globalAlpha = alpha;
    var g = hover ? 1.12 : 1;
    var sway = Math.sin(performance.now() / 1500 + p.seed * 6.28) * 0.005 * scale;

    // 地面阴影
    ctx2d.beginPath();
    ctx2d.ellipse(s.sx, s.sy, size.crown * 0.55 * scale * g, size.crown * 0.2 * scale * g, 0, 0, Math.PI * 2);
    ctx2d.fillStyle = "rgba(40, 60, 40, 0.18)";
    ctx2d.fill();

    // 根部小草，强化"种在地上"
    ctx2d.fillStyle = "hsl(102 40% 44%)";
    for (var gi = -1; gi <= 1; gi++) {
      var gx = s.sx + gi * size.crown * 0.34 * scale + sway * 0.2;
      ctx2d.beginPath();
      ctx2d.moveTo(gx - 0.008 * scale, s.sy);
      ctx2d.lineTo(gx, s.sy - 0.019 * scale * g);
      ctx2d.lineTo(gx + 0.008 * scale, s.sy);
      ctx2d.closePath();
      ctx2d.fill();
    }

    // 未标记：地上一颗种子
    if (!note.maturity) {
      ctx2d.beginPath();
      ctx2d.ellipse(s.sx, s.sy - 0.008 * scale, 0.013 * scale, 0.009 * scale, 0, 0, Math.PI * 2);
      ctx2d.fillStyle = "hsl(40 14% 62%)";
      ctx2d.fill();
      ctx2d.globalAlpha = 1;
      return;
    }

    var trunkH = size.trunk * scale * g;
    var tw = Math.max(1.6, size.crown * 0.22 * scale * g);
    var topX = s.sx + sway * 0.35;
    var crownY = s.sy - trunkH;

    // 树干：下粗上细
    ctx2d.beginPath();
    ctx2d.moveTo(s.sx - tw * 0.5, s.sy);
    ctx2d.lineTo(topX - tw * 0.24, crownY);
    ctx2d.lineTo(topX + tw * 0.24, crownY);
    ctx2d.lineTo(s.sx + tw * 0.5, s.sy);
    ctx2d.closePath();
    ctx2d.fillStyle = "hsl(28 26% 30%)";
    ctx2d.fill();

    // 常青树：可见的分枝
    if (note.maturity === "evergreen") {
      ctx2d.strokeStyle = "hsl(28 26% 27%)";
      ctx2d.lineWidth = Math.max(1, tw * 0.3);
      ctx2d.lineCap = "round";
      for (var bi = -1; bi <= 1; bi += 2) {
        ctx2d.beginPath();
        ctx2d.moveTo(topX, crownY + trunkH * 0.42);
        ctx2d.quadraticCurveTo(
          topX + bi * size.crown * 0.4 * scale,
          crownY - size.crown * 0.2 * scale,
          topX + bi * size.crown * 0.66 * scale,
          crownY - size.crown * 0.62 * scale
        );
        ctx2d.stroke();
      }
    }

    // 幼苗：茎 + 两片真叶
    if (note.maturity === "seedling") {
      ctx2d.fillStyle = hsl(col, 4);
      leafPath(topX, crownY + 1 * scale, size.crown * 1.6 * scale * g, size.crown * 0.5 * scale * g, -0.5);
      leafPath(topX, crownY + 1 * scale, size.crown * 1.45 * scale * g, size.crown * 0.45 * scale * g, Math.PI + 0.5);
      ctx2d.beginPath();
      ctx2d.ellipse(topX, crownY - size.crown * 0.25 * scale, size.crown * 0.26 * scale, size.crown * 0.38 * scale, 0, 0, Math.PI * 2);
      ctx2d.fillStyle = hsl(col, 10);
      ctx2d.fill();
      ctx2d.globalAlpha = 1;
      return;
    }

    var rx = size.crown * 1.05 * scale * g;
    var ry = size.crown * 0.82 * scale * g;
    var cxx = topX + sway * 0.5;

    // 树冠三层：暗底 → 主色 → 亮面，形成体积感
    ctx2d.fillStyle = hsl(col, -16);
    canopy(cxx, crownY - ry * 0.3, rx * 1.05, ry * 1.0, p.seed, 5);
    ctx2d.fill();

    ctx2d.fillStyle = hsl(col, 0);
    canopy(cxx, crownY - ry * 0.42, rx, ry, p.seed, 5);
    ctx2d.fill();

    if (note.maturity === "evergreen") {
      // 两侧叶团，让轮廓不对称、更有机
      ctx2d.fillStyle = hsl(col, -6);
      canopy(cxx - rx * 0.58, crownY - ry * 0.12, rx * 0.52, ry * 0.56, p.seed + 0.3, 4);
      ctx2d.fill();
      ctx2d.fillStyle = hsl(col, -3);
      canopy(cxx + rx * 0.62, crownY - ry * 0.22, rx * 0.48, ry * 0.52, p.seed + 0.6, 4);
      ctx2d.fill();
    }

    // 顶部受光
    ctx2d.fillStyle = "rgba(255,255,255,0.18)";
    canopy(cxx - rx * 0.28, crownY - ry * 0.86, rx * 0.52, ry * 0.4, p.seed + 0.9, 4);
    ctx2d.fill();

    ctx2d.globalAlpha = 1;
  }

  function draw() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    var cx = w / 2;
    var cy = h * 0.6;
    var scale = Math.min(w, h * 1.6) * 0.32 * zoom;
    viewScale = scale;
    var ISLAND = 1;

    ctx2d.clearRect(0, 0, w, h);

    // 岛屿：泥土侧面
    var depth = 0.55;
    ctx2d.beginPath();
    for (var i = 0; i <= 64; i++) {
      var a = (i / 64) * Math.PI * 2;
      var p = project(Math.cos(a) * ISLAND, 0, Math.sin(a) * ISLAND, cx, cy, scale);
      if (i === 0) ctx2d.moveTo(p.sx, p.sy);
      else ctx2d.lineTo(p.sx, p.sy);
    }
    var bottomY = cy + scale * FLATTEN * 1 + scale * depth;
    ctx2d.lineTo(cx + scale, bottomY);
    for (var j = 0; j <= 32; j++) {
      var b = Math.PI - (j / 32) * Math.PI;
      var q = project(Math.cos(b) * ISLAND * 0.86, 0, Math.sin(b) * ISLAND * 0.86, cx, cy, scale);
      ctx2d.lineTo(q.sx, bottomY + Math.abs(q.sy - cy) * 0.4);
    }
    ctx2d.closePath();
    var soil = ctx2d.createLinearGradient(0, cy, 0, bottomY + scale * 0.4);
    soil.addColorStop(0, "#a58a63");
    soil.addColorStop(1, "#6f5a41");
    ctx2d.fillStyle = soil;
    ctx2d.fill();

    // 草地顶面
    ctx2d.beginPath();
    for (var m = 0; m <= 64; m++) {
      var c = (m / 64) * Math.PI * 2;
      var pr = project(Math.cos(c) * ISLAND, 0, Math.sin(c) * ISLAND, cx, cy, scale);
      if (m === 0) ctx2d.moveTo(pr.sx, pr.sy);
      else ctx2d.lineTo(pr.sx, pr.sy);
    }
    ctx2d.closePath();
    var grass = ctx2d.createLinearGradient(cx - scale, cy - scale * FLATTEN, cx + scale, cy + scale * FLATTEN);
    grass.addColorStop(0, "#9ed07e");
    grass.addColorStop(1, "#7bbd68");
    ctx2d.fillStyle = grass;
    ctx2d.fill();
    ctx2d.strokeStyle = "rgba(255,255,255,0.35)";
    ctx2d.lineWidth = 1.5;
    ctx2d.stroke();

    // 按深度排序绘制
    screen = [];
    positions.forEach(function (p) {
      if (!visible(p.note)) return;
      var s = project(p.x, 0, p.z, cx, cy, scale);
      screen.push({ p: p, s: s });
    });
    screen.sort(function (a, b) {
      return a.s.depth - b.s.depth;
    });

    var elapsed = Math.min(1, (performance.now() - start) / 1800);
    var active = (hovered || pinned) || null;

    screen.forEach(function (entry, idx) {
      var appear = Math.max(0, Math.min(1, elapsed * screen.length * 1.6 - idx));
      drawTree(entry.p, entry.s, scale, appear, active === entry.p.note.slug);
    });

    if (screen.length === 0) empty.style.display = "block";
    else empty.style.display = "none";
  }

  function pick(mx, my) {
    var best = null;
    var bestD = 1e9;
    for (var i = 0; i < screen.length; i++) {
      var e = screen[i];
      var size = treeSize(e.p.note);
      var dx = mx - e.s.sx;
      var dy = my - (e.s.sy - size.trunk * viewScale * 0.6);
      var d = dx * dx + dy * dy;
      var r = size.crown * viewScale * 1.5 + 12;
      if (d < r * r && d < bestD) {
        bestD = d;
        best = e.p.note;
      }
    }
    return best;
  }

  function showCard(note) {
    if (!note) {
      card.style.display = "none";
      return;
    }
    card.style.display = "block";
    cardTitle.textContent = note.title;
    var meta = [];
    var labelMap = { evergreen: "常青", budding: "生长", seedling: "幼苗" };
    meta.push(note.maturity ? labelMap[note.maturity] : "未标记");
    if (note.revisions > 0) meta.push("修订 " + note.revisions + " 次");
    if (note.growthDays > 0) meta.push("生长 " + note.growthDays + " 天");
    if (note.tags && note.tags.length) meta.push(note.tags.join(" / "));
    cardMeta.textContent = meta.join(" · ");
    cardLink.href = "/" + note.slug;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    resize();
    draw();
  });

  canvas.addEventListener("mousedown", function (e) {
    dragging = true;
    lastX = e.clientX;
    autoRotate = false;
  });
  window.addEventListener("mouseup", function () {
    dragging = false;
  });
  window.addEventListener("mousemove", function (e) {
    var rect = canvas.getBoundingClientRect();
    if (dragging) {
      rotation += (e.clientX - lastX) * 0.008;
      lastX = e.clientX;
      return;
    }
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    hovered = pick(mx, my);
    canvas.style.cursor = hovered ? "pointer" : "grab";
    if (!pinned) showCard(hovered);
    if (hovered) {
      tip.style.display = "block";
      tip.textContent = hovered.title;
      tip.style.left = mx + "px";
      tip.style.top = my - 28 + "px";
    } else {
      tip.style.display = "none";
    }
  });

  canvas.addEventListener("click", function (e) {
    var rect = canvas.getBoundingClientRect();
    var note = pick(e.clientX - rect.left, e.clientY - rect.top);
    pinned = note || null;
    showCard(pinned);
  });

  canvas.addEventListener(
    "wheel",
    function (e) {
      e.preventDefault();
      zoom = Math.max(0.5, Math.min(2.4, zoom - e.deltaY * 0.0012));
    },
    { passive: false }
  );

  // 触摸
  var touchStartX = 0;
  canvas.addEventListener("touchstart", function (e) {
    touchStartX = e.touches[0].clientX;
    autoRotate = false;
  });
  canvas.addEventListener("touchmove", function (e) {
    var x = e.touches[0].clientX;
    rotation += (x - touchStartX) * 0.01;
    touchStartX = x;
  });

  Array.prototype.forEach.call(document.querySelectorAll(".garden-filter"), function (btn) {
    btn.addEventListener("click", function () {
      level = btn.dataset.level;
      pinned = null;
      showCard(null);
      Array.prototype.forEach.call(document.querySelectorAll(".garden-filter"), function (b) {
        b.classList.toggle("active", b === btn);
      });
    });
  });

  document.getElementById("garden-reset").addEventListener("click", function () {
    rotation = -0.6;
    zoom = 1;
    autoRotate = true;
  });

  function loop() {
    if (autoRotate && !dragging) rotation += 0.0012;
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  loop();
})();
`
}

function pageHtml(data, opts) {
  const payload = JSON.stringify(data).replace(/</g, "\\u003c")
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>花园 · Jiang</title>
<style>
  :root {
    --sky: linear-gradient(180deg, #dff0fb 0%, #f4f9f3 55%, #eef4e6 100%);
    --ink: #2f3a2f;
    --muted: #7b8b7b;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background: var(--sky);
    color: var(--ink);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  header {
    padding: 1.1rem 1.5rem 0.4rem;
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
    flex-wrap: wrap;
  }
  header h1 { font-size: 1.15rem; margin: 0; font-weight: 700; letter-spacing: 0.02em; }
  header .sub { font-size: 0.82rem; color: var(--muted); }
  header a { margin-left: auto; font-size: 0.82rem; color: var(--muted); text-decoration: none; }
  header a:hover { color: var(--ink); }
  #stage { position: relative; flex: 1; min-height: 0; }
  canvas { width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
  #garden-tip {
    position: absolute; pointer-events: none; display: none;
    background: rgba(30, 40, 30, 0.88); color: #fff; font-size: 0.78rem;
    padding: 0.2rem 0.5rem; border-radius: 4px; transform: translateX(-50%); white-space: nowrap;
  }
  #garden-card {
    position: absolute; left: 1.2rem; bottom: 1.2rem; max-width: 20rem; display: none;
    background: rgba(255, 255, 255, 0.92); border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 10px; padding: 0.8rem 1rem; box-shadow: 0 10px 30px rgba(40, 60, 40, 0.14);
  }
  #garden-card h3 { margin: 0 0 0.25rem; font-size: 1rem; }
  #garden-card p { margin: 0 0 0.55rem; font-size: 0.78rem; color: var(--muted); }
  #garden-card a { font-size: 0.82rem; color: #3f7d52; text-decoration: none; font-weight: 600; }
  #garden-empty {
    position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    color: var(--muted); font-size: 0.9rem;
  }
  footer {
    padding: 0.6rem 1.5rem 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;
  }
  button {
    font: inherit; font-size: 0.8rem; cursor: pointer; border-radius: 999px;
    border: 1px solid rgba(0, 0, 0, 0.1); background: rgba(255, 255, 255, 0.7);
    color: var(--ink); padding: 0.3rem 0.8rem;
  }
  button:hover { background: #fff; }
  button.active { background: var(--ink); color: #fff; border-color: var(--ink); }
  .hint { margin-left: auto; font-size: 0.72rem; color: var(--muted); }
  @media (max-width: 640px) {
    header { padding: 0.8rem 1rem 0.3rem; }
    footer { padding: 0.5rem 1rem 0.8rem; }
    #garden-card { left: 0.8rem; right: 0.8rem; bottom: 0.8rem; max-width: none; }
  }
</style>
</head>
<body>
<header>
  <h1>花园</h1>
  <span class="sub">${data.total} 篇笔记 · 当前呈现 ${data.notes.length} 棵 · 拖拽旋转，滚轮缩放，点击查看笔记</span>
  <a href="/">← 返回博客</a>
</header>
<div id="stage">
  <canvas id="garden-canvas"></canvas>
  <div id="garden-tip"></div>
  <div id="garden-empty">这个筛选下还没有笔记</div>
  <div id="garden-card">
    <h3 id="garden-card-title"></h3>
    <p id="garden-card-meta"></p>
    <a id="garden-card-link" href="/">打开笔记 →</a>
  </div>
</div>
<footer>
  <button class="garden-filter active" data-level="all">全部 ${data.notes.length}</button>
  <button class="garden-filter" data-level="seedling">幼苗 ${data.counts.seedling}</button>
  <button class="garden-filter" data-level="budding">生长 ${data.counts.budding}</button>
  <button class="garden-filter" data-level="evergreen">常青 ${data.counts.evergreen}</button>
  <button class="garden-filter" data-level="unknown">未标记 ${data.counts.unknown}</button>
  <button id="garden-reset">重置视角</button>
  <span class="hint">颜色越绿表示最近还在打理</span>
</footer>
<script>window.__GARDEN__ = ${payload};</script>
<script>${engineScript()}</script>
</body>
</html>
`
}

// ------------------------------------------------------------ emitter
var GardenIsland = (userOpts) => {
  const opts = { slug: "garden", limit: 50, ...userOpts }
  return {
    name: "GardenIsland",
    getQuartzComponents() {
      return []
    },
    async *emit(ctx, content) {
      const data = collectNotes(content, opts)
      const html = pageHtml(data, opts)
      const outDir = String(ctx.argv.output ?? "public")
      const target = path.join(outDir, `${opts.slug}.html`)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, html, "utf-8")
      yield target
    },
  }
}

export { GardenIsland, GardenIsland as default }
