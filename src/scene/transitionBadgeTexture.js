import * as THREE from 'three';
import { APP_CONFIG } from '../config/appConfig.js';

function steppedPoints(w, h, cut, px) {
  const pts = [];
  let x = cut;
  let y = 0;
  const n = cut / px;

  pts.push([x, y]);
  x = w - cut;
  pts.push([x, y]);

  for (let i = 0; i < n; i += 1) {
    x += px;
    pts.push([x, y]);
    y += px;
    pts.push([x, y]);
  }

  y = h - cut;
  pts.push([x, y]);

  for (let i = 0; i < n; i += 1) {
    y += px;
    pts.push([x, y]);
    x -= px;
    pts.push([x, y]);
  }

  x = cut;
  pts.push([x, y]);

  for (let i = 0; i < n; i += 1) {
    x -= px;
    pts.push([x, y]);
    y -= px;
    pts.push([x, y]);
  }

  y = cut;
  pts.push([x, y]);

  for (let i = 0; i < n; i += 1) {
    y -= px;
    pts.push([x, y]);
    x += px;
    pts.push([x, y]);
  }

  pts.push([cut, 0]);
  return pts;
}

function drawSteppedPath(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

export function createTransitionBadgeTexture(name, style = APP_CONFIG.transitionLabels.badge) {
  const label = ` ${String(name ?? 'Без названия')}`.trim();
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = `${style.fontSize}px "JetBrains Mono", "PT Mono", "Cascadia Mono", Consolas, monospace`;

  const textW = Math.round(measureCtx.measureText(label).width || label.length * style.fontSize * 0.58);
  let w = Math.max(style.minW, textW + style.padX * 2);
  let h = Math.max(style.h, style.fontSize + style.padY * 2);
  w = Math.max(style.px * 6, Math.round(w / style.px) * style.px);
  h = Math.max(style.px * 4, Math.round(h / style.px) * style.px);

  const cutSteps = Math.max(1, Math.floor(Math.min(style.cut, Math.min(w, h) / 3) / style.px));
  const cut = cutSteps * style.px;
  const points = steppedPoints(w, h, cut, style.px);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  drawSteppedPath(ctx, points);
  ctx.fillStyle = style.background;
  ctx.globalAlpha = style.opacity;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.save();
  drawSteppedPath(ctx, points);
  ctx.clip();
  ctx.fillStyle = style.dither;
  const patternSize = style.px * 2;
  for (let y = 0; y < h; y += patternSize) {
    for (let x = 0; x < w; x += patternSize) {
      ctx.fillRect(x, y, style.px, style.px);
      ctx.fillRect(x + style.px, y + style.px, style.px, style.px);
    }
  }

  ctx.strokeStyle = style.highlight;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cut, 1);
  ctx.lineTo(w - cut, 1);
  ctx.moveTo(1, cut);
  ctx.lineTo(1, h - cut);
  ctx.stroke();

  ctx.strokeStyle = style.shadow;
  ctx.beginPath();
  ctx.moveTo(cut, h - 1);
  ctx.lineTo(w - cut, h - 1);
  ctx.moveTo(w - 1, cut);
  ctx.lineTo(w - 1, h - cut);
  ctx.stroke();
  ctx.restore();

  if (style.borderColor) {
    drawSteppedPath(ctx, points);
    ctx.strokeStyle = style.borderColor;
    ctx.globalAlpha = style.borderOpacity;
    ctx.lineWidth = style.borderStroke;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.font = `${style.fontSize}px "JetBrains Mono", "PT Mono", "Cascadia Mono", Consolas, monospace`;
  ctx.fillStyle = style.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, Math.floor(w / 2), Math.floor(h / 2));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return {
    texture,
    pixelWidth: w,
    pixelHeight: h,
  };
}
