import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const WALL_Z = -3.7;
const WARNING_MS = 900;
const HOLD_MS = 1050;
const RETRACT_MS = 320;
const CYCLE_MIN = 12000;
const CYCLE_MAX = 19000;

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInQuad(t: number) {
  return t * t;
}

export default function PopWall3D() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = Math.max(1, host.clientWidth || window.innerWidth);
    const height = Math.max(1, host.clientHeight || window.innerHeight);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 100);
    camera.position.set(0, 0.62, 2.4);
    camera.lookAt(0, 0.34, -7.5);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xfff1cf, 1.35);
    key.position.set(1.5, 3.8, 2.2);
    scene.add(key);

    const group = new THREE.Group();
    group.visible = false;
    group.position.set(0, -0.95, WALL_Z);
    scene.add(group);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.72, 0.78, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x242a31, metalness: 0.82, roughness: 0.24 }),
    );
    body.position.y = 0.39;
    group.add(body);

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(1.58, 0.62),
      new THREE.MeshStandardMaterial({ color: 0x151a20, emissive: 0x1a0b00, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.35 }),
    );
    face.position.set(0, 0.42, 0.086);
    group.add(face);

    const amber = new THREE.MeshStandardMaterial({ color: 0xff9d00, emissive: 0xff7a00, emissiveIntensity: 1.8, roughness: 0.35 });
    const red = new THREE.MeshStandardMaterial({ color: 0xff2f2f, emissive: 0xff0000, emissiveIntensity: 2.2, roughness: 0.3 });

    const topStrip = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.055, 0.22), amber);
    topStrip.position.set(0, 0.76, 0);
    group.add(topStrip);

    const bottomStrip = topStrip.clone();
    bottomStrip.position.y = 0.03;
    group.add(bottomStrip);

    [-0.72, 0.72].forEach((x) => {
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 14), red);
      beacon.position.set(x, 0.77, 0.12);
      group.add(beacon);
    });

    const badgeCanvas = document.createElement("canvas");
    badgeCanvas.width = 768;
    badgeCanvas.height = 256;
    const ctx = badgeCanvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, badgeCanvas.width, badgeCanvas.height);
      ctx.fillStyle = "#151a20";
      ctx.fillRect(0, 0, badgeCanvas.width, badgeCanvas.height);
      ctx.strokeStyle = "#ff7a00";
      ctx.lineWidth = 18;
      ctx.strokeRect(10, 10, badgeCanvas.width - 20, badgeCanvas.height - 20);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 88px Arial Black, Arial";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("AMS WEST", badgeCanvas.width / 2, 98);
      ctx.font = "900 54px Arial Black, Arial";
      ctx.fillStyle = "#ffb000";
      ctx.fillText("POP WALL", badgeCanvas.width / 2, 182);
    }
    const badgeTex = new THREE.CanvasTexture(badgeCanvas);
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    const badge = new THREE.Mesh(
      new THREE.PlaneGeometry(1.42, 0.47),
      new THREE.MeshBasicMaterial({ map: badgeTex, transparent: false }),
    );
    badge.position.set(0, 0.42, 0.091);
    group.add(badge);

    const warning = new THREE.Group();
    warning.visible = false;
    warning.position.set(0, 0.72, WALL_Z + 0.04);
    scene.add(warning);

    const warningMat = new THREE.MeshBasicMaterial({ color: 0xffb000, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
    const warningPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.95), warningMat);
    warning.add(warningPlane);

    const warningCanvas = document.createElement("canvas");
    warningCanvas.width = 768;
    warningCanvas.height = 256;
    const wctx = warningCanvas.getContext("2d");
    if (wctx) {
      wctx.clearRect(0, 0, warningCanvas.width, warningCanvas.height);
      wctx.textAlign = "center";
      wctx.textBaseline = "middle";
      wctx.font = "900 72px Arial Black, Arial";
      wctx.fillStyle = "#ffd34d";
      wctx.fillText("⚠ POP WALL ⚠", warningCanvas.width / 2, 92);
      wctx.font = "900 36px Arial Black, Arial";
      wctx.fillStyle = "#ffffff";
      wctx.fillText("LANE INTERFERENCE", warningCanvas.width / 2, 168);
    }
    const warningTex = new THREE.CanvasTexture(warningCanvas);
    warningTex.colorSpace = THREE.SRGBColorSpace;
    const warningText = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.58), new THREE.MeshBasicMaterial({ map: warningTex, transparent: true }));
    warningText.position.z = 0.01;
    warning.add(warningText);

    let phase: "idle" | "warning" | "rise" | "hold" | "retract" = "idle";
    let phaseStart = performance.now();
    let nextAt = phaseStart + CYCLE_MIN + Math.random() * (CYCLE_MAX - CYCLE_MIN);

    const trigger = (now: number) => {
      phase = "warning";
      phaseStart = now;
      warning.visible = true;
      group.visible = false;
    };

    const resize = () => {
      const w = Math.max(1, host.clientWidth || window.innerWidth);
      const h = Math.max(1, host.clientHeight || window.innerHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const now = performance.now();

      if (phase === "idle" && now >= nextAt) trigger(now);

      if (phase === "warning") {
        const t = Math.min(1, (now - phaseStart) / WARNING_MS);
        warningMat.opacity = 0.18 + Math.abs(Math.sin(t * Math.PI * 5)) * 0.45;
        warning.scale.setScalar(0.98 + Math.sin(t * Math.PI * 5) * 0.025);
        if (t >= 1) {
          phase = "rise";
          phaseStart = now;
          warning.visible = false;
          group.visible = true;
        }
      } else if (phase === "rise") {
        const t = Math.min(1, (now - phaseStart) / 280);
        const e = easeOutBack(t);
        group.position.y = -0.95 + e * 0.95;
        if (t >= 1) {
          group.position.y = 0;
          phase = "hold";
          phaseStart = now;
        }
      } else if (phase === "hold") {
        const t = Math.min(1, (now - phaseStart) / HOLD_MS);
        const pulse = 1 + Math.sin(t * Math.PI * 6) * 0.015;
        group.scale.set(1, pulse, 1);
        (topStrip.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + Math.abs(Math.sin(t * Math.PI * 8)) * 1.7;
        (bottomStrip.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + Math.abs(Math.sin(t * Math.PI * 8)) * 1.7;
        if (t >= 1) {
          phase = "retract";
          phaseStart = now;
        }
      } else if (phase === "retract") {
        const t = Math.min(1, (now - phaseStart) / RETRACT_MS);
        group.position.y = -easeInQuad(t) * 0.95;
        if (t >= 1) {
          group.visible = false;
          group.position.y = -0.95;
          group.scale.set(1, 1, 1);
          phase = "idle";
          phaseStart = now;
          nextAt = now + CYCLE_MIN + Math.random() * (CYCLE_MAX - CYCLE_MIN);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener("resize", resize);
      scene.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose?.());
          else o.material.dispose?.();
        }
      });
      badgeTex.dispose();
      warningTex.dispose();
      renderer.dispose();
      try { host.removeChild(renderer.domElement); } catch {}
    };
  }, []);

  return <div ref={hostRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}
