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
- **First-person 3D lane view (v2)**: perspective wood lane receding into a dark
  alley, pins standing in a dark pin-pit at the far end, neon back-wall accent,
  ball rolls away from viewer scaling down with distance, aiming arrows.
- Dark gameplay HUD: dark 10-frame scorecard with orange frame numbers + dark
  score pills; celebration overlay (STRIKE/SPARE with animated stars, GUTTER).
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

## Implemented (2026-08-27b) — Coach Voice, Rivalry, Strike Cam, Ball Skins
- **Coach Voice**: `expo-speech` reads Coach Luna's tips aloud (respects the sound
  mute toggle). Auto-speaks the Results tip + speaker buttons on Results
  (`coach-speak-button`) and each chat reply ("Hear it"). `src/audio/speech.ts`.
- **Rivalry Mode**: persistent CPU rival with a name + win/loss memory
  (`src/store/rival.ts`, AsyncStorage). Vs CPU shows the rival's name; `/api/ai/quip`
  now takes rival_name/cpu_wins/player_wins/last_result so the trash-talk references
  the rivalry. Result recorded after each Vs CPU game.
- **Strike Cam**: on a strike (all 10 pins in one throw), the 3D camera does a
  slow-mo cinematic zoom into the pin deck (`cinematicRef` + physicsDt slow-mo in
  BowlingLane loop).
- **Ball Skins**: `/skins` screen (`app/skins.tsx`) to pick/unlock glossy 3D ball
  styles — Classic (default), Chrome (3 games), Galaxy (score 120+), Neon (5 strikes).
  Selection persists (`src/game/skins.ts`) and applies to the in-game ball material
  (skin used when no power-up is armed). Home "Ball Skins" button.
- Verified iteration 6: backend 20/20 (incl. rivalry quip test), all game/results/
  coach/skins flows pass, zero console errors.


- **OpenAI GPT-5.6 Luna** via `emergentintegrations` + `EMERGENT_LLM_KEY` (backend/.env).
  Backend endpoints in `server.py`:
  - `POST /api/ai/quip` — witty commentator OR cocky CPU trash-talk one-liners.
  - `POST /api/ai/coach` — 1-2 sentence coaching tip from game stats.
  - `POST /api/ai/chat` + `GET /api/ai/chat/{session_id}` — "Coach Luna" chat,
    history persisted in `ai_chats` collection. All have graceful fallbacks.
- **Frontend AI**: live commentator quip banner + CPU banter in `game.tsx`;
  "Coach Luna says" tip card on `results.tsx`; new `/coach` chat screen
  (`app/coach.tsx`) with suggestion chips + `react-native-keyboard-controller`;
  Home "Ask Coach Luna" button. API in `src/api/client.ts` (aiQuip/aiCoach/aiChat).
- **Realistic wood alley + subtle neon** (BowlingLane rewrite): glossy procedural
  wood-plank lane (DataTexture) with ball reflection smear, metal side walls,
  white pins w/ red rings, pin pit, subtle neon accent strips.
- **Neon graffiti** on both alley walls (procedural additive-blend DataTexture).
- **Ballistic pin physics** (fly/tumble/bounce/settle), camera shake + whoosh dolly,
  upgraded STRIKE/SPARE star-burst Celebration.
- Verified iteration 5: backend 19/19 (12 core + 7 AI), all game/results/coach flows
  pass with live GPT responses, zero console errors.
- Backlog note: replace Fredoka.ttf (decode warning) + migrate deprecated RN-Web style props.


- **True 3D lane** via `three.js` + `expo-gl` (GLView) — replaced the View-based
  fake-3D `BowlingLane.tsx`. First-person camera, real perspective, fog depth.
  - 3D neon lane (emissive edges, grid rungs, center line, 3D chevron arrows),
    dark gutters, back wall with neon horizon + accents.
  - 3D bowling pins (LatheGeometry profile + glowing neon rings) that physically
    topple (axis-angle rotation, slide, spin) and pop back up on rack refill.
  - Glowing energy-core ball (emissive + attached PointLight) that rolls down the
    lane (rotates), scales up for Giant, curves for Magnet.
  - GPU particle burst (THREE.Points, additive) on impact; screen flash for Bomb/Laser.
  - Neon spotlight on pin deck; cyan/purple point lights for cyber ambiance.
- **New `knockdown` prop** (game.tsx passes `res.knocked`) so strikes visibly
  topple pins before the engine's instant rack-reset (HOLD window).
- three@0.185, expo-gl@16 installed. Verified iteration 3: backend 12/12, solo +
  vs-cpu + power-ups + results flows pass, app boots with three.js, zero JS errors.
- Note: WebGL 3D best on a published build; validated on web preview.


- **Arcade sound effects** (`expo-audio`): synthesized WAV SFX in `assets/sounds/`
  (ball roll, pin crash, strike, spare, gutter, power-up zap, lock blip, tap, win).
  Sound manager `src/audio/sounds.ts` (imperative players, preloaded, mute persisted
  to AsyncStorage). Wired into throws, impacts, celebration, meter locks, power-up
  arming, and results. Global init in `_layout.tsx`.
- **Sound on/off toggle** (`src/components/SoundToggle.tsx`) on home top bar + game HUD.
- **Futuristic neon 3D lane** (rewrote `BowlingLane.tsx`): deep-space gradient, neon
  cyan lane edges (rotated glow lines), perspective floor-grid rungs, glowing horizon,
  back-wall grid accents, neon-haloed pins (cyan/purple stripes), energy-core glowing
  ball with motion-trail echo.
- **Advanced power-up FX**: particle burst on impact (count/spread scale by power-up),
  shockwave ring, explosion core, magnet field rings orbiting the ball, faster
  throw + trail for muscle, colored flash for bomb/laser.
- **Cohesive dark HUD**: dark/neon restyle of control panel, TimingMeters, PowerUpTray.
- Verified: testing agent iteration 2 — backend 12/12, solo + vs-cpu + results flows
  pass, no runtime regressions from audio/lane changes.
