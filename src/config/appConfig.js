export const APP_CONFIG = {
  data: {
    mapsUrl: '/data/maps.json',
    tilesetUrl: '/data/tiles.jpg',
  },

  tileAtlas: {
    tileSize: 16,
    gap: 1,
    margin: 0,
    scale: 2,
    uvInset: 0.5,
  },

  mapModel: {
    chunkSize: 24,
    fallbackEmoji: '⬛',
  },

  renderer: {
    background: '#0b0d0e',
    dpr: [1, 2],
    gl: {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    },
  },

  camera: {
    initialZoom: 16,
    positionZ: 100,
    near: -1000,
    far: 1000,
    minZoom: 0.7,
    maxZoom: 96,
    distance: {
      default: 62,
      min: 12,
      max: 180,
      step: 1,
    },
    fit: {
      paddingTiles: 6,
      scale: 0.9,
      minZoom: 1.2,
      maxZoom: 54,
    },
    controls: {
      dampingFactor: 0.08,
    },
    flyTo: {
      duration: 0.55,
    },
  },

  lod: {
    overviewEnterZoom: 4,
    overviewExitZoom: 5,
    overviewMinCells: 8000,
    maxOverviewTextureDim: 4096,
    detailedTilePxCellLimit: 12000,
    detailedTilePx: 3,
    coarseTilePx: 1,
  },

  hover: {
    hitPlaneZ: 0.22,
    markerZ: 0.3,
    clickDeltaTolerance: 5,
    opacity: 1,
    dashRepeats: 6,
    dashSpeed: 1.9,
    runnerRepeats: 2,
    runnerSpeed: 0.65,
    pulseSpeed: 5,
    colors: {
      base: [0.28, 1.0, 0.9],
      hot: [0.92, 1.0, 0.96],
      accent: [1.0, 0.72, 0.28],
    },
  },

  transitionLabels: {
    visibleByDefault: true,
    locale: 'ru',
    arrows: ['🔼', '▶️', '🔽', '◀️'],
    maxBadgeTiles: 5,
    pixelsPerTile: 30,
    minWorldWidth: 1.45,
    offsetTiles: 0.14,
    z: 0.24,
    badge: {
      fontSize: 14,
      padX: 10,
      padY: 6,
      minW: 110,
      h: 24,
      cut: 16,
      px: 2,
      background: '#171c29',
      opacity: 0.95,
      textColor: '#ffffff',
      highlight: 'rgba(255,255,255,0.18)',
      shadow: 'rgba(0,0,0,0.45)',
      dither: 'rgba(255,255,255,0.05)',
      borderColor: null,
      borderStroke: 2,
      borderOpacity: 0.95,
    },
  },

  edgeFog: {
    enabled: true,
    innerFadeTiles: 2.1,
    outerFadeTiles: 3.2,
    z: 0.18,
    opacity: 1,
    color: '#0b0d0e',
    mistColor: '#c8e4e1',
    animation: {
      enabled: true,
      speed: 0.32,
      waveScale: 0.72,
      driftScale: 0.38,
      mistStrength: 0.24,
    },
  },

  mapBounds: {
    color: '#d8a657',
    opacity: 0.55,
    z: 0.11,
  },
};
