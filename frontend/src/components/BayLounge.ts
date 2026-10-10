import * as THREE from "three";

// Original, deterministic mural. One small texture; no downloads or per-frame work.
// Pixel primitives also work in native Expo GL without DOM/canvas APIs.
export function makeBayMuralTexture(): THREE.DataTexture {
  const w = 512, h = 256;
  const data = new Uint8Array(w * h * 4);
  const pixel = (x: number, y: number, color: number[]) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = ((h - 1 - y) * w + x) * 4;
    data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = 255;
  };
  const rect = (x: number, y: number, width: number, height: number, color: number[]) => {
    for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) pixel(px, py, color);
  };
  const line = (x0: number, y0: number, x1: number, y1: number, color: number[], thick = 1) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let n = 0; n <= steps; n++) {
      const t = n / steps;
      rect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), thick, thick, color);
    }
  };
  for (let y = 0; y < h; y++) {
    const t = Math.min(1, y / 190);
    const color = y < 194 ? [75 + 172 * t, 52 + 101 * t, 143 - 37 * t] : [23, 72, 100];
    for (let x = 0; x < w; x++) pixel(x, y, color);
  }
  for (let y = 38; y < 120; y++) for (let x = 344; x < 426; x++) {
    if (Math.hypot(x - 385, y - 79) < 40) pixel(x, y, [255, 218, 119]);
  }
  // Layered city silhouettes and warm lit windows.
  for (let n = 0; n < 25; n++) {
    const x = n * 22 - 8, height = 20 + (n * 31 % 43), top = 194 - height;
    rect(x, top, 18, height, [61, 52, 95]);
    for (let wy = top + 7; wy < 190; wy += 10) for (let wx = x + 4; wx < x + 16; wx += 7) {
      if ((wx + wy + n) % 3) rect(wx, wy, 2, 3, [255, 206, 113]);
    }
  }
  const steel = [28, 34, 65], highlight = [255, 133, 117];
  const cableY = (x: number) => 65 + 89 * (1 - Math.pow((x - 256) / 66, 2));
  for (let x = 190; x <= 322; x++) {
    pixel(x, cableY(x), steel); pixel(x, cableY(x) + 1, steel);
    if (x % 13 === 0) line(x, cableY(x), x, 166, steel);
  }
  line(0, 155, 190, 65, steel, 2); line(322, 65, 511, 155, steel, 2);
  [190, 322].forEach(x => {
    rect(x - 6, 58, 12, 126, steel);
    rect(x - 3, 62, 6, 8, highlight);
    [85, 116, 147].forEach(y => rect(x - 15, y, 30, 4, steel));
  });
  rect(0, 166, w, 6, steel); line(0, 167, 511, 167, highlight);
  for (let y = 207; y < 246; y += 10) line(358 - (y % 13), y, 411 + (y % 17), y, [225, 159, 143]);
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// Cosmetic rails outside the playable lane; no collision or gameplay hooks.
export function addLoungeRails(scene: THREE.Scene, length: number, centerZ: number): void {
  [-1, 1].forEach(side => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, length),
      new THREE.MeshBasicMaterial({ color: side < 0 ? 0x39ff9a : 0xff2d95, toneMapped: false }));
    rail.position.set(side * 1.01, 0.025, centerZ);
    scene.add(rail);
  });
}


// Static painted surfaces share the sunset mural palette. Floor art stays clear
// through the middle so the moving ball and physical aiming chevrons read cleanly.
export function makeLoungePaintTexture(surface: "floor" | "wall" | "ceiling"): THREE.DataTexture {
  const w = 256, h = 512, data = new Uint8Array(w * h * 4);
  const pixel = (x: number, y: number, c: number[]) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = ((h - 1 - y) * w + x) * 4;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  };
  const stroke = (points: number[][], c: number[], radius: number) => {
    for (let n = 1; n < points.length; n++) {
      const [ax, ay] = points[n - 1], [bx, by] = points[n];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let j = 0; j <= steps; j++) {
        const x = ax + (bx - ax) * j / steps, y = ay + (by - ay) * j / steps;
        for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) pixel(x + dx, y + dy, c);
        }
      }
    }
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const grain = Math.sin(y * 0.6 + x * 0.03) * 3;
    const seam = x % 32 === 0 ? -10 : 0;
    const edge = x < 59 || x > 197;
    const c = surface === "floor" ? edge ? (x < 128 ? [92, 205, 182] : [231, 137, 184]) : [153, 212, 201]
      : surface === "wall" ? [75 + y * 0.16, 152 - y * 0.11, 186 + y * 0.06]
      : [24 + y * 0.015, 44 + y * 0.018, 72 + y * 0.018];
    pixel(x, y, c.map(v => v + grain + (surface === "floor" ? seam : 0)));
  }
  const ink = [19, 32, 62], mint = [57, 255, 154], pink = [255, 45, 149], gold = [255, 211, 80];
  const tag = (x: number, y: number, scale: number) => {
    const paths = [ [[0,0],[0,30]], [[20,0],[20,30]], [[0,15],[20,15]], [[29,0],[35,30],[44,14],[53,30],[59,0]] ];
    paths.forEach(path => {
      const pts = path.map(([px,py]) => [x + px * scale,y + py * scale]);
      stroke(pts, ink, 4); stroke(pts, mint, 2);
    });
  };
  for (let n = 0; n < 4; n++) {
    const y = 40 + n * 125;
    if (surface === "floor") {
      stroke([[4,y+35],[43,y],[54,y+44],[24,y+70],[57,y+85]], ink, 4);
      stroke([[4,y+35],[43,y],[54,y+44],[24,y+70],[57,y+85]], mint, 2);
      stroke([[203,y+11],[248,y+35],[211,y+75],[250,y+94]], ink, 4);
      stroke([[203,y+11],[248,y+35],[211,y+75],[250,y+94]], gold, 2);
      tag(11,y+5,0.62);
    } else {
      stroke([[9,y+43],[57,y+10],[102,y+69],[161,y+18],[247,y+53]], ink, 7);
      stroke([[9,y+43],[57,y+10],[102,y+69],[161,y+18],[247,y+53]], n%2 ? mint : pink, 4);
      if (surface === "wall") tag(73,y+24,1.4);
      else stroke([[113,y+10],[127,y+36],[155,y+40],[132,y+56],[137,y+85],[114,y+69],[91,y+85],[97,y+56],[73,y+40],[101,y+36],[113,y+10]],gold,2);
    }
  }
  if (surface === "floor") {
    stroke([[103,350],[107,376],[148,376],[153,350],[139,361],[128,343],[116,361],[103,350]], [89,169,154], 2);
  }
  const texture = new THREE.DataTexture(data,w,h,THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function addLoungeCeiling(scene: THREE.Scene, length: number, centerZ: number, texture: THREE.Texture): void {
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(2.7,length),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, fog: false, toneMapped: false }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0,2.22,centerZ);
  scene.add(ceiling);
}
