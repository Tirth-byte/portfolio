/* Voxel wordmark — canvas 2.5D, isometric extrude.
   Kill conditions (enforced here):
   (1) legible at 360px — two stacked 5x7 words, cell auto-fit
   (2) static fallback with JS disabled — handled in HTML (.no-js shows Cabinet name);
       reduced-motion draws the final frame with no animation
   (3) animates once on load, never again — single rAF pass, then frozen */
(function () {
  "use strict";
  var canvas = document.getElementById("wordmark");
  var stage = canvas && canvas.closest(".wordmark");
  var ctx = canvas && canvas.getContext && canvas.getContext("2d");
  if (!ctx) { if (stage) stage.classList.add("fallback-on"); return; } // keep Cabinet name visible

  // 5x7 block glyphs
  var G = {
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"]
  };
  var LINES = ["TIRTH", "PATEL"];
  var GLYPH_W = 5, GLYPH_H = 7, LETTER_GAP = 1, LINE_GAP = 2;

  var COLS = 0;
  LINES.forEach(function (w) { COLS = Math.max(COLS, w.length * GLYPH_W + (w.length - 1) * LETTER_GAP); });
  var ROWS = LINES.length * GLYPH_H + (LINES.length - 1) * LINE_GAP;

  // build the list of "on" cells with per-cell reveal order
  var cells = [];
  LINES.forEach(function (word, li) {
    var rowBase = li * (GLYPH_H + LINE_GAP);
    for (var i = 0; i < word.length; i++) {
      var g = G[word[i]]; if (!g) continue;
      var colBase = i * (GLYPH_W + LETTER_GAP);
      for (var r = 0; r < GLYPH_H; r++) {
        for (var c = 0; c < GLYPH_W; c++) {
          if (g[r][c] === "1") cells.push({ x: colBase + c, y: rowBase + r });
        }
      }
    }
  });
  // reveal order: diagonal sweep from top-left (feels "built")
  cells.forEach(function (p) { p.ord = p.x + p.y; });
  var maxOrd = 0; cells.forEach(function (p) { maxOrd = Math.max(maxOrd, p.ord); });

  var VOX_TOP = "#D8D4CC", VOX_MID = "#B7B2A7", VOX_LOW = "#8E887B", SIGNAL = "#E0A62E", PAPER = "#EFEEE8";
  var dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  var cell = 0, ox = 0, oy = 0, depth = 0;

  function layout() {
    var cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // reserve room for the extrusion depth so nothing clips
    var cw = cssW / (COLS + 1.2);
    var ch = cssH / (ROWS + 1.2);
    cell = Math.floor(Math.min(cw, ch));
    depth = Math.max(2, Math.round(cell * 0.42));
    var gridW = COLS * cell + depth, gridH = ROWS * cell + depth;
    ox = Math.round((cssW - gridW) / 2) + depth;
    oy = Math.round((cssH - gridH) / 2) + depth;
  }

  function drawCube(px, py, t) {
    // t in 0..1 reveal amount
    var s = cell * (0.9 + 0.1 * t);
    var gap = Math.max(1, Math.round(cell * 0.08));
    var w = s - gap;
    var d = depth * t;
    var a = ctx.globalAlpha;
    ctx.globalAlpha = a * t;
    // right side face (shadow)
    ctx.fillStyle = VOX_LOW;
    ctx.beginPath();
    ctx.moveTo(px + w, py);
    ctx.lineTo(px + w + d, py - d);
    ctx.lineTo(px + w + d, py + w - d);
    ctx.lineTo(px + w, py + w);
    ctx.closePath(); ctx.fill();
    // top side face (mid)
    ctx.fillStyle = VOX_MID;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + d, py - d);
    ctx.lineTo(px + w + d, py - d);
    ctx.lineTo(px + w, py);
    ctx.closePath(); ctx.fill();
    // front face (lit)
    ctx.fillStyle = VOX_TOP;
    ctx.fillRect(px, py, w, w);
    // gold lit edge — top + left of front face
    ctx.strokeStyle = SIGNAL;
    ctx.lineWidth = Math.max(1, cell * 0.09);
    ctx.beginPath();
    ctx.moveTo(px + 0.5, py + w);
    ctx.lineTo(px + 0.5, py + 0.5);
    ctx.lineTo(px + w, py + 0.5);
    ctx.stroke();
    ctx.globalAlpha = a;
  }

  function render(progress) {
    var cssW = canvas.clientWidth, cssH = canvas.clientHeight;
    ctx.clearRect(0, 0, cssW, cssH);
    // draw back-to-front (bottom rows first so extrusion overlaps read right)
    var ordered = cells.slice().sort(function (m, n) { return (n.y - m.y) || (m.x - n.x); });
    var reach = progress * (maxOrd + 6);
    for (var k = 0; k < ordered.length; k++) {
      var p = ordered[k];
      var t = reach - p.ord;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      // ease
      t = t * t * (3 - 2 * t);
      if (t <= 0) continue;
      var px = ox + p.x * cell;
      var py = oy + p.y * cell;
      drawCube(px, py, t);
    }
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var started = false;

  function run() {
    layout();
    if (reduce) { render(1); return; }        // static final frame, no motion
    var DUR = 1100, t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var e = (ts - t0) / DUR;
      if (e >= 1) { render(1); return; }        // freeze — never loops
      render(e * e * (3 - 2 * e));
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // run once when visible (or immediately if already in view)
  function begin() { if (started) return; started = true; run(); }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { begin(); io.disconnect(); } });
    }, { threshold: 0.25 });
    io.observe(canvas);
  } else { begin(); }

  // only relayout+redraw the FINAL frame on resize (never re-animates)
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { if (started) { layout(); render(1); } }, 150);
  });
})();
