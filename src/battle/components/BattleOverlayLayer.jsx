import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { animated, to, useTransition } from '@react-spring/web';
import { APP_CONFIG } from '../../config/appConfig.js';

const BATTLE_TRANSIENT_EFFECTS = APP_CONFIG.battle?.effects?.transient || {};
const EFFECT_VISIBLE_MS = {
  damage: numberOr(BATTLE_TRANSIENT_EFFECTS.damageVisibleMs, 170),
  heal: numberOr(BATTLE_TRANSIENT_EFFECTS.healVisibleMs, 210),
};
const EFFECT_TRANSITION = {
  duration: numberOr(BATTLE_TRANSIENT_EFFECTS.transitionDurationMs, 82),
  enterOpacity: numberOr(BATTLE_TRANSIENT_EFFECTS.enterOpacity, 0.98),
  fromScale: numberOr(BATTLE_TRANSIENT_EFFECTS.fromScale, 0.58),
  enterScale: numberOr(BATTLE_TRANSIENT_EFFECTS.enterScale, 1.06),
  leaveScale: numberOr(BATTLE_TRANSIENT_EFFECTS.leaveScale, 1.24),
};

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function pxToPercent(value, base) {
  return `${(value / base) * 100}%`;
}

function PositionedImageComponent({
  src,
  left,
  top,
  width,
  height,
  sceneWidth,
  sceneHeight,
  className,
  centered = false,
  style,
}) {
  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      className={className}
      draggable="false"
      style={{
        left: pxToPercent(left, sceneWidth),
        top: pxToPercent(top, sceneHeight),
        width: pxToPercent(width, sceneWidth),
        height: pxToPercent(height, sceneHeight),
        transform: centered ? 'translate(-50%, -50%)' : undefined,
        ...style,
      }}
    />
  );
}

const PositionedImage = memo(PositionedImageComponent);

function BattleTransientEffects({ scene, items }) {
  const [activeEffects, setActiveEffects] = useState([]);
  const seenIdsRef = useRef(new Set());
  const timeoutsRef = useRef(new Map());

  useEffect(() => () => {
    timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    const nextEffects = items.filter((item) => !seenIdsRef.current.has(item.id));

    if (nextEffects.length === 0) return;

    nextEffects.forEach((item) => {
      seenIdsRef.current.add(item.id);
      const visibleMs = item.effectType === 'heal'
        ? EFFECT_VISIBLE_MS.heal
        : EFFECT_VISIBLE_MS.damage;
      const timeoutId = window.setTimeout(() => {
        setActiveEffects((current) => current.filter((entry) => entry.id !== item.id));
        timeoutsRef.current.delete(item.id);
      }, visibleMs);
      timeoutsRef.current.set(item.id, timeoutId);
    });

    setActiveEffects((current) => [...current, ...nextEffects]);
  }, [items]);

  useEffect(() => {
    if (items.length === 0 && activeEffects.length === 0) {
      seenIdsRef.current.clear();
    }
  }, [activeEffects.length, items.length]);

  const transitions = useTransition(activeEffects, {
    keys: (item) => item.id,
    from: { opacity: 0, transform: `translate(-50%, -50%) scale(${EFFECT_TRANSITION.fromScale})` },
    enter: {
      opacity: EFFECT_TRANSITION.enterOpacity,
      transform: `translate(-50%, -50%) scale(${EFFECT_TRANSITION.enterScale})`,
    },
    leave: { opacity: 0, transform: `translate(-50%, -50%) scale(${EFFECT_TRANSITION.leaveScale})` },
    config: { duration: EFFECT_TRANSITION.duration },
  });

  return transitions((style, item) => (
    <animated.img
      key={item.id}
      src={item.src}
      alt=""
      draggable="false"
      className={`battle-test__overlay-image battle-test__overlay-image--effect battle-test__overlay-image--effect-${item.effectType || 'damage'}`}
      style={{
        left: pxToPercent(item.left, scene.width),
        top: pxToPercent(item.top, scene.height),
        width: pxToPercent(item.width, scene.width),
        height: pxToPercent(item.height, scene.height),
        ...style,
      }}
    />
  ));
}

function hashFloatingId(value = '') {
  let hash = 0;
  const text = String(value);

  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }

  return Math.abs(hash);
}

function buildFloatingMotion(item, index) {
  const hash = hashFloatingId(`${item.id}:${index}`);
  const direction = hash % 2 === 0 ? 1 : -1;
  const lane = ((hash >> 3) % 7) - 3;
  const wobble = ((hash >> 7) % 100) / 100;
  const x = direction * (18 + Math.abs(lane) * 7 + wobble * 10);
  const startX = -direction * (4 + wobble * 8);
  const lift = 34 + ((hash >> 11) % 22);
  const exitLift = lift + 28 + ((hash >> 15) % 18);
  const rotate = direction * (2 + wobble * 5);
  const scale = 0.98 + (((hash >> 19) % 14) / 100);

  return {
    ...item,
    motion: {
      startX,
      startY: 8 + ((hash >> 21) % 7),
      x,
      y: -lift,
      exitX: x + direction * (8 + Math.abs(lane) * 3),
      exitY: -exitLift,
      rotate,
      scale,
    },
  };
}

