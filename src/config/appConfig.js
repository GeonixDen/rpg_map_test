const VITE_ENV = import.meta.env || {};

const backendBaseUrl = VITE_ENV.VITE_SERVER_URL || VITE_ENV.VITE_BOT_RPG_API_URL || 'http://127.0.0.1:3000';
const backendDevUserId =
  VITE_ENV.VITE_DEV_USER_ID ||
  VITE_ENV.VITE_USER_ID ||
  VITE_ENV.VITE_TELEGRAM_USER_ID ||
  VITE_ENV.VITE_BOT_RPG_DEV_USER_ID ||
  '1023513907';
const backendDevKey = VITE_ENV.VITE_DEV_KEY || VITE_ENV.VITE_BOT_RPG_DEV_KEY || '';

export const APP_CONFIG = {
  data: {
    mapsUrl: '/data/maps.json',
    tilesetUrl: '/data/tiles.jpg',
  },

  backend: {
    enabled: VITE_ENV.VITE_BOT_RPG_BACKEND !== 'false',
    baseUrl: backendBaseUrl,
    botUsername: VITE_ENV.VITE_BOT_USERNAME || '',
    devUserId: backendDevUserId,
    devKey: backendDevKey,
    pollMs: Number(VITE_ENV.VITE_BOT_RPG_POLL_MS) || 2500,
  },

  tileAtlas: {
    tileSize: 16,
    gap: 1,
    margin: 0,
    scale: 2,
    uvInset: 0.5,
  },

  pixelArt: {
    enabled: true,
    snapFollowZoom: true,
    snapCameraPosition: true,
    minSnapZoom: 8,
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
      default: 20,
      min: 12,
      max: 180,
      step: 1,
    },
    fit: {
      paddingTiles: 2,
      scale: 1,
      minZoom: 1,
      maxZoom: 54,
    },
    controls: {
      dampingFactor: 0.08,
    },
    flyTo: {
      duration: 0.55,
    },
    follow: {
      smoothing: 9,
      movementSmoothing: 6.5,
    },
  },

  movement: {
    stepMs: 125,
    minStepMs: 42,
    maxDurationMs: 2400,
    easing: 'smootherstep',
    cameraEasing: 'linear',
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
    dashSpeed: 1.2,
    runnerRepeats: 2,
    runnerSpeed: 0.65,
    pulseSpeed: 5,
    colors: {
      base: [0.28, 1.0, 0.9],
      hot: [0.92, 1.0, 0.96],
      accent: [1.0, 0.72, 0.28],
    },
    types: {
      npc: {
        base: [1.0, 0.68, 0.18],
        hot: [1.0, 0.94, 0.58],
        accent: [1.0, 0.44, 0.08],
        opacity: 1,
      },
      road: {
        base: [0.86, 0.9, 0.94],
        hot: [1.0, 1.0, 1.0],
        accent: [0.72, 0.82, 0.95],
        opacity: 0.95,
      },
      none: {
        base: [0.34, 0.36, 0.38],
        hot: [0.62, 0.65, 0.68],
        accent: [0.42, 0.44, 0.48],
        opacity: 0.72,
      },
      transition: {
        base: [0.18, 0.48, 1.0],
        hot: [0.68, 0.88, 1.0],
        accent: [0.22, 0.95, 1.0],
        opacity: 1,
      },
    },
  },

  transitionLabels: {
    visibleByDefault: true,
    locale: 'ru',
    arrows: ['🔼', '▶️', '🔽', '◀️'],
    maxBadgeTiles: 6.5,
    pixelsPerTile: 30,
    minWorldWidth: 1.45,
    offsetTiles: 0.14,
    z: 0.24,
    badge: {
      textureScale: 3,
      fontSize: 15,
      fontWeight: 700,
      padX: 10,
      padY: 6,
      minW: 110,
      h: 24,
      cut: 16,
      px: 2,
      background: '#171c29',
      opacity: 0.95,
      textColor: '#ffffff',
      textStrokeColor: 'rgba(0,0,0,0.72)',
      textStrokeWidth: 3,
      textShadowColor: 'rgba(0,0,0,0.9)',
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
    innerFadeTiles: 2,
    outerFadeTiles: 10,
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

  treeSway: {
    enabled: true,
    tileCoords: [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
      [0, 2],
      [1, 2],
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
      [0, 4],
      [1, 4],
      [0, 5],
      [2, 5],
      [3, 5],
      [5, 5],
      [6, 5],
    ],
    maxAnimatedInstances: 12000,
    amplitudeTiles: 0.045,
    liftTiles: 0.01,
    speed: 1.35,
    phaseScale: 0.47,
    trunkAnchor: -0.24,
  },

  dynamicEntities: {
    visible: true,
    scale: 1,
    otherPlayers: {
      z: 0.205,
      renderOrder: 320,
    },
    actors: {
      z: 0.215,
      renderOrder: 340,
    },
    fallbackEmojiByKind: {
      player: '🟢1',
      otherPlayer: '🟢1_o',
      npc: '❗',
      battlepoint: '🟥',
      enemy: '⚔',
      consumable: '🌿',
      hunt: '🦴',
    },
  },

  mapBounds: {
    color: '#d8a657',
    opacity: 0.55,
    z: 0.11,
  },
};
