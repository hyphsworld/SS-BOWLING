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
const HOLD = 1200; // ms toppled pins stay down before rack refill
const AIM_SCALE = 1.6;
const POCKET_X = 0.28;

const BALL_COLORS: Record<string, number> = {
  magnet: 0x39ff9a,
  giant: 0xffd24a,
  muscle: 0xff5c7a,
  bomb: 0xff7a2a,
  lightning: 0x63e6ff,
  none: 0x59d6ff,
};

const PARTICLES = 70;

function pinWorld(id: number) {
  const p = PINS[id];
  return { x: p.x * WX, z: PIN_FRONT_Z - p.row * ROW_GAP };
}

// bowling-pin lathe profile (radius, height)
function makePinGeometry() {
  const pts: THREE.Vector2[] = [
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
  return new THREE.LatheGeometry(pts, 20);
}

export default function BowlingLane({ standing, throwState, knockdown, onArrive }: Props) {
  // shared refs to imperative three objects
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);

  const ballRef = useRef<THREE.Mesh | null>(null);
  const ballLightRef = useRef<THREE.PointLight | null>(null);
  const pinsRef = useRef<
    {
      id: number;
      group: THREE.Group;
      base: THREE.Vector3;
      axis: THREE.Vector3;
      fallDir: THREE.Vector3;
      spin: number;
      progress: number;
    }[]
  >([]);

  const particleRef = useRef<{
    points: THREE.Points;
    pos: Float32Array;
    vel: Float32Array;
    life: number;
    mat: THREE.PointsMaterial;
  } | null>(null);

  const standingSetRef = useRef<Set<number>>(new Set(standing));
  const recentlyKnockedRef = useRef<Map<number, number>>(new Map());
  const onArriveRef = useRef<typeof onArrive>(onArrive);

  const throwAnim = useRef<{
    active: boolean;
    t: number;
    dur: number; // seconds
    aim: number;
    powerup: PowerUpId | null;
    arrived: boolean;
  }>({ active: false, t: 0, dur: 0.82, aim: 0, powerup: null, arrived: true });

  // reanimated flash overlay for bomb / laser
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const [flashColor, setFlashColor] = useState<string>("#7FE9FF");

  useEffect(() => {
    onArriveRef.current = onArrive;
  }, [onArrive]);

  useEffect(() => {
    standingSetRef.current = new Set(standing);
  }, [standing]);

  // register a throw -> start ball animation
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
    }
    if (throwState.powerup === "bomb" || throwState.powerup === "lightning") {
      setFlashColor(throwState.powerup === "bomb" ? "#FFB35C" : "#7FE9FF");
      flash.value = withDelay(
        a.dur * 1000 - 60,
        withSequence(
          withTiming(0.85, { duration: 80 }),
          withTiming(0, { duration: 420 }),
        ),
      );
    }
  }, [throwState?.key]);

  // register knocked pins for topple + hold
  useEffect(() => {
    if (!knockdown) return;
    const now = globalThis.performance ? performance.now() : Date.now();
    knockdown.pins.forEach((id) => recentlyKnockedRef.current.set(id, now));
    // spawn impact particles
    spawnParticles(throwState?.powerup ?? null, knockdown.pins);
  }, [knockdown?.key]);

  const spawnParticles = (pu: PowerUpId | null, pins: number[]) => {
    const pr = particleRef.current;
    if (!pr) return;
    // burst origin: average knocked pin position, or pocket
    let ox = 0;
    let oz = PIN_FRONT_Z;
    if (pins.length) {
      let sx = 0;
      let sz = 0;
      pins.forEach((id) => {
        const w = pinWorld(id);
        sx += w.x;
        sz += w.z;
      });
      ox = sx / pins.length;
      oz = sz / pins.length;
    }
    const power = pu === "bomb" ? 3.2 : pu === "muscle" ? 2.6 : pu === "lightning" ? 3.0 : 1.9;
    for (let i = 0; i < PARTICLES; i++) {
      pr.pos[i * 3] = ox;
      pr.pos[i * 3 + 1] = 0.25;
      pr.pos[i * 3 + 2] = oz;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      const sp = power * (0.4 + Math.random() * 0.9);
      pr.vel[i * 3] = Math.cos(theta) * Math.sin(phi) * sp;
      pr.vel[i * 3 + 1] = Math.cos(phi) * sp * 1.2 + 1.0;
      pr.vel[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * sp;
    }
    pr.life = 1;
    pr.mat.color.setHex(BALL_COLORS[pu ?? "none"]);
    pr.mat.opacity = 1;
    pr.points.visible = true;
    (pr.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  };

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
    renderer.setClearColor(0x02040d, 1);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x02040d, 6, 13);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 100);
    camera.position.set(0, 0.62, 2.4);
    camera.lookAt(0, 0.34, -7.5);
    cameraRef.current = camera;

    // ---- lighting ----
    scene.add(new THREE.AmbientLight(0x2a4a80, 0.7));
    const hemi = new THREE.HemisphereLight(0x3a6fff, 0x000010, 0.6);
    scene.add(hemi);
    const p1 = new THREE.PointLight(0x22e1ff, 1.2, 20);
    p1.position.set(-1.5, 2.5, -2);
    scene.add(p1);
    const p2 = new THREE.PointLight(0x8a4bff, 1.0, 20);
    p2.position.set(1.6, 2.2, -6);
    scene.add(p2);
    // bright spotlight over the pin deck so pins pop
    const deckLight = new THREE.PointLight(0xbfefff, 2.6, 8);
    deckLight.position.set(0, 2.2, PIN_FRONT_Z - ROW_GAP * 1.5);
    scene.add(deckLight);

    // ---- lane surface ----
    const laneLen = BALL_START_Z - (PIN_FRONT_Z - ROW_GAP * 3 - 0.8);
    const laneCz = (BALL_START_Z + (PIN_FRONT_Z - ROW_GAP * 3 - 0.8)) / 2;
    const laneMat = new THREE.MeshStandardMaterial({
      color: 0x0b1d4d,
      emissive: 0x061238,
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.4,
    });
    const lane = new THREE.Mesh(new THREE.BoxGeometry(LANE_HALF * 2, 0.1, laneLen), laneMat);
    lane.position.set(0, -0.05, laneCz);
    scene.add(lane);

    // gutters
    const gutMat = new THREE.MeshStandardMaterial({ color: 0x01030a, roughness: 0.8 });
    [-1, 1].forEach((s) => {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, laneLen), gutMat);
      g.position.set(s * (LANE_HALF + 0.11), -0.09, laneCz);
      scene.add(g);
    });

    // neon materials
    const neon = new THREE.MeshBasicMaterial({ color: 0x22e1ff });
    const neonDim = new THREE.MeshBasicMaterial({ color: 0x22e1ff, transparent: true, opacity: 0.4 });
    const neonPurple = new THREE.MeshBasicMaterial({ color: 0x8a4bff, transparent: true, opacity: 0.7 });

    // lane neon edges
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, laneLen), neon);
      e.position.set(s * LANE_HALF, 0.02, laneCz);
      scene.add(e);
    });
    // center line
    const cl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, laneLen), neonDim);
    cl.position.set(0, 0.012, laneCz);
    scene.add(cl);
    // grid rungs
    for (let z = 1.0; z > PIN_FRONT_Z; z -= 1.0) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(LANE_HALF * 2, 0.015, 0.03), neonDim);
      r.position.set(0, 0.012, z);
      scene.add(r);
    }
    // aiming chevrons (arrows)
    [-0.55, -0.2, 0.2, 0.55].forEach((ax) => {
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 3), neon.clone());
      tri.rotation.x = -Math.PI / 2;
      tri.position.set(ax * LANE_HALF, 0.02, -2.6);
      scene.add(tri);
    });

    // ---- back wall ----
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 6),
      new THREE.MeshStandardMaterial({ color: 0x050a1f, emissive: 0x0a1a44, emissiveIntensity: 0.6 }),
    );
    wall.position.set(0, 1.2, PIN_FRONT_Z - ROW_GAP * 3 - 1.1);
    scene.add(wall);
    // horizon neon line
    const horizon = new THREE.Mesh(new THREE.BoxGeometry(8, 0.05, 0.05), neon);
    horizon.position.set(0, 0.9, PIN_FRONT_Z - ROW_GAP * 3 - 1.05);
    scene.add(horizon);
    const horizon2 = new THREE.Mesh(new THREE.BoxGeometry(5, 0.03, 0.03), neonPurple);
    horizon2.position.set(0, 1.35, PIN_FRONT_Z - ROW_GAP * 3 - 1.06);
    scene.add(horizon2);
    [-2, -1, 1, 2].forEach((vx) => {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.4, 0.03), neonDim);
      v.position.set(vx, 1.2, PIN_FRONT_Z - ROW_GAP * 3 - 1.07);
      scene.add(v);
    });

    // ---- pins ----
    const pinGeo = makePinGeometry();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x3a8fd8,
      emissiveIntensity: 1.25,
      roughness: 0.25,
      metalness: 0.1,
    });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00c2ff });
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x7a5cff });
    pinsRef.current = [];
    Object.keys(PINS).forEach((k) => {
      const id = Number(k);
      const w = pinWorld(id);
      const group = new THREE.Group();
      const body = new THREE.Mesh(pinGeo, bodyMat.clone());
      group.add(body);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.01, 8, 20), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.3;
      group.add(ring);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 20), ringMat2);
      ring2.rotation.x = Math.PI / 2;
      ring2.position.y = 0.24;
      group.add(ring2);
      group.position.set(w.x, 0, w.z);
      group.scale.setScalar(1.18);
      scene.add(group);
      const theta = Math.random() * Math.PI * 2;
      const axis = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
      const fallDir = new THREE.Vector3(-axis.z, 0, axis.x);
      pinsRef.current.push({
        id,
        group,
        base: new THREE.Vector3(w.x, 0, w.z),
        axis,
        fallDir,
        spin: (Math.random() - 0.5) * 3,
        progress: 0,
      });
    });

    // ---- ball ----
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0x59d6ff,
      emissive: 0x59d6ff,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.6,
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 32), ballMat);
    ball.position.set(0, BALL_R, BALL_START_Z);
    ball.visible = false;
    scene.add(ball);
    ballRef.current = ball;
    const bl = new THREE.PointLight(0x59d6ff, 1.4, 4);
    ball.add(bl);
    ballLightRef.current = bl;

    // ---- particles ----
    const pgeo = new THREE.BufferGeometry();
    const pos = new Float32Array(PARTICLES * 3);
    const vel = new Float32Array(PARTICLES * 3);
    pgeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pmat = new THREE.PointsMaterial({
      color: 0x59d6ff,
      size: 0.16,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(pgeo, pmat);
    points.visible = false;
    scene.add(points);
    particleRef.current = { points, pos, vel, life: 0, mat: pmat };

    lastRef.current = globalThis.performance ? performance.now() : Date.now();

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const now = globalThis.performance ? performance.now() : Date.now();
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;

      // ---- ball ----
      const a = throwAnim.current;
      const b = ballRef.current!;
      if (a.active) {
        a.t += dt / a.dur;
        const t = Math.min(1, a.t);
        const eased = t * t; // accelerate toward pins
        const isMagnet = a.powerup === "magnet";
        const isGiant = a.powerup === "giant";
        const targetX = isMagnet ? POCKET_X * WX : a.aim * AIM_SCALE * WX;
        let x = 0 + (targetX - 0) * t;
        if (isMagnet) x += Math.sin(t * Math.PI) * 0.35; // curved approach
        const z = BALL_START_Z + (PIN_FRONT_Z - BALL_START_Z) * eased;
        const sc = isGiant ? 1.7 : 1;
        b.scale.setScalar(sc);
        b.position.set(x, BALL_R * sc, z);
        b.rotation.x -= dt * 22;
        b.rotation.z += (isMagnet ? -1 : 0) * dt * 4;
        if (t >= 1 && !a.arrived) {
          a.arrived = true;
          a.active = false;
          b.visible = false;
          onArriveRef.current && onArriveRef.current();
        }
      }

      // ---- pins ----
      const standingSet = standingSetRef.current;
      const rk = recentlyKnockedRef.current;
      for (const p of pinsRef.current) {
        const logicallyUp = standingSet.has(p.id);
        const kt = rk.get(p.id);
        const held = kt !== undefined && now - kt < HOLD;
        const down = !logicallyUp || held ? 1 : 0;
        // smooth
        p.progress += (down - p.progress) * Math.min(1, dt * (down ? 12 : 6));
        const prog = p.progress;
        const q = new THREE.Quaternion().setFromAxisAngle(p.axis, prog * 1.55);
        if (prog > 0.02) {
          const spinQ = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            prog * p.spin,
          );
          q.multiply(spinQ);
        }
        p.group.quaternion.copy(q);
        p.group.position.copy(p.base);
        p.group.position.addScaledVector(p.fallDir, prog * 0.28);
        p.group.position.y = p.base.y - prog * 0.02;
      }

      // ---- particles ----
      const pr = particleRef.current!;
      if (pr.points.visible) {
        pr.life -= dt * 1.1;
        for (let i = 0; i < PARTICLES; i++) {
          pr.vel[i * 3 + 1] -= 5.5 * dt; // gravity
          pr.pos[i * 3] += pr.vel[i * 3] * dt;
          pr.pos[i * 3 + 1] += pr.vel[i * 3 + 1] * dt;
          pr.pos[i * 3 + 2] += pr.vel[i * 3 + 2] * dt;
          if (pr.pos[i * 3 + 1] < 0) pr.pos[i * 3 + 1] = 0;
        }
        (pr.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        pr.mat.opacity = Math.max(0, pr.life);
        if (pr.life <= 0) pr.points.visible = false;
      }

      renderer.render(scene, camera);
      // present frame
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
  container: { flex: 1, overflow: "hidden", backgroundColor: "#02040d" },
});
