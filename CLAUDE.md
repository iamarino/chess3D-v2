# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — Next.js dev server only (no multiplayer relay; WebSocket connections to `/ws` will fail).
- `npm run dev:online` — dev server *with* the multiplayer relay, via `node server.js` (custom http+ws server wrapping Next). Use this when testing online play.
- `npm run build` / `npm start` — production build / start (no relay).
- `npm run start:online` — production start with the relay (`NODE_ENV=production node server.js`).
- `npm run lint` — ESLint (flat config: `eslint-config-next` core-web-vitals + typescript).
- No test runner is configured in this repo.

## Code comments

All code comments must be written in Portuguese (pt-BR), regardless of the language used elsewhere in the file.

## Animated pieces

Pieces with a rigged walk clip (today only the hero pawn) move by **root motion**:
the board position is derived from the clip's own forward displacement rather
than tweened alongside it, so the feet never slide and the piece stops dead
centre on the destination square with no correction step. Any change to how a
piece moves between squares — and adding a walk animation to a new piece —
must follow **[docs/animacao-de-pecas.md](docs/animacao-de-pecas.md)**, which
documents the mechanism, the recipe, and the invariants that keep it correct.
`scripts/analisar-caminhada.mjs` measures a `.glb`'s stride and footfalls and
prints the `MODEL_CONFIGS` entry to paste.

## Architecture

This is a Next.js App Router app rendering a 3D chess board (`@react-three/fiber` / `three`), with optional online 2-player multiplayer over WebSockets. The code is layered so that chess rules, visual presentation, and networking never talk to each other directly:

- **`src/core/chess/ChessEngine.ts`** — wraps `chess.js`, translating its board-by-square model into stable piece ids (`piece-N`) so the visual layer can animate a piece moving instead of unmounting/remounting it. `PieceColor` in this codebase is `'hero' | 'villain'`, not `'white' | 'black'` — this naming is used consistently everywhere, including the theme system, network payloads, and camera framing.
- **`src/core/game/GameManager.ts`** — the only object the visual layer is allowed to talk to for game logic. Owns a `ChessEngine` and an `EventManager`, handles square-selection/move/promotion flow, and emits high-level events (`piece-moved`, `piece-captured`, `check`, `checkmate`, `turn-changed`, `state-reset`, etc). Has an `applyRemoteMove` path that bypasses local turn/color gating, used to replay moves that already happened on the opponent's client.
- **`src/core/game/EventManager.ts`** — minimal typed pub/sub used by both `GameManager` and `NetworkManager` to decouple producers from consumers.
- **`src/network/NetworkManager.ts`** — thin WebSocket client. Knows nothing about chess; it just creates/joins a room and ferries opaque `move` payloads. Pairs with `server.js` on the backend.
- **`server.js`** — custom server combining Next's request handler with a `ws` `WebSocketServer` mounted on `noServer: true` and manually routed by pathname (`/ws`), specifically so it doesn't swallow Next's own HMR upgrade requests in dev. Rooms are an in-memory `Map` keyed by a 5-character code (host/guest sockets); the server only relays `move` messages between the two peers in a room — it does not validate chess rules or game state, the clients are authoritative.
- **`src/store/*.ts`** (zustand) — the bridge between the manager/engine classes above and React. Each store instantiates or imports a manager singleton, subscribes to its events in the store initializer, and mirrors state into zustand so components can select from it reactively. `useGameStore` wraps `GameManager`, `useNetworkStore` wraps the `networkManager` singleton from `NetworkManager.ts`. `useSettingsStore` is persisted to `localStorage` (`chess3d-settings`) and also defines `QUALITY_PRESETS`, which drive renderer settings (DPR, shadows, particle counts) read by the three.js layer. `useUIStore` is plain UI open/close state (menus, lobby).
- **`src/components/NetworkBridge.tsx`** — the glue component (mounted once in `page.tsx`) that wires `GameManager` events to `NetworkManager` and back: local moves get sent when a match is active, remote moves get replayed through `applyRemoteMove`, and starting a match resets the board and sets `localPlayerColor` to gate local input to the player's own turn.
- **`src/three/`** — the `@react-three/fiber` scene graph: `Scene.tsx` is the `<Canvas>` root (reads `useGameStore`/`useSettingsStore` for pieces and quality presets), `CameraDirector.tsx` drives cinematic camera moves off `GameManager` events (capture/check/checkmate/reset) via `CameraManager.ts`, `Board`/`BoardBase`/`Piece`/`Environment`/`effects/*` render the board, pieces (GLB models loaded via `ModelLoader.ts` from `public/models/`), and particle/aura effects. Villain-side players get a mirrored camera "home" so each player sees their own back rank at the bottom.
- **`src/themes/`** — visual theming (colors, board square schemes, per-piece model URLs), decoupled from game logic (`ChessTheme` in `ThemeDefinition.ts`). Currently only one theme (`heroes-villains`) is wired up in `Scene.tsx`.
- **Path alias**: `@/*` maps to `src/*` (see `tsconfig.json`).
