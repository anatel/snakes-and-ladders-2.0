# Snakes and Ladders MVP Plan

Status: active
Owner: Anat Eliahu
Last updated: 2026-07-16

## Goal
Ship a playable, visually polished, responsive Snakes and Ladders web game: single-player vs. computer, with a dice-roll interaction that plays a sound on every throw, per `.doc/product-definition.md`.

## Scope
In scope for this plan (first slice of the product):
- 10x10 classic board (100 squares) with a fixed, classic set of snakes and ladders.
- Player vs. computer play mode only.
- Turn flow: current player triggers the die -> die animates and rolls a number 1-6 -> dice-throw sound plays -> piece moves square by square -> snake/ladder resolves with a visual slide -> turn passes.
- Win condition: first to land exactly on square 100 wins; clear end-of-game message with a "Play again" action.
- Responsive layout (mobile portrait through desktop).
- Visual polish: styled board/pieces/snakes/ladders/dice, consistent with `.rule/style-rules.md` and `.rule/ui-rules.md`.
- New React + Vite + TypeScript frontend project (no backend, no database - all game state is client-side).

Out of scope (deferred, per product definition):
- Human vs. human / multiplayer.
- Accounts, persistent stats, leaderboards.
- Board/theme customization, difficulty levels.
- Hosting/deployment to a public host (local/dev only for this plan; a free-tier host is a likely future step).

## Assumptions
- Build as a client-only React + Vite + TypeScript app (matches `.rule/ui-rules.md` libraries: `lucide-react`, `sonner`); follow `.rule/coding-rules.md` (no trailing semicolons in `.ts`/`.tsx`).
- Computer opponent just rolls and moves automatically after a short delay - no strategy needed, since Snakes and Ladders has no player decisions.
- Use a single royalty-free dice-roll sound effect bundled as a static asset, played via an `HTMLAudioElement` on user-triggered roll (satisfies browser autoplay policies since it's a user gesture).
- Classic fixed board (same snakes/ladders every game) for this slice; randomized/custom board layout deferred.

## Open Questions
1. ~~Tech stack~~ - **Decided: React + Vite, with TypeScript.**
2. ~~Board layout~~ - **Decided: classic 10x10 (100 squares), standard boustrophedon numbering, fixed classic set of snakes and ladders.**
3. ~~Dice sound asset~~ - **Decided: source a free CC0 dice-roll clip, bundled as a static asset.**
4. ~~Repo location~~ - **Decided: new `app/` directory at root, with the standard Vite scaffold split into subfolders (`app/src/`, `app/public/`, etc.).**
5. ~~Deployment target~~ - **Decided: local/dev only for this plan; hosting on a free tier (e.g. Vercel/Netlify) is a future step, out of scope here.**

## Steps
1. Scaffold a React + Vite + TypeScript project in `app/` (`app/src/`, `app/public/`, etc.) with the CSS structure from `.rule/style-rules.md` (`main.css` importing `setup`, `basics`, `cmps`).
2. Build the board component: render 100 squares in the classic boustrophedon (snake-path) layout, responsive grid.
3. Add the snake/ladder data model and rendering (visual overlays connecting start/end squares).
4. Implement the turn state machine: `player-turn -> rolling -> moving -> resolve-snake-or-ladder -> check-win -> next-turn`.
5. Build the Dice component: visible die, tap/click to roll, roll animation, plays the dice-throw sound on trigger.
6. Implement computer-turn logic: auto-roll after a short delay, same move/resolve pipeline as the player.
7. Implement the win/lose end screen with "Play again" (reset state), using `sonner` for the win/lose toast per `.rule/ui-rules.md`.
8. Apply responsive styling and visual polish (board, pieces, dice, snakes, ladders) per `.rule/style-rules.md`.
9. Add tests per `.rule/testing-rules.md`: dice roll -> move logic, snake/ladder resolution, win detection, computer-turn flow (mock randomness/time per the reliability rules).
10. Manual pass: verify on mobile and desktop viewport sizes; verify the dice sound fires on every roll.

## Validation
- Automated: unit tests for movement/resolution/win logic pass; randomness and timers mocked/frozen per `.rule/testing-rules.md`.
- Manual: play a full game to completion against the computer on desktop and mobile viewport sizes; confirm the dice sound plays on every roll; confirm layout doesn't break at common breakpoints.
- Run the `verify` skill against the running app before calling this done.

## Risks
- Browser autoplay restrictions could silently block the dice sound if it isn't triggered directly by a user gesture - mitigate by playing the sound synchronously inside the roll click/tap handler.
- Square-by-square movement animation timing can get fiddly with rapid re-rolls - mitigate by disabling the die while a move/animation is in progress.
- A 100-square responsive grid can get tight on small phone screens - mitigate with a scaled-down square size or scroll container on narrow viewports.

## Rollout Order
1. Land the project scaffold and a static board render first (no game logic), so the visual direction can be checked early.
2. Add turn/dice/movement logic behind the static board.
3. Add sound and animation polish last, once the core loop works.
4. Ship as a single release, running locally (`npm run dev`/`build`); no phased user rollout needed (client-only, no backend). Deploying to a free host is a future step, out of scope here.

## Rollback
- Client-only static app: rollback is reverting the branch/commit and redeploying the previous build (or taking the page down) - no data migration or backend state to unwind.
