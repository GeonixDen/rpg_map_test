import { APP_CONFIG } from '../config/appConfig.js';

function getFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function getSegmentProgress(t, easing = APP_CONFIG.movement?.easing) {
  switch (easing) {
    case 'smooth':
    case 'quad':
      return easeInOutQuad(t);
    case 'sine':
      return easeInOutSine(t);
    case 'smootherstep':
      return smootherstep(t);
    case 'linear':
    default:
      return t;
  }
}

export function toMovementPoint(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function normalizeMovementPath(path) {
  return (Array.isArray(path) ? path : []).map(toMovementPoint).filter(Boolean);
}

export function getMovementTimings(path) {
  const points = normalizeMovementPath(path);
  const segments = Math.max(0, points.length - 1);
  const movementConfig = APP_CONFIG.movement || {};
  const stepMs = getFiniteNumber(movementConfig.stepMs, 110);
  const minStepMs = getFiniteNumber(movementConfig.minStepMs, 42);
  const maxDurationMs = getFiniteNumber(movementConfig.maxDurationMs, 2400);
  const cappedStepMs = segments > 0 ? Math.min(stepMs, maxDurationMs / segments) : 0;
  const segmentMs = segments > 0 ? Math.max(minStepMs, cappedStepMs) : 0;

  return {
    points,
    segments,
    totalMs: segmentMs * segments,
    segmentMs,
  };
}

export function getNowMs() {
  return typeof window !== 'undefined' && window.performance?.now ? window.performance.now() : Date.now();
}

export function sampleMovementPath(animation, nowMs = getNowMs(), options = {}) {
  const { points, segments, totalMs, segmentMs } = getMovementTimings(animation?.path);

  if (points.length === 0) return null;
  if (points.length === 1 || segments <= 0 || segmentMs <= 0) {
    return { ...points[points.length - 1], done: true };
  }

  const startedAtMs = Number.isFinite(Number(animation?.startedAtMs)) ? Number(animation.startedAtMs) : nowMs;
  const elapsed = Math.max(0, nowMs - startedAtMs);
  const rawIndex = Math.floor(elapsed / segmentMs);
  const segmentIndex = clamp(rawIndex, 0, segments - 1);
  const segmentElapsed = elapsed - segmentIndex * segmentMs;
  const t = clamp(segmentElapsed / segmentMs, 0, 1);
  const eased = getSegmentProgress(t, options.easing);
  const from = points[segmentIndex];
  const to = points[segmentIndex + 1] || points[points.length - 1];

  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    done: elapsed >= totalMs,
  };
}
