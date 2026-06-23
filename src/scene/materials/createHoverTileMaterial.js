import { ShaderMaterial, Vector3 } from 'three';
import { APP_CONFIG } from '../../config/appConfig.js';

function colorVector(color) {
  return new Vector3(color[0], color[1], color[2]);
}

export function createHoverTileMaterial(config = APP_CONFIG.hover) {
  return new ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: config.opacity },
      uDashRepeats: { value: config.dashRepeats },
      uDashSpeed: { value: config.dashSpeed },
      uRunnerRepeats: { value: config.runnerRepeats },
      uRunnerSpeed: { value: config.runnerSpeed },
      uPulseSpeed: { value: config.pulseSpeed },
      uBaseColor: { value: colorVector(config.colors.base) },
      uHotColor: { value: colorVector(config.colors.hot) },
      uAccentColor: { value: colorVector(config.colors.accent) },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;

      uniform float uTime;
      uniform float uOpacity;
      uniform float uDashRepeats;
      uniform float uDashSpeed;
      uniform float uRunnerRepeats;
      uniform float uRunnerSpeed;
      uniform float uPulseSpeed;
      uniform vec3 uBaseColor;
      uniform vec3 uHotColor;
      uniform vec3 uAccentColor;

      float perimeterPosition(vec2 uv) {
        vec2 d = abs(uv - 0.5);

        if (d.y > d.x) {
          return uv.y > 0.5 ? uv.x : 3.0 - uv.x;
        }

        return uv.x > 0.5 ? 1.0 + (1.0 - uv.y) : 3.0 + uv.y;
      }

      void main() {
        vec2 centered = abs(vUv - 0.5);
        float edgeDistance = 0.5 - max(centered.x, centered.y);

        float lineCore = 1.0 - smoothstep(0.018, 0.105, edgeDistance);
        float lineGlow = 1.0 - smoothstep(0.040, 0.22, edgeDistance);
        float emptyCenter = 1.0 - smoothstep(0.18, 0.24, edgeDistance);

        float path = perimeterPosition(vUv);
        float dashPhase = fract(path * uDashRepeats - uTime * uDashSpeed);
        float dashHead = smoothstep(0.015, 0.075, dashPhase);
        float dashTail = 1.0 - smoothstep(0.54, 0.72, dashPhase);
        float dash = dashHead * dashTail;

        float runnerPhase = fract(path * uRunnerRepeats - uTime * uRunnerSpeed);
        float runner = smoothstep(0.02, 0.10, runnerPhase) * (1.0 - smoothstep(0.14, 0.34, runnerPhase));
        float pulse = 0.72 + 0.28 * sin(uTime * uPulseSpeed);

        vec3 color = mix(uBaseColor, uHotColor, dash);
        color = mix(color, uAccentColor, runner * 0.45);

        float alpha = lineCore * 0.18;
        alpha += dash * lineCore * (0.98 + 0.02 * pulse);
        alpha += runner * lineCore * 0.82;
        alpha += dash * lineGlow * 0.42;
        alpha *= emptyCenter * uOpacity;

        if (alpha < 0.01) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
}
