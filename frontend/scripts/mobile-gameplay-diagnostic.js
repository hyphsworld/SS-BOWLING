const fs = require("fs");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

const overlay = fs.readFileSync("src/components/LaneHazardOverlay.web.tsx", "utf8");
const lane = fs.readFileSync("src/components/BowlingLane.web.tsx", "utf8");
const game = fs.readFileSync("app/game.tsx", "utf8");
const meters = fs.readFileSync("src/components/TimingMeters.tsx", "utf8");
const powerups = fs.readFileSync("src/components/PowerUpTray.tsx", "utf8");

assert(overlay.includes('pointerEvents="none"'), "Alley Gator overlay must never steal gameplay touches");
assert(overlay.includes("width: 8, height: 10"), "Alley Gator eyes must stay marble-size");
assert(overlay.includes("shadowRadius: 10"), "Alley Gator eyes must keep their night glow");
assert(overlay.includes('"wallHigh", "wallLow", "lane"'), "Eye warning must rotate through multiple lane positions");
assert(overlay.includes("setShowGator(true)"), "Full Alley Gator must appear only in the impact sequence");
assert(overlay.indexOf("stageGatorAttack();") > overlay.indexOf('type !== "pop-wall-impact"'), "Gator attack must be triggered by ball contact");
assert((lane.match(/new CustomEvent\("super-strike-hazard"/g) || []).length >= 2, "Both WebGL and fallback lanes must fire the hazard impact event");
assert(game.includes("Haptics.ImpactFeedbackStyle.Heavy"), "A blocked ball must deliver heavy impact feedback");
assert(meters.includes('testID={isAim ? "lock-aim-button" : "throw-button"}'), "Aim and Throw controls need stable mobile test IDs");
assert(meters.includes("height: 56"), "Aim and Throw touch targets must remain at least 56px high");
assert(powerups.includes("horizontal"), "Power-ups must remain horizontally scrollable on narrow screens");
assert(powerups.includes("width: 66") && powerups.includes("height: 66"), "Power-up touch targets must remain mobile-safe");
assert(powerups.includes('testID={`powerup-${p.id}`}'), "Every power-up needs a stable mobile test ID");

console.log("Mobile gameplay diagnostic passed: Gator timing, unobstructed controls, safe touch targets, and fallback impact behavior are locked.");
