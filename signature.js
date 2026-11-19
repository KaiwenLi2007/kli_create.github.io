/* ============================================================
   KAIWEN LI — SIGNATURE LAYER
   Conway's Game of Life as a pond: spaceships swim across the
   page like koi, the cursor sows cells, clicks launch gliders.
   Two species share the water ("Immigration" Life): a newborn cell
   takes the majority colour of its three parents, so every ship
   keeps one colour as it swims — a few orange koi among cobalt.
   Cells cross-fade and stay faint: the pond is a backdrop, never
   something that blinks at you.
   Zero libraries. Everything below is hand-rolled.
   ============================================================ */

(function () {
    "use strict";

    const root = document.documentElement;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

    /* ---------- palette: read from CSS tokens, refreshed on theme change ---------- */
    const pal = { koi: "#d9542f", cobalt: "#2b45a6", trail: "#c9cde3", ink: 0.32 };

    function readPalette() {
        const cs = getComputedStyle(root);
        const tok = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
        pal.koi = tok("--accent", pal.koi);
        pal.cobalt = tok("--blue", pal.cobalt);
        pal.trail = tok("--trail", pal.trail);
        // peak opacity of a fully lit cell — kept low so the pond never competes with text
        const ink = parseFloat(tok("--pond-ink", ""));
        if (ink > 0 && ink <= 1) pal.ink = ink;
    }
    readPalette();
    new MutationObserver(readPalette).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    /* ---------- toast ---------- */
    const toastEl = document.createElement("div");
    toastEl.className = "kl-toast";
    toastEl.setAttribute("role", "status");
    document.body.appendChild(toastEl);
    let toastTimer;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
    }

    /* ============================================================
       CONWAY'S GAME OF LIFE — B3/S23 on a torus. The grid is wider
       than the screen by M cells on every side, so ships can be
       launched out of sight and swim in.
       ============================================================ */
    const CS = 22;            // cell size, px
    const M = 8;              // hidden margin, cells
    const TICK = 260;         // ms per generation — a slow drift, not a flicker
    const SPAWN_EVERY = 3200; // ms between population checks
    const BASE = 0.28;        // pond strength away from the hero (behind reading text)
    const ERODE_AGE = 100;    // still lifes older than this slowly dissolve
    const GLOW_TAU = 220;     // ms — cells fade in and out instead of popping
    const TRAIL_TAU = 520;    // ms — the pale wake left by a cell that just died
    const TRAIL_A = 0.4;      // wake opacity (its colour is already close to the paper)
    const KOI = 0.3;          // share of new ships (and soup) that are orange

    const life = {
        cols: 0, rows: 0, visCols: 0, visRows: 0, w: 0, h: 0,
        cells: null, next: null, age: null, glow: null, trail: null, kind: null,
        ctx: null, lastTick: 0, lastSpawn: 0, gen: 0, alive: 0, seen: 0,
    };

    const ambient = document.querySelector(".ambient");
    const hero = document.querySelector(".hero");
    const genEl = document.querySelector(".life-gen");
    const aliveEl = document.querySelector(".life-alive");

    // spaceships as drawn swim LEFT at c/2; mirrored copies swim right
    const LWSS = [".O..O", "O....", "O...O", "OOOO."];
    const MWSS = ["...O..", ".O...O", "O.....", "O....O", "OOOOO."];
    const toCells = (rows, mirror) => {
        const out = [];
        rows.forEach((row, r) => {
            for (let c = 0; c < row.length; c++) {
                if (row[c] === "O") out.push([r, mirror ? row.length - 1 - c : c]);
            }
        });
        return out;
    };
    // even index swims left, odd index swims right
    const SHIPS = [toCells(LWSS, false), toCells(LWSS, true), toCells(MWSS, false), toCells(MWSS, true)];

    // the four rotations/reflections of the glider, as [row, col]
    const GLIDERS = [
        [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
        [[0, 0], [0, 1], [1, 1], [1, 2], [2, 0]],
        [[0, 0], [0, 1], [0, 2], [1, 0], [2, 1]],
        [[0, 2], [1, 0], [1, 1], [2, 1], [2, 2]],
    ];

    // the canvas fills .ambient, i.e. the viewport *minus* any classic scrollbar
    const viewW = () => (ambient && ambient.clientWidth) || document.documentElement.clientWidth || innerWidth;
    const viewH = () => (ambient && ambient.clientHeight) || document.documentElement.clientHeight || innerHeight;

    function allocate() {
        const w = viewW(), h = viewH();
        const visCols = Math.ceil(w / CS), visRows = Math.ceil(h / CS);
        const cols = visCols + 2 * M, rows = visRows + 2 * M;
        const n = cols * rows;
        const cells = new Uint8Array(n), next = new Uint8Array(n);
        const age = new Uint16Array(n), glow = new Float32Array(n), trail = new Float32Array(n);
        const kind = new Uint8Array(n);   // 0 = cobalt, 1 = orange
        // carry the pond across resizes — mobile URL bars resize the viewport constantly
        if (life.cells) {
            const cMax = Math.min(cols, life.cols), rMax = Math.min(rows, life.rows);
            for (let r = 0; r < rMax; r++) {
                for (let c = 0; c < cMax; c++) {
                    const o = r * life.cols + c, i = r * cols + c;
                    cells[i] = life.cells[o];
                    age[i] = life.age[o];
                    glow[i] = life.glow[o];
                    trail[i] = life.trail[o];
                    kind[i] = life.kind[o];
                }
            }
        }
        Object.assign(life, { cols, rows, visCols, visRows, w, h, cells, next, age, glow, trail, kind });
    }

    function setCell(col, row, v, k) {
        if (!life.cells) return;
        const c = ((col % life.cols) + life.cols) % life.cols;
        const r = ((row % life.rows) + life.rows) % life.rows;
        const i = r * life.cols + c;
        life.cells[i] = v;
        life.age[i] = 0;
        if (v && k !== undefined) life.kind[i] = k;
    }

    function soup(density) {
        if (!life.cells) return;
        for (let i = 0; i < life.cells.length; i++) {
            if (Math.random() < density) {
                life.cells[i] = 1;
                life.age[i] = 0;
                life.kind[i] = Math.random() < KOI ? 1 : 0;
            }
        }
    }

    function stampGlider(px, py, k = 1) {
        const col = Math.floor(px / CS) + M, row = Math.floor(py / CS) + M;
        const g = GLIDERS[(Math.random() * GLIDERS.length) | 0];
        for (const [dr, dc] of g) setCell(col + dc, row + dr, 1, k);
    }

    // onScreen: drop it somewhere visible; otherwise launch it from the hidden margin
    function spawnShip(onScreen) {
        if (!life.cells) return;
        const k = (Math.random() * SHIPS.length) | 0;
        const right = k % 2 === 1;
        const row = M + 1 + ((Math.random() * Math.max(1, life.visRows - 7)) | 0);
        const col = onScreen
            ? M + ((Math.random() * Math.max(1, life.visCols - 6)) | 0)
            : (right ? M - 7 : M + life.visCols + 1);
        const species = Math.random() < KOI ? 1 : 0;
        for (const [dr, dc] of SHIPS[k]) setCell(col + dc, row + dr, 1, species);
    }

    function seed() {
        for (let k = 0; k < 6; k++) spawnShip(true);
        for (let k = 0; k < 3; k++) stampGlider(Math.random() * life.w, Math.random() * life.h, Math.random() < KOI ? 1 : 0);
        soup(0.012);
    }

    function lifeTick() {
        const { cols, rows, cells, next, age, trail, kind } = life;
        const r0 = M, r1 = M + life.visRows, c0 = M, c1 = M + life.visCols;
        let alive = 0, seen = 0;  // whole torus vs. the visible window only
        for (let r = 0; r < rows; r++) {
            const rowVisible = r >= r0 && r < r1;
            const up = ((r - 1 + rows) % rows) * cols;
            const mid = r * cols;
            const dn = ((r + 1) % rows) * cols;
            for (let c = 0; c < cols; c++) {
                const l = (c - 1 + cols) % cols, rr = (c + 1) % cols;
                const n =
                    cells[up + l] + cells[up + c] + cells[up + rr] +
                    cells[mid + l] + cells[mid + rr] +
                    cells[dn + l] + cells[dn + c] + cells[dn + rr];
                const i = mid + c;
                const was = cells[i];
                let now = was ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
                // still lifes slowly dissolve so the pond never silts up
                if (now && was && age[i] > ERODE_AGE && Math.random() < 0.03) now = 0;
                next[i] = now;
                if (now) {
                    alive++;
                    if (rowVisible && c >= c0 && c < c1) seen++;
                    if (was) age[i] = Math.min(age[i] + 1, 1000);
                    else {
                        // a birth has exactly three live parents: take their majority colour.
                        // Safe to write in place — a dead cell's own colour is never read as a parent.
                        age[i] = 0;
                        kind[i] = (
                            cells[up + l] * kind[up + l] + cells[up + c] * kind[up + c] + cells[up + rr] * kind[up + rr] +
                            cells[mid + l] * kind[mid + l] + cells[mid + rr] * kind[mid + rr] +
                            cells[dn + l] * kind[dn + l] + cells[dn + c] * kind[dn + c] + cells[dn + rr] * kind[dn + rr]
                        ) >= 2 ? 1 : 0;
                    }
                } else if (was) {
                    trail[i] = 1;
                    age[i] = 0;
                }
            }
        }
        cells.set(next);
        // hard ceiling, in case a collision explodes
        if (alive > cells.length * 0.14) {
            alive = 0;
            seen = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const i = r * cols + c;
                    if (cells[i] && Math.random() < 0.35) { cells[i] = 0; trail[i] = 1; age[i] = 0; }
                    alive += cells[i];
                    if (cells[i] && r >= r0 && r < r1 && c >= c0 && c < c1) seen++;
                }
            }
        }
        life.alive = alive;
        life.seen = seen;
        life.gen++;
    }

    function updateStats() {
        if (genEl) genEl.textContent = String(life.gen).padStart(4, "0");
        if (aliveEl) aliveEl.textContent = String(life.seen).padStart(3, "0");
    }

    // re-run `cb` whenever devicePixelRatio changes (window dragged to another screen, zoom)
    function onDprChange(cb) {
        if (!window.matchMedia) return;
        let mq = null;
        const listen = () => {
            mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
            if (mq.addEventListener) mq.addEventListener("change", fire, { once: true });
            else if (mq.addListener) mq.addListener(fire);
        };
        function fire() {
            if (mq && !mq.addEventListener && mq.removeListener) mq.removeListener(fire);
            cb();
            listen();
        }
        listen();
    }

    /* ---------- hero: cells are vivid up top, fade behind reading text ---------- */
    const keepEls = hero ? Array.from(hero.querySelectorAll("[data-keepout]")) : [];
    const navEl = document.querySelector(".site-nav");
    let keeps = [];   // [x0, y0, x1, y1] in document coordinates, padded
    let heroH = 0;
    let navBottom = 0; // the fixed nav is transparent over the hero — keep its band clear too
    let strength = BASE;

    function measureKeepouts() {
        if (!hero) return;
        heroH = hero.offsetHeight || innerHeight;
        navBottom = navEl ? navEl.getBoundingClientRect().bottom : 0;
        const sy = scrollY, pad = 14;
        keeps = keepEls.map((el) => {
            const r = el.getBoundingClientRect();
            return [r.left - pad, r.top + sy - pad, r.right + pad, r.bottom + sy + pad];
        });
    }

    function heroStrength() {
        if (!hero) return BASE;
        const t = Math.min(1, Math.max(0, scrollY / Math.max(1, heroH * 0.75)));
        return 1 - t * (1 - BASE);
    }

    // 1 in open water; KEEP_MIN behind text and the nav band, ramping over FEATHER px
    // so ships slide under the text softly instead of switching off at a hard edge
    const KEEP_MIN = 0.05, FEATHER = 44;
    const ramp = (d) => d <= 0 ? KEEP_MIN : d >= FEATHER ? 1 : KEEP_MIN + (1 - KEEP_MIN) * (d / FEATHER);
    function keepFactor(x, viewY, docY) {
        let f = ramp(viewY - navBottom);
        for (let k = 0; k < keeps.length && f > KEEP_MIN; k++) {
            const b = keeps[k];
            const dx = Math.max(b[0] - x, 0, x - b[2]);
            const dy = Math.max(b[1] - docY, 0, docY - b[3]);
            if (dx < FEATHER && dy < FEATHER) f = Math.min(f, ramp(Math.hypot(dx, dy)));
        }
        return f;
    }

    let lastRender = 0;
    function lifeRender(ts) {
        const ctx = life.ctx;
        const { cols, visCols, visRows, cells, glow, trail, kind } = life;
        const s = strength * pal.ink;
        const pad = 1.5, sz = CS - pad * 2, half = CS / 2;
        const sy = scrollY;
        const useKeep = keeps.length > 0 && strength > BASE + 0.02;

        // time-based easing, so 60 Hz and 120 Hz screens look the same
        const dt = Math.min(100, lastRender ? ts - lastRender : 16);
        lastRender = ts;
        const kGlow = 1 - Math.exp(-dt / GLOW_TAU);
        const kTrail = Math.exp(-dt / TRAIL_TAU);

        ctx.clearRect(0, 0, life.w, life.h);

        // ease every cell (hidden margin included) toward its state
        for (let i = 0; i < cells.length; i++) {
            glow[i] += (cells[i] - glow[i]) * kGlow;
            if (glow[i] < 0.004) glow[i] = 0;
            if (trail[i] > 0) trail[i] = trail[i] < 0.02 ? 0 : trail[i] * kTrail;
        }

        // three passes — wake, cobalt, orange — so fillStyle changes only three times.
        // A dying cell keeps drawing while its glow fades, so nothing ever pops off.
        for (let pass = 0; pass < 3; pass++) {
            ctx.fillStyle = pass === 0 ? pal.trail : pass === 1 ? pal.cobalt : pal.koi;
            for (let r = M; r < M + visRows; r++) {
                const y = (r - M) * CS;
                for (let c = M; c < M + visCols; c++) {
                    const i = r * cols + c;
                    let a;
                    if (pass === 0) {
                        if (trail[i] === 0) continue;
                        a = trail[i] * (1 - glow[i]) * TRAIL_A * strength;
                    } else {
                        if (glow[i] === 0 || kind[i] !== pass - 1) continue;
                        a = glow[i] * s;
                    }
                    if (a < 0.006) continue;
                    const x = (c - M) * CS;
                    if (useKeep) a *= keepFactor(x + half, y + half, y + half + sy);
                    if (a < 0.006) continue;
                    ctx.globalAlpha = a;
                    ctx.fillRect(x + pad, y + pad, sz, sz);
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    if (ambient) {
        const cv = document.createElement("canvas");
        cv.className = "life-canvas";
        cv.setAttribute("aria-hidden", "true");
        ambient.appendChild(cv);
        life.ctx = cv.getContext("2d");
    }

    if (life.ctx) {
        const cv = life.ctx.canvas;
        const fit = () => {
            const dpr = Math.min(devicePixelRatio || 1, 2);
            const first = !life.cells;
            allocate();
            cv.width = Math.round(life.w * dpr);
            cv.height = Math.round(life.h * dpr);
            life.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            if (first) seed();
            measureKeepouts();
        };
        fit();
        let rt;
        const refit = () => { clearTimeout(rt); rt = setTimeout(fit, 150); };
        addEventListener("resize", refit);
        // a classic scrollbar appearing/disappearing resizes .ambient without a window resize
        if ("ResizeObserver" in window) new ResizeObserver(refit).observe(ambient);
        onDprChange(fit);
        // fonts and the hero's entrance animation both move the text boxes
        addEventListener("load", measureKeepouts);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureKeepouts);

        // the cursor sows life as it travels
        let seedX = -999, seedY = -999;
        addEventListener("pointermove", (e) => {
            if (Math.hypot(e.clientX - seedX, e.clientY - seedY) > CS) {
                seedX = e.clientX;
                seedY = e.clientY;
                const col = Math.floor(e.clientX / CS) + M, row = Math.floor(e.clientY / CS) + M;
                // the visitor's cells are orange, like the gliders their clicks launch
                setCell(col, row, 1, 1);
                setCell(col + ((Math.random() * 3) | 0) - 1, row + ((Math.random() * 3) | 0) - 1, 1, 1);
            }
        }, { passive: true });

        // clicks/taps launch gliders (except on interactive elements). `click`, not
        // `pointerdown`: on touch screens pointerdown also starts every scroll swipe.
        addEventListener("click", (e) => {
            if (e.button > 0 || !(e.target instanceof Element)) return;
            if (e.target.closest("a, button, input, textarea, select, label, .site-nav, .overlay-menu, .portrait-frame")) return;
            stampGlider(e.clientX, e.clientY);
        });
    }

    const hint = document.querySelector(".hero-hint");
    if (hint && coarsePointer) hint.textContent = "tap anywhere to launch a glider";

    /* ============================================================
       KONAMI CODE — ↑↑↓↓←→←→BA
       ============================================================ */
    // a rolling buffer of the last ten keys, so a stray extra key or Caps Lock can't break it
    const KONAMI = ["arrowup", "arrowup", "arrowdown", "arrowdown",
        "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"].join(" ");
    const keys = [];
    addEventListener("keydown", (e) => {
        if (typeof e.key !== "string") return;
        keys.push(e.key.toLowerCase());
        if (keys.length > 10) keys.shift();
        if (keys.join(" ") === KONAMI) {
            keys.length = 0;
            for (let i = 0; i < 6; i++) spawnShip(true);
            for (let i = 0; i < 12; i++) {
                stampGlider(Math.random() * life.w, Math.random() * life.h);
            }
            toast("// achievement unlocked — the pond is alive");
        }
    });

    /* ============================================================
       HERO IDENTITY TYPEWRITER  (home page only — guards on element)
       Types + retypes short "I ___" lines about who Kaiwen is.
       Uses textContent only, never innerHTML.
       ============================================================ */
    (function heroTypewriter() {
        const type = document.querySelector(".hl-type");
        if (!type) return;
        const phrases = [
            "prove theorems.",
            "research constructive logic.",
            "build games & apps.",
            "turn math into motion.",
            "teach snowboarding.",
        ];
        let pi = 0, ci = 0, deleting = false;
        function tick() {
            const word = phrases[pi];
            if (!deleting) {
                type.textContent = word.slice(0, ++ci);
                if (ci === word.length) { deleting = true; return setTimeout(tick, 1700); }
                return setTimeout(tick, 52 + Math.random() * 46);
            }
            type.textContent = word.slice(0, --ci);
            if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; return setTimeout(tick, 380); }
            return setTimeout(tick, 26);
        }
        setTimeout(tick, 950);
    })();

    /* ============================================================
       MAIN LOOP
       ============================================================ */
    let lastMeasure = 0;
    function loop(ts) {
        if (life.ctx && life.cells) {
            if (ts - life.lastTick > TICK) {
                life.lastTick = ts;
                lifeTick();
                updateStats();
            }
            // judge the population by what is on screen — oscillators parked in the
            // hidden margin must not keep a small phone's pond empty
            if (ts - life.lastSpawn > SPAWN_EVERY) {
                life.lastSpawn = ts;
                if (life.seen < Math.max(14, life.visCols * life.visRows * 0.022)) spawnShip(false);
            }
            if (ts - lastMeasure > 1000) {
                lastMeasure = ts;
                measureKeepouts();
            }
            strength = heroStrength();
            lifeRender(ts);
        }
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
})();
