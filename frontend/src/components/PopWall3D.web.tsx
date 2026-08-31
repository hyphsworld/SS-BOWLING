import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const WALL_Z = -3.7;
const WARNING_MS = 850;
const RISE_MS = 340;
const HOLD_MS = 1200;
const RETRACT_MS = 380;
const CYCLE_MIN = 9000;
const CYCLE_MAX = 14000;

function easeOutBack(t: number) {
  const c1 = 1.45;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function makeFaceTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext("2d");
  if (c) {
    c.fillStyle = "#11161b"; c.fillRect(0, 0, 1024, 512);
    c.strokeStyle = "#ff8a00"; c.lineWidth = 22; c.strokeRect(16, 16, 992, 480);
    c.fillStyle = "#2b3138";
    for (let x = -120; x < 1100; x += 120) { c.save(); c.translate(x, 256); c.rotate(-0.55); c.fillRect(-18, -360, 36, 720); c.restore(); }
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = "900 112px Arial Black, Arial"; c.fillStyle = "#ffffff"; c.fillText("AMS WEST", 512, 205);
    c.font = "900 68px Arial Black, Arial"; c.fillStyle = "#ffb000"; c.fillText("POP WALL", 512, 320);
    c.font = "800 30px Arial Black, Arial"; c.fillStyle = "#ff5a2a"; c.fillText("STRIKE THROUGH THE STREETS", 512, 402);
  }
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

export default function PopWall3D() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const width = Math.max(1, host.clientWidth || window.innerWidth);
    const height = Math.max(1, host.clientHeight || window.innerHeight);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(width, height, false); renderer.setClearColor(0, 0);
    Object.assign(renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" }); host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 100); camera.position.set(0, 0.62, 2.4); camera.lookAt(0, 0.34, -7.5);
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xfff1cf, 1.5); key.position.set(1.5, 4, 2); scene.add(key);

    const rig = new THREE.Group(); rig.visible = false; rig.position.set(0, -0.86, WALL_Z); scene.add(rig);
    const steel = new THREE.MeshStandardMaterial({ color: 0x252b32, metalness: 0.9, roughness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0d1115, metalness: 0.82, roughness: 0.3 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xff8a00, emissive: 0xff4d00, emissiveIntensity: 2.0, metalness: 0.55, roughness: 0.25 });
    const red = new THREE.MeshStandardMaterial({ color: 0xff2d2d, emissive: 0xff0000, emissiveIntensity: 2.6, roughness: 0.2 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.78, 0.24), steel); body.position.y = 0.39; rig.add(body);
    const faceTex = makeFaceTexture();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 0.58), new THREE.MeshStandardMaterial({ map: faceTex, emissive: 0x2a0d00, emissiveIntensity: 0.6, metalness: 0.25, roughness: 0.32 })); face.position.set(0, 0.42, 0.126); rig.add(face);
    [-0.84, 0.84].forEach((x) => { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.32), dark); rail.position.set(x, 0.28, 0); rig.add(rail); });
    [0.03, 0.77].forEach((y) => { const strip = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.055, 0.3), orange); strip.position.set(0, y, 0.01); rig.add(strip); });
    [-0.72, 0.72].forEach((x) => { const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), red); beacon.position.set(x, 0.84, 0.12); rig.add(beacon); });

    const slot = new THREE.Group(); slot.position.set(0, 0.012, WALL_Z); scene.add(slot);
    const slotDark = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.025, 0.34), new THREE.MeshBasicMaterial({ color: 0x050608 })); slot.add(slotDark);
    [-0.93, 0.93].forEach((x) => { const edge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.38), new THREE.MeshBasicMaterial({ color: 0xff8a00 })); edge.position.x = x; slot.add(edge); });
    const warnLight = new THREE.PointLight(0xff3b00, 0, 3.5); warnLight.position.set(0, 0.22, WALL_Z + 0.2); scene.add(warnLight);

    let phase: "idle" | "warning" | "rise" | "hold" | "retract" = "idle";
    let phaseStart = performance.now(); let nextAt = phaseStart + CYCLE_MIN + Math.random() * (CYCLE_MAX - CYCLE_MIN);
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate); const now = performance.now();
      if (phase === "idle" && now >= nextAt) { phase = "warning"; phaseStart = now; rig.visible = false; }
      if (phase === "warning") {
        const t = Math.min(1, (now - phaseStart) / WARNING_MS); warnLight.intensity = 2.5 + Math.abs(Math.sin(t * Math.PI * 7)) * 5;
        slot.scale.z = 1 + Math.abs(Math.sin(t * Math.PI * 7)) * 0.18;
        if (t >= 1) { phase = "rise"; phaseStart = now; rig.visible = true; warnLight.intensity = 5; }
      } else if (phase === "rise") {
        const t = Math.min(1, (now - phaseStart) / RISE_MS); rig.position.y = -0.86 + easeOutBack(t) * 0.86; rig.rotation.z = Math.sin(t * Math.PI * 5) * 0.018;
        if (t >= 1) { rig.position.y = 0; rig.rotation.z = 0; phase = "hold"; phaseStart = now; }
      } else if (phase === "hold") {
        const t = Math.min(1, (now - phaseStart) / HOLD_MS); rig.position.y = Math.sin(t * Math.PI * 10) * 0.008; warnLight.intensity = 2 + Math.abs(Math.sin(t * Math.PI * 8)) * 4;
        if (t >= 1) { phase = "retract"; phaseStart = now; }
      } else if (phase === "retract") {
        const t = Math.min(1, (now - phaseStart) / RETRACT_MS); rig.position.y = -0.86 * t * t; warnLight.intensity = 4 * (1 - t);
        if (t >= 1) { rig.visible = false; rig.position.y = -0.86; slot.scale.set(1,1,1); phase = "idle"; nextAt = now + CYCLE_MIN + Math.random() * (CYCLE_MAX - CYCLE_MIN); }
      }
      renderer.render(scene, camera);
    }; animate();
    const resize = () => { const w = Math.max(1, host.clientWidth || window.innerWidth), h = Math.max(1, host.clientHeight || window.innerHeight); renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); };
    window.addEventListener("resize", resize);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); scene.traverse((o:any)=>{o.geometry?.dispose?.(); if(o.material){if(Array.isArray(o.material))o.material.forEach((m:any)=>m.dispose?.());else o.material.dispose?.();}}); faceTex.dispose(); renderer.dispose(); try{host.removeChild(renderer.domElement);}catch{} };
  }, []);
  return <div ref={hostRef} style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }} />;
}
