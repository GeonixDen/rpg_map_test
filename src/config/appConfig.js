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

  mapRenderer: {
    type: 'shader',
    tileMapCacheLimit: 6,
    z: 0,
    treeSway: true,
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
      default: 22,
      min: 22,
      max: 50,
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
    },
  },

  movement: {
    stepMs: 125,
    minStepMs: 42,
    maxDurationMs: 2400,
    easing: 'smootherstep',
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

  mapTransition: {
    fadeMs: 720,
    background: 'rgba(11, 13, 14, 0.88)',
  },

  fog: {
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

  edgeFog: {
    enabled: true,
    innerFadeTiles: 2,
    outerFadeTiles: 10,
    z: 0.18,
    opacity: 1,
  },

  fogOfWar: {
    enabled: true,
    z: 0.19,
    renderOrder: 255,
    opacity: 0.98,
    maxMaskTextureSize: 1536,
    fadeTiles: 2,
    edgeClearMin: 0.52,
    edgeSoftness: 0.48,
    noiseStrength: 0.12,
    revealSpeed: 1.35,
    fadeInSpeed: 4.5,
    fadeOutSpeed: 1.15,
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

  battle: {
    boss: {
      sceneWidth: 300,
      sceneHeight: 480,
      spriteDrawHeight: 480,
      spriteCenterYOffset: 0,
      effectOffsetScale: 1,
      maxStatusIcons: 6,
      hud: {
        visibleQueueRows: 2,
        queueRowHeight: 34,
        queueMinWidth: 168,
        queueHeaderHeight: 6,
        padding: 10,
      },
    },

    actionPanel: {
      width: 188,
      gap: 3,
      screenPadding: 12,
      verticalOffsetFactor: 0.44,
    },

    visualQueue: {
      impactDelayMs: 58,
      stepMs: 215,
      healStepMs: 240,
      syncStatusesWithHits: true,
    },

    effects: {
      transient: {
        damageVisibleMs: 170,
        healVisibleMs: 210,
        transitionDurationMs: 82,
        fromScale: 0.58,
        enterScale: 1.06,
        leaveScale: 1.24,
        enterOpacity: 0.98,
      },
    },

    unmaskIndicator: {
      effectName: 'magic_mask',
      size: 66,
      yOffset: -4,
      bossSize: 96,
      bossYOffset: -16,
      opacity: 0.82,
      pulseScale: 1.08,
      pulseMs: 1450,
      glowColor: 'rgba(255, 220, 140, 0.52)',
    },

    statusEffects: {
      stun: {
        strength: 1,
        desaturation: 1,
        brightness: 0.84,
      },
    },

    highlights: {
      default: {
        color: '#ffffff',
        opacity: 0,
        thickness: 1.2,
      },
      hoveredTargetable: {
        color: '#fff6c2',
        opacity: 1,
        thickness: 3.15,
      },
      targetable: {
        color: '#ffcf57',
        opacity: 1,
        thickness: 2.65,
      },
      selected: {
        color: '#b6f5ff',
        opacity: 0.98,
        thickness: 2.2,
      },
      hoveredSelectable: {
        color: '#c3e8ff',
        opacity: 0.88,
        thickness: 1.9,
      },
    },

    animations: {
      idle: {
        enabled: true,
        speed: 3,
        maxUpperLift: 0.01,
        curve: 5,
        anchorCompensation: 0.5,
      },
      attack: {
        spring: {
          tension: 820,
          friction: 20,
        },
        steps: [
          {
            x: 22,
            y: -2,
            rotation: -0.055,
            duration: 70,
          },
          {
            x: -4,
            y: 1,
            rotation: 0.022,
            duration: 60,
          },
          {
            x: 0,
            y: 0,
            rotation: 0,
            duration: 85,
          },
        ],
      },
      impact: {
        spring: {
          tension: 940,
          friction: 18,
        },
        settle: {
          x: 0,
          y: 0,
          rotation: 0,
          duration: 78,
        },
        types: {
          damage: [
            {
              x: -9,
              y: 2,
              rotation: 0.04,
              duration: 48,
            },
            {
              x: 5,
              y: -1,
              rotation: -0.03,
              duration: 58,
            },
          ],
          block: [
            {
              x: -4,
              y: 0,
              rotation: 0.018,
              duration: 44,
            },
            {
              x: 2,
              y: 0,
              rotation: -0.012,
              duration: 52,
            },
          ],
          dodge: [
            {
              x: -18,
              y: 5,
              rotation: 0.085,
              duration: 64,
            },
            {
              x: 5,
              y: -2,
              rotation: -0.035,
              duration: 66,
            },
          ],
        },
      },
      heal: {
        spring: {
          tension: 560,
          friction: 16,
        },
        stretchY: 1.012,
        liftCompensation: 0.5,
        pulseDuration: 86,
        settleDuration: 130,
      },
      flash: {
        spring: {
          tension: 640,
          friction: 18,
        },
        holdDuration: 46,
        fadeDuration: 150,
        types: {
          damage: {
            color: '#ffb3aa',
            strength: 0.42,
          },
          heal: {
            color: '#b9ffc5',
            strength: 0.36,
          },
        },
      },
      life: {
        spring: {
          tension: 220,
          friction: 24,
        },
        removeDeadAfterMs: 180,
        removeDeadFadeMs: 320,
        deathAfterImpactMs: 210,
        resultRevealDelayMs: 140,
        deadOpacity: 1,
        deadDropY: 0,
        deadScale: 1,
        deadRotation: 0,
        deadFadeOpacity: 0,
        deadFadeDropY: 0,
        deadFadeScale: 1,
        deadFadeRotation: 0,
        uiSettleMs: 260,
        uiDeadOpacity: 1,
        uiDetailDeadOpacity: 1,
        uiDeadDropY: 0,
        uiDeadScale: 1,
        uiFadeOpacity: 0,
        uiFadeDropY: 0,
        uiFadeScale: 1,
        uiFadeBlur: 0,
      },
    },
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

  questGuide: {
    enabled: true,
    z: 0.34,
    renderOrder: 430,
    lookAheadTiles: 5,
    completeDistanceTiles: 1.15,
    routeTravelSpeed: 1.8,
    followSpeed: 8.5,
    fadeInSpeed: 5.6,
    fadeOutSpeed: 7.2,
    bobSpeed: 5.4,
    bobRadius: 0.04,
    chaosRadius: 0.095,
    chaosSpeed: 2.35,
    chaosPhaseScale: 0.67,
    pulseSpeed: 6.8,
    pulseScale: 0.06,
    color: '#ffd86b',
    coreColor: '#fff8b7',
    glowRadius: 0.27,
    glowOpacity: 0.24,
    coreRadius: 0.066,
    coreOpacity: 0.94,
    trailHistoryLength: 28,
    tail: [
      { lag: 4, radius: 0.052, opacity: 0.16 },
      { lag: 8, radius: 0.04, opacity: 0.1 },
      { lag: 13, radius: 0.03, opacity: 0.065 },
    ],
  },

  mapBounds: {
    color: '#d8a657',
    opacity: 0.55,
    z: 0.11,
  },
};
