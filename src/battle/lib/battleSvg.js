function sanitizeSvgId(value = 'x') {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createSvgTexture(svg) {
  return svg ? svgToDataUri(svg) : null;
}

function escapeSvgText(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function approxTextWidth(text, fontSize = 12, factor = 0.58) {
  return Math.ceil(String(text || '').length * fontSize * factor);
}

function ellipsize(text, maxChars = 26) {
  const value = String(text || '');
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(1, maxChars - 1))}…`;
}

function buildBevelPolygonPoints(x, y, width, height, cut = 8) {
  const w = Math.max(0, Number(width) || 0);
  const h = Math.max(0, Number(height) || 0);
  if (w <= 0 || h <= 0) return '';

  const c = Math.max(0, Math.min(
    Number(cut) || 0,
    Math.max(0, w / 2 - 1),
    Math.max(0, h / 2 - 1),
  ));

  return [
    `${x + c},${y}`,
    `${x + w - c},${y}`,
    `${x + w},${y + c}`,
    `${x + w},${y + h - c}`,
    `${x + w - c},${y + h}`,
    `${x + c},${y + h}`,
    `${x},${y + h - c}`,
    `${x},${y + c}`,
  ].join(' ');
}

function buildInsetBevelPolygonPoints(x, y, width, height, cut = 8, inset = 2) {
  const innerW = Math.max(0, (Number(width) || 0) - inset * 2);
  const innerH = Math.max(0, (Number(height) || 0) - inset * 2);
  if (innerW <= 0 || innerH <= 0) return '';

  return buildBevelPolygonPoints(
    x + inset,
    y + inset,
    innerW,
    innerH,
    Math.max(0, (Number(cut) || 0) - inset),
  );
}

function getBossQueuePreviewPlateWidth(previewLabel) {
  const previewTextWidth = Math.max(16, Math.ceil(approxTextWidth(previewLabel || '—', 12, 0.6)));
  return Math.max(52, previewTextWidth + 42);
}

function getBossQueueTitleWidth(name, {
  fontSize = 11,
  fontFactor = 0.6,
  maxChars = 40,
  minWidth = 32,
} = {}) {
  const titleText = ellipsize(name, maxChars);
  const textWidth = Math.ceil(approxTextWidth(titleText, fontSize, fontFactor));
  return Math.max(minWidth, textWidth);
}

function getBossQueueRowWidth(item) {
  const previewPlateWidth = getBossQueuePreviewPlateWidth(item?.previewLabel);
  const titleWidth = getBossQueueTitleWidth(item?.name);
  return titleWidth + previewPlateWidth + 32;
}

export function getBossHudLayout(width, height, model, config = {}) {
  const padding = Number(config.padding) || 10;
  const sceneWidth = Number(model?.scene?.width || config.sceneWidth) || 300;
  const visibleRowsLimit = Number(config.visibleQueueRows) || 2;
  const queueLength = Array.isArray(model?.queue) ? model.queue.length : 0;
  const visibleQueueRows = Math.max(1, Math.min(visibleRowsLimit, queueLength || 1));
  const queueRowH = Number(config.queueRowHeight) || 34;
  const queueHeaderH = Number(config.queueHeaderHeight) || 6;
  const queueOverflowH = queueLength > visibleQueueRows ? 14 : 0;
  const queueH = queueHeaderH + visibleQueueRows * queueRowH + queueOverflowH;

  let maxQueueRowWidth = 0;
  if (Array.isArray(model?.queue)) {
    model.queue.slice(0, visibleQueueRows).forEach((item) => {
      maxQueueRowWidth = Math.max(maxQueueRowWidth, getBossQueueRowWidth(item));
    });
  }

  const queueW = Math.max(Number(config.queueMinWidth) || 168, maxQueueRowWidth);
  const bossNameText = ellipsize(model?.bossName, 40);
  const nameTextW = Math.ceil(approxTextWidth(bossNameText, 13, 0.65));
  const barW = sceneWidth - 20;
  const bossCenterX = width - Math.floor(sceneWidth / 2);
  const infoW = Math.max(60, nameTextW + 32);
  const defW = Math.ceil(approxTextWidth(String(model?.defence ?? 0), 12, 0.6));
  const dodgeW = Math.ceil(approxTextWidth(`${model?.dodgePct ?? 0}%`, 12, 0.6));
  const statsW = Math.max(64, Math.max(defW, dodgeW) + 46);

  return {
    info: {
      bgX: bossCenterX - Math.floor(infoW / 2),
      bgY: padding + 18,
      bgW: infoW,
      bgH: 22,
      nameX: bossCenterX,
      y: padding + 33,
    },
    bar: {
      x: bossCenterX - Math.floor(barW / 2),
      y: padding,
      w: barW,
      h: 14,
    },
    stats: {
      x: width - statsW - padding,
      y: height - queueH - padding - 60,
      w: statsW,
      h: 24,
      gap: 6,
    },
    queue: {
      x: width - queueW - padding,
      y: height - queueH - padding,
      w: queueW,
      h: queueH,
      headerH: queueHeaderH,
      rowH: queueRowH,
      visibleRows: visibleQueueRows,
    },
    status: {
      right: width - padding,
      bottom: height - queueH - padding - 66,
    },
  };
}

function getBossStatIconSvg(type, { heal = false } = {}) {
  if (type === 'attack') {
    if (heal) {
      return '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#6ce597"/></svg>';
    }

    return '<svg width="14" height="14" viewBox="0 0 24 24"><path d="M19.3,2.7c-0.8-0.8-2-0.8-2.8,0l-9.9,9.9L4,10.1l-2,2l4.2,4.2L2.7,19.8L4.2,21.3l3.5-3.5l4.2,4.2l2-2l-2.5-2.5l9.9-9.9 C22.1,6.8,22.1,5.5,21.3,4.7L19.3,2.7z" fill="#ff6f61"/></svg>';
  }

  if (type === 'defence') {
    return '<svg width="14" height="14" viewBox="0 0 12 12"><path d="M6 1 L11 3 V6 C11 8.8 8.9 11 6 12 C3.1 11 1 8.8 1 6 V3 Z" fill="#ffffff" fill-opacity="0.95"/><path d="M3 3.4 C3.6 2.9 4.7 2.4 6 2.1 V9.6 C4.5 8.9 3.4 7.6 3.1 6 Z" fill="#ffffff" fill-opacity="0.35"/></svg>';
  }

  if (type === 'dodge') {
    return '<svg width="14" height="14" viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet"><path d="M27.026 8.969c0.743-0.896 1.226-2.154 1.226-3.562 0-2.543-1.512-4.65-3.448-4.902-0.129-0.020-0.267 0-0.399 0-0.791 0-1.527 0.305-2.139 0.827l-21.218 1.536 19.521 1.414v0.744c-0.004 0.068-0.007 0.136-0.009 0.205l-19.512 1.413 19.515 1.413v0.949l-19.515 1.413 17.355 1.257v0.262c-0.127 0.324-0.237 0.667-0.333 1.023l-17.023 1.233 16.231 1.175v1.219l-16.231 1.175 16.26 1.177v1.42l-16.26 1.177 18.883 1.367v1.040l-18.883 1.367 19.358 1.402v0.971l-19.358 1.401 19.633 1.422 0.047 0.72h7.096l0.741-9.947h2.793c0-4.765-0.305-11.554-4.332-12.312zM21.202 8.102c0.001 0.002 0.002 0.005 0.004 0.007l-0.064-0.011 0.061 0.004z" fill="#ffffff"/></svg>';
  }

  return '<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#d7c08a"/></svg>';
}

function buildBossStatPill(x, y, width, value, type, { heal = false } = {}) {
  const icon = getBossStatIconSvg(type, { heal });
  const accent = heal ? '#7ce5a2' : (type === 'attack' ? '#ffcf8a' : '#e7edf6');
  const accentFill = heal
    ? 'rgba(108,229,151,0.18)'
    : (type === 'attack' ? 'rgba(255,206,0,0.16)' : 'rgba(255,255,255,0.07)');
  const valueText = escapeSvgText(String(value || '0'));
  const outerPoints = buildBevelPolygonPoints(0, 0, width, 24, 7);
  const innerPoints = buildInsetBevelPolygonPoints(0, 0, width, 24, 7, 1.5);
  const accentPoints = buildInsetBevelPolygonPoints(width - 28, 0, 28, 24, 7, 1.5);

  return `
  <g transform="translate(${x}, ${y})">
    <polygon points="${outerPoints}" fill="#0b110d" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
    <polygon points="${innerPoints}" fill="#0d1313" />
    <polygon points="${accentPoints}" fill="${accentFill}" />
    <path d="M 6 5 L ${Math.max(8, width - 8)} 5" stroke="rgba(255,255,255,0.04)" stroke-width="1" />
    <g transform="translate(${width - 22}, 5)">${icon}</g>
    <text x="${width - 32}" y="16.5" text-anchor="end" fill="${accent}" font-family="Tahoma, sans-serif" font-size="12" font-weight="800">${valueText}</text>
  </g>`;
}

function buildBossApTicks(x, y, count, filled, {
  size = 8,
  gap = 3,
  activeBase = '#aa8800',
  activeHighlight = '#ffce00',
  activeStroke = '#000000',
  inactiveBase = '#222222',
  inactiveHighlight = '#555555',
  inactiveStroke = 'rgba(255,255,255,0.18)',
} = {}) {
  return Array.from({ length: Math.max(0, count) }, (_, idx) => {
    const left = x + idx * (size + gap);
    const top = y;
    const active = idx < filled + 1;
    const cx = left + size / 2;
    const cy = top + size / 2;
    const topP = `${cx},${top}`;
    const rightP = `${left + size},${cy}`;
    const bottomP = `${cx},${top + size}`;
    const leftP = `${left},${cy}`;
    const fullRhombus = `${topP} ${rightP} ${bottomP} ${leftP}`;
    const topHalf = `${leftP} ${topP} ${rightP} ${cx},${cy}`;

    return `
  <polygon points="${fullRhombus}" fill="${active ? activeBase : inactiveBase}" stroke="${active ? activeStroke : inactiveStroke}" stroke-width="1" stroke-linejoin="round" />
  <polygon points="${topHalf}" fill="${active ? activeHighlight : inactiveHighlight}" />`;
  }).join('');
}

function getBossApTicksWidth(count, { size = 8, gap = 3 } = {}) {
  const total = Math.max(0, Number(count) || 0);
  if (!total) return 0;
  return total * size + Math.max(0, total - 1) * gap;
}

export function buildBossHudSvg(model, width, height, config = {}) {
  if (!model) return null;

  const layout = getBossHudLayout(width, height, model, config);
  const ratio = Math.max(0, Math.min(1, Number(model.health || 0) / Math.max(1, Number(model.maxHealth || 1))));
  const { bar, info, stats, queue } = layout;
  const filledW = Math.max(0, Math.round((bar.w - 4) * ratio));
  const bossName = escapeSvgText(ellipsize(model.bossName, 40));

  let barTicks = '';
  for (let i = 1; i < 10; i += 1) {
    const tickX = bar.x + 2 + Math.floor((bar.w - 4) * (i / 10));
    barTicks += `<line x1="${tickX}" y1="${bar.y + bar.h - 8}" x2="${tickX}" y2="${bar.y + bar.h - 2}" stroke="rgba(0,0,0,0.8)" stroke-width="1.5" />`;
  }

  const statPills = [
    buildBossStatPill(stats.x, stats.y, stats.w, model.defence, 'defence'),
    buildBossStatPill(stats.x, stats.y + stats.h + stats.gap, stats.w, `${model.dodgePct}%`, 'dodge'),
  ].join('');
  const infoBgPoints = buildBevelPolygonPoints(info.bgX, info.bgY, info.bgW, info.bgH, 6);
  const gothicFrameColor = '#1a1614';
  const gothicTrimColor = '#8c7352';
  const gothicHighlight = '#bfa780';
  const queueHeaderTicks = model.roundLimit > 0
    ? buildBossApTicks(
      bar.x + 2,
      bar.y + bar.h + 8,
      model.roundLimit,
      model.roundActionPoints,
      {
        size: 7,
        gap: 2,
        inactiveBase: '#1a1f1b',
        inactiveHighlight: '#313a33',
      },
    )
    : '';
  const visibleQueue = Array.isArray(model.queue) ? model.queue.slice(0, queue.visibleRows) : [];
  const queueOverflow = Math.max(0, (model.queue?.length || 0) - visibleQueue.length);
  const queueRows = visibleQueue.length
    ? visibleQueue.map((item, idx) => {
      const rowY = queue.y + queue.headerH + idx * queue.rowH;
      const rowW = Math.min(queue.w, getBossQueueRowWidth(item));
      const rowX = queue.x + queue.w - rowW;
      const rowH = 30;
      const isCurrent = item.isCurrent;
      const previewPlateWidth = getBossQueuePreviewPlateWidth(item.previewLabel);
      const previewPlateX = rowX + rowW - previewPlateWidth - 6;
      const previewPlateY = rowY + 3;
      const previewPlateSvg = buildBossStatPill(
        previewPlateX,
        previewPlateY,
        previewPlateWidth,
        item.previewLabel || '—',
        item.previewType === 'utility' ? 'neutral' : 'attack',
        { heal: item.previewType === 'heal' },
      );
      const titleLeftX = rowX + 18;
      const titleRightX = previewPlateX - 6;
      const titleAvailableWidth = Math.max(32, titleRightX - titleLeftX);
      const titleMaxChars = Math.max(8, Math.floor(titleAvailableWidth / (11 * 0.6)));
      const title = escapeSvgText(ellipsize(item.name, titleMaxChars));
      const activeTickSize = 7;
      const activeTickGap = 2;
      const activeTickWidth = getBossApTicksWidth(item.cost, { size: activeTickSize, gap: activeTickGap });
      const activeTickX = rowX - 10 - activeTickWidth;
      const activeTickY = rowY + 11;
      const activeSweepX = activeTickX - 10;
      const activeSweepW = rowX + rowW - activeSweepX;
      const activeSweepPoints = buildBevelPolygonPoints(activeSweepX, rowY + 5, activeSweepW, rowH - 10, 8);
      const activeSweepInnerPoints = buildInsetBevelPolygonPoints(activeSweepX, rowY + 5, activeSweepW, rowH - 10, 8, 1.5);
      const apTicks = isCurrent
        ? buildBossApTicks(activeTickX, activeTickY, item.cost, Math.min(model.actionPoints, item.cost), {
          size: activeTickSize,
          gap: activeTickGap,
          activeBase: '#aa8800',
          activeHighlight: '#ffce00',
          inactiveBase: '#1a1f1b',
          inactiveHighlight: '#313a33',
        })
        : '';
      const rowFill = isCurrent ? 'rgba(13,19,19,0.94)' : 'rgba(10,14,11,0.78)';
      const rowStroke = isCurrent ? 'rgba(255,255,255,0.45)' : 'rgba(30,43,36,0.92)';
      const rowPoints = buildBevelPolygonPoints(rowX, rowY, rowW, rowH, 8);
      const rowInnerPoints = buildInsetBevelPolygonPoints(rowX, rowY, rowW, rowH, 8, 1.5);

      return `
  ${isCurrent ? `<polygon points="${activeSweepPoints}" fill="rgba(255,206,0,0.3)" stroke="rgba(255,206,0,0.2)" stroke-width="1" />
  <polygon points="${activeSweepInnerPoints}" fill="rgba(55,43,9,0.3)" />
  ${apTicks}` : ''}
  <polygon points="${rowPoints}" fill="${rowFill}" stroke="${rowStroke}" stroke-width="${isCurrent ? 1.4 : 1}" />
  <polygon points="${rowInnerPoints}" fill="rgba(13,19,19,0.62)" />
  <path d="M ${rowX + 8} ${rowY + 5} L ${rowX + rowW - 8} ${rowY + 5}" stroke="rgba(255,255,255,0.04)" stroke-width="1" />
  <text x="${titleRightX}" y="${rowY + 18}" text-anchor="end" fill="#f4f6fb" font-family="Tahoma, sans-serif" font-size="11" font-weight="${isCurrent ? '700' : '600'}">${title}</text>
  ${previewPlateSvg}`;
    }).join('')
    : `<text x="${queue.x + 14}" y="${queue.y + 42}" fill="rgba(255,255,255,0.66)" font-family="Tahoma, sans-serif" font-size="11">Нет способностей</text>`;

  return createSvgTexture(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bossHpFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5C0000" />
      <stop offset="50%" stop-color="#FF0000" />
      <stop offset="100%" stop-color="#5C0000" />
    </linearGradient>
    <linearGradient id="bossBarGlass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="bossPanelFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111913" stop-opacity="0.97" />
      <stop offset="100%" stop-color="#090d0a" stop-opacity="0.92" />
    </linearGradient>
  </defs>

  <rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h}" fill="#0a0808" stroke="#000000" stroke-width="2" />
  ${filledW > 0 ? `
  <rect x="${bar.x + 2}" y="${bar.y + 2}" width="${filledW}" height="${bar.h - 4}" fill="url(#bossHpFill)" />
  <path d="M ${bar.x + 2} ${bar.y + 3} L ${bar.x + 2 + filledW} ${bar.y + 3}" stroke="rgba(255,120,120,0.3)" stroke-width="1.5" />` : ''}
  ${barTicks}
  <path d="M ${bar.x + 6} ${bar.y + 4} L ${bar.x + bar.w - 6} ${bar.y + 4}" stroke="url(#bossBarGlass)" stroke-width="3" />
  <rect x="${bar.x + 1}" y="${bar.y + 1}" width="${bar.w - 2}" height="${bar.h - 2}" fill="none" stroke="${gothicFrameColor}" stroke-width="1.5" />
  <rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h}" fill="none" stroke="${gothicTrimColor}" stroke-width="1" />
  <path d="M ${bar.x - 3} ${bar.y - 3} L ${bar.x + 5} ${bar.y} L ${bar.x} ${bar.y + 5} Z" fill="${gothicFrameColor}" stroke="${gothicTrimColor}" stroke-width="1"/>
  <path d="M ${bar.x - 3} ${bar.y + bar.h + 3} L ${bar.x + 5} ${bar.y + bar.h} L ${bar.x} ${bar.y + bar.h - 5} Z" fill="${gothicFrameColor}" stroke="${gothicTrimColor}" stroke-width="1"/>
  <path d="M ${bar.x + bar.w + 3} ${bar.y - 3} L ${bar.x + bar.w - 5} ${bar.y} L ${bar.x + bar.w} ${bar.y + 5} Z" fill="${gothicFrameColor}" stroke="${gothicTrimColor}" stroke-width="1"/>
  <path d="M ${bar.x + bar.w + 3} ${bar.y + bar.h + 3} L ${bar.x + bar.w - 5} ${bar.y + bar.h} L ${bar.x + bar.w} ${bar.y + bar.h - 5} Z" fill="${gothicFrameColor}" stroke="${gothicTrimColor}" stroke-width="1"/>
  <polygon points="${bar.x + bar.w / 2},${bar.y - 4} ${bar.x + bar.w / 2 + 6},${bar.y} ${bar.x + bar.w / 2},${bar.y + 4} ${bar.x + bar.w / 2 - 6},${bar.y}" fill="${gothicFrameColor}" stroke="${gothicTrimColor}" stroke-width="1"/>
  <polygon points="${bar.x + bar.w / 2},${bar.y + bar.h + 4} ${bar.x + bar.w / 2 + 6},${bar.y + bar.h} ${bar.x + bar.w / 2},${bar.y + bar.h - 4} ${bar.x + bar.w / 2 - 6},${bar.y + bar.h}" fill="${gothicFrameColor}" stroke="${gothicTrimColor}" stroke-width="1"/>
  <polyline points="${bar.x + bar.w / 2 - 5},${bar.y} ${bar.x + bar.w / 2},${bar.y - 3} ${bar.x + bar.w / 2 + 5},${bar.y}" fill="none" stroke="${gothicHighlight}" stroke-width="1" />
  <polyline points="${bar.x + bar.w / 2 - 5},${bar.y + bar.h} ${bar.x + bar.w / 2},${bar.y + bar.h + 3} ${bar.x + bar.w / 2 + 5},${bar.y + bar.h}" fill="none" stroke="${gothicHighlight}" stroke-width="1" />

  <polygon points="${infoBgPoints}" fill="rgba(10, 14, 11, 0.6)" stroke="rgba(255,255,255,0.04)" stroke-width="1" />
  <polygon points="${buildInsetBevelPolygonPoints(info.bgX, info.bgY, info.bgW, info.bgH, 6, 1.5)}" fill="rgba(0, 0, 0, 0.3)" />
  <text x="${info.nameX + 1}" y="${info.y + 1}" text-anchor="middle" fill="#000" font-family="Tahoma, sans-serif" font-size="13" font-weight="800">${bossName}</text>
  <text x="${info.nameX}" y="${info.y}" text-anchor="middle" fill="#e4e8f0" font-family="Tahoma, sans-serif" font-size="13" font-weight="800">${bossName}</text>

  ${statPills}
  ${queueHeaderTicks}
  ${queueRows}
  ${queueOverflow ? `<text x="${queue.x + queue.w - 12}" y="${queue.y + queue.h - 6}" text-anchor="end" fill="rgba(255,255,255,0.42)" font-family="Tahoma, sans-serif" font-size="10" font-weight="700">. . .</text>` : ''}
</svg>`);
}

