# Bing Beats

**Discover music across time and space.** Pick any country and any year from 1950 to today, and Bing Beats surfaces the tracks that defined that place and moment — complete with 30-second previews and an AI music guide that knows the local scene.

> A cross-platform mobile app that turns "what did the world sound like in Brazil in 1998?" into a tappable, playable playlist.

---

## What It Is

Bing Beats is a music-discovery app built with **Expo / React Native**. The core loop is simple and tactile:

1. **Choose a place** — tap a country from a flag grid, or spin an interactive 3D globe and tap it directly.
2. **Choose a time** — drag a year slider spanning 1950 → present.
3. **Discover** — get a curated playlist of tracks from that country and year, each with cover art, a 30-second audio preview, and a link to open the full track in Spotify.
4. **Ask the guide** — a built-in AI chatbot explains the genres, scenes, and cultural context of that place and era, and can generate a playlist on request.

The entire interface breathes with a **continuously cycling rainbow gradient** — accent colors, buttons, and the globe's glow smoothly shift through the full color spectrum on a ~12-second loop, giving the app a living, playful feel without any user input.

---

## How It Works

The project is split into two independent halves so that private API keys never touch the client.

### Frontend — the Expo app (`BingBeats/`)

Built with **Expo Router** (file-based navigation) and heavily animated with **React Native Reanimated**.

- **Home screen** — the heart of the app: a segmented toggle between a *Featured countries* flag grid and an interactive *Globe*, a year slider, and a "Discover" button. Micro-interactions everywhere: an animated wordmark that assembles letter-by-letter, a floating tagline, a "popping" year counter, haptic feedback on taps, and a sliding pill on the toggle.
- **Playlist screen** — fetches tracks for the chosen country + year, shows shimmer skeleton loaders while waiting, then renders track cards. Tapping a row plays a 30-second preview (via `expo-av`), with a single active audio player that cleans itself up. Tracks without previews link straight to Spotify.
- **AI chat assistant** — a global overlay available anywhere in the app. It's context-aware: it knows which country and year you're exploring and can produce a playlist inline.
- **Shared state via React Context** — one context holds the selected country/year, another drives the app-wide cycling gradient.

### Backend — the API server (`server/`)

A lightweight **Node.js / Express** service (deployed on Render) that acts as a secure proxy and orchestrator:

- `POST /api/playlist` — authenticates with **Spotify** (Client Credentials flow, with token caching), searches that country's market for the given year, dedupes and ranks results, and returns the top tracks.
- `POST /api/chat` — builds a country/year-scoped system prompt, enriches it with the real track list, and calls **Google Gemini** to answer music questions or generate playlists.
- `GET /api/public-config` — hands the client a public **Mapbox** token for the globe.
- `GET /health` — reports which integrations are configured.

---

## Tools & Technologies

| Area | Stack |
|------|-------|
| **Framework** | Expo, React Native, Expo Router, TypeScript |
| **UI / Animation** | React Native Reanimated, Expo Linear Gradient, Expo Haptics, custom cycling-gradient theming |
| **Audio** | `expo-av` (30-second preview playback) |
| **Maps** | Mapbox GL (interactive globe, rendered in a WebView) |
| **Backend** | Node.js, Express, CORS |
| **Music data** | Spotify Web API + iTunes Search API (for preview backfill) |
| **AI** | Google Gemini (`gemini-2.5-flash-lite`) |
| **Hosting** | Render (backend), Expo Go (app runtime) |

---

## Challenges Encountered

**Spotify hides its preview URLs.** The Spotify Web API frequently returns tracks with a null `preview_url`, which would leave the app's play button useless. The fix: for every selected track, the backend makes a secondary lookup against the **iTunes Search API** and backfills a real 30-second preview clip whenever Spotify omits one. This dramatically increased the number of actually-playable tracks.

**Spotify's undocumented rate limit.** Under the Client Credentials flow, Spotify's docs claim a search limit of up to 50 results — but the live API rejects anything above 10 with a `400 Invalid limit` error. This only surfaced through real testing. The search now pages with `limit=10` and gathers candidates across multiple requests.

**Render's cold starts.** The free hosting tier spins the server down when idle, causing a 30–60 second delay on the first request that can feel like the app is broken. This drove the design toward careful, honest loading states — shimmer skeletons and progress messaging — so the wait feels intentional rather than frozen.

**Rendering a 3D globe inside React Native.** There's no first-class native globe component, so the interactive Mapbox globe runs inside a WebView. Feeding the app's continuously-cycling accent color into that WebView naively would flood it with hundreds of injections per second, so the hue is **quantized into buckets** — the globe only updates its accent ~24 times per full color loop, keeping it smooth without spamming the bridge.

**Gemini quota and model fallback.** Free-tier Gemini models hit `429` rate limits under load. The server defaults to a model with more headroom and exposes an environment override, so the model can be swapped without a code change when one quota is exhausted.

**Keeping the chatbot on-topic and useful.** The assistant handles one exchange at a time with limited memory of prior turns. Playlist requests are detected by intent and short-circuited to return a real, tappable playlist rather than a generic text list — bridging the gap between "chatbot" and "functional feature."

---

## What I'd Add With More Time

- A real **database** to persist saved playlists and user preferences (currently everything is in-memory).
- **Conversation memory** and stronger topic-guarding for the AI guide, so it stays a focused music companion across a longer chat.
- Smoother animations and richer loading states to further mask cold-start latency.

---

## Architecture at a Glance

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│   Expo / React Native    │  HTTPS  │   Express API (Render)        │
│   ───────────────────    │ ──────► │   ──────────────────          │
│   • Home (grid / globe)  │         │   /api/playlist  → Spotify     │
│   • Year slider          │ ◄────── │                   + iTunes     │
│   • Playlist + previews  │  JSON   │   /api/chat      → Gemini      │
│   • AI chat assistant    │         │   /api/public-config → Mapbox  │
└─────────────────────────┘         └──────────────────────────────┘
     Keys stay on the server, never in the app bundle.
```

---

*Bing Beats — a personal project exploring how music maps onto place and time.*
