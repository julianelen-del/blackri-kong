// Loads the user's exact character illustrations, extracts transparent cutouts
// using border flood-fill alpha matting (so white shirts & eyes stay 100% solid!),
// and renders the Buenos Aires Donkey Kong background + props onto cached offscreen canvases.

import { CANVAS_H, CANVAS_W, GORILLA_POS, LADDERS, PLATFORMS, getPlatformY } from './levelData';

export interface SpriteAssets {
  gorillaSprite: HTMLCanvasElement | null;
  vendorFront: HTMLCanvasElement | null;
  vendorSide: HTMLCanvasElement | null;
  stageBackdrop: HTMLCanvasElement;
  ready: boolean;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

// Flood-fill background removal starting from outer border pixels,
// preserving interior whites (eyes, striped shirt, collar) cleanly!
function extractCutout(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const imgData = ctx.getImageData(0, 0, sw, sh);
  const data = imgData.data;
  const total = sw * sh;
  const visited = new Uint8Array(total);
  const bgMask = new Uint8Array(total);

  const isBgColor = (idx4: number) => {
    const r = data[idx4];
    const g = data[idx4 + 1];
    const b = data[idx4 + 2];
    // Pure white / very light neutral studio background
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    return minC > 224 && maxC - minC < 26;
  };

  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const enqueue = (px: number, py: number) => {
    const pos = py * sw + px;
    if (visited[pos]) return;
    visited[pos] = 1;
    if (isBgColor(pos * 4)) {
      bgMask[pos] = 1;
      queue[tail++] = pos;
    }
  };

  for (let x = 0; x < sw; x++) {
    enqueue(x, 0);
    enqueue(x, sh - 1);
  }
  for (let y = 0; y < sh; y++) {
    enqueue(0, y);
    enqueue(sw - 1, y);
  }

  while (head < tail) {
    const pos = queue[head++];
    const px = pos % sw;
    const py = (pos - px) / sw;

    if (px > 0) enqueue(px - 1, py);
    if (px < sw - 1) enqueue(px + 1, py);
    if (py > 0) enqueue(px, py - 1);
    if (py < sh - 1) enqueue(px, py + 1);
  }

  // Apply transparency + 1px soft edge feathering
  let minX = sw;
  let minY = sh;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const pos = y * sw + x;
      const i4 = pos * 4;
      if (bgMask[pos]) {
        data[i4 + 3] = 0;
      } else {
        // Soften edge pixels bordering transparent background
        let nearBg = false;
        if (
          (x > 0 && bgMask[pos - 1]) ||
          (x < sw - 1 && bgMask[pos + 1]) ||
          (y > 0 && bgMask[pos - sw]) ||
          (y < sh - 1 && bgMask[pos + sw])
        ) {
          nearBg = true;
        }
        if (nearBg) {
          const lum = (data[i4] + data[i4 + 1] + data[i4 + 2]) / 3;
          if (lum > 205) {
            data[i4 + 3] = Math.max(40, Math.round((255 - lum) * 3.5));
          }
        }
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Tightly crop around non-transparent silhouette for accurate foot pivot & hitboxes
  if (maxX <= minX || maxY <= minY) return c;
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const cropped = document.createElement('canvas');
  cropped.width = cw;
  cropped.height = ch;
  cropped.getContext('2d')!.drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
  return cropped;
}

function buildStageBackdrop(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  // 1. Midnight Buenos Aires Sky Gradient
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  sky.addColorStop(0, '#040814');
  sky.addColorStop(0.55, '#0B162D');
  sky.addColorStop(1, '#101C36');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars
  for (let i = 0; i < 85; i++) {
    const sx = (Math.sin(i * 91.7) * 0.5 + 0.5) * CANVAS_W;
    const sy = (Math.cos(i * 47.3) * 0.5 + 0.5) * 320;
    const r = (i % 3) * 0.55 + 0.6;
    ctx.fillStyle = i % 5 === 0 ? 'rgba(253, 224, 71, 0.7)' : 'rgba(226, 232, 240, 0.55)';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Palacio del Congreso Silhouette (Left Background)
  ctx.save();
  ctx.fillStyle = '#0F1B33';
  ctx.fillRect(210, 310, 260, 340);
  ctx.fillRect(295, 250, 90, 70);
  // Dome
  ctx.fillStyle = '#143842';
  ctx.beginPath();
  ctx.arc(340, 250, 44, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(337, 185, 6, 25);
  // Warm facade uplight
  const congGlow = ctx.createLinearGradient(0, 310, 0, 560);
  congGlow.addColorStop(0, 'rgba(245, 158, 11, 0.16)');
  congGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = congGlow;
  ctx.fillRect(220, 320, 240, 240);
  ctx.restore();

  // 3. Buenos Aires Skyline Towers with Lit Windows
  const towers = [
    { x: 18, y: 240, w: 120, h: 420 },
    { x: 145, y: 290, w: 85, h: 370 },
    { x: 470, y: 265, w: 105, h: 395 },
    { x: 705, y: 250, w: 110, h: 410 },
    { x: 830, y: 215, w: 130, h: 445 },
    { x: 980, y: 260, w: 115, h: 400 },
    { x: 1110, y: 225, w: 150, h: 435 },
  ];
  for (const t of towers) {
    ctx.fillStyle = '#0B1325';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.strokeRect(t.x, t.y, t.w, t.h);
    for (let wy = t.y + 18; wy < CANVAS_H - 90; wy += 24) {
      for (let wx = t.x + 14; wx < t.x + t.w - 18; wx += 22) {
        const seed = Math.sin(wx * 13.7 + wy * 7.3);
        if (seed > 0.15) {
          ctx.fillStyle = seed > 0.72 ? 'rgba(251, 191, 36, 0.6)' : 'rgba(56, 189, 248, 0.32)';
          ctx.fillRect(wx, wy, 10, 12);
        }
      }
    }
  }

  // Rooftop "CABA" Neon Sign
  ctx.save();
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(855, 224, 86, 30);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.strokeRect(855, 224, 86, 30);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 19px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CABA', 898, 246);
  ctx.restore();

  // 4. Illuminated Obelisco (Center)
  ctx.save();
  const obGlow = ctx.createRadialGradient(640, 420, 18, 640, 420, 210);
  obGlow.addColorStop(0, 'rgba(251, 191, 36, 0.38)');
  obGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = obGlow;
  ctx.fillRect(430, 160, 420, 490);

  const obGrad = ctx.createLinearGradient(600, 75, 680, 630);
  obGrad.addColorStop(0, '#F5E8C7');
  obGrad.addColorStop(0.55, '#E4C88B');
  obGrad.addColorStop(1, '#C4913B');
  ctx.fillStyle = obGrad;
  ctx.beginPath();
  ctx.moveTo(640, 58);
  ctx.lineTo(664, 102);
  ctx.lineTo(684, 640);
  ctx.lineTo(596, 640);
  ctx.lineTo(616, 102);
  ctx.closePath();
  ctx.fill();

  // Shadow facet on right side of Obelisco
  ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.beginPath();
  ctx.moveTo(640, 58);
  ctx.lineTo(664, 102);
  ctx.lineTo(684, 640);
  ctx.lineTo(648, 640);
  ctx.closePath();
  ctx.fill();

  // "BA" Illuminated Emblem
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 30px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BA', 636, 445);
  ctx.restore();

  // 5. Steel Support Columns behind Girders
  ctx.fillStyle = '#1E293B';
  for (const colX of [88, 640, 1188]) {
    ctx.fillRect(colX - 8, 128, 16, 530);
    ctx.fillStyle = '#334155';
    ctx.fillRect(colX - 4, 128, 5, 530);
    ctx.fillStyle = '#1E293B';
  }

  // 6. Buenos Aires Street Props (placed slightly behind girder plane)
  const drawObraBarrier = (x: number, level: number) => {
    const y = getPlatformY(level, x) ?? 656;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#EAB308';
    ctx.fillRect(-44, -44, 6, 44);
    ctx.fillRect(38, -44, 6, 44);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-48, -44, 96, 28);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-48, -44, 96, 28);
    ctx.clip();
    ctx.fillStyle = '#18181B';
    for (let sx = -60; sx < 65; sx += 20) {
      ctx.beginPath();
      ctx.moveTo(sx, -44);
      ctx.lineTo(sx + 10, -44);
      ctx.lineTo(sx - 4, -16);
      ctx.lineTo(sx - 14, -16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(-26, -41, 52, 22);
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-26, -41, 52, 22);
    ctx.fillStyle = '#18181B';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OBRA', 0, -31);
    ctx.fillText('CABA', 0, -21);
    ctx.restore();
  };

  const drawDumpster = (x: number, level: number) => {
    const y = getPlatformY(level, x) ?? 656;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(-22, -5, 5, 0, Math.PI * 2);
    ctx.arc(22, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1F6F3D';
    ctx.fillRect(-34, -48, 68, 42);
    ctx.fillStyle = '#14532D';
    ctx.fillRect(-37, -54, 74, 8);
    ctx.strokeStyle = '#14532D';
    ctx.lineWidth = 2;
    ctx.strokeRect(-30, -43, 60, 33);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 14px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CABA', 0, -29);
    ctx.fillText('LIMP', 0, -16);
    ctx.restore();
  };

  const drawDrum = (x: number, level: number, label: string, topCol: string, bandCol: string) => {
    const y = getPlatformY(level, x) ?? 656;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = topCol;
    ctx.fillRect(-16, -46, 32, 46);
    ctx.fillStyle = bandCol;
    ctx.fillRect(-16, -32, 32, 18);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-16, -46, 32, 46);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, -20);
    ctx.restore();
  };

  const drawCrate = (x: number, y: number, label: string, isPalta: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = isPalta ? '#855E3B' : '#9C6B3B';
    ctx.fillRect(-26, -46, 52, 46);
    ctx.strokeStyle = '#4A2E16';
    ctx.lineWidth = 3;
    ctx.strokeRect(-26, -46, 52, 46);
    if (isPalta) {
      ctx.fillStyle = '#EAB308';
      ctx.fillRect(-21, -32, 42, 18);
      ctx.fillStyle = '#1C1917';
      ctx.font = 'bold 13px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PALTAS', 0, -19);
    } else {
      ctx.beginPath();
      ctx.moveTo(-24, -44);
      ctx.lineTo(24, -2);
      ctx.stroke();
      ctx.fillStyle = '#DC2626';
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.font = 'bold 22px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(label, 0, -16);
      ctx.fillText(label, 0, -16);
    }
    ctx.restore();
  };

  // Bottom props
  drawCrate(55, getPlatformY(0, 55)!, 'DK', false);
  drawDrum(210, 0, 'CABA', '#1D4E6F', '#FACC15');
  drawDrum(248, 0, 'BASTRASH', '#1E3A5F', '#CBD5E1');
  drawObraBarrier(360, 0);

  // Mid props
  drawObraBarrier(310, 1);
  drawDumpster(1165, 1);

  drawObraBarrier(860, 2);
  drawDumpster(1170, 2);

  drawDumpster(105, 3);
  // SUBTE Post on Level 3 Left
  {
    const sy = getPlatformY(3, 275)!;
    ctx.fillStyle = '#334155';
    ctx.fillRect(272, sy - 66, 6, 66);
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(275, sy - 76, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 12px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUBTE', 275, sy - 73);
  }

  // Top Platform Props: Stacked PALTAS Crates + Red-White Soccer Goal!
  const topY = GORILLA_POS.y;
  drawCrate(1052, topY, 'PALTAS', true);
  drawCrate(1108, topY, 'PALTAS', true);
  drawCrate(1080, topY - 46, 'PALTAS', true);

  // Soccer Goal (Arco)
  ctx.save();
  ctx.translate(1152, topY);
  // Net
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
  ctx.lineWidth = 1.5;
  for (let nx = 8; nx <= 68; nx += 10) {
    ctx.beginPath();
    ctx.moveTo(nx, -86);
    ctx.lineTo(nx + 10, 0);
    ctx.stroke();
  }
  for (let ny = -86; ny <= 0; ny += 12) {
    ctx.beginPath();
    ctx.moveTo(8, ny);
    ctx.lineTo(76, ny + 6);
    ctx.stroke();
  }
  // Striped red/white goal frame
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#EA580C';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -86);
  ctx.lineTo(66, -86);
  ctx.lineTo(78, 0);
  ctx.stroke();
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -86);
  ctx.lineTo(66, -86);
  ctx.stroke();
  ctx.restore();

  // 7. Metallic Ladders (drawn behind girder top flange!)
  for (const lad of LADDERS) {
    ctx.save();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(lad.x - 16, lad.topY);
    ctx.lineTo(lad.x - 16, lad.bottomY);
    ctx.moveTo(lad.x + 16, lad.topY);
    ctx.lineTo(lad.x + 16, lad.bottomY);
    ctx.stroke();

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lad.x - 17, lad.topY);
    ctx.lineTo(lad.x - 17, lad.bottomY);
    ctx.moveTo(lad.x + 15, lad.topY);
    ctx.lineTo(lad.x + 15, lad.bottomY);
    ctx.stroke();

    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 4;
    for (let ry = lad.topY + 16; ry < lad.bottomY - 8; ry += 18) {
      ctx.beginPath();
      ctx.moveTo(lad.x - 16, ry);
      ctx.lineTo(lad.x + 16, ry);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 8. Riveted Steel I-Beam Girders
  for (const plat of PLATFORMS) {
    for (let i = 0; i < plat.points.length - 1; i++) {
      const a = plat.points[i];
      const b = plat.points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);

      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);

      // Web body
      const webGrad = ctx.createLinearGradient(0, 0, 0, 22);
      webGrad.addColorStop(0, '#B45309');
      webGrad.addColorStop(0.5, '#7C2D12');
      webGrad.addColorStop(1, '#431407');
      ctx.fillStyle = webGrad;
      ctx.fillRect(0, 0, len, 22);

      // Top & bottom steel flanges
      ctx.fillStyle = '#D97706';
      ctx.fillRect(0, 0, len, 5);
      ctx.fillStyle = '#9A3412';
      ctx.fillRect(0, 17, len, 5);

      // Diagonal truss lines & rivets
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let rx = 0; rx < len - 24; rx += 28) {
        ctx.moveTo(rx, 5);
        ctx.lineTo(rx + 14, 17);
        ctx.lineTo(rx + 28, 5);
      }
      ctx.stroke();

      ctx.fillStyle = '#F59E0B';
      for (let rx = 14; rx < len; rx += 32) {
        ctx.beginPath();
        ctx.arc(rx, 11, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Bottom dark street base
  ctx.fillStyle = '#070B14';
  ctx.fillRect(0, 678, CANVAS_W, CANVAS_H - 678);

  return canvas;
}

export async function loadSpriteAssets(): Promise<SpriteAssets> {
  const stageBackdrop = buildStageBackdrop();
  const assets: SpriteAssets = {
    gorillaSprite: null,
    vendorFront: null,
    vendorSide: null,
    stageBackdrop,
    ready: false,
  };

  try {
    const [gorillaImg, vendorImg] = await Promise.all([
      loadImage('/assets/aistudio/image_28f8f627_58879715.jpg'),
      loadImage('/assets/aistudio/image_128bacf0_da080b28.jpg'),
    ]);

    assets.gorillaSprite = extractCutout(gorillaImg, 0, 0, gorillaImg.width, gorillaImg.height);
    const halfW = Math.floor(vendorImg.width / 2);
    assets.vendorFront = extractCutout(vendorImg, 0, 0, halfW, vendorImg.height);
    assets.vendorSide = extractCutout(vendorImg, halfW, 0, vendorImg.width - halfW, vendorImg.height);
    assets.ready = true;
  } catch (err) {
    console.warn('Could not load character sprites:', err);
  }

  return assets;
}
