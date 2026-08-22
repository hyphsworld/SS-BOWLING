# Super Strike — PRD

## Original Problem Statement
Build a mobile app named **Super Strike**, a bowling game where you use power-ups
to cause strikes. Reference: Baseball Simulator 1000 ("Ultra" plays).

## User Choices (verbatim)
- Controls: Tap timing meters (aim bar + power bar)
- Power-ups: Magnet/homing, Lightning/laser wipe, Giant/multi-ball, Explosive/bomb, Muscle arm
- Modes: Solo, Vs CPU, and user-to-user multiplayer
- Visual style: Bright modern cartoon, 3D-ish
- Power-ups are EARNED during gameplay via an energy meter

## Architecture
- **Frontend**: Expo Router (stack) + React Native Reanimated for the animated lane,
  ball physics-sim, and pin fall. Fonts: Fredoka (display) + Nunito (text).
- **Backend**: FastAPI + MongoDB. Stores players, scores (leaderboard/stats),
  and multiplayer rooms (turn/score sync via polling).
- **Game engine** (`src/game/engine.ts`): 10-pin knockdown simulation with chain
  reactions, standard bowling scoring, power-up overrides, energy economy.

## Personas
- Casual arcade player chasing high scores (solo).
- Competitive player challenging the CPU or friends (vs / multiplayer).

## Core Requirements (static)
- Tap-timing aim + power controls with a "pocket" skill zone.
- Five earnable power-ups with distinct effects and energy costs.
- Full 10-frame bowling with strikes/spares/10th-frame bonus.
- Solo, Vs CPU (alternating frames), and multiplayer (room code, score battle).
- Leaderboard + personal stats.

## Implemented (2026-08-22)
- Home / mode select with hero art.
- Animated bowling lane: perspective pins, rolling ball, power-up visual FX
  (magnet curve, giant ball, bomb/laser flash), pin-fall animation.
- Tap-timing meters (aim with pocket zone + power with sweet zone).
- Power-up tray + energy meter; 5 power-ups (magnet, giant, muscle, bomb, laser).
- 10-frame scorecard HUD (glassmorphic), live scoring.
- Solo mode, Vs CPU mode (CPU AI throws + uses power-ups), Multiplayer rooms.
- Post-game results w/ celebration, score submit, play again.
- Leaderboard (pull-to-refresh) + Profile stats + editable name.
- Backend: players, scores, leaderboard, stats, rooms (create/join/get/progress).

## Backlog / Remaining
- P1: Real-time turn-by-turn multiplayer (currently async score battle).
- P1: Sound effects & music.
- P2: More power-ups, cosmetics/ball skins, daily challenges.
- P2: Tournaments / friend lists.

## Next Tasks
- Gather user feedback on difficulty tuning of the knockdown model.
