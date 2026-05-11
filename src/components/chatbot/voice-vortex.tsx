'use client';

import { useRef, useEffect, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════
   Voice Vortex — Modern AI Orb (Siri / Gemini style)
   
   Fluid metaball orb with iridescent gradients and strong
   audio reactivity for both listening (mic) and speaking (TTS).
   
   States:
     idle      — gentle fluid motion, soft breathing
     listening — audio-reactive fluid deformation, mic energy drives shape
     thinking  — rapid swirling vortex with orbiting highlights
     speaking  — audio-reactive pulsing, TTS output drives shape
   ═══════════════════════════════════════════════════════════ */

export type VortexState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceVortexProps {
  state: VortexState;
  size?: number;
  audioData?: Float32Array | null;
  className?: string;
}

/* ─── GLSL Shaders ─── */

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  
  varying vec2 v_uv;
  
  uniform float u_time;
  uniform float u_state;       // 0=idle, 1=listening, 2=thinking, 3=speaking
  uniform float u_audioLevel;  // 0.0 - 1.0 overall audio energy
  uniform float u_bassLevel;   // 0.0 - 1.0 bass frequency energy
  uniform float u_midLevel;    // 0.0 - 1.0 mid frequency energy
  uniform float u_highLevel;   // 0.0 - 1.0 high frequency energy
  uniform vec2 u_resolution;
  
  #define PI 3.14159265359
  #define TAU 6.28318530718
  
  // ─── Noise Functions ───
  
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  // FBM for richer detail
  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 4; i++) {
      val += amp * snoise(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return val;
  }
  
  // ─── Iridescent Color Palette ───
  
  // Modern AI orb palette — cool blues, magentas, cyans with warm accents
  vec3 iridescentColor(float t, float shift) {
    // Core iridescent gradient
    vec3 cyan    = vec3(0.02, 0.84, 0.84);  // #06D7D7
    vec3 blue    = vec3(0.20, 0.45, 0.74);  // #3472BC
    vec3 magenta = vec3(0.89, 0.24, 0.10);  // #E43D19 (warm accent)
    vec3 violet  = vec3(0.45, 0.15, 0.65);  // deep violet
    vec3 white   = vec3(0.95, 0.95, 0.98);  // bright highlight
    
    float i = fract(t + shift);
    
    if (i < 0.2)  return mix(cyan, blue, i / 0.2);
    if (i < 0.4)  return mix(blue, violet, (i - 0.2) / 0.2);
    if (i < 0.6)  return mix(violet, magenta, (i - 0.4) / 0.2);
    if (i < 0.8)  return mix(magenta, cyan, (i - 0.6) / 0.2);
    return mix(white, cyan, (i - 0.8) / 0.2);
  }
  
  // Softer Nothing-themed iridescence (dark bg compatible)
  vec3 orbPalette(float t, float shift, float energy) {
    vec3 cyan    = vec3(0.02, 0.84, 0.84);
    vec3 blue    = vec3(0.20, 0.45, 0.74);
    vec3 magenta = vec3(0.89, 0.24, 0.10);
    vec3 violet  = vec3(0.55, 0.20, 0.75);
    vec3 white   = vec3(0.92, 0.92, 0.96);
    
    // Boost saturation with energy
    float i = fract(t + shift);
    vec3 col;
    
    if (i < 0.25)  col = mix(cyan, blue, i / 0.25);
    else if (i < 0.5)  col = mix(blue, violet, (i - 0.25) / 0.25);
    else if (i < 0.75) col = mix(violet, magenta, (i - 0.5) / 0.25);
    else col = mix(magenta, cyan, (i - 0.75) / 0.25);
    
    // Brighten with energy
    col = mix(col, white, energy * 0.15);
    return col;
  }
  
  // ─── Fluid Deformation ───
  
  vec2 fluidWarp(vec2 uv, float time, float strength) {
    vec2 q = vec2(fbm(uv + time * 0.12), fbm(uv + vec2(5.2, 1.3) + time * 0.1));
    vec2 r = vec2(fbm(uv + 4.0 * q + vec2(1.7, 9.2) + time * 0.15),
                  fbm(uv + 4.0 * q + vec2(8.3, 2.8) + time * 0.126));
    return uv + strength * r;
  }
  
  // Metaball SDF
  float metaball(vec2 p, vec2 center, float radius) {
    return radius / length(p - center);
  }
  
  void main() {
    vec2 uv = (v_uv - 0.5) * 2.0;
    float aspect = u_resolution.x / u_resolution.y;
    uv.x *= aspect;
    
    float dist = length(uv);
    float time = u_time;
    float state = u_state;
    float audio = u_audioLevel;
    float bass = u_bassLevel;
    float mid = u_midLevel;
    float high = u_highLevel;
    
    vec3 color = vec3(0.0);
    float alpha = 0.0;
    
    // ═══ IDLE STATE ═══
    // Gentle fluid motion with soft breathing, subtle iridescence
    if (state < 0.5) {
      float breathe = sin(time * 0.6) * 0.5 + 0.5;
      float radius = 0.38 + breathe * 0.03;
      
      // Smooth fluid warp
      vec2 warped = fluidWarp(uv * 1.5, time * 0.6, 0.08);
      float d = length(warped);
      
      // Soft orb edge
      float orb = smoothstep(radius + 0.08, radius - 0.12, d);
      
      // Iridescent sheen based on warped position
      float sheen = fbm(warped * 2.0 + time * 0.15) * 0.5 + 0.5;
      vec3 orbColor = orbPalette(sheen, time * 0.03, 0.1);
      
      // Subtle internal flow lines
      float flow = sin(atan(warped.y, warped.x) * 3.0 + d * 6.0 - time * 0.5) * 0.5 + 0.5;
      orbColor = mix(orbColor, orbPalette(flow + 0.3, time * 0.04, 0.05), 0.15);
      
      // Center highlight
      float centerGlow = exp(-d * 4.0) * 0.2;
      orbColor += vec3(0.95, 0.95, 0.98) * centerGlow;
      
      // Outer glow
      float glow = exp(-dist * 2.8) * 0.15 * (0.8 + breathe * 0.3);
      vec3 glowColor = orbPalette(time * 0.02, 0.0, 0.0) * glow;
      
      // Specular highlight
      float spec = exp(-length(uv - vec2(-0.1, 0.12)) * 10.0) * 0.2;
      orbColor += vec3(1.0) * spec * orb;
      
      color = orbColor * orb + glowColor;
      alpha = orb * 0.95 + glow * 0.7 + spec * 0.15;
    }
    
    // ═══ LISTENING STATE ═══
    // Strongly audio-reactive: bass drives overall shape, mids drive warping, highs drive detail
    else if (state < 1.5) {
      float energy = 0.15 + audio * 0.85;
      float bassE = 0.15 + bass * 0.85;
      float midE = 0.15 + mid * 0.85;
      float highE = 0.15 + high * 0.85;
      
      // Base radius pulses with bass
      float radius = 0.36 + bassE * 0.18 + sin(time * 1.5) * 0.02;
      
      // Multi-layer fluid warp — each band drives a different layer
      vec2 w1 = fluidWarp(uv * 1.8, time * 0.8, 0.06 + bassE * 0.15);
      vec2 w2 = fluidWarp(uv * 2.5 + 3.0, time * 1.0, 0.04 + midE * 0.12);
      vec2 w3 = fluidWarp(uv * 3.5 + 7.0, time * 1.3, 0.02 + highE * 0.08);
      
      float d1 = length(w1);
      float d2 = length(w2);
      float d3 = length(w3);
      
      // Multiple overlapping orb layers
      float orb1 = smoothstep(radius + 0.1, radius - 0.15, d1);
      float orb2 = smoothstep(radius + 0.15, radius - 0.1, d2) * 0.6;
      float orb3 = smoothstep(radius + 0.2, radius - 0.08, d3) * 0.35;
      
      // Iridescent colors — shift faster with more energy
      float shift1 = time * 0.06 * energy;
      float shift2 = time * 0.09 * energy + 0.3;
      float shift3 = time * 0.12 * energy + 0.6;
      
      vec3 c1 = orbPalette(fbm(w1 * 2.0 + time * 0.2) * 0.5 + 0.5, shift1, energy);
      vec3 c2 = orbPalette(fbm(w2 * 2.5 - time * 0.15) * 0.5 + 0.5, shift2, energy);
      vec3 c3 = orbPalette(fbm(w3 * 3.0 + time * 0.25) * 0.5 + 0.5, shift3, energy);
      
      vec3 orbColor = c1 * orb1 + c2 * orb2 + c3 * orb3;
      
      // Bright center
      float centerBright = exp(-dist * 3.5) * 0.25 * energy;
      orbColor += vec3(0.95, 0.95, 0.98) * centerBright;
      
      // Energy-reactive outer glow
      float glow = exp(-dist * 2.0) * (0.2 + energy * 0.5);
      vec3 glowColor = orbPalette(time * 0.04, 0.5, energy) * glow;
      
      // Audio-reactive wave ripples emanating from orb
      float ripple1 = sin(dist * 15.0 - time * 4.0 * energy) * exp(-dist * 2.5) * bassE * 0.2;
      float ripple2 = sin(dist * 22.0 - time * 5.0 * energy + 1.5) * exp(-dist * 3.0) * midE * 0.15;
      float ripple3 = sin(dist * 30.0 - time * 6.0 * energy + 3.0) * exp(-dist * 3.5) * highE * 0.1;
      
      // Specular
      float spec = exp(-length(uv - vec2(-0.08, 0.1)) * 7.0) * 0.2 * energy;
      orbColor += vec3(1.0) * spec;
      
      color = orbColor + glowColor
            + orbPalette(time * 0.05, 0.0, energy * 0.5) * ripple1
            + orbPalette(time * 0.07, 0.3, energy * 0.3) * ripple2
            + orbPalette(time * 0.09, 0.6, energy * 0.2) * ripple3;
      alpha = max(orb1, max(orb2, orb3)) + glow * 0.6 + ripple1 + ripple2 + ripple3 + spec * 0.15;
    }
    
    // ═══ THINKING STATE ═══
    // Fast swirling vortex with orbiting highlights
    else if (state < 2.5) {
      // Strong vortex rotation
      float angle = atan(uv.y, uv.x);
      float r = length(uv);
      
      // Spiral distortion
      float spiralTwist = time * 1.5;
      angle += spiralTwist * exp(-r * 1.8);
      vec2 spiralUV = vec2(cos(angle), sin(angle)) * r;
      
      // Fluid warp on top
      vec2 warped = fluidWarp(spiralUV * 1.5, time * 1.0, 0.12);
      float d = length(warped);
      
      float radius = 0.37 + sin(time * 2.0) * 0.03;
      float orb = smoothstep(radius + 0.08, radius - 0.14, d);
      
      // Fast swirling iridescence
      float spiral = sin(atan(warped.y, warped.x) * 4.0 + time * 2.5 + d * 8.0) * 0.5 + 0.5;
      float n = fbm(warped * 3.0 + time * 0.4) * 0.5 + 0.5;
      
      vec3 c1 = orbPalette(spiral, time * 0.1, 0.5);
      vec3 c2 = orbPalette(n, time * 0.13 + 0.3, 0.5);
      vec3 orbColor = mix(c1, c2, spiral * 0.6) * orb;
      
      // Orbiting highlight blobs
      float blobs = 0.0;
      for (float i = 0.0; i < 6.0; i++) {
        float a = time * (1.0 + i * 0.4) + i * TAU / 6.0;
        float br = 0.18 + sin(time * 2.0 + i * 1.5) * 0.06;
        vec2 bp = vec2(cos(a), sin(a)) * br;
        float blob = exp(-length(uv - bp) * 18.0) * 0.18;
        vec3 blobCol = orbPalette(i / 6.0 + time * 0.08, 0.0, 0.6);
        color += blobCol * blob;
        blobs += blob;
      }
      
      // Outer glow
      float glow = exp(-dist * 2.5) * 0.35;
      vec3 glowColor = orbPalette(time * 0.07, 0.0, 0.3) * glow;
      
      // Center bright spot
      float center = exp(-dist * 4.0) * 0.2;
      orbColor += vec3(0.95, 0.95, 0.98) * center * orb;
      
      // Specular
      float spec = exp(-length(uv - vec2(-0.08, 0.1)) * 8.0) * 0.15;
      
      color = orbColor + glowColor + vec3(0.95, 0.95, 0.98) * spec;
      alpha = orb * 0.95 + glow * 0.5 + blobs + spec * 0.1;
    }
    
    // ═══ SPEAKING STATE ═══
    // Audio-reactive pulsing synced to TTS output
    else {
      float energy = 0.1 + audio * 0.9;
      float bassE = 0.1 + bass * 0.9;
      float midE = 0.1 + mid * 0.9;
      float highE = 0.1 + high * 0.9;
      
      // Pulsing radius driven by bass
      float pulse = sin(time * 2.5) * 0.03 * energy;
      float radius = 0.38 + pulse + bassE * 0.12;
      
      // Fluid warp — driven by audio energy
      vec2 w1 = fluidWarp(uv * 1.6, time * 0.5, 0.05 + energy * 0.15);
      vec2 w2 = fluidWarp(uv * 2.2 + 5.0, time * 0.7, 0.03 + midE * 0.1);
      
      float d1 = length(w1);
      float d2 = length(w2);
      
      float orb1 = smoothstep(radius + 0.08, radius - 0.12, d1);
      float orb2 = smoothstep(radius + 0.14, radius - 0.08, d2) * 0.45;
      
      // Iridescent colors — shift with speech cadence
      float shift = time * 0.05 * (0.5 + energy * 0.5);
      vec3 c1 = orbPalette(fbm(w1 * 2.0 + time * 0.15) * 0.5 + 0.5, shift, energy);
      vec3 c2 = orbPalette(fbm(w2 * 2.5 - time * 0.1) * 0.5 + 0.5, shift + 0.4, energy);
      
      vec3 orbColor = c1 * orb1 + c2 * orb2;
      
      // Center glow pulsing with audio
      float centerPulse = exp(-dist * 3.5) * (0.15 + energy * 0.2);
      orbColor += vec3(0.95, 0.95, 0.98) * centerPulse;
      
      // Energy-reactive glow
      float glow = exp(-dist * 2.2) * (0.2 + energy * 0.4);
      vec3 glowColor = orbPalette(time * 0.03, 0.5, energy) * glow;
      
      // Concentric audio-reactive rings expanding outward
      float rings = 0.0;
      for (float i = 0.0; i < 4.0; i++) {
        float r = 0.35 + i * 0.1 + sin(time * 3.0 - i * 0.6) * 0.03;
        float ringWidth = 0.005 + energy * 0.01;
        float ring = smoothstep(ringWidth, 0.0, abs(dist - r)) * exp(-dist * 2.0) * energy * 0.25;
        vec3 ringCol = orbPalette(i / 4.0 + time * 0.04, 0.0, energy);
        color += ringCol * ring;
        rings += ring;
      }
      
      // Specular
      float spec = exp(-length(uv - vec2(-0.08, 0.1)) * 8.0) * 0.18 * energy;
      orbColor += vec3(1.0) * spec;
      
      color = orbColor + glowColor;
      alpha = max(orb1, orb2) * 0.95 + glow * 0.5 + rings + spec * 0.12;
    }
    
    // ─── Circular mask with soft edge ───
    float mask = smoothstep(1.0, 0.45, length(v_uv - 0.5) * 2.0);
    alpha *= mask;
    color *= mask;
    
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

/* ─── WebGL Helpers ─── */

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

/* ─── Component ─── */

export default function VoiceVortex({ state, size = 280, audioData, className = '' }: VoiceVortexProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const audioLevelRef = useRef({ overall: 0, bass: 0, mid: 0, high: 0 });
  const stateRef = useRef<VortexState>(state);
  const audioDataRef = useRef<Float32Array | null>(null);

  // Keep refs in sync
  stateRef.current = state;
  audioDataRef.current = audioData ?? null;

  // Process audio frequency data into bands
  const processAudioData = useCallback(() => {
    const data = audioDataRef.current;
    if (!data || data.length === 0) {
      audioLevelRef.current = { overall: 0, bass: 0, mid: 0, high: 0 };
      return;
    }

    const len = data.length;
    const bassEnd = Math.floor(len * 0.15);
    const midEnd = Math.floor(len * 0.5);

    let bassSum = 0, midSum = 0, highSum = 0, totalSum = 0;
    for (let i = 0; i < len; i++) {
      const val = Math.abs(data[i]);
      totalSum += val;
      if (i < bassEnd) bassSum += val;
      else if (i < midEnd) midSum += val;
      else highSum += val;
    }

    const prev = audioLevelRef.current;
    const smooth = 0.65; // faster response for reactivity
    audioLevelRef.current = {
      overall: prev.overall * smooth + (totalSum / len) * (1 - smooth),
      bass: prev.bass * smooth + (bassSum / Math.max(bassEnd, 1)) * (1 - smooth),
      mid: prev.mid * smooth + (midSum / Math.max(midEnd - bassEnd, 1)) * (1 - smooth),
      high: prev.high * smooth + (highSum / Math.max(len - midEnd, 1)) * (1 - smooth),
    };
  }, []);

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = createProgram(gl, vs, fs);
    if (!program) return;
    programRef.current = program;

    // Full-screen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1,
    ]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);

    // Enable blending for alpha
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Render loop
    const render = () => {
      if (!gl || !program) return;

      processAudioData();

      const time = (Date.now() - startTimeRef.current) / 1000;
      const stateVal = stateRef.current === 'idle' ? 0 :
                       stateRef.current === 'listening' ? 1 :
                       stateRef.current === 'thinking' ? 2 : 3;

      const { overall, bass, mid, high } = audioLevelRef.current;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(gl.getUniformLocation(program, 'u_time'), time);
      gl.uniform1f(gl.getUniformLocation(program, 'u_state'), stateVal);
      gl.uniform1f(gl.getUniformLocation(program, 'u_audioLevel'), overall);
      gl.uniform1f(gl.getUniformLocation(program, 'u_bassLevel'), bass);
      gl.uniform1f(gl.getUniformLocation(program, 'u_midLevel'), mid);
      gl.uniform1f(gl.getUniformLocation(program, 'u_highLevel'), high);
      gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (gl) {
        gl.deleteProgram(program);
      }
    };
  }, [processAudioData]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
  }, [size]);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        className="relative rounded-full"
        style={{
          width: size,
          height: size,
        }}
      />
    </div>
  );
}