export function buildPlatformSvgs(char, effectiveStats, activeChar) {
  const platformCfg = {
    svgW: 100,
    totalH: 60,
    cx: 50,
    baseCy: 24,
    shadowCy: 27,
    baseRx: 44,
    baseRy: 14,
    shadowRx: 42,
    shadowRy: 14,
    innerRx: 38,
    innerRy: 11,
    platformFill: '#0b110d',
    platformInnerFill: '#0d1313',
    platformInnerStroke: '#ffffff',
    platformInnerStrokeOpacity: 0.05,
    platformStrokeActive: 'rgba(255,255,255,0.7)',
    platformStrokeInactive: '#1e2b24',
    platformStrokeWidth: 1.5,
    shadowFill: '#000000',
    shadowOpacity: 0.6,
    shadowBlur: 3,
    hpArcBgOuter: '#000000',
    hpArcBgInner: '#161e19',
    hpArcOuterWidth: 7,
    hpArcInnerWidth: 5,
    hpArcActiveWidth: 5,
    arcLength: 103,
    badgeFillActive: 'rgb(240,240,240)',
    badgeFillInactive: 'rgb(0,0,0)',
    badgeStrokeWidth: 3,
    badgeY: 29,
    badgeH: 20,
    badgeCut: 6,
    hpFontSize: 14,
    tickW: 8,
    tickGap: 3,
    tickY: 24,
    tickReadyBase: '#aa8800',
    tickReadyHighlight: '#ffce00',
    tickReadyStroke: '#000000',
    tickCdBase: '#222222',
    tickCdHighlight: '#555555',
    tickCdStroke: '#ffffff',
    ...(char?.renderUi?.platform || {}),
  };

  const ratio = Math.max(0, Math.min(1, effectiveStats.health / effectiveStats.maxHealth));
  const hpText = String(effectiveStats.health);
  const hpTextW = hpText.length * 8;
  const hpLabelW = Math.max(34, hpTextW + 16);
  const hpLabelX = platformCfg.cx - hpLabelW / 2;
  const hpLabelY = platformCfg.badgeY;
  const hpLabelH = platformCfg.badgeH;
  const badgeCut = Math.max(
    3,
    Math.min(
      platformCfg.badgeCut,
      Math.floor(hpLabelH / 2) - 1,
      Math.floor(hpLabelW / 4),
    ),
  );

  const hpBadgePoints = [
    `${hpLabelX + badgeCut},${hpLabelY}`,
    `${hpLabelX + hpLabelW - badgeCut},${hpLabelY}`,
    `${hpLabelX + hpLabelW},${hpLabelY + hpLabelH / 2}`,
    `${hpLabelX + hpLabelW - badgeCut},${hpLabelY + hpLabelH}`,
    `${hpLabelX + badgeCut},${hpLabelY + hpLabelH}`,
    `${hpLabelX},${hpLabelY + hpLabelH / 2}`,
  ].join(' ');

  let activeColor = platformCfg.platformStrokeInactive;
  let badgeFill = platformCfg.badgeFillInactive;
  let badgeFillText = '#fff';

  if (activeChar) {
    activeColor = platformCfg.platformStrokeActive;
    badgeFill = platformCfg.badgeFillActive;
    badgeFillText = '#000';
  }

  let ticksSvg = '';
  const abilities = Array.isArray(char.__allAbilityIds) ? char.__allAbilityIds : [];

  if (abilities.length > 0) {
    const tickW = platformCfg.tickW;
    const tickGap = platformCfg.tickGap;
    const totalTickW = abilities.length * tickW + (abilities.length - 1) * tickGap;
    let startX = Math.round(platformCfg.cx - totalTickW / 2);
    const tickY = platformCfg.tickY;

    abilities.forEach((_, index) => {
      const cd = char.abilityCooldowns?.[index] || 0;
      const isReady = cd === 0;

      const baseColor = isReady ? platformCfg.tickReadyBase : platformCfg.tickCdBase;
      const highlight = isReady ? platformCfg.tickReadyHighlight : platformCfg.tickCdHighlight;
      const stroke = isReady ? platformCfg.tickReadyStroke : platformCfg.tickCdStroke;
      const cx = startX + tickW / 2;
      const cy = tickY + tickW / 2;
      const topP = `${cx},${tickY}`;
      const rightP = `${startX + tickW},${cy}`;
      const bottomP = `${cx},${tickY + tickW}`;
      const leftP = `${startX},${cy}`;
      const fullRhombus = `${topP} ${rightP} ${bottomP} ${leftP}`;
      const topHalf = `${leftP} ${topP} ${rightP} ${cx},${cy}`;

      ticksSvg += `<polygon points="${fullRhombus}" fill="${baseColor}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round" />`;
      ticksSvg += `<polygon points="${topHalf}" fill="${highlight}" />`;

      startX += tickW + tickGap;
    });
  }

  let hpColorTop;
  let hpColorBot;

  if (ratio <= 0.33) {
    hpColorTop = 'rgba(255,77,77,0.7)';
    hpColorBot = 'rgba(181,6,6,0.7)';
  } else if (ratio <= 0.66) {
    hpColorTop = 'rgba(255,221,68,0.7)';
    hpColorBot = 'rgba(209,160,0,0.7)';
  } else {
    hpColorTop = 'rgba(77,255,77,0.7)';
    hpColorBot = 'rgba(31,152,2,0.7)';
  }

  const hpArcPath = `M ${platformCfg.cx - platformCfg.baseRx} ${platformCfg.baseCy} A ${platformCfg.baseRx} ${platformCfg.baseRy} 0 0 0 ${platformCfg.cx + platformCfg.baseRx} ${platformCfg.baseCy}`;
  const filledLength = ratio * platformCfg.arcLength;
  const charIdSafe = sanitizeSvgId(char.id);

  let activeIndicatorSvg = '';
  if (activeChar) {
    const arcRx = platformCfg.baseRx + 2;
    const arcRy = platformCfg.baseRy + 2;
    const activeArcPath = `M ${platformCfg.cx - arcRx} ${platformCfg.baseCy} A ${arcRx} ${arcRy} 0 0 0 ${platformCfg.cx + arcRx} ${platformCfg.baseCy}`;

    activeIndicatorSvg = `
      <path d="${activeArcPath}" fill="none" stroke="${platformCfg.platformStrokeActive}" stroke-width="5" filter="url(#glow_${charIdSafe})" />
    `;
  }

  const platformSvg = `
<svg width="${platformCfg.svgW}" height="${platformCfg.totalH}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="hpGrad_${charIdSafe}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${hpColorBot}" />
      <stop offset="50%" stop-color="${hpColorTop}" />
      <stop offset="100%" stop-color="${hpColorBot}" />
    </linearGradient>
    <filter id="glow_${charIdSafe}" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${platformCfg.shadowBlur}" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <ellipse
    cx="${platformCfg.cx}" cy="${platformCfg.shadowCy}"
    rx="${platformCfg.shadowRx}" ry="${platformCfg.shadowRy}"
    fill="${platformCfg.shadowFill}"
    opacity="${platformCfg.shadowOpacity}"
    filter="url(#glow_${charIdSafe})"
  />

  <ellipse
    cx="${platformCfg.cx}" cy="${platformCfg.baseCy}"
    rx="${platformCfg.baseRx}" ry="${platformCfg.baseRy}"
    fill="${platformCfg.platformFill}"
    stroke="${activeColor}"
    stroke-width="${platformCfg.platformStrokeWidth}"
  />
  ${activeIndicatorSvg}

  <ellipse
    cx="${platformCfg.cx}" cy="${platformCfg.baseCy}"
    rx="${platformCfg.innerRx}" ry="${platformCfg.innerRy}"
    fill="${platformCfg.platformInnerFill}"
    stroke="${platformCfg.platformInnerStroke}"
    stroke-opacity="${platformCfg.platformInnerStrokeOpacity}"
    stroke-width="1"
  />

  <path
    d="${hpArcPath}"
    fill="none"
    stroke="${platformCfg.hpArcBgOuter}"
    stroke-width="${platformCfg.hpArcOuterWidth}"
    stroke-linecap="round"
  />
  <path
    d="${hpArcPath}"
    fill="none"
    stroke="${platformCfg.hpArcBgInner}"
    stroke-width="${platformCfg.hpArcInnerWidth}"
    stroke-linecap="round"
  />
  <path
    d="${hpArcPath}"
    fill="none"
    stroke="url(#hpGrad_${charIdSafe})"
    stroke-width="${platformCfg.hpArcActiveWidth}"
    stroke-linecap="round"
    stroke-dasharray="${filledLength} 150"
  />

  <polygon
    points="${hpBadgePoints}"
    fill="${badgeFill}"
    stroke="${hpColorTop}"
    stroke-width="${platformCfg.badgeStrokeWidth}"
    stroke-linejoin="miter"
  />

  <text x="${platformCfg.cx}" y="40"
        fill="${badgeFillText}"
        font-family="Tahoma, sans-serif" font-size="${platformCfg.hpFontSize}" font-weight="900"
        text-anchor="middle" dominant-baseline="middle">
    ${hpText}
  </text>
</svg>`;

  const ticksSvgWrapper = ticksSvg
    ? `<svg width="${platformCfg.svgW}" height="${platformCfg.totalH}" fill="none" xmlns="http://www.w3.org/2000/svg">${ticksSvg}</svg>`
    : null;

  return {
    svgW: platformCfg.svgW,
    totalH: platformCfg.totalH,
    platformUri: createSvgTexture(platformSvg),
    ticksUri: createSvgTexture(ticksSvgWrapper),
  };
}

export function buildStatSvg(effectiveStats, mirrorStats) {
  const defenceVal = effectiveStats.defence || 0;
  const dodgePct = Math.round((effectiveStats.dodgeChance || 0) * 100);
  const atkMin = effectiveStats.attack?.min || 0;
  const atkMax = effectiveStats.attack?.max || 0;
  const isHeal = atkMin < 0;
  const avgDmg = Math.round((Math.abs(atkMin) + Math.abs(atkMax)) / 2);

  const txtDef = String(defenceVal);
  const txtDod = `${dodgePct}%`;
  const txtAtk = String(avgDmg);

  const ICON_SIZE = 14;
  const ICON_GAP = 2;
  const FS = 13;
  const charW = Math.round(FS * 0.6);

  const defW = ICON_SIZE + ICON_GAP + charW * txtDef.length;
  const dodW = ICON_SIZE + ICON_GAP + charW * txtDod.length;
  const atkW = ICON_SIZE + ICON_GAP + charW * txtAtk.length;

  const bgPad = 1;
  const statSvgW = Math.max(80, Math.ceil(Math.max(defW, dodW, atkW) + bgPad * 2 + 2));
  const statSvgH = 58;
  const rowGap = 2;
  const leftX = bgPad + 1;
  const rightX = (w) => Math.max(0, statSvgW - w - bgPad - 1);

  const defX = !mirrorStats ? rightX(defW) : leftX;
  const dodX = !mirrorStats ? rightX(dodW) : leftX;
  const atkX = !mirrorStats ? rightX(atkW) : leftX;
  const statTextAnchor = !mirrorStats ? 'end' : 'start';
  const atkIconX = !mirrorStats ? (atkW - ICON_SIZE) : 0;
  const defIconX = !mirrorStats ? (defW - ICON_SIZE) : 0;
  const dodIconX = !mirrorStats ? (dodW - ICON_SIZE) : 0;
  const atkTextX = !mirrorStats ? (atkW - ICON_SIZE - ICON_GAP) : (ICON_SIZE + ICON_GAP);
  const defTextX = !mirrorStats ? (defW - ICON_SIZE - ICON_GAP) : (ICON_SIZE + ICON_GAP);
  const dodTextX = !mirrorStats ? (dodW - ICON_SIZE - ICON_GAP) : (ICON_SIZE + ICON_GAP);
  const defY = bgPad + 1;
  const dodY = defY + ICON_SIZE + bgPad * 2 + rowGap;
  const atkY = dodY + ICON_SIZE + bgPad * 2 + rowGap;

  const atkIcon = isHeal
    ? `<svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#55ff55"/></svg>`
    : `<svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24"><path d="M19.3,2.7c-0.8-0.8-2-0.8-2.8,0l-9.9,9.9L4,10.1l-2,2l4.2,4.2L2.7,19.8L4.2,21.3l3.5-3.5l4.2,4.2l2-2l-2.5-2.5l9.9-9.9 C22.1,6.8,22.1,5.5,21.3,4.7L19.3,2.7z" fill="#ff4444"/></svg>`;

  const statSvg = `
<svg width="${statSvgW}" height="${statSvgH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="statShadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="0.5" stdDeviation="0.6" flood-opacity="0.35"/>
    </filter>
  </defs>
  <g filter="url(#statShadow)" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
     font-variant-numeric="tabular-nums">

    <g transform="translate(${defX}, ${defY})">
      <rect x="${-bgPad}" y="${-bgPad}" width="${defW + bgPad * 2}" height="${ICON_SIZE + bgPad * 2}" rx="3" ry="3" fill="#000" fill-opacity="0.6"/>
      <g transform="translate(${defIconX}, 0)">
        <svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 12 12">
          <path d="M6 1 L11 3 V6 C11 8.8 8.9 11 6 12 C3.1 11 1 8.8 1 6 V3 Z" fill="#ffffff" fill-opacity="0.95"/>
          <path d="M3 3.4 C3.6 2.9 4.7 2.4 6 2.1 V9.6 C4.5 8.9 3.4 7.6 3.1 6 Z" fill="#ffffff" fill-opacity="0.35"/>
        </svg>
      </g>
      <text x="${defTextX}" y="${ICON_SIZE / 2 + 1}"
            fill="#fff" font-size="${FS}" font-weight="700"
            text-anchor="${statTextAnchor}" dominant-baseline="middle">${txtDef}</text>
    </g>

    <g transform="translate(${dodX}, ${dodY})">
      <rect x="${-bgPad}" y="${-bgPad}" width="${dodW + bgPad * 2}" height="${ICON_SIZE + bgPad * 2}" rx="3" ry="3" fill="#000" fill-opacity="0.6"/>
      <g transform="translate(${dodIconX}, 0)">
        <svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet">
          <path d="M27.026 8.969c0.743-0.896 1.226-2.154 1.226-3.562 0-2.543-1.512-4.65-3.448-4.902-0.129-0.020-0.267 0-0.399 0-0.791 0-1.527 0.305-2.139 0.827l-21.218 1.536 19.521 1.414v0.744c-0.004 0.068-0.007 0.136-0.009 0.205l-19.512 1.413 19.515 1.413v0.949l-19.515 1.413 17.355 1.257v0.262c-0.127 0.324-0.237 0.667-0.333 1.023l-17.023 1.233 16.231 1.175v1.219l-16.231 1.175 16.26 1.177v1.42l-16.26 1.177 18.883 1.367v1.040l-18.883 1.367 19.358 1.402v0.971l-19.358 1.401 19.633 1.422 0.047 0.72h7.096l0.741-9.947h2.793c0-4.765-0.305-11.554-4.332-12.312zM21.202 8.102c0.001 0.002 0.002 0.005 0.004 0.007l-0.064-0.011 0.061 0.004z" fill="#ffffff" stroke="none"/>
        </svg>
      </g>
      <text x="${dodTextX}" y="${ICON_SIZE / 2 + 1}"
            fill="#fff" font-size="${FS}" font-weight="700"
            text-anchor="${statTextAnchor}" dominant-baseline="middle">${txtDod}</text>
    </g>

    <g transform="translate(${atkX}, ${atkY})">
      <rect x="${-bgPad}" y="${-bgPad}" width="${atkW + bgPad * 2}" height="${ICON_SIZE + bgPad * 2}" rx="3" ry="3" fill="#000" fill-opacity="0.6"/>
      <g transform="translate(${atkIconX}, 0)">
        ${atkIcon}
      </g>
      <text x="${atkTextX}" y="${ICON_SIZE / 2 + 1}"
            fill="#fff" font-size="${FS}" font-weight="700"
            text-anchor="${statTextAnchor}" dominant-baseline="middle">${txtAtk}</text>
    </g>

  </g>
</svg>`;

  return {
    width: statSvgW,
    height: statSvgH,
    uri: createSvgTexture(statSvg),
  };
}

export function buildCountBadgesSvg(countBadges, width, height) {
  if (!countBadges.length) return null;

  const texts = countBadges.map((badge) => `
  <text x="${badge.x}" y="${badge.y}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="10"
        font-family="Tahoma"
        font-weight="900"
        fill="#ffffff"
        stroke="#000000"
        stroke-width="3"
        paint-order="stroke">${badge.text}</text>`).join('');

  return createSvgTexture(`
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${texts}
</svg>`);
}