function BattleFloatingNumbers({ scene, items }) {
  const [activeNumbers, setActiveNumbers] = useState([]);
  const seenIdsRef = useRef(new Set());
  const timeoutsRef = useRef(new Map());

  useEffect(() => () => {
    timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutsRef.current.clear();
  }, []);

  useEffect(() => {
    const nextNumbers = items.filter((item) => !seenIdsRef.current.has(item.id));

    if (nextNumbers.length === 0) return;

    const preparedNumbers = nextNumbers.map((item, index) => buildFloatingMotion(item, index));

    preparedNumbers.forEach((item) => {
      seenIdsRef.current.add(item.id);
      const timeoutId = window.setTimeout(() => {
        setActiveNumbers((current) => current.filter((entry) => entry.id !== item.id));
        timeoutsRef.current.delete(item.id);
      }, 920);
      timeoutsRef.current.set(item.id, timeoutId);
    });

    setActiveNumbers((current) => [...current, ...preparedNumbers]);
  }, [items]);

  useEffect(() => {
    if (items.length === 0 && activeNumbers.length === 0) {
      seenIdsRef.current.clear();
    }
  }, [activeNumbers.length, items.length]);

  const transitions = useTransition(activeNumbers, {
    keys: (item) => item.id,
    from: (item) => ({
      opacity: 0,
      x: item.motion.startX,
      y: item.motion.startY,
      scale: 0.78,
      rotate: item.motion.rotate * -0.25,
    }),
    enter: (item) => ({
      opacity: 1,
      x: item.motion.x,
      y: item.motion.y,
      scale: item.motion.scale,
      rotate: item.motion.rotate,
    }),
    leave: (item) => ({
      opacity: 0,
      x: item.motion.exitX,
      y: item.motion.exitY,
      scale: 0.9,
      rotate: item.motion.rotate * 1.3,
    }),
    config: { tension: 430, friction: 26 },
  });

  return transitions((style, item) => (
    <animated.div
      key={item.id}
      className={`battle-test__floating-number battle-test__floating-number--${item.type || 'damage'}`}
      style={{
        left: pxToPercent(item.left, scene.width),
        top: pxToPercent(item.top, scene.height),
        opacity: style.opacity,
        transform: to(
          [style.x, style.y, style.scale, style.rotate],
          (x, y, scale, rotate) => (
            `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`
          ),
        ),
      }}
    >
      {item.text}
    </animated.div>
  ));
}

function buildPlatformClassName(item, highlightStateById = {}) {
  const highlightState = highlightStateById?.[item.charId];

  return [
    'battle-test__overlay-image',
    'battle-test__overlay-image--platform',
    highlightState ? `battle-test__overlay-image--platform-${highlightState}` : '',
  ].filter(Boolean).join(' ');
}

export const BattleUnderlay = memo(function BattleUnderlay({ scene, items, highlightStateById }) {
  return (
    <div className="battle-test__overlay battle-test__overlay--under">
      {items.map((item) => (
        <PositionedImage
          key={item.id}
          src={item.uri}
          left={item.left}
          top={item.top}
          width={item.width}
          height={item.height}
          sceneWidth={scene.width}
          sceneHeight={scene.height}
          className={buildPlatformClassName(item, highlightStateById)}
          style={item.style}
        />
      ))}
    </div>
  );
});

export const BattleOverlay = memo(function BattleOverlay({ scene, items, countsUri, floatingTexts = [] }) {
  const effectItems = useMemo(
    () => items.filter((item) => item.kind === 'effect'),
    [items],
  );
  const staticItems = useMemo(
    () => items.filter((item) => item.kind !== 'meta' && item.kind !== 'effect'),
    [items],
  );

  return (
    <div className="battle-test__overlay battle-test__overlay--over">
      {staticItems.map((item) => (
        <PositionedImage
          key={item.id}
          src={item.uri || item.src}
          left={item.left}
          top={item.top}
          width={item.width}
          height={item.height}
          sceneWidth={scene.width}
          sceneHeight={scene.height}
          centered={Boolean(item.centered)}
          className={`battle-test__overlay-image battle-test__overlay-image--${item.kind || 'svg'}${item.tone ? ` battle-test__overlay-image--${item.tone}` : ''}`}
          style={item.style}
        />
      ))}

      <BattleTransientEffects scene={scene} items={effectItems} />

      {countsUri ? (
        <img
          src={countsUri}
          alt=""
          className="battle-test__overlay-image battle-test__overlay-image--counts"
          draggable="false"
        />
      ) : null}

      <BattleFloatingNumbers scene={scene} items={floatingTexts} />
    </div>
  );
});
