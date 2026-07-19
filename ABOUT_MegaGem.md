# MegaGem Live

**An interactive auction-strategy game — 1 human vs. 2 AI players — played inside a first-person 3D auction room.**

🔗 Live landing page: `https://kaiwenli2007.github.io/MegaGem_Live/`
🎮 Live app (Flask backend): `https://megagem-live.onrender.com`

---

## What is this project?

MegaGem Live is a real-time, single-player-against-AI strategy game built around a
sealed-bid **auction** and **hidden information**. You sit at a virtual desk in a
neon "cyberpunk" auction room and compete against two AI opponents to accumulate
the most value before the round ends.

The core tension is that nobody has full information. At the start of a round,
half the gems are pulled out of play and secretly split between the three
players. Because a gem type's final value depends on *how many* of that type were
removed from the game, every player is holding a piece of the answer — and the
only way to learn more is to win auctions, which forces you to reveal one of your
own secrets to everyone else.

### How it plays

- **3 players** — you (Player 1) plus 2 AI bidders. Everyone starts with **35 coins**.
- **30 gems** across 5 types (Gold, Sapphire, Jade, Onyx, Opal), 6 of each. At
  round start, **15 gems are removed** and dealt out as private information —
  5 per player.
- The game runs on a deck of **action cards**: *Win 1 Gem*, *Win 2 Gems*,
  *Invest*, and *Loan*. Each card is auctioned; the **highest bid wins and pays**,
  and ties break to the lower player ID.
- **Winning an auction costs you information** — you must reveal one of your
  private removed gems to the whole table. That revealed data shifts everyone's
  estimate of what each gem type is ultimately worth.
- **Scoring at end of round:** a gem type is worth `(total removed count) × 4`.
  Your final score = coins + investments + bonuses − loans + gem worth.

So the game is a constant balancing act: spend coins to win value and gather
signals, but overpaying early — or leaking the wrong secret at the wrong moment —
can hand the round to the AI.

### Modes

- **Start Game** — the full real-time auction with live bidding, reveals, and scoring.
- **Play with Tutor** — the same game, but with an AI coach on its own wall screen
  offering tips and answering strategy questions mid-game.
- **Learn How to Play** — a step-by-step tutorial plus a Q&A chat with an AI tutor.

---

## Tools & Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python, Flask, Flask-SocketIO, eventlet |
| **Real-time transport** | Socket.IO (WebSockets) for live bid/reveal/scoring events |
| **AI** | Google Gemini (`google-genai` SDK) — powers the AI bidders, the in-game coach, and the tutor, with a **heuristic fallback** when no API key is present |
| **3D rendering** | Three.js — WebGL for the room geometry + **CSS3DRenderer** to fold real HTML panels into the 3D scene |
| **Frontend** | Vanilla JavaScript, Socket.IO client, hand-built SVG gem art |
| **2D effects** | Custom canvas overlay (sparkles, shockwaves, confetti) reacting to game events |
| **Deployment** | Docker, Render (`render.yaml`), GitHub Pages for the static landing page |

### Architecture — "The Separation of Powers"

The 3D upgrade was deliberately **decoupled** so the graphics could be bolted on
without touching the game logic. Four layers, each with one job:

- **🧠 The Brain** (Flask + Socket.IO) — runs all game logic, resolves bids, and
  broadcasts events. It has no idea the frontend is 3D.
- **🎭 The Stage** (Three.js WebGL) — renders the physical room: desk, lights, and
  the spinning 3D gems that mirror the live gem queue.
- **🪄 The Illusionist** (Three.js CSS3DRenderer) — takes ordinary HTML (the bid
  form, the leaderboard, the auction log) and mounts it *inside* the 3D space as
  interactive on-screen panels.
- **📬 The Messenger** (Socket.IO client) — the connective tissue: it listens to
  the Brain and tells the Stage to animate and the Illusionist to update text.

Because the backend broadcasts the exact same events it did for the original 2D
dashboard, the whole 3D room is effectively a *presentation skin* — and a "Flat
2D mode" in settings can turn it off entirely.

---

## Challenges that came up

Building this surfaced a mix of gameplay-logic bugs, real-time-state headaches,
and the general difficulty of grafting a 3D interface onto a 2D app.

- **The human seat kept locking players out.** The seat was originally tied to a
  socket connection, so a simple page refresh spawned a new socket and the game
  would reject the returning player with *"Only the human player can submit
  bids."* The fix was to bind the human seat to a **persistent client ID** stored
  in `localStorage` — the seat now survives refreshes, and if the seat's owner has
  no live connection at all, it transfers to the requesting client instead of
  freezing everyone out.

- **The gem queue could show an impossible state.** A refill bug let the announced
  gem queue briefly display 3 gems when it should never exceed 2. This was fixed
  by refilling the queue **one gem at a time**, and the fix was **verified across
  200+ simulated games** to confirm it can never break again.

- **Fragile external dependencies.** An early version relied on QuickChart for a
  prediction chart — an external service that made the UI brittle. It was removed
  in favor of self-contained rendering.

- **Gemini model availability is a moving target.** Model IDs 404 depending on API
  key, region, and API version. The app defends against this with a **fallback
  chain of model names** and a **heuristic bidder** so the game stays fully
  playable even with no API key or a failing model — the AI never hard-crashes the
  round.

- **Folding real HTML into a 3D scene.** Getting CSS3DRenderer panels to stay
  crisp, clickable, and correctly scaled was non-trivial: screens had to
  **auto-scale to any window size** (the desk tablet capped at ~50% of the
  viewport) while remaining interactive form elements rather than flat textures.

- **Camera feel.** To keep the first-person view from feeling robotic, view
  switches use **interpolation (lerping)** to glide the camera between targets —
  the Big Screen, your tablet, the neutral room, and the auction log — instead of
  snapping instantly, simulating the motion of turning your head.

---

## Reflection

MegaGem Live started as a fairly conventional 2D auction dashboard and grew into
something more ambitious: a real-time multiplayer-style game with AI opponents,
an AI coach, and a full first-person 3D room. The most valuable lesson from the
project wasn't any single technology — it was the payoff of **clean separation of
concerns.** Because the backend was written to broadcast game events without
caring how they were displayed, I was able to completely reimagine the frontend —
from flat HTML to a WebGL auction room — without rewriting the game logic. That
"Brain / Stage / Illusionist / Messenger" split is the thing I'd carry into every
future project.

The bugs were also a good teacher. The human-seat lockout and the phantom third
gem in the queue were both **state-management** problems, and both taught the same
underlying lesson: in a real-time app, the source of truth has to be stable and
identity has to be durable. Tying identity to a socket felt fine until the first
page refresh proved otherwise. Verifying the queue fix across 200+ simulated games
also reinforced how much confidence you get from **testing at scale** rather than
eyeballing a few manual runs.

Integrating Gemini was a lesson in **designing for failure.** Third-party model
availability is genuinely unpredictable, so the game had to stay fun and playable
whether the AI came from a large language model or a simple heuristic. Building the
fallback path first meant the experience never depended on an external service
being up — a principle I'd apply well beyond AI features.

If I were to keep going, the obvious next steps are true multi-human multiplayer
(the socket infrastructure is already most of the way there), smarter and more
varied AI personalities, and richer 3D interaction. But even as it stands, the
project taught me how to reason about real-time state, how to layer an immersive
interface on top of solid game logic, and how to keep a system robust when the
pieces it depends on aren't guaranteed to cooperate.
