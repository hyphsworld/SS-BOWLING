import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import { GLView, ExpoWebGLRenderingContext } from "expo-gl";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as THREE from "three";
import { PINS } from "@/src/game/engine";
import { PowerUpId } from "@/src/game/powerups";

export interface ThrowState {
  key: number;
  aim: number; // -1..1
  powerup: PowerUpId | null;
}

interface Props {
  standing: number[];
  throwState: ThrowState | null;
  knockdown: { key: number; pins: number[] } | null;
  onArrive?: () => void;
}

// ---- world constants ----
const WX = 0.5; // lane-x unit -> world x
const LANE_HALF = 1.0;
const PIN_FRONT_Z = -7.5;
const ROW_GAP = 0.5;
const BALL_R = 0.16;
const BALL_START_Z = 1.5;
const HOLD = 1300; // ms toppled pins stay down before rack refill
const AIM_SCALE = 1.6;
const POCKET_X = 0.28;
const PIN_SCALE = 1.18;
const PIN_HALF = 0.21 * PIN_SCALE; // pin center height above base
const GRAV = 7.0;

// realistic marbled ball colors (subtle neon accent emissive)
const BALL_COLORS: Record<string, number> = {
  magnet: 0x39ff9a,
  giant: 0xffd24a,
  muscle: 0xff5c7a,
  bomb: 0xff7a2a,
  lightning: 0x63e6ff,
  none: 0xff5a2a,
};

const REFLECT: Record<string, number> = { ...BALL_COLORS };

function pinWorld(id: number) {
  const p = PINS[id];
  return { x: p.x * WX, z: PIN_FRONT_Z - p.row * ROW_GAP };
}

// procedural wood-plank texture (works on native — no canvas needed)
function makeWoodTexture() {
  const w = 64;
  const h = 256;
  const data = new Uint8Array(w * h * 4);
  const planks = 5;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const plank = Math.floor(i / (w / planks));
      const inPlank = i % (w / planks);
      const seam = inPlank < 1.2 ? 0.55 : 1;
      const tone = 0.86 + ((plank * 37) % 10) / 60; // per-plank variation
      const grain =
        0.92 +
        0.06 * Math.sin(j * 0.25 + plank * 5) +
        0.05 * Math.sin(j * 1.7 + i) +
        (Math.random() - 0.5) * 0.05;
      const m = seam * tone * grain;
      const idx = (j * w + i) * 4;
      data[idx] = Math.min(255, 205 * m);
      data[idx + 1] = Math.min(255, 158 * m);
      data[idx + 2] = Math.min(255, 96 * m);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.needsUpdate = true;
  return tex;
}

// procedural neon graffiti texture for the alley walls (black bg = invisible under additive blend)
function makeGraffitiTexture() {
  const w = 256;
  const h = 128;
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 255;
  const palette = [
    [57, 255, 154],
    [99, 230, 255],
    [255, 92, 122],
    [255, 210, 74],
    [180, 90, 255],
    [34, 225, 255],
    [255, 120, 40],
  ];
  const add = (x: number, y: number, c: number[], k: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = (y * w + x) * 4;
    data[idx] = Math.min(255, data[idx] + c[0] * k);
    data[idx + 1] = Math.min(255, data[idx + 1] + c[1] * k);
    data[idx + 2] = Math.min(255, data[idx + 2] + c[2] * k);
  };
  const disc = (cx: number, cy: number, r: number, c: number[], k = 1) => {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d <= r) add(cx + x, cy + y, c, k * (1 - d / (r + 0.001)));
      }
  };
  const stroke = (x0: number, y0: number, x1: number, y1: number, th: number, c: number[]) => {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, th, c, 0.9);
    }
  };
  // random tags: streaks
  for (let i = 0; i < 16; i++) {
    const c = palette[Math.floor(Math.random() * palette.length)];
    const x0 = Math.random() * w;
    const y0 = Math.random() * h;
    const ang = Math.random() * Math.PI * 2;
    const len = 20 + Math.random() * 60;
    stroke(x0, y0, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len, 1 + Math.random() * 2, c);
  }
  // spray blobs + drips
  for (let i = 0; i < 12; i++) {
    const c = palette[Math.floor(Math.random() * palette.length)];
    const cx = Math.random() * w;
    const cy = Math.random() * h;
    disc(cx, cy, 4 + Math.random() * 7, c, 0.8);
    if (Math.random() < 0.6) stroke(cx, cy, cx, cy + 8 + Math.random() * 22, 1, c); // drip
  }
  // speckle
  for (let i = 0; i < 500; i++) {
    const c = palette[Math.floor(Math.random() * palette.length)];
    add(Math.random() * w, Math.random() * h, c, 0.5);
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.needsUpdate = true;
  return tex;
}

