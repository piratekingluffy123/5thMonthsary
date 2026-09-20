(() => {
  "use strict";

  const SIZE = 480;
  const STORAGE_KEY = "monthsary-puzzle-v1";
  const $ = (id) => document.getElementById(id);

  // Snapshot of the untouched page, used by "Download personalized file".
  const PRISTINE_HTML = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;

  let difficulty = 4;
  let photo = null;   // small JPEG data URL, or null
  let puzzle = null;

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */
  const makeCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    return canvas;
  };

  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  const encode = (obj) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const decode = (str) => {
    const binary = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  };

  const loadFonts = () => {
    if (!document.fonts) return Promise.resolve();
    return Promise.all([
      "600 64px Caveat",
      "26px Caveat",
      "600 32px 'Playfair Display'",
      "italic 500 20px 'Playfair Display'",
    ].map((font) => document.fonts.load(font, "abc"))).catch(() => {});
  };

  function drawHeart(ctx, cx, cy, s, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.3);
    ctx.bezierCurveTo(cx, cy, cx - s, cy, cx - s, cy + s * 0.35);
    ctx.bezierCurveTo(cx - s, cy + s * 0.75, cx - s * 0.4, cy + s, cx, cy + s * 1.25);
    ctx.bezierCurveTo(cx + s * 0.4, cy + s, cx + s, cy + s * 0.75, cx + s, cy + s * 0.35);
    ctx.bezierCurveTo(cx + s, cy, cx, cy, cx, cy + s * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function wrapLines(ctx, text, maxWidth) {
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /* ------------------------------------------------------------------ *
   * Form state
   * ------------------------------------------------------------------ */
  const getConfig = () => ({
    herName: $("herName").value.trim(),
    yourName: $("yourName").value.trim(),
    message: $("message").value.trim(),
    n: difficulty,
  });

  function saveForm() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(getConfig())); } catch {}
  }

  function restoreForm() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch {}
    if (saved.herName) $("herName").value = saved.herName;
    if (saved.yourName) $("yourName").value = saved.yourName;
    if (saved.message) $("message").value = saved.message;
    setDifficulty(saved.n || difficulty);
  }

  function setDifficulty(n) {
    difficulty = n;
    document.querySelectorAll("#difficulty .chip").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.n) === n);
    });
  }

  /* ------------------------------------------------------------------ *
   * Photo upload (resized once, so links and files stay small)
   * ------------------------------------------------------------------ */
  function drawCover(ctx, img) {
    const scale = Math.max(SIZE / img.width, SIZE / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  }

  async function resizePhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const canvas = makeCanvas();
      drawCover(canvas.getContext("2d"), await loadImage(url));
      return canvas.toDataURL("image/jpeg", 0.8);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function setPhoto(dataUrl) {
    photo = dataUrl;
    $("photo-thumb").hidden = $("photo-clear").hidden = !dataUrl;
    if (dataUrl) $("photo-thumb").src = dataUrl;
    else $("photoInput").value = "";
  }

  /* ------------------------------------------------------------------ *
   * Puzzle artwork
   * ------------------------------------------------------------------ */
  function drawGeneratedArt(ctx, { herName, yourName, message }) {
    const mid = SIZE / 2;

    const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    bg.addColorStop(0, "#f3c9ce");
    bg.addColorStop(0.55, "#c97b84");
    bg.addColorStop(1, "#7c3f5c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.fillStyle = "#fff";
    [[50, 60, 10], [430, 90, 14], [60, 420, 12], [420, 410, 9], [250, 40, 8], [40, 250, 8], [440, 250, 10]]
      .forEach(([x, y, s]) => drawHeart(ctx, x, y, s, 0.16));

    ctx.textAlign = "center";
    ctx.fillStyle = "#fffaf6";
    ctx.font = "600 64px Caveat, cursive";
    ctx.fillText("five months", mid, 110);

    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mid - 70, 132);
    ctx.lineTo(mid + 70, 132);
    ctx.stroke();

    ctx.font = "600 32px 'Playfair Display', serif";
    ctx.fillText(`of loving ${herName || "you"}`, mid, 175);
    drawHeart(ctx, mid, 205, 16, 0.9);

    ctx.font = "26px Caveat, cursive";
    ctx.fillStyle = "#fff6f2";
    const lines = wrapLines(ctx, message || "here's to every month after this one.", 360).slice(0, 7);
    const startY = 285 - (lines.length - 1) * 15;
    lines.forEach((line, i) => ctx.fillText(line, mid, startY + i * 30));

    if (yourName) {
      ctx.font = "italic 500 20px 'Playfair Display', serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(`\u2014 ${yourName}`, mid, SIZE - 34);
    }
  }

  function drawPhotoArt(ctx, img) {
    drawCover(ctx, img);
    const fade = ctx.createLinearGradient(0, SIZE - 70, 0, SIZE);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(30,10,20,0.55)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, SIZE - 70, SIZE, 70);

    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "500 22px Caveat, cursive";
    ctx.fillText("5 months \u2022 solve me", SIZE / 2, SIZE - 22);
  }

  async function buildSource(cfg) {
    await loadFonts();
    const canvas = makeCanvas();
    const ctx = canvas.getContext("2d");
    if (cfg.photo) {
      try {
        drawPhotoArt(ctx, await loadImage(cfg.photo));
        return canvas;
      } catch { /* fall through to generated art */ }
    }
    drawGeneratedArt(ctx, cfg);
    return canvas;
  }

  /* ------------------------------------------------------------------ *
   * Jigsaw geometry
   * ------------------------------------------------------------------ */

  // Every inner edge gets a random tab (+1) or socket (-1); neighbours mirror it.
  function makeTabs(n) {
    const rand = () => (Math.random() < 0.5 ? 1 : -1);
    const grid = (rows, cols) => Array.from({ length: rows }, () => Array.from({ length: cols }, rand));
    return { h: grid(n, n - 1), v: grid(n - 1, n) };
  }

  function sidesFor({ h, v }, n, r, c) {
    return {
      top:    r === 0     ? 0 : -v[r - 1][c],
      bottom: r === n - 1 ? 0 :  v[r][c],
      left:   c === 0     ? 0 : -h[r][c - 1],
      right:  c === n - 1 ? 0 :  h[r][c],
    };
  }

  // Draws one edge starting at (x, y) along (tx, ty); (nx, ny) points outward.
  function addEdge(ctx, x, y, tx, ty, nx, ny, sign, len) {
    const end = [x + tx * len, y + ty * len];
    if (!sign) return ctx.lineTo(...end);

    const r = len * 0.16;
    const at = (t, h) => [x + tx * len * t + nx * sign * h, y + ty * len * t + ny * sign * h];
    ctx.lineTo(...at(0.35, 0));
    ctx.quadraticCurveTo(...at(0.4, r), ...at(0.5, r * 1.3));
    ctx.quadraticCurveTo(...at(0.6, r), ...at(0.65, 0));
    ctx.lineTo(...end);
  }

  function makePieceCanvas(source, row, col, sides, size, pad) {
    const total = size + pad * 2;
    const far = pad + size;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = total;
    canvas.className = "piece";
    canvas.style.width = canvas.style.height = `${total}px`;

    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    addEdge(ctx, pad, pad,  1,  0,  0, -1, sides.top,    size);
    addEdge(ctx, far, pad,  0,  1,  1,  0, sides.right,  size);
    addEdge(ctx, far, far, -1,  0,  0,  1, sides.bottom, size);
    addEdge(ctx, pad, far,  0, -1, -1,  0, sides.left,   size);
    ctx.closePath();

    ctx.save();
    ctx.clip();
    ctx.drawImage(source, col * size - pad, row * size - pad, total, total, 0, 0, total, total);
    ctx.restore();

    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.stroke();
    return canvas;
  }

  /* ------------------------------------------------------------------ *
   * Puzzle controller
   * ------------------------------------------------------------------ */
  class Puzzle {
    constructor(n, source, onComplete) {
      this.n = n;
      this.count = n * n;
      this.source = source;
      this.onComplete = onComplete;

      this.size = SIZE / n;
      this.pad = this.size * 0.32;
      this.total = this.size + this.pad * 2;

      this.stage = $("stage");
      this.outer = $("stage-outer");
      this.board = $("board");

      this.pieces = [];
      this.solved = 0;
      this.z = 10;
      this.scale = 1;

      this.layoutBoard();
      this.buildPieces();
      this.updateProgress();

      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.outer);
    }

    destroy() {
      this.observer.disconnect();
      this.pieces.forEach((p) => p.el.remove());
    }

    layoutBoard() {
      // Pieces start in a tight tray right under the board.
      const gap = Math.max(3, this.size * 0.05);
      this.cell = this.size + gap;
      this.perRow = Math.max(1, Math.floor(SIZE / this.cell));
      this.trayTop = SIZE + 18;
      this.trayHeight = Math.ceil(this.count / this.perRow) * this.cell + this.pad * 2;

      const grid = `var(--line) 0 1px, transparent 1px ${this.size}px`;
      this.board.style.width = this.board.style.height = `${SIZE}px`;
      this.board.style.backgroundImage =
        `repeating-linear-gradient(to right, ${grid}), repeating-linear-gradient(to bottom, ${grid})`;

      this.stage.style.width = `${SIZE}px`;
      this.stage.style.height = `${this.trayTop + this.trayHeight}px`;
    }

    buildPieces() {
      const tabs = makeTabs(this.n);
      const spots = this.trayPositions();

      for (let r = 0; r < this.n; r++) {
        for (let c = 0; c < this.n; c++) {
          const el = makePieceCanvas(this.source, r, c, sidesFor(tabs, this.n, r, c), this.size, this.pad);
          const piece = {
            el,
            targetX: c * this.size - this.pad,
            targetY: r * this.size - this.pad,
            solved: false,
          };
          this.place(piece, spots[this.pieces.length]);
          this.stage.appendChild(el);
          this.pieces.push(piece);
          this.enableDrag(piece);
        }
      }
    }

    trayPositions() {
      const slots = Array.from({ length: this.count }, (_, i) => i);
      for (let i = slots.length - 1; i > 0; i--) {           // Fisher–Yates
        const j = Math.floor(Math.random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
      }

      const maxX = Math.max(0, SIZE - this.total);
      const minY = this.trayTop;
      const maxY = this.trayTop + Math.max(0, this.trayHeight - this.total);
      const jitter = this.size * 0.1;
      const wobble = () => Math.random() * jitter * 2 - jitter;
      const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

      return slots.map((slot) => {
        const row = Math.floor(slot / this.perRow);
        const col = slot % this.perRow;
        return {
          x: clamp(col * this.cell + wobble(), 0, maxX),
          y: clamp(this.trayTop + this.pad + row * this.cell + wobble(), minY, maxY),
        };
      });
    }

    place(piece, { x, y }) {
      piece.el.style.left = `${x}px`;
      piece.el.style.top = `${y}px`;
      piece.el.style.zIndex = this.z++;
    }

    reshuffle() {
      const spots = this.trayPositions();
      this.pieces.forEach((piece, i) => {
        piece.solved = false;
        piece.el.classList.remove("solved");
        this.place(piece, spots[i]);
      });
      this.solved = 0;
      this.updateProgress();
    }

    updateProgress() {
      $("progress-fill").style.width = `${(this.solved / this.count) * 100}%`;
      $("progress-label").textContent = `${this.solved} / ${this.count} pieces`;
    }

    fit() {
      this.scale = Math.min(1, this.outer.clientWidth / SIZE);
      this.stage.style.transform = `scale(${this.scale})`;
      this.outer.style.height = `${parseFloat(this.stage.style.height) * this.scale}px`;
    }

    // Pointer position in the stage's unscaled coordinate space.
    toStage(e) {
      const rect = this.stage.getBoundingClientRect();
      return { x: (e.clientX - rect.left) / this.scale, y: (e.clientY - rect.top) / this.scale };
    }

    enableDrag(piece) {
      const { el } = piece;
      let grab = null;

      el.addEventListener("pointerdown", (e) => {
        if (piece.solved) return;
        const p = this.toStage(e);
        grab = { x: p.x - parseFloat(el.style.left), y: p.y - parseFloat(el.style.top) };
        el.classList.add("dragging");
        el.style.zIndex = this.z++;
        el.setPointerCapture(e.pointerId);
      });

      el.addEventListener("pointermove", (e) => {
        if (!grab) return;
        const p = this.toStage(e);
        el.style.left = `${p.x - grab.x}px`;
        el.style.top = `${p.y - grab.y}px`;
      });

      const drop = () => {
        if (!grab) return;
        grab = null;
        el.classList.remove("dragging");
        this.trySnap(piece);
      };
      el.addEventListener("pointerup", drop);
      el.addEventListener("pointercancel", drop);
    }

    trySnap(piece) {
      const { el } = piece;
      const dx = parseFloat(el.style.left) - piece.targetX;
      const dy = parseFloat(el.style.top) - piece.targetY;
      if (Math.hypot(dx, dy) >= this.size * 0.28) return;

      el.style.left = `${piece.targetX}px`;
      el.style.top = `${piece.targetY}px`;
      el.style.zIndex = 1;
      el.classList.add("solved", "just-solved");
      setTimeout(() => el.classList.remove("just-solved"), 300);

      piece.solved = true;
      this.solved++;
      this.updateProgress();
      if (this.solved === this.count) setTimeout(this.onComplete, 450);
    }
  }

  /* ------------------------------------------------------------------ *
   * Flow: start, celebrate, confetti
   * ------------------------------------------------------------------ */
  async function startPuzzle(cfg) {
    puzzle?.destroy();
    puzzle = null;
    $("intro-screen").hidden = true;
    $("puzzle-screen").hidden = false;

    const n = Math.min(5, Math.max(3, Number(cfg.n) || 4));
    const source = await buildSource(cfg);
    puzzle = new Puzzle(n, source, () => celebrate(cfg));
  }

  function celebrate({ herName, yourName, message }) {
    $("love-to").textContent = herName ? `for ${herName}` : "for you, love";
    $("love-msg").textContent = message || "Happy 5th monthsary. Here's to many more.";
    $("love-sign").textContent = yourName ? `\u2014 ${yourName}` : "";
    $("complete-overlay").hidden = false;
    launchConfetti();
  }

  function launchConfetti() {
    const canvas = document.createElement("canvas");
    canvas.id = "confetti-canvas";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
    resize();
    addEventListener("resize", resize);

    const colors = ["#e39aa2", "#cf9d4f", "#c97b84", "#ffffff", "#8e4b6b"];
    const rand = (min, max) => min + Math.random() * (max - min);
    const bits = Array.from({ length: 140 }, () => ({
      x: rand(0, canvas.width),
      y: -20 - rand(0, canvas.height * 0.5),
      r: rand(3, 8),
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: rand(-1.5, 1.5),
      vy: rand(2, 5),
      rot: rand(0, Math.PI),
      vr: rand(-0.15, 0.15),
      heart: Math.random() < 0.25,
    }));

    const start = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const b of bits) {
        b.x += b.vx; b.y += b.vy; b.rot += b.vr;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        if (b.heart) drawHeart(ctx, 0, -b.r, b.r, 0.9);
        else ctx.fillRect(-b.r / 2, -b.r / 2, b.r, b.r * 1.6);
        ctx.restore();
      }
      if (now - start < 3800) return requestAnimationFrame(frame);
      removeEventListener("resize", resize);
      canvas.remove();
    })(start);
  }

  /* ------------------------------------------------------------------ *
   * Sharing
   * ------------------------------------------------------------------ */
  const shareConfig = () => ({ ...getConfig(), photo: photo || undefined });

  function makeLink() {
    const url = `${location.href.split("#")[0]}#p=${encode(shareConfig())}`;
    $("share-url").value = url;
    $("share-output").hidden = false;

    const note = $("share-note");
    note.hidden = url.length <= 6000;
    note.textContent = "This link is long because of the photo \u2014 if a messaging app trims it, use \u201cDownload personalized file\u201d instead.";
  }

  async function downloadFile() {
    // The download is one self-contained file, so the CSS and JS get inlined.
    let css, js;
    try {
      [css, js] = await Promise.all(["styles.css", "script.js"].map(async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(url);
        return res.text();
      }));
    } catch {
      alert("Bundling needs the site to be hosted (or run from a local server). Browsers block it when the page is opened straight from a file. The surprise link works once the site is hosted.");
      return;
    }

    const cfg = shareConfig();
    const preset = `<script>window.__PRESET__=${JSON.stringify(cfg).replace(/</g, "\\u003C")};<\/script>`;
    const html = PRISTINE_HTML
      .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}\n</style>`)
      .replace('<script src="script.js"><\/script>', () => `<script>\n${js}\n<\/script>`)
      .replace("<body>", () => `<body>${preset}`);

    const slug = cfg.herName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "her";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    link.download = `puzzle-for-${slug}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  }

  async function copyLink() {
    const input = $("share-url");
    input.select();
    try { await navigator.clipboard.writeText(input.value); } catch {}
    const btn = $("copy-link-btn");
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy"), 1400);
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */
  function spawnFloaties() {
    const host = $("floaties");
    const emojis = ["💗", "✨"];
    for (let i = 0; i < 6; i++) {
      const el = document.createElement("span");
      el.textContent = emojis[i % emojis.length];
      el.style.left = `${Math.random() * 100}vw`;
      el.style.fontSize = `${12 + Math.random() * 10}px`;
      el.style.setProperty("--dx", `${Math.random() * 60 - 30}px`);
      el.style.animationDuration = `${20 + Math.random() * 14}s`;
      el.style.animationDelay = `-${Math.random() * 24}s`;
      host.appendChild(el);
    }
  }

  document.querySelectorAll("#difficulty .chip").forEach((btn) =>
    btn.addEventListener("click", () => setDifficulty(Number(btn.dataset.n))));

  $("photo-pick-btn").addEventListener("click", () => $("photoInput").click());
  $("photoInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setPhoto(await resizePhoto(file));
    } catch {
      setPhoto(null);
      alert("Couldn't read that photo \u2014 try a JPG or PNG.");
    }
  });
  $("photo-clear").addEventListener("click", () => setPhoto(null));

  $("start-btn").addEventListener("click", () => {
    saveForm();
    startPuzzle({ ...getConfig(), photo });
  });
  $("new-puzzle-btn").addEventListener("click", () => {
    puzzle?.destroy();
    puzzle = null;
    $("puzzle-screen").hidden = true;
    $("intro-screen").hidden = false;
  });
  $("reshuffle-btn").addEventListener("click", () => puzzle?.reshuffle());
  $("play-again-btn").addEventListener("click", () => {
    $("complete-overlay").hidden = true;
    puzzle?.reshuffle();
  });
  $("close-overlay-btn").addEventListener("click", () => ($("complete-overlay").hidden = true));

  $("make-link-btn").addEventListener("click", makeLink);
  $("copy-link-btn").addEventListener("click", copyLink);
  $("download-file-btn").addEventListener("click", downloadFile);

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  function readPreset() {
    try {
      if (window.__PRESET__) return window.__PRESET__;
      if (location.hash.startsWith("#p=")) return decode(location.hash.slice(3));
    } catch {}
    return null;
  }

  spawnFloaties();
  restoreForm();

  const preset = readPreset();
  if (preset) startPuzzle(preset);
})();