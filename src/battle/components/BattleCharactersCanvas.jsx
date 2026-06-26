import { memo, Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { a, to, useSpring } from '@react-spring/three';
import { Color, PlaneGeometry, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2 } from 'three';
import { APP_CONFIG } from '../../config/appConfig.js';

const OUTLINE_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const OUTLINE_FRAGMENT_SHADER = `
  uniform sampler2D uMap;
  uniform vec2 uTexelSize;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uThickness;
  uniform float uFlipX;

  varying vec2 vUv;

  vec2 orientUv(vec2 uv) {
    return vec2(mix(uv.x, 1.0 - uv.x, uFlipX), uv.y);
  }

  float sampleAlpha(vec2 uv) {
    return texture2D(uMap, orientUv(uv)).a;
  }

  void main() {
    float alpha = sampleAlpha(vUv);

    if (alpha <= 0.01) {
      discard;
    }

    vec2 texel = uTexelSize * uThickness;
    float minNeighbor = 1.0;

    minNeighbor = min(minNeighbor, sampleAlpha(vUv + vec2(texel.x, 0.0)));
    minNeighbor = min(minNeighbor, sampleAlpha(vUv + vec2(-texel.x, 0.0)));
    minNeighbor = min(minNeighbor, sampleAlpha(vUv + vec2(0.0, texel.y)));
    minNeighbor = min(minNeighbor, sampleAlpha(vUv + vec2(0.0, -texel.y)));
    minNeighbor = min(minNeighbor, sampleAlpha(vUv + vec2(texel.x, texel.y)));
    minNeighbor = min(minNeighbor, sampleAlpha(vUv + vec2(-texel.x, texel.y)));
    minNeighbor = min(minNeighbor, sampleAlpha(vUv + vec2(texel.x, -texel.y)));
    minNeighbor = min(minNeighbor, sampleAlpha(vUv + vec2(-texel.x, -texel.y)));

    float edge = 1.0 - smoothstep(0.02, 0.18, minNeighbor);

    if (edge <= 0.001 || uOpacity <= 0.001) {
      discard;
    }

    gl_FragColor = vec4(uColor, edge * uOpacity * alpha);
  }
`;

const SPRITE_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SPRITE_FRAGMENT_SHADER = `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uStunned;
  uniform float uStunStrength;
  uniform float uStunDesaturation;
  uniform float uStunBrightness;
  uniform float uFlipX;
  uniform vec3 uFlashColor;
  uniform float uFlashStrength;

  varying vec2 vUv;

  void main() {
    vec2 uv = vec2(mix(vUv.x, 1.0 - vUv.x, uFlipX), vUv.y);
    vec4 color = texture2D(uMap, uv);

    if (color.a <= 0.01) {
      discard;
    }

    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 stunnedColor = clamp(
      mix(color.rgb, vec3(gray), clamp(uStunDesaturation, 0.0, 1.0)) * max(0.0, uStunBrightness),
      0.0,
      1.0
    );
    color.rgb = mix(color.rgb, stunnedColor, clamp(uStunned * uStunStrength, 0.0, 1.0));
    color.rgb = mix(color.rgb, uFlashColor, clamp(uFlashStrength, 0.0, 1.0));
    color.a *= uOpacity;

    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`;

const SHARED_SPRITE_GEOMETRY = new PlaneGeometry(1, 1);
const RESIZE_CONFIG = { scroll: false };
const BATTLE_CONFIG = APP_CONFIG.battle || {};
const BATTLE_HIGHLIGHTS = BATTLE_CONFIG.highlights || {};
const BATTLE_ANIMATIONS = BATTLE_CONFIG.animations || {};
const STUN_STATUS_EFFECT = BATTLE_CONFIG.statusEffects?.stun || {};
const IDLE_ANIMATION = BATTLE_ANIMATIONS.idle || {};
const ATTACK_ANIMATION = BATTLE_ANIMATIONS.attack || {};
const IMPACT_ANIMATION = BATTLE_ANIMATIONS.impact || {};
const HEAL_ANIMATION = BATTLE_ANIMATIONS.heal || {};
const FLASH_ANIMATION = BATTLE_ANIMATIONS.flash || {};
const LIFE_ANIMATION = BATTLE_ANIMATIONS.life || {};

const HIGHLIGHT_KEY_BY_STATE = {
  'hovered-targetable': 'hoveredTargetable',
  targetable: 'targetable',
  selected: 'selected',
  'hovered-selectable': 'hoveredSelectable',
};

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getDirectedStep(step = {}, direction = 1, fallbackDuration = 80) {
  return {
    offsetX: direction * numberOr(step.x, 0),
    offsetY: numberOr(step.y, 0),
    rotation: direction * numberOr(step.rotation, 0),
    config: { duration: numberOr(step.duration, fallbackDuration) },
  };
}

function getHighlightConfig(highlightState) {
  const key = HIGHLIGHT_KEY_BY_STATE[highlightState] || 'default';
  return BATTLE_HIGHLIGHTS[key] || BATTLE_HIGHLIGHTS.default || { color: '#ffffff', opacity: 0, thickness: 1.2 };
}

function hashString(value = '') {
  let hash = 0;
  const text = String(value);

  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }

  return Math.abs(hash);
}

function getImpactFlash(type) {
  const flash = FLASH_ANIMATION.types?.[type];
  if (!flash) return null;

  return {
    color: flash.color || '#ffffff',
    strength: numberOr(flash.strength, 0),
  };
}

function getLifeAnimationTarget(actor) {
  const direction = actor.attackDirection || 1;

  if (actor.animation.removingDead) {
    return {
      opacity: numberOr(LIFE_ANIMATION.deadFadeOpacity, 0),
      dropY: numberOr(LIFE_ANIMATION.deadFadeDropY, -34),
      scale: numberOr(LIFE_ANIMATION.deadFadeScale, 0.72),
      rotation: direction * numberOr(LIFE_ANIMATION.deadFadeRotation, 0.075),
      config: { duration: numberOr(LIFE_ANIMATION.removeDeadFadeMs, 420) },
    };
  }

  if (actor.animation.dead) {
    return {
      opacity: numberOr(LIFE_ANIMATION.deadOpacity, 0.16),
      dropY: numberOr(LIFE_ANIMATION.deadDropY, -18),
      scale: numberOr(LIFE_ANIMATION.deadScale, 0.88),
      rotation: direction * numberOr(LIFE_ANIMATION.deadRotation, 0.025),
      config: LIFE_ANIMATION.spring || { tension: 220, friction: 24 },
    };
  }

  return {
    opacity: 1,
    dropY: 0,
    scale: 1,
    rotation: 0,
    config: LIFE_ANIMATION.spring || { tension: 220, friction: 24 },
  };
}

function CanvasDebugProbe({ enabled, spriteCount, onSample }) {
  const { gl, size } = useThree();
  const sampleRef = useRef({
    startedAt: 0,
    lastAt: 0,
    frames: 0,
    frameMs: 0,
  });

  useEffect(() => {
    if (!enabled) return;

    const now = performance.now();
    sampleRef.current = {
      startedAt: now,
      lastAt: now,
      frames: 0,
      frameMs: 0,
    };
  }, [enabled]);

  useFrame((state, delta) => {
    if (!enabled || !onSample) return;

    const now = performance.now();
    const current = sampleRef.current;

    if (!current.startedAt) {
      current.startedAt = now;
      current.lastAt = now;
    }

    current.frames += 1;
    current.frameMs += delta * 1000;

    if (now - current.lastAt < 280) {
      return;
    }

    const elapsed = Math.max(1, now - current.lastAt);
    const fps = Math.round((current.frames * 1000) / elapsed);
    const avgFrameMs = Number((current.frameMs / Math.max(1, current.frames)).toFixed(1));

    onSample({
      fps,
      frameMs: avgFrameMs,
      perfScore: Number(state.performance.current.toFixed(2)),
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      lines: gl.info.render.lines,
      points: gl.info.render.points,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      pixelRatio: Number(gl.getPixelRatio().toFixed(2)),
      canvasWidth: size.width,
      canvasHeight: size.height,
      spriteCount,
      elapsedMs: Math.round(now - current.startedAt),
      elapsedSec: Number(state.clock.elapsedTime.toFixed(1)),
    });

    current.lastAt = now;
    current.frames = 0;
    current.frameMs = 0;
  });

  return null;
}

function CharacterSpriteComponent({ actor, scene }) {
  const idleGroupRef = useRef(null);
  const texture = useLoader(TextureLoader, actor.spriteUrl);
  const displayTexture = useMemo(() => texture.clone(), [texture]);
  const idlePhase = useMemo(() => (
    (hashString(actor.charId || actor.id) % 1000) / 1000 * Math.PI * 2
  ), [actor.charId, actor.id]);
  const image = texture.image;
  const aspect = image?.width && image?.height ? image.width / image.height : 1;
  const fitBoxWidth = Number(actor.drawWidth) || null;
  const fitBoxHeight = actor.drawHeight;
  const fitBoxAspect = fitBoxWidth ? fitBoxWidth / Math.max(1, fitBoxHeight) : null;
  const renderWidth = fitBoxWidth
    ? (aspect > fitBoxAspect ? fitBoxWidth : fitBoxHeight * aspect)
    : fitBoxHeight * aspect;
  const renderHeight = fitBoxWidth
    ? (aspect > fitBoxAspect ? fitBoxWidth / aspect : fitBoxHeight)
    : fitBoxHeight;
  const baseX = actor.centerX - scene.width / 2;
  const baseY = scene.height / 2 - actor.centerY;
  const baseBottomY = baseY - renderHeight / 2;

  const [attackSpring, attackApi] = useSpring(() => ({
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    config: ATTACK_ANIMATION.spring || { tension: 820, friction: 20 },
  }));

  const [hitSpring, hitApi] = useSpring(() => ({
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    config: IMPACT_ANIMATION.spring || { tension: 940, friction: 18 },
  }));

  const [healSpring, healApi] = useSpring(() => ({
    stretchY: 1,
    config: HEAL_ANIMATION.spring || { tension: 560, friction: 16 },
  }));

  const [flashSpring, flashApi] = useSpring(() => ({
    color: '#ffffff',
    shaderStrength: 0,
    config: FLASH_ANIMATION.spring || { tension: 640, friction: 18 },
  }));

  const [lifeSpring, lifeApi] = useSpring(() => getLifeAnimationTarget(actor));

  useEffect(() => {
    displayTexture.colorSpace = SRGBColorSpace;
    displayTexture.wrapS = RepeatWrapping;
    displayTexture.repeat.set(actor.shouldFlip ? -1 : 1, 1);
    displayTexture.offset.set(actor.shouldFlip ? 1 : 0, 0);
    displayTexture.needsUpdate = true;

    return () => {
      displayTexture.dispose();
    };
  }, [actor.shouldFlip, displayTexture]);

  useFrame((state) => {
    const group = idleGroupRef.current;
    if (!group) return;

    if (actor.animation.dead || IDLE_ANIMATION.enabled === false) {
      group.scale.x = 1;
      group.scale.y = 1;
      group.position.y = 0;
      return;
    }

    const breath = Math.sin(state.clock.elapsedTime * numberOr(IDLE_ANIMATION.speed, 2.05) + idlePhase);
    const breath01 = (breath + 1) * 0.5;
    const upperLift = Math.pow(
      breath01,
      numberOr(IDLE_ANIMATION.curve, 1.35),
    ) * numberOr(IDLE_ANIMATION.maxUpperLift, 0.027);

    group.scale.x = 1;
    group.scale.y = 1 + upperLift;
    group.position.y = 0;
  });

  useEffect(() => {
    if (!actor.animation.attackToken) return;
    const steps = Array.isArray(ATTACK_ANIMATION.steps) ? ATTACK_ANIMATION.steps : [];

    attackApi.start({
      to: async (next) => {
        for (const step of steps) {
          await next(getDirectedStep(step, actor.attackDirection, 80));
        }
      },
    });
  }, [actor.animation.attackToken, actor.attackDirection, attackApi]);

  useEffect(() => {
    if (!actor.animation.hitToken) return;
    const impactType = actor.animation.impactType || 'damage';
    const typeSteps = IMPACT_ANIMATION.types?.[impactType] || IMPACT_ANIMATION.types?.damage || [];
    const settleStep = IMPACT_ANIMATION.settle || { x: 0, y: 0, rotation: 0, duration: 78 };

    hitApi.start({
      to: async (next) => {
        for (const step of typeSteps) {
          await next(getDirectedStep(step, actor.attackDirection, 58));
        }
        await next(getDirectedStep(settleStep, actor.attackDirection, 78));
      },
    });
  }, [actor.animation.hitToken, actor.animation.impactType, actor.attackDirection, hitApi]);

  useEffect(() => {
    if (!actor.animation.healToken) return;

    healApi.start({
      to: async (next) => {
        await next({
          stretchY: numberOr(HEAL_ANIMATION.stretchY, numberOr(HEAL_ANIMATION.pulseScale, 1.012)),
          config: { duration: numberOr(HEAL_ANIMATION.pulseDuration, 86) },
        });
        await next({
          stretchY: 1,
          config: { duration: numberOr(HEAL_ANIMATION.settleDuration, 130) },
        });
      },
    });
  }, [actor.animation.healToken, healApi]);

  useEffect(() => {
    lifeApi.start(getLifeAnimationTarget(actor));
  }, [actor.animation.dead, actor.animation.deathToken, actor.animation.removingDead, actor.attackDirection, lifeApi]);

  const x = to([attackSpring.offsetX, hitSpring.offsetX], (attackOffsetX, hitOffsetX) => (
    baseX + attackOffsetX + hitOffsetX
  ));
  const y = to([attackSpring.offsetY, hitSpring.offsetY, lifeSpring.dropY], (attackOffsetY, hitOffsetY, dropY) => (
    baseBottomY + attackOffsetY + hitOffsetY + dropY
  ));
  const rotation = to([attackSpring.rotation, hitSpring.rotation, lifeSpring.rotation], (attackRotation, hitRotation, lifeRotation) => (
    attackRotation + hitRotation + lifeRotation
  ));
  const scaleX = lifeSpring.scale.to((value) => renderWidth * value);
  const scaleY = lifeSpring.scale.to((value) => renderHeight * value);
  const healStretchY = healSpring.stretchY;
  const highlightConfig = useMemo(
    () => getHighlightConfig(actor.highlightState),
    [actor.highlightState],
  );
  const outlineUniforms = useMemo(() => ({
    uMap: { value: displayTexture },
    uTexelSize: { value: new Vector2(1 / Math.max(1, image?.width || 1), 1 / Math.max(1, image?.height || 1)) },
    uColor: { value: new Color(highlightConfig.color) },
    uOpacity: { value: highlightConfig.opacity },
    uThickness: { value: highlightConfig.thickness },
    uFlipX: { value: actor.shouldFlip ? 1 : 0 },
  }), [actor.shouldFlip, displayTexture, highlightConfig.color, highlightConfig.opacity, highlightConfig.thickness, image?.height, image?.width]);
  const spriteUniforms = useMemo(() => ({
    uMap: { value: displayTexture },
    uOpacity: { value: 1 },
    uStunned: { value: actor.stunned ? 1 : 0 },
    uStunStrength: { value: numberOr(STUN_STATUS_EFFECT.strength, 1) },
    uStunDesaturation: { value: numberOr(STUN_STATUS_EFFECT.desaturation, 0.38) },
    uStunBrightness: { value: numberOr(STUN_STATUS_EFFECT.brightness, 0.84) },
    uFlipX: { value: actor.shouldFlip ? 1 : 0 },
    uFlashColor: { value: new Color('#ffffff') },
    uFlashStrength: { value: 0 },
  }), [actor.shouldFlip, actor.stunned, displayTexture]);

  useEffect(() => {
    outlineUniforms.uMap.value = displayTexture;
    outlineUniforms.uTexelSize.value.set(
      1 / Math.max(1, image?.width || 1),
      1 / Math.max(1, image?.height || 1),
    );
    outlineUniforms.uColor.value.set(highlightConfig.color);
    outlineUniforms.uOpacity.value = highlightConfig.opacity;
    outlineUniforms.uThickness.value = highlightConfig.thickness;
    outlineUniforms.uFlipX.value = actor.shouldFlip ? 1 : 0;
  }, [actor.shouldFlip, displayTexture, highlightConfig.color, highlightConfig.opacity, highlightConfig.thickness, image?.height, image?.width, outlineUniforms]);

  useEffect(() => {
    spriteUniforms.uMap.value = displayTexture;
    spriteUniforms.uStunned.value = actor.stunned ? 1 : 0;
    spriteUniforms.uStunStrength.value = numberOr(STUN_STATUS_EFFECT.strength, 1);
    spriteUniforms.uStunDesaturation.value = numberOr(STUN_STATUS_EFFECT.desaturation, 0.38);
    spriteUniforms.uStunBrightness.value = numberOr(STUN_STATUS_EFFECT.brightness, 0.84);
    spriteUniforms.uFlipX.value = actor.shouldFlip ? 1 : 0;
  }, [actor.shouldFlip, actor.stunned, displayTexture, spriteUniforms]);

  useEffect(() => {
    if (!actor.animation.impactToken) return;

    const flash = getImpactFlash(actor.animation.impactType);
    if (!flash) return;

    spriteUniforms.uFlashColor.value.set(flash.color);

    flashApi.start({
      from: {
        color: flash.color,
        shaderStrength: flash.strength,
      },
      to: async (next) => {
        await next({
          color: flash.color,
          shaderStrength: flash.strength,
          config: { duration: numberOr(FLASH_ANIMATION.holdDuration, 46) },
        });
        await next({
          color: '#ffffff',
          shaderStrength: 0,
          config: { duration: numberOr(FLASH_ANIMATION.fadeDuration, 150) },
        });
      },
    });
  }, [actor.animation.impactToken, actor.animation.impactType, flashApi, spriteUniforms]);

  return (
    <a.group
      position-x={x}
      position-y={y}
      position-z={actor.row * 0.1}
      rotation-z={rotation}
      scale-x={scaleX}
      scale-y={scaleY}
      scale-z={1}
    >
      <a.group scale-y={healStretchY}>
        <group ref={idleGroupRef}>
          <group position-y={0.5}>
            <mesh geometry={SHARED_SPRITE_GEOMETRY} renderOrder={actor.row + 10}>
              {actor.stunned ? (
                <a.shaderMaterial
                  transparent
                  depthWrite={false}
                  depthTest={false}
                  toneMapped={false}
                  uniforms={spriteUniforms}
                  vertexShader={SPRITE_VERTEX_SHADER}
                  fragmentShader={SPRITE_FRAGMENT_SHADER}
                  uniforms-uOpacity-value={lifeSpring.opacity}
                  uniforms-uFlashStrength-value={flashSpring.shaderStrength}
                />
              ) : (
                <a.meshBasicMaterial
                  map={displayTexture}
                  transparent
                  depthWrite={false}
                  depthTest={false}
                  toneMapped={false}
                  opacity={lifeSpring.opacity}
                  color={flashSpring.color}
                />
              )}
            </mesh>
          </group>

          {highlightConfig.opacity > 0 ? (
            <mesh geometry={SHARED_SPRITE_GEOMETRY} position-y={0.5} position-z={0.01} renderOrder={actor.row + 11}>
              <shaderMaterial
                transparent
                depthWrite={false}
                depthTest={false}
                toneMapped={false}
                uniforms={outlineUniforms}
                vertexShader={OUTLINE_VERTEX_SHADER}
                fragmentShader={OUTLINE_FRAGMENT_SHADER}
              />
            </mesh>
          ) : null}
        </group>
      </a.group>
    </a.group>
  );
}

const CharacterSprite = memo(CharacterSpriteComponent, (prevProps, nextProps) => {
  const prev = prevProps.actor;
  const next = nextProps.actor;

  return (
    prev.id === next.id
    && prev.spriteUrl === next.spriteUrl
    && prev.centerX === next.centerX
    && prev.centerY === next.centerY
    && prev.drawWidth === next.drawWidth
    && prev.drawHeight === next.drawHeight
    && prev.row === next.row
    && prev.shouldFlip === next.shouldFlip
    && prev.attackDirection === next.attackDirection
    && prev.highlightState === next.highlightState
    && prev.stunned === next.stunned
    && prev.animation.attackToken === next.animation.attackToken
    && prev.animation.hitToken === next.animation.hitToken
    && prev.animation.healToken === next.animation.healToken
    && prev.animation.impactToken === next.animation.impactToken
    && prev.animation.impactType === next.animation.impactType
    && prev.animation.deathToken === next.animation.deathToken
    && prev.animation.dead === next.animation.dead
    && prev.animation.removingDead === next.animation.removingDead
    && prevProps.scene.width === nextProps.scene.width
    && prevProps.scene.height === nextProps.scene.height
  );
});

export default function BattleCharactersCanvas({
  scene,
  sprites,
  highlightStateById = {},
  debugEnabled = false,
  onDebugSample,
}) {
  const cameraConfig = useMemo(() => ({
    left: -scene.width / 2,
    right: scene.width / 2,
    top: scene.height / 2,
    bottom: -scene.height / 2,
    near: -100,
    far: 100,
    zoom: 1,
    position: [0, 0, 10],
  }), [scene.height, scene.width]);
  const glConfig = useMemo(() => ({
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance',
  }), []);
  const highlightedSprites = useMemo(() => (
    sprites.map((actor) => ({
      ...actor,
      highlightState: highlightStateById?.[actor.charId] || null,
    }))
  ), [highlightStateById, sprites]);

  return (
    <Canvas
      orthographic
      // dpr={[1, 1.5]}
      frameloop="always"
      gl={glConfig}
      camera={cameraConfig}
      resize={RESIZE_CONFIG}
    >
      <Suspense fallback={null}>
        {highlightedSprites.map((actor) => (
          <CharacterSprite
            key={actor.id}
            actor={actor}
            scene={scene}
          />
        ))}
        <CanvasDebugProbe
          enabled={debugEnabled}
          spriteCount={highlightedSprites.length}
          onSample={onDebugSample}
        />
      </Suspense>
    </Canvas>
  );
}
