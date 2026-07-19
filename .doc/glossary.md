# Glossary

## Purpose
- Define canonical domain terms and approved short forms used across code, API routes, docs, and plans.

## Core Terms

- **Chat message**: a short text message sent by a player to the other players in the same multiplayer game session. Scoped to a single game (`GameStateView.chatMessages`); not persisted once the game/session is gone, and not visible to players outside that game. A chat message has a `kind` of `'message'` (typed by a player) or `'system'` (a server-generated announcement about a player - `event: 'joined' | 'left'` - not typed by anyone, but still carries that player's `playerId`/`playerName`/`colorIndex` so a client can tell whether the event was about itself, e.g. to pick a distinct sound).

## Naming Alignment
- If a new domain term is introduced, add it here before broad usage.

## Update Rules
- Add new terms when introducing a new bounded context, entity, or shared API concept.
- Avoid synonyms for existing terms unless explicitly approved and documented here.
