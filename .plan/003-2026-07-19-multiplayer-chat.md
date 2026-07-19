# Multiplayer In-Game Chat Plan

Status: draft
Owner: Anat Eliahu
Last updated: 2026-07-19

## Goal
Let players in the same multiplayer game send each other short text messages, visible to everyone in that game, per the updated `.doc/product-definition.md` ("In-game chat" in Product Scope).

## Scope
In scope:
- A chat panel visible once a player has joined a game: in the waiting room (`app/src/mp/WaitingRoom.tsx`) and during active play (`app/src/mp/MultiplayerGame.tsx`).
- Any connected, non-left player in that game can send a short text message; all players in the same game (including the sender) see it.
- Chat history for a game is visible to a player who reconnects within the existing 1-minute reconnect window (same session), since it rides on the same `game-state` broadcast as the rest of the game.
- Server-side validation: non-empty after trim, capped length, sender must be an authenticated player in that game who hasn't left.

Out of scope (per updated product definition):
- Chat persistence beyond the life of a game (no database, no history after all players leave).
- Chat between players who are not in the same game (no global/lobby chat, no DMs).
- Moderation/profanity filtering (explicitly accepted as an assumption for v1).
- Rate limiting / spam throttling (small, self-selected groups of up to 4 players; can be revisited if abused).

## Assumptions
- Chat rides the existing per-game WebSocket connection and the existing `game-state` broadcast — no new transport, no new server process, consistent with the "dependency-light" prioritization rule.
- Chat messages live in server memory as part of the in-memory `Game` record (`app/server/gameStore.ts`), same lifecycle as the rest of game state: created on `createGame`, discarded when the game/session is garbage-collected. No persistence layer is added.
- A capped, bounded message history (see Open Question 2) keeps memory and broadcast payload size bounded even in a long-running game.
- React's default text rendering (no `dangerouslySetInnerHTML`) is sufficient to prevent stored-XSS from chat text, per `.rule/security-rules.md` ("escape or encode output based on context").

## Open Questions
1. Where does chat history live in the protocol — embedded in `GameStateView` (broadcast on every state change, reusing the existing `game-state` message) vs. a separate `chat-message` server message appended client-side?
   - **Recommended: embed `chatMessages: ChatMessageView[]` in `GameStateView`.** Reuses the existing single-source-of-truth broadcast (`notifyChange` → re-serialize → send to all connections) instead of adding a second message stream and a second piece of client-side reducer logic. Simpler, and a reconnecting player automatically gets full history for free.
2. How much history to keep per game?
   - **Recommended: cap at the last 200 messages per game (drop oldest).** Bounds memory and payload size; 200 is generous for a short game session and avoids adding a "clear chat" affordance.
3. Can a player who has left (auto-removed by turn timeout) still send messages?
   - **Recommended: no.** Once `isLeft` is true they're already excluded from the turn order and board; block `send-chat-message` for them server-side the same way `roll`/`start-game` are blocked (via a domain check), so a removed player can't keep talking into a game they're no longer part of. Their prior messages remain visible in history.
4. Max message length?
   - **Recommended: 500 characters,** trimmed, rejected if empty after trim. Matches "short text messages" in the product definition and is generous for a casual in-game aside.
5. Should new chat messages produce a toast/notification (per `.rule/ui-rules.md`, `sonner` is the toast library)?
   - **Recommended: no toast.** The chat panel is persistently visible during both waiting-room and active play, so a toast would be redundant noise on top of an always-visible panel. Revisit only if the panel becomes collapsible on small screens.

## Steps
1. Extend `app/src/mp/protocol.ts`: add `ChatMessageView { id, playerId, playerName, colorIndex, text, sentAt }`; add `chatMessages: ChatMessageView[]` to `GameStateView`; add `{ type: 'send-chat-message'; gameId: string; playerId: string; text: string }` to `ClientMessage`.
2. Extend `app/server/gameStore.ts`: add `chatMessages` to the internal `Game` shape, initialize `[]` in `createGame`; add `postChatMessage(gameId, playerId, text)` that validates the sender exists and `!isLeft`, validates/trims text (reject empty or over the length cap), pushes a message (`randomUUID()`, `Date.now()`), trims the array to the last 200 entries, calls `notifyChange(game.id)`; include `chatMessages` in `serializeGame`.
3. Wire the new message type into `app/server/index.ts`: `case 'send-chat-message'`, gated by the existing `requireOwnIdentity` check (same pattern as `roll`/`start-game`), calling `postChatMessage`.
4. Extend `app/src/mp/useMultiplayerGame.ts`: add a `sendChatMessage(text: string)` callback mirroring `roll`/`startGame` (looks up `game`/`myPlayerId`, sends `send-chat-message`); no new local state needed since `chatMessages` arrives via the existing `game` state.
5. Build a `Chat` component (`app/src/mp/Chat.tsx` + `app/src/mp/chat.css`): scrollable message list (auto-scrolls to newest), sender name/color dot per message (reusing the `piece--{colorIndex}` color convention from `MultiplayerGame.tsx`), text input + send button (Enter to send, disabled while empty or over the length cap), hidden/disabled input if the current player `isLeft`.
6. Mount `Chat` in `WaitingRoom.tsx` and `MultiplayerGame.tsx`, passing `game.chatMessages`, `myPlayerId`, and the new `sendChatMessage` handler down from `Multiplayer.tsx`.
7. Add "Chat message" to `.doc/glossary.md` (new shared protocol/entity concept), per the glossary's update rule.
8. Add tests per `.rule/testing-rules.md` in `app/server/gameStore.test.ts`: happy path (message appears in `serializeGame().chatMessages` and triggers `notifyChange`), validation failures (empty/whitespace-only text, text over the length cap, unknown player, left player), and the 200-message cap (oldest dropped once exceeded).
9. Manual pass: open 2-4 browser tabs, join the same game, confirm messages sent from one tab appear in all tabs (waiting room and in-game), confirm a reconnecting player sees prior chat history, confirm a timed-out/removed player can no longer send.

## Validation
- Automated: new `gameStore.test.ts` cases for `postChatMessage` (happy path, validation, left-player rejection, history cap) pass alongside existing suite (`board.test.ts`, `gameLogic.test.ts`, existing `gameStore.test.ts` cases).
- Manual: multi-tab session as in Step 9 above — send/receive across players, reconnect-preserves-history, removed player can't send.
- Run the `verify` skill against the running app (client + server) before calling this done.

## Risks
- Embedding chat history in every `GameStateView` broadcast means every unrelated state change (a roll, a reconnect) also re-sends the full chat log — mitigated by the 200-message cap keeping payload size bounded; acceptable for a ≤4-player casual game.
- Chat text is untrusted user input rendered in the UI — must be rendered as plain text (React's default JSX text interpolation), never via `dangerouslySetInnerHTML`, to avoid stored XSS per `.rule/security-rules.md`.
- No moderation or rate limiting (accepted per the updated product-definition assumption) — a player could spam or send abusive text; acceptable for v1 since games are small and players chose to play together, but worth flagging if this ships beyond a casual/friends context.

## Rollout Order
1. Land protocol + server-side `postChatMessage` + tests first (no UI), matching plan 002's backend-first approach.
2. Add the client `sendChatMessage` hook wiring.
3. Add the `Chat` UI component and mount it in the waiting room and game view.
4. Ship as a single release alongside the existing multiplayer feature; no phased rollout.

## Rollback
- Revert the branch/commit. Chat is additive (new protocol fields/message type, new component, new server function) and doesn't change existing turn/roll/reconnect logic, so rollback doesn't affect the already-shipped multiplayer feature.
