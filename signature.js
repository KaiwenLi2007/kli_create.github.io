/* ============================================================
   KAIWEN LI — SIGNATURE LAYER
   The site does mathematics:
   · Conway's Game of Life living in the background grid,
     seeded by your cursor, gliders on click
   · A true 4D tesseract (rotations in the XW/YZ/XY/ZW planes,
     projected 4D→3D→2D) steering with the cursor
   · A working terminal:  `  to open — prove, prime, collatz,
     fib, life, glider, spin, open …
   Zero libraries. Everything below is hand-rolled.
   ============================================================ */

(function () {
    "use strict";

    /* theme + shared motion state (owned by site.js; light "paper" is default) */
    const isLight = () => document.documentElement.getAttribute("data-theme") !== "dark";
    const motion = window.__klMotion || { energy: 0, hue: 210 };

    /* ---------- shared cursor (own lerp, independent of site.js) ---------- */
    const cur = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, tx: 0, ty: 0, active: false };
    addEventListener("pointermove", (e) => {
        cur.x = e.clientX;
        cur.y = e.clientY;
        cur.tx = e.clientX / innerWidth - 0.5;
        cur.ty = e.clientY / innerHeight - 0.5;
        cur.active = true;
    }, { passive: true });

    /* ---------- toast ---------- */
    const toastEl = document.createElement("div");
    toastEl.className = "kl-toast";
    document.body.appendChild(toastEl);
    let toastTimer;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
    }

    /* ============================================================
       CONWAY'S GAME OF LIFE — B3/S23 on a torus
       ============================================================ */
    const ambient = document.querySelector(".ambient");
    const life = {
        on: true, CS: 26, TICK: 150,
        cols: 0, rows: 0, cells: null, next: null, energy: null, age: null,
        ctx: null, lastTick: 0,
    };

    if (ambient) {
        const cv = document.createElement("canvas");
        cv.className = "life-canvas";
        // slot beneath the constellation canvas if site.js already added one
        const netCv = ambient.querySelector("canvas");
        if (netCv) ambient.insertBefore(cv, netCv);
        else ambient.appendChild(cv);
        life.ctx = cv.getContext("2d");

        const build = () => {
            const dpr = Math.min(devicePixelRatio || 1, 2);
            cv.width = innerWidth * dpr;
            cv.height = innerHeight * dpr;
            life.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            life.cols = Math.ceil(innerWidth / life.CS);
            life.rows = Math.ceil(innerHeight / life.CS);
            const n = life.cols * life.rows;
            life.cells = new Uint8Array(n);
            life.next = new Uint8Array(n);
            life.energy = new Float32Array(n);
            life.age = new Uint16Array(n);
            soup(0.05);
        };
        build();
        let rt;
        addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 200); });
    }

    function soup(density) {
        if (!life.cells) return;
        for (let i = 0; i < life.cells.length; i++) {
            if (Math.random() < density) { life.cells[i] = 1; life.age[i] = 0; }
        }
    }

    function setCell(col, row, v) {
        if (!life.cells) return;
        const c = ((col % life.cols) + life.cols) % life.cols;
        const r = ((row % life.rows) + life.rows) % life.rows;
        const i = r * life.cols + c;
        life.cells[i] = v;
        if (v) life.age[i] = 0;
    }

    // the four rotations/reflections of the glider
    const GLIDERS = [
        [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
        [[0, 0], [0, 1], [1, 1], [1, 2], [2, 0]],
        [[0, 0], [0, 1], [0, 2], [1, 0], [2, 1]],
        [[0, 2], [1, 0], [1, 1], [2, 1], [2, 2]],
    ];

    function stampGlider(px, py) {
        const col = Math.floor(px / life.CS), row = Math.floor(py / life.CS);
        const g = GLIDERS[(Math.random() * GLIDERS.length) | 0];
        for (const [dr, dc] of g) setCell(col + dc, row + dr, 1);
    }

    function lifeTick() {
        const { cols, rows, cells, next, age } = life;
        let alive = 0;
        for (let r = 0; r < rows; r++) {
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
                next[i] = cells[i] ? (n === 2 || n === 3 ? 1 : 0) : (n === 3 ? 1 : 0);
                if (next[i]) { alive++; age[i] = Math.min(age[i] + 1, 600); }
            }
        }
        life.cells.set(next);
        const total = cols * rows;
        // keep the colony sparse and immortal
        if (alive > total * 0.16) {
            for (let i = 0; i < total; i++) {
                if (life.cells[i] && Math.random() < 0.35) life.cells[i] = 0;
            }
        } else if (alive < total * 0.004) {
            soup(0.04);
        }
    }

    function lifeRender() {
        const ctx = life.ctx;
        if (!ctx) return;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        if (!life.on) return;
        const { cols, rows, cells, energy, age, CS } = life;
        const pad = CS * 0.14, sz = CS - pad * 2;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;
                const target = cells[i] ? 1 : 0;
                energy[i] += (target - energy[i]) * 0.14;
                const e = energy[i];
                if (e < 0.02) continue;
                // young cells cyan → mature cells indigo
                // young cells bloom into colour where the cursor sows them,
                // then settle into mono ink as they age
                const t = Math.min(age[i] / 40, 1);
                const sat = Math.round((1 - t) * motion.energy * 88);
                const light = isLight() ? (46 - t * 27) : (90 - t * 20);
                const hue = (motion.hue + i * 0.7) % 360;
                ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${e * (isLight() ? 0.17 : 0.12)})`;
                ctx.fillRect(c * CS + pad, r * CS + pad, sz, sz);
            }
        }
    }

    // the cursor sows life as it travels
    let seedX = -999, seedY = -999;
    addEventListener("pointermove", (e) => {
        if (!life.cells || !life.on) return;
        if (Math.hypot(e.clientX - seedX, e.clientY - seedY) > life.CS) {
            seedX = e.clientX;
            seedY = e.clientY;
            const col = Math.floor(e.clientX / life.CS), row = Math.floor(e.clientY / life.CS);
            setCell(col, row, 1);
            setCell(col + ((Math.random() * 3) | 0) - 1, row + ((Math.random() * 3) | 0) - 1, 1);
        }
    }, { passive: true });

    // clicks launch gliders (except on interactive elements)
    addEventListener("pointerdown", (e) => {
        if (e.target.closest("a, button, input, .terminal, .site-nav, .overlay-menu")) return;
        if (life.on) stampGlider(e.clientX, e.clientY);
    }, { passive: true });

    /* ============================================================
       TESSERACT — {-1,1}^4 rotated in 4 planes, projected twice
       ============================================================ */
    const hero = document.querySelector(".hero");
    let tctx = null, tW = 0, tH = 0, spinBoost = 0;
    const ang = { xw: 0.4, yz: 0.2, xy: 0, zw: 0 };

    const VERTS = [];
    for (let i = 0; i < 16; i++) {
        VERTS.push([
            (i & 1) * 2 - 1,
            ((i >> 1) & 1) * 2 - 1,
            ((i >> 2) & 1) * 2 - 1,
            ((i >> 3) & 1) * 2 - 1,
        ]);
    }
    const EDGES = [];
    for (let i = 0; i < 16; i++) {
        for (let j = i + 1; j < 16; j++) {
            const x = i ^ j;
            if ((x & (x - 1)) === 0) EDGES.push([i, j]); // differ in exactly one coordinate
        }
    }

    if (hero) {
        const cv = document.createElement("canvas");
        cv.id = "tesseract";
        hero.insertBefore(cv, hero.firstChild);
        tctx = cv.getContext("2d");
        const fit = () => {
            const dpr = Math.min(devicePixelRatio || 1, 2);
            tW = hero.clientWidth;
            tH = hero.clientHeight;
            cv.width = tW * dpr;
            cv.height = tH * dpr;
            tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        fit();
        addEventListener("resize", fit);
    }

    function drawTesseract() {
        if (!tctx) return;
        const boost = 1 + spinBoost;
        spinBoost *= 0.985;
        // cursor position drives the two main rotation planes
        ang.xw += (0.0036 + cur.nx * 0.016) * boost;
        ang.yz += (0.0042 + cur.ny * 0.016) * boost;
        ang.xy += 0.0021 * boost;
        ang.zw += 0.0015 * boost;

        const cxw = Math.cos(ang.xw), sxw = Math.sin(ang.xw);
        const cyz = Math.cos(ang.yz), syz = Math.sin(ang.yz);
        const cxy = Math.cos(ang.xy), sxy = Math.sin(ang.xy);
        const czw = Math.cos(ang.zw), szw = Math.sin(ang.zw);

        const cx = tW / 2 + cur.nx * -30;
        const cy = tH / 2 + cur.ny * -22;
        const R = Math.min(tW, tH) * 0.19;
        const DW = 3, DZ = 4; // projection distances

        const proj = [];
        for (const [x0, y0, z0, w0] of VERTS) {
            // rotate in XW
            let x = x0 * cxw - w0 * sxw;
            let w = x0 * sxw + w0 * cxw;
            // rotate in YZ
            let y = y0 * cyz - z0 * syz;
            let z = y0 * syz + z0 * cyz;
            // rotate in XY
            const x2 = x * cxy - y * sxy;
            const y2 = x * sxy + y * cxy;
            x = x2; y = y2;
            // rotate in ZW
            const z2 = z * czw - w * szw;
            const w2 = z * szw + w * czw;
            z = z2; w = w2;
            // 4D → 3D (w-perspective), then 3D → 2D (z-perspective)
            const s4 = DW / (DW - w);
            const x3 = x * s4, y3 = y * s4, z3 = z * s4;
            const s3 = DZ / (DZ - z3);
            proj.push({
                x: cx + x3 * s3 * R,
                y: cy + y3 * s3 * R,
                d: s4 * s3, // combined depth cue
            });
        }

        tctx.clearRect(0, 0, tW, tH);
        for (const [a, b] of EDGES) {
            const p = proj[a], q = proj[b];
            const d = (p.d + q.d) / 2;
            const t = Math.max(0, Math.min(1, (d - 0.7) / 1.1));
            // depth drives lightness/thickness; motion drives colour
            const act = Math.min(1, motion.energy * 0.9 + spinBoost * 0.5);
            const hue = (motion.hue + t * 40) % 360;
            const el = isLight() ? (30 - t * 10) : (55 + t * 35);
            const al = (0.10 + t * 0.24) * (isLight() ? 1.5 : 1);
            tctx.beginPath();
            tctx.moveTo(p.x, p.y);
            tctx.lineTo(q.x, q.y);
            tctx.strokeStyle = `hsla(${hue}, ${Math.round(act * 85)}%, ${el}%, ${al})`;
            tctx.lineWidth = 0.7 + t * 1.1;
            tctx.stroke();
        }
        for (const p of proj) {
            const t = Math.max(0, Math.min(1, (p.d - 0.7) / 1.1));
            const act = Math.min(1, motion.energy * 0.9 + spinBoost * 0.5);
            const hue = (motion.hue + t * 40) % 360;
            const el = isLight() ? (22 - t * 6) : (78 + t * 18);
            tctx.beginPath();
            tctx.arc(p.x, p.y, 1.4 + t * 1.8, 0, Math.PI * 2);
            tctx.fillStyle = `hsla(${hue}, ${Math.round(act * 80)}%, ${el}%, ${0.28 + t * 0.5})`;
            tctx.fill();
        }
    }

    /* ============================================================
       GLOBE — a rotating Fibonacci sphere of points (terminal: globe)
       ============================================================ */
    const globe = { on: false, cv: null, ctx: null, W: 0, H: 0, pts: [], rot: 0, fade: 0 };

    // distribute unit-sphere points along the golden spiral
    (function buildGlobe() {
        const N = 2000;
        const golden = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < N; i++) {
            const y = 1 - (i / (N - 1)) * 2;
            const r = Math.sqrt(Math.max(0, 1 - y * y));
            const th = i * golden;
            globe.pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
        }
    })();

    function ensureGlobe() {
        if (globe.cv) return;
        const cv = document.createElement("canvas");
        cv.className = "globe-canvas";
        document.body.appendChild(cv);
        globe.cv = cv;
        globe.ctx = cv.getContext("2d");
        const fit = () => {
            const dpr = Math.min(devicePixelRatio || 1, 2);
            globe.W = innerWidth; globe.H = innerHeight;
            cv.width = globe.W * dpr;
            cv.height = globe.H * dpr;
            globe.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        fit();
        addEventListener("resize", fit);
    }

    function drawGlobe() {
        const ctx = globe.ctx;
        if (!ctx) return;
        const target = globe.on ? 1 : 0;
        globe.fade += (target - globe.fade) * 0.07;
        if (!globe.on && globe.fade < 0.004) {
            ctx.clearRect(0, 0, globe.W, globe.H);
            globe.cv.style.opacity = "0";
            return;
        }
        globe.cv.style.opacity = "1";
        ctx.clearRect(0, 0, globe.W, globe.H);

        const cx = globe.W / 2, cy = globe.H / 2;
        const R = Math.min(globe.W, globe.H) * 0.36 * (0.55 + 0.45 * globe.fade);
        const light = isLight();

        // faint halo lifts the sphere off the page
        const g = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R * 1.25);
        g.addColorStop(0, `rgba(${light ? "20, 18, 12" : "255, 255, 255"}, ${0.05 * globe.fade})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);

        // spin from its own idle drift + a launch burst + cursor energy; tilt follows cursor
        globe.rot += 0.004 + motion.energy * 0.02 + spinBoost * 0.004;
        const tilt = 0.45 + cur.ny * 0.5;
        const ca = Math.cos(globe.rot), sa = Math.sin(globe.rot);
        const ct = Math.cos(tilt), st = Math.sin(tilt);
        const sat = Math.round(motion.energy * 88);

        for (const [x0, y0, z0] of globe.pts) {
            const x = x0 * ca + z0 * sa;         // rotate around Y
            let z = -x0 * sa + z0 * ca;
            const y = y0 * ct - z * st;          // tilt around X
            z = y0 * st + z * ct;
            const depth = (z + 1) / 2;           // 0 back → 1 front
            const size = (0.55 + depth * 1.7) * (0.7 + 0.3 * globe.fade);
            const a = (0.1 + depth * 0.62) * globe.fade;
            const l = light ? (32 - depth * 20) : (52 + depth * 43);
            ctx.beginPath();
            ctx.arc(cx + x * R, cy + y * R, size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${(motion.hue + depth * 30) % 360}, ${sat}%, ${l}%, ${a})`;
            ctx.fill();
        }
    }

    /* ============================================================
       TERMINAL
       ============================================================ */
    const launcher = document.createElement("button");
    launcher.className = "term-launcher";
    launcher.innerHTML = '<span class="tl-dot"></span>~ terminal <kbd>`</kbd>';
    document.body.appendChild(launcher);

    const term = document.createElement("div");
    term.className = "terminal";
    term.innerHTML =
        '<div class="term-bar">' +
        '<span class="term-dots"><i></i><i></i><i></i></span>' +
        '<span class="term-title">kaiwen@cmu — portfolio-shell</span>' +
        '<button class="term-close" aria-label="Close terminal">✕</button>' +
        '</div>' +
        '<div class="term-out"></div>' +
        '<div class="term-line"><span class="term-prompt">❯</span>' +
        '<input class="term-in" spellcheck="false" autocomplete="off" autocapitalize="off"></div>';
    document.body.appendChild(term);

    const out = term.querySelector(".term-out");
    const input = term.querySelector(".term-in");
    let booted = false;
    const history = [];
    let histIdx = -1;

    function print(text, cls) {
        const div = document.createElement("div");
        div.className = "tline" + (cls ? " " + cls : "");
        div.textContent = text;
        out.appendChild(div);
        out.scrollTop = out.scrollHeight;
    }

    function printCmd(text) {
        const div = document.createElement("div");
        div.className = "tline t-cmd";
        const ps = document.createElement("span");
        ps.className = "t-ps";
        ps.textContent = "❯";
        div.appendChild(ps);
        div.appendChild(document.createTextNode(text));
        out.appendChild(div);
        out.scrollTop = out.scrollHeight;
    }

    const BANNER =
        " ██╗  ██╗██╗\n" +
        " ██║ ██╔╝██║\n" +
        " █████╔╝ ██║\n" +
        " ██╔═██╗ ██║\n" +
        " ██║  ██╗███████╗\n" +
        " ╚═╝  ╚═╝╚══════╝";

    function boot() {
        print(BANNER, "t-banner");
        print("portfolio-shell v1.0 — Kaiwen Li, Mathematics @ CMU", "t-acc");
        print("type 'help' to see what this thing can do.", "t-dim");
        print("");
    }

    function setTerm(open) {
        term.classList.toggle("open", open);
        if (open) {
            if (!booted) { booted = true; boot(); }
            setTimeout(() => input.focus(), 80);
        } else {
            input.blur();
        }
    }

    launcher.addEventListener("click", () => setTerm(!term.classList.contains("open")));
    term.querySelector(".term-close").addEventListener("click", () => setTerm(false));
    addEventListener("keydown", (e) => {
        if (e.key === "`" && document.activeElement !== input) {
            e.preventDefault();
            setTerm(!term.classList.contains("open"));
        }
        if (e.key === "Escape") {
            if (term.classList.contains("open")) setTerm(false);
            if (globe.on) globe.on = false;
        }
    });

    // the hero "prompt line" (home page) opens the terminal
    const heroPrompt = document.querySelector(".hero-prompt");
    if (heroPrompt) heroPrompt.addEventListener("click", () => setTerm(true));

    /* ----- math helpers ----- */
    function isPrime(n) {
        if (n < 2) return false;
        if (n % 2 === 0) return n === 2;
        if (n % 3 === 0) return n === 3;
        for (let i = 5; i * i <= n; i += 6) {
            if (n % i === 0 || n % (i + 2) === 0) return false;
        }
        return true;
    }
    function smallestFactor(n) {
        if (n % 2 === 0) return 2;
        if (n % 3 === 0) return 3;
        for (let i = 5; i * i <= n; i += 6) {
            if (n % i === 0) return i;
            if (n % (i + 2) === 0) return i + 2;
        }
        return n;
    }
    function nextPrime(n) {
        let m = n + 1;
        while (!isPrime(m)) m++;
        return m;
    }

    const PROOFS = [
        ["√2 is irrational",
            "Suppose √2 = p/q in lowest terms. Then p² = 2q², so p is even: p = 2k.\n" +
            "Substituting, 4k² = 2q² ⟹ q² = 2k², so q is even too — contradicting\n" +
            "lowest terms. Hence no such p/q exists.  ∎"],
        ["There are infinitely many primes (Euclid)",
            "Given any finite list p₁, …, pₙ, let N = p₁·p₂·…·pₙ + 1. Each pᵢ divides N − 1,\n" +
            "so none divides N. Thus N has a prime factor not in the list.  ∎"],
        ["Handshake lemma",
            "Every edge contributes exactly 2 to the sum of all vertex degrees, so\n" +
            "Σ deg(v) = 2|E| is even. Therefore the number of odd-degree vertices is even.  ∎"],
        ["Two Pittsburghers have the same hair count",
            "A human head has fewer than 1,000,000 hairs, and Pittsburgh has over 300,000\n" +
            "people — but wait, that's not enough… add the students. With more people than\n" +
            "possible hair counts, the pigeonhole principle finishes the job.  ∎"],
        ["0.999… = 1",
            "Let x = 0.999… . Then 10x = 9.999… = 9 + x, so 9x = 9, giving x = 1.  ∎"],
    ];

    const PAGES = {
        home: "index.html", experience: "experience.html", education: "experience.html",
        achievements: "honors.html", math: "honors.html", mathematics: "honors.html", honors: "honors.html",
        interests: "interests.html", megagem: "megagem.html",
        bingbeats: "bingbeats.html", beats: "bingbeats.html",
        assets: "https://arcg.is/04Xv9r",
    };

    const COMMANDS = ["help", "whoami", "resume", "contact", "ls", "open", "prove",
        "prime", "collatz", "fib", "life", "glider", "spin", "globe", "clear",
        "history", "pwd", "date", "echo", "exit"];

    function exec(raw) {
        const line = raw.trim();
        if (!line) return;
        printCmd(line);
        history.push(line);
        histIdx = history.length;

        const [cmd, ...args] = line.split(/\s+/);
        const c = cmd.toLowerCase();

        switch (c) {
            case "help":
                print("navigation", "t-acc");
                print("  ls              list pages");
                print("  open <page>     jump to a page (e.g. open megagem)");
                print("profile", "t-acc");
                print("  whoami          one-liner");
                print("  resume          the full summary");
                print("  contact         how to reach me");
                print("mathematics", "t-acc");
                print("  prove           a random pocket proof");
                print("  prime <n>       primality + smallest factor + next prime");
                print("  collatz <n>     hailstone trajectory of n");
                print("  fib <n>         exact n-th Fibonacci number (BigInt)");
                print("playground", "t-acc");
                print("  life on|off|soup   control the Game of Life background");
                print("  glider [n]      launch gliders into the grid");
                print("  spin            overclock the 4D tesseract (home page)");
                print("  globe           summon a rotating globe of points");
                print("system", "t-acc");
                print("  clear · history · pwd · date · echo · exit");
                break;

            case "whoami":
                print("Kaiwen Li — Mathematics (Discrete Math & Logic) @ Carnegie Mellon, Class of 2029.");
                print("USAMO qualifier · constructive-logic researcher · builder of games and apps.", "t-dim");
                break;

            case "resume":
            case "cat":
                print("KAIWEN LI — Mathematics (Discrete Math & Logic), CMU '29", "t-acc");
                print("  kl5@andrew.cmu.edu · 1-412-891-5688 · Pittsburgh, PA", "t-dim");
                print("EDUCATION    CMU, B.S. Mathematics — Discrete Math & Logic (exp. May 2029)");
                print("             QPA 3.74/4.00 · Dean's List ×2 · Lord Byng Secondary (96/100)");
                print("RESEARCH     Constructive logic & theoretical CS — Prof. Richard Statman");
                print("HONORS       USAMO Qualifier · 2× AMC 12 HRD (top 1%) · 3× AIME (12/15) · Euclid top 2.5%");
                print("PROJECTS     Bing Beats · MegaGem Live · Asset Management Research");
                print("EXPERIENCE   Quant Market Making (3rd/35+) · TA @ Kerrisdale · Snowboard Instructor (CASI)");
                print("PROGRAMS     SUMaC (Stanford) · UBC Math Circle · NSLC Engineering");
                break;

            case "contact":
                print("email   kl5@andrew.cmu.edu", "t-cy");
                print("phone   1-412-891-5688");
                print("where   Pittsburgh, PA");
                break;

            case "ls":
                print("home/  experience/  achievements/  interests/", "t-cy");
                print("bingbeats/  megagem/  assets/ (external)", "t-cy");
                break;

            case "open": {
                const key = (args[0] || "").toLowerCase();
                const dest = PAGES[key];
                if (!dest) {
                    print(`open: unknown page '${args[0] || ""}' — try 'ls'`, "t-err");
                } else if (dest.startsWith("http")) {
                    print(`opening ${key} ↗`, "t-dim");
                    window.open(dest, "_blank");
                } else {
                    print(`navigating to ${key}…`, "t-dim");
                    setTimeout(() => { location.href = dest; }, 350);
                }
                break;
            }

            case "prove": {
                const [title, body] = PROOFS[(Math.random() * PROOFS.length) | 0];
                print("Theorem. " + title + ".", "t-acc");
                print(body);
                break;
            }

            case "prime": {
                const n = Number(args[0]);
                if (!Number.isInteger(n) || n < 0) { print("usage: prime <positive integer>", "t-err"); break; }
                if (n > 1e12) { print("prime: capped at 10^12 (this shell runs on your battery)", "t-err"); break; }
                if (n < 2) { print(`${n} is neither prime nor composite.`); break; }
                if (isPrime(n)) {
                    print(`${n} is prime.`, "t-cy");
                } else {
                    const f = smallestFactor(n);
                    print(`${n} = ${f} × ${n / f}  (not prime)`);
                }
                print(`next prime: ${nextPrime(n)}`, "t-dim");
                break;
            }

            case "collatz": {
                const n = Number(args[0]);
                if (!Number.isInteger(n) || n < 1) { print("usage: collatz <positive integer>", "t-err"); break; }
                if (n > 1e9) { print("collatz: capped at 10^9", "t-err"); break; }
                let x = n, steps = 0, peak = n;
                const seq = [n];
                while (x !== 1 && steps < 1000) {
                    x = x % 2 === 0 ? x / 2 : 3 * x + 1;
                    peak = Math.max(peak, x);
                    steps++;
                    if (seq.length < 30) seq.push(x);
                }
                const shown = seq.join(" → ") + (steps + 1 > seq.length ? " → …" : "");
                print(shown);
                print(`reached 1 in ${steps} steps · peak ${peak}`, "t-cy");
                print("(no counterexample today either)", "t-dim");
                break;
            }

            case "fib": {
                const n = Number(args[0]);
                if (!Number.isInteger(n) || n < 0) { print("usage: fib <n>", "t-err"); break; }
                if (n > 1000) { print("fib: capped at n = 1000", "t-err"); break; }
                let a = 0n, b = 1n;
                for (let i = 0; i < n; i++) { const t = a + b; a = b; b = t; }
                const s = a.toString();
                print(`F(${n}) = ${s}`);
                if (s.length > 20) print(`(${s.length} digits, computed exactly)`, "t-dim");
                break;
            }

            case "life": {
                const sub = (args[0] || "").toLowerCase();
                if (sub === "off") { life.on = false; print("Game of Life paused. the grid rests.", "t-dim"); }
                else if (sub === "on") { life.on = true; print("Game of Life resumed. B3/S23, as nature intended.", "t-cy"); }
                else if (sub === "soup") { soup(0.12); print("primordial soup deployed. watch the background.", "t-cy"); }
                else print("usage: life on | off | soup", "t-err");
                break;
            }

            case "glider": {
                const n = Math.max(1, Math.min(Number(args[0]) || 3, 25));
                for (let i = 0; i < n; i++) {
                    stampGlider(Math.random() * innerWidth, Math.random() * innerHeight);
                }
                print(`${n} glider${n > 1 ? "s" : ""} launched. they travel diagonally, forever.`, "t-cy");
                break;
            }

            case "spin":
                if (tctx) {
                    spinBoost = 14;
                    print("tesseract overclocked. rotating through 4 planes at once.", "t-cy");
                } else {
                    print("no tesseract on this page — it lives on the home page.", "t-dim");
                }
                break;

            case "globe":
            case "sphere":
            case "earth": {
                ensureGlobe();
                const sub = (args[0] || "").toLowerCase();
                if (sub === "off") {
                    globe.on = false;
                    print("globe dismissed.", "t-dim");
                } else {
                    globe.on = true;
                    spinBoost = Math.max(spinBoost, 8);
                    print("2,000 points on a sphere. move the cursor to spin and tilt it.", "t-cy");
                    print("`globe off` or Esc to dismiss.", "t-dim");
                }
                break;
            }

            case "clear":
                out.innerHTML = "";
                break;

            case "history":
                history.forEach((h, i) => print(`  ${i + 1}  ${h}`, "t-dim"));
                break;

            case "pwd":
                print("/home/kaiwen/portfolio");
                break;

            case "date":
                print(new Date().toString());
                break;

            case "echo":
                print(args.join(" "));
                break;

            case "sudo":
                print("Permission denied: reported to the Dean of Discrete Mathematics.", "t-err");
                break;

            case "rm":
                print("nice try.", "t-err");
                break;

            case "exit":
                setTerm(false);
                break;

            default:
                if (PAGES[c]) { exec("open " + c); return; }
                print(`command not found: ${c} — try 'help'`, "t-err");
        }
        print("");
    }

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            exec(input.value);
            input.value = "";
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (histIdx > 0) { histIdx--; input.value = history[histIdx] || ""; }
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (histIdx < history.length) { histIdx++; input.value = history[histIdx] || ""; }
        } else if (e.key === "Tab") {
            e.preventDefault();
            const v = input.value;
            if (v.toLowerCase().startsWith("open ")) {
                const part = v.slice(5).toLowerCase();
                const hit = Object.keys(PAGES).find((p) => p.startsWith(part));
                if (hit) input.value = "open " + hit;
            } else if (v) {
                const hit = COMMANDS.find((cName) => cName.startsWith(v.toLowerCase()));
                if (hit) input.value = hit;
            }
        }
    });

    /* ============================================================
       KONAMI CODE — ↑↑↓↓←→←→BA
       ============================================================ */
    const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
        "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
    let kIdx = 0;
    addEventListener("keydown", (e) => {
        if (document.activeElement === input) return;
        kIdx = e.key === KONAMI[kIdx] ? kIdx + 1 : (e.key === KONAMI[0] ? 1 : 0);
        if (kIdx === KONAMI.length) {
            kIdx = 0;
            life.on = true;
            for (let i = 0; i < 16; i++) {
                stampGlider(Math.random() * innerWidth, Math.random() * innerHeight);
            }
            soup(0.06);
            spinBoost = 20;
            toast("// achievement unlocked — the grid is alive");
        }
    });

    /* ============================================================
       MAIN LOOP
       ============================================================ */
    function loop(ts) {
        cur.nx += (cur.tx - cur.nx) * 0.06;
        cur.ny += (cur.ty - cur.ny) * 0.06;

        if (life.ctx && ts - life.lastTick > life.TICK) {
            life.lastTick = ts;
            if (life.on) lifeTick();
        }
        lifeRender();
        drawTesseract();
        if (globe.cv) drawGlobe();
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
})();