interface PinObj {
  id: number;
  group: THREE.Group;
  base: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  launching: boolean;
  fallen: boolean;
  delay: number;
  resetting: boolean;
  resetT: number;
  resetFromPos: THREE.Vector3;
  resetFromQuat: THREE.Quaternion;
}

export default function BowlingLane({ standing, throwState, knockdown, onArrive }: Props) {
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  const ballRef = useRef<THREE.Mesh | null>(null);
  const ballLightRef = useRef<THREE.PointLight | null>(null);
  const reflectRef = useRef<THREE.Mesh | null>(null);
  const pinsRef = useRef<PinObj[]>([]);
  const impactRef = useRef(new THREE.Vector3(0, 0, PIN_FRONT_Z));
  const shakeRef = useRef(0);

  const standingSetRef = useRef<Set<number>>(new Set(standing));
  const recentlyKnockedRef = useRef<Map<number, number>>(new Map());
  const onArriveRef = useRef<typeof onArrive>(onArrive);

  const throwAnim = useRef<{
    active: boolean;
    t: number;
    dur: number;
    aim: number;
    powerup: PowerUpId | null;
    arrived: boolean;
  }>({ active: false, t: 0, dur: 0.82, aim: 0, powerup: null, arrived: true });

  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const [flashColor, setFlashColor] = useState<string>("#7FE9FF");

  useEffect(() => {
    onArriveRef.current = onArrive;
  }, [onArrive]);

  useEffect(() => {
    standingSetRef.current = new Set(standing);
  }, [standing]);

  useEffect(() => {
    if (!throwState) return;
    const a = throwAnim.current;
    a.active = true;
    a.arrived = false;
    a.t = 0;
    a.aim = throwState.aim;
    a.powerup = throwState.powerup;
    a.dur = throwState.powerup === "muscle" ? 0.56 : 0.82;
    if (ballRef.current) {
      const mat = ballRef.current.material as THREE.MeshStandardMaterial;
      const col = BALL_COLORS[throwState.powerup ?? "none"];
      mat.color.setHex(col);
      mat.emissive.setHex(col);
      if (ballLightRef.current) ballLightRef.current.color.setHex(col);
      ballRef.current.visible = true;
      if (reflectRef.current) {
        (reflectRef.current.material as THREE.MeshBasicMaterial).color.setHex(
          REFLECT[throwState.powerup ?? "none"],
        );
        reflectRef.current.visible = true;
      }
    }
    if (throwState.powerup === "bomb" || throwState.powerup === "lightning") {
      setFlashColor(throwState.powerup === "bomb" ? "#FFB35C" : "#BFF3FF");
      flash.value = withDelay(
        a.dur * 1000 - 60,
        withSequence(withTiming(0.8, { duration: 80 }), withTiming(0, { duration: 420 })),
      );
    }
  }, [throwState?.key]);

  // launch knocked pins ballistically
  useEffect(() => {
    if (!knockdown) return;
    const now = globalThis.performance ? performance.now() : Date.now();
    const impact = impactRef.current;
    const pu = throwAnim.current.powerup;
    const powerScale = pu === "bomb" ? 1.7 : pu === "muscle" || pu === "lightning" ? 1.4 : 1;
    knockdown.pins.forEach((id) => {
      recentlyKnockedRef.current.set(id, now);
      const pin = pinsRef.current.find((p) => p.id === id);
      if (!pin || pin.launching || pin.fallen) return;
      const dir = new THREE.Vector3().subVectors(pin.base, impact);
      dir.y = 0;
      if (dir.lengthSq() < 0.001) dir.set(Math.random() - 0.5, 0, -0.5);
      dir.normalize();
      // spread
      const spread = (Math.random() - 0.5) * 0.9;
      const c = Math.cos(spread);
      const s = Math.sin(spread);
      const dx = dir.x * c - dir.z * s;
      const dz = dir.x * s + dir.z * c;
      const dist = Math.max(0.3, pin.base.distanceTo(impact));
      const speed = (2.4 + Math.random() * 1.8) * powerScale;
      pin.vel.set(dx * speed, 1.6 + Math.random() * 1.8, dz * speed);
      pin.ang.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 16,
      );
      pin.delay = Math.min(0.25, dist * 0.03) + Math.random() * 0.03;
      pin.pos.copy(pin.base);
      pin.launching = true;
      pin.resetting = false;
    });
    // camera shake on impact
    shakeRef.current = pu === "bomb" ? 0.28 : 0.18;
  }, [knockdown?.key]);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    glRef.current = gl;
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    const renderer = new THREE.WebGLRenderer({
      canvas: {
        width,
        height,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        clientWidth: width,
        clientHeight: height,
        getContext: () => gl,
      } as any,
      context: gl as any,
      antialias: true,
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x05060a, 1);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05060a, 7, 14);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 100);
    camera.position.set(0, 0.62, 2.4);
    camera.lookAt(0, 0.34, -7.5);
    cameraRef.current = camera;

    // ---- lighting (warm alley) ----
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x1a1206, 0.7);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff2d8, 1.1);
    key.position.set(1.5, 4, 2);
    scene.add(key);
    const deckLight = new THREE.PointLight(0xffffff, 2.2, 9);
    deckLight.position.set(0, 2.4, PIN_FRONT_Z - ROW_GAP * 1.5);
    scene.add(deckLight);
    // subtle neon accent lights
    const neonA = new THREE.PointLight(0x22e1ff, 0.8, 12);
    neonA.position.set(-1.8, 1.6, -3);
    scene.add(neonA);
    const neonB = new THREE.PointLight(0x8a4bff, 0.7, 12);
    neonB.position.set(1.8, 1.6, -5);
    scene.add(neonB);

    const laneLen = BALL_START_Z - (PIN_FRONT_Z - ROW_GAP * 3 - 0.8);
    const laneCz = (BALL_START_Z + (PIN_FRONT_Z - ROW_GAP * 3 - 0.8)) / 2;

    // ---- glossy wood lane ----
    const wood = makeWoodTexture();
    const laneMat = new THREE.MeshStandardMaterial({
      map: wood,
      color: 0xffffff,
      roughness: 0.18,
      metalness: 0.35,
    });
    const lane = new THREE.Mesh(new THREE.BoxGeometry(LANE_HALF * 2, 0.1, laneLen), laneMat);
    lane.position.set(0, -0.05, laneCz);
    scene.add(lane);
    // glossy sheen strip down the lane (additive highlight)
    const sheen = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_HALF * 0.9, laneLen),
      new THREE.MeshBasicMaterial({
        color: 0xfff3d0,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sheen.rotation.x = -Math.PI / 2;
    sheen.position.set(0, 0.011, laneCz);
    scene.add(sheen);

    // gutters
    const gutMat = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.6, metalness: 0.5 });
    [-1, 1].forEach((sd) => {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, laneLen), gutMat);
      g.position.set(sd * (LANE_HALF + 0.11), -0.1, laneCz);
      scene.add(g);
    });

    // ---- metal alley side walls ----
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      roughness: 0.45,
      metalness: 0.85,
    });
    const graffiti = makeGraffitiTexture();
    [-1, 1].forEach((sd) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, laneLen), metalMat);
      wall.position.set(sd * (LANE_HALF + 0.28), 1.0, laneCz);
      scene.add(wall);
      // neon graffiti on the inner wall face (additive glow over metal)
      const graf = new THREE.Mesh(
        new THREE.PlaneGeometry(laneLen, 2.1),
        new THREE.MeshBasicMaterial({
          map: graffiti,
          transparent: true,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.95,
        }),
      );
      graf.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
      graf.position.set(sd * (LANE_HALF + 0.2), 1.05, laneCz);
      scene.add(graf);
      // subtle neon accent strip along top of wall
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, laneLen),
        new THREE.MeshBasicMaterial({ color: 0x22e1ff }),
      );
      strip.position.set(sd * (LANE_HALF + 0.2), 2.05, laneCz);
      scene.add(strip);
    });

    // ---- pin pit + back ----
    const pitZ = PIN_FRONT_Z - ROW_GAP * 3 - 0.55;
    const pit = new THREE.Mesh(
      new THREE.BoxGeometry(LANE_HALF * 2.2, 1.2, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.9 }),
    );
    pit.position.set(0, 0.2, pitZ);
    scene.add(pit);
    const backWall = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 3),
      new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.6, metalness: 0.5 }),
    );
    backWall.position.set(0, 1.0, pitZ - 0.5);
    scene.add(backWall);
    const neonH = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.04, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x22e1ff }),
    );
    neonH.position.set(0, 1.7, pitZ - 0.48);
    scene.add(neonH);

    // aiming chevrons on the lane
    [-0.55, -0.2, 0.2, 0.55].forEach((ax) => {
      const tri = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.14, 3),
        new THREE.MeshStandardMaterial({ color: 0x2a2118, emissive: 0x1a1206, roughness: 0.5 }),
      );
      tri.rotation.x = -Math.PI / 2;
      tri.position.set(ax * LANE_HALF, 0.02, -2.6);
      scene.add(tri);
    });

    // ---- pins (white body + red rings) ----
    const pinPts: THREE.Vector2[] = [
      new THREE.Vector2(0.001, 0.0),
      new THREE.Vector2(0.05, 0.0),
      new THREE.Vector2(0.057, 0.04),
      new THREE.Vector2(0.048, 0.11),
      new THREE.Vector2(0.078, 0.18),
      new THREE.Vector2(0.052, 0.27),
      new THREE.Vector2(0.03, 0.32),
      new THREE.Vector2(0.046, 0.37),
      new THREE.Vector2(0.036, 0.41),
      new THREE.Vector2(0.001, 0.42),
    ];
    const pinGeo = new THREE.LatheGeometry(pinPts, 22);
    pinGeo.translate(0, -0.21, 0); // center pivot
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x334455,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.05,
    });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xd42a2a, roughness: 0.3 });
    pinsRef.current = [];
    Object.keys(PINS).forEach((k) => {
      const id = Number(k);
      const w = pinWorld(id);
      const group = new THREE.Group();
      const body = new THREE.Mesh(pinGeo, bodyMat.clone());
      group.add(body);
      // two red rings near the neck (relative to centered geometry)
      [0.09, 0.03].forEach((ry) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 22), redMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = ry;
        group.add(ring);
      });
      group.position.set(w.x, PIN_HALF, w.z);
      group.scale.setScalar(PIN_SCALE);
      scene.add(group);
      pinsRef.current.push({
        id,
        group,
        base: new THREE.Vector3(w.x, PIN_HALF, w.z),
        pos: new THREE.Vector3(w.x, PIN_HALF, w.z),
        vel: new THREE.Vector3(),
        ang: new THREE.Vector3(),
        launching: false,
        fallen: false,
        delay: 0,
        resetting: false,
        resetT: 0,
        resetFromPos: new THREE.Vector3(),
        resetFromQuat: new THREE.Quaternion(),
      });
    });

    // ---- ball (glossy marbled, subtle glow) ----
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xff5a2a,
      emissive: 0xff5a2a,
      emissiveIntensity: 0.28,
      roughness: 0.12,
      metalness: 0.4,
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 32), ballMat);
    ball.position.set(0, BALL_R, BALL_START_Z);
    ball.visible = false;
    scene.add(ball);
    ballRef.current = ball;
    const bl = new THREE.PointLight(0xff5a2a, 0.9, 3.5);
    ball.add(bl);
    ballLightRef.current = bl;
    // reflection smear on the glossy lane
    const reflect = new THREE.Mesh(
      new THREE.CircleGeometry(BALL_R * 1.3, 20),
      new THREE.MeshBasicMaterial({
        color: 0xff5a2a,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    reflect.rotation.x = -Math.PI / 2;
    reflect.visible = false;
    scene.add(reflect);
    reflectRef.current = reflect;

    lastRef.current = globalThis.performance ? performance.now() : Date.now();
    const tmpQ = new THREE.Quaternion();
    const tmpAxis = new THREE.Vector3();

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const now = globalThis.performance ? performance.now() : Date.now();
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;

      // ---- ball roll ----
      const a = throwAnim.current;
      const b = ballRef.current!;
      let camDz = 0;
      let camDy = 0;
      if (a.active) {
        a.t += dt / a.dur;
        const t = Math.min(1, a.t);
        const eased = t * t;
        const isMagnet = a.powerup === "magnet";
        const isGiant = a.powerup === "giant";
        const targetX = isMagnet ? POCKET_X * WX : a.aim * AIM_SCALE * WX;
        let x = targetX * t;
        if (isMagnet) x += Math.sin(t * Math.PI) * 0.35;
        const z = BALL_START_Z + (PIN_FRONT_Z - BALL_START_Z) * eased;
        const sc = isGiant ? 1.7 : 1;
        b.scale.setScalar(sc);
        b.position.set(x, BALL_R * sc, z);
        b.rotation.x -= dt * 24;
        // reflection smear follows ball
        const rf = reflectRef.current!;
        rf.position.set(x, 0.012, z);
        rf.scale.setScalar(sc);
        (rf.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - t * 0.5);
        // whoosh dolly
        camDz = -0.55 * Math.sin(Math.PI * t);
        camDy = -0.06 * Math.sin(Math.PI * t);
        if (t >= 1 && !a.arrived) {
          a.arrived = true;
          a.active = false;
          b.visible = false;
          rf.visible = false;
          impactRef.current.set(x, 0, PIN_FRONT_Z);
          onArriveRef.current && onArriveRef.current();
        }
      }

      // ---- camera shake + whoosh ----
      shakeRef.current *= Math.exp(-dt * 7);
      const sh = shakeRef.current;
      const cam = cameraRef.current!;
      cam.position.set(
        (Math.random() - 0.5) * sh,
        0.62 + camDy + (Math.random() - 0.5) * sh,
        2.4 + camDz,
      );
      cam.lookAt((Math.random() - 0.5) * sh * 0.5, 0.34, -7.5);

      // ---- pins ----
      const standingSet = standingSetRef.current;
      const rk = recentlyKnockedRef.current;
      for (const p of pinsRef.current) {
        const up = standingSet.has(p.id);
        const kt = rk.get(p.id);

        if (p.launching) {
          if (p.delay > 0) {
            p.delay -= dt;
          } else {
            p.vel.y -= GRAV * dt;
            p.pos.addScaledVector(p.vel, dt);
            // floor bounce
            if (p.pos.y < 0.05) {
              p.pos.y = 0.05;
              p.vel.y = -p.vel.y * 0.35;
              p.vel.x *= 0.72;
              p.vel.z *= 0.72;
              p.ang.multiplyScalar(0.7);
            }
            // integrate spin
            const angMag = p.ang.length();
            if (angMag > 0.0001) {
              tmpAxis.copy(p.ang).normalize();
              tmpQ.setFromAxisAngle(tmpAxis, angMag * dt);
              p.group.quaternion.premultiply(tmpQ);
            }
            p.group.position.copy(p.pos);
            // settle
            if (
              p.pos.y <= 0.06 &&
              p.vel.lengthSq() < 0.25 &&
              angMag < 1.2
            ) {
              p.launching = false;
              p.fallen = true;
              p.vel.set(0, 0, 0);
              p.ang.set(0, 0, 0);
            }
          }
          continue;
        }

        // reset (rack refill) after hold
        if (p.fallen && up && kt !== undefined && now - kt > HOLD && !p.resetting) {
          p.resetting = true;
          p.resetT = 0;
          p.resetFromPos.copy(p.group.position);
          p.resetFromQuat.copy(p.group.quaternion);
        }
        if (p.resetting) {
          p.resetT = Math.min(1, p.resetT + dt * 3);
          const e = 1 - Math.pow(1 - p.resetT, 3);
          p.group.position.lerpVectors(p.resetFromPos, p.base, e);
          p.group.quaternion.copy(p.resetFromQuat).slerp(new THREE.Quaternion(), e);
          if (p.resetT >= 1) {
            p.resetting = false;
            p.fallen = false;
            p.pos.copy(p.base);
            p.group.position.copy(p.base);
            p.group.quaternion.identity();
          }
          continue;
        }

        // idle standing
        if (!p.fallen) {
          p.group.position.copy(p.base);
          p.group.quaternion.identity();
        }
      }

      renderer.render(scene, cameraRef.current!);
      // @ts-ignore
      if (gl.endFrameEXP) gl.endFrameEXP();
    };
    animate();
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const scene = sceneRef.current;
      if (scene) {
        scene.traverse((o: any) => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose?.());
            else o.material.dispose?.();
          }
        });
      }
      rendererRef.current?.dispose?.();
    };
  }, []);

  return (
    <View style={styles.container}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: flashColor }, flashStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden", backgroundColor: "#05060a" },
});
