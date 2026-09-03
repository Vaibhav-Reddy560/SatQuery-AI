import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Line, PerformanceMonitor, AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";

/**
 * The Earth hero.
 *
 * Composition follows the reference photography: a raking sun that lights a
 * crescent limb, city lights on the dark side, and a cyan atmospheric rim.
 * The camera is close enough that you see a limb rather than a full ball.
 *
 * Lazy-loaded — three/R3F/drei are ~225KB gz and live in their own chunk.
 */

const SUN_DIR = new THREE.Vector3(-3, 1.2, 2).normalize();
const ATMOS = new THREE.Color("#6fb8ff");
const ORBIT_R = 1.30;
const ORBIT_INCLINATION = THREE.MathUtils.degToRad(23.5);
const ORBIT_YAW = THREE.MathUtils.degToRad(12);

// ── Earth ──────────────────────────────────────────────────

const earthVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const earthFrag = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform vec3 uSunDir;
  uniform vec3 uAtmos;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 n = normalize(vWorldNormal);
    float ndl = dot(n, normalize(uSunDir));

    // Soft terminator rather than a hard shadow line.
    float dayAmt = smoothstep(-0.12, 0.30, ndl);

    vec3 day   = texture2D(uDay,   vUv).rgb;
    vec3 night = texture2D(uNight, vUv).rgb;

    // Ocean reads as blue-dominant; give it a cool specular sheen facing the sun.
    float ocean = smoothstep(0.04, 0.22, day.b - max(day.r, day.g));
    vec3 lit = day * (0.14 + 1.05 * max(ndl, 0.0));
    lit += uAtmos * ocean * pow(max(ndl, 0.0), 7.0) * 0.40;

    // City lights appear only where the sun does not reach.
    vec3 cities = night * pow(1.0 - dayAmt, 1.7) * 1.65;

    vec3 col = mix(cities, lit, dayAmt);

    // Inner rim, brightest on the lit limb.
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    col += uAtmos * fres * 0.30 * smoothstep(-0.35, 0.55, ndl);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function Earth({ speed }: { speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const manualYaw = useRef(0);
  const [day, night, clouds] = useLoader(THREE.TextureLoader, [
    "/textures/earth-day.jpg",
    "/textures/earth-night.jpg",
    "/textures/earth-clouds.jpg",
  ]);
  const { gl } = useThree();

  // Configure textures in an effect, not during render — mutating a value
  // returned from a hook while rendering double-fires under StrictMode.
  useEffect(() => {
    // Without SRGBColorSpace the NASA imagery renders washed-out and grey.
    day.colorSpace = THREE.SRGBColorSpace;
    night.colorSpace = THREE.SRGBColorSpace;
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    day.anisotropy = aniso;
    night.anisotropy = aniso;
    clouds.anisotropy = aniso;
    day.needsUpdate = true;
    night.needsUpdate = true;
    clouds.needsUpdate = true;
  }, [day, night, clouds, gl]);

  const uniforms = useMemo(
    () => ({
      uDay: { value: day },
      uNight: { value: night },
      uSunDir: { value: SUN_DIR },
      uAtmos: { value: ATMOS },
    }),
    [day, night]
  );

  const cloudRef = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    const drag = manualYaw.current;
    manualYaw.current = 0;
    if (ref.current) ref.current.rotation.y += dt * 0.035 * speed + drag;
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.056 * speed + drag;
  });

  return (
    <group rotation={[0.35, 0, 0.18]}>
      {/* Drag-to-rotate: a real console treats its screen as an input
          surface, not just a display. Additive on top of the auto-rotate
          rather than replacing it — direct manipulation without having to
          first "turn off" the animation. Pointer capture keeps the drag
          tracking even if the cursor slips past the sphere's silhouette
          mid-gesture. */}
      <mesh
        ref={ref}
        onPointerDown={(e) => {
          e.stopPropagation();
          dragging.current = true;
          lastX.current = e.clientX;
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          manualYaw.current += (e.clientX - lastX.current) * 0.006;
          lastX.current = e.clientX;
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          (e.target as Element).releasePointerCapture?.(e.pointerId);
        }}
      >
        <sphereGeometry args={[1, 128, 96]} />
        <shaderMaterial
          vertexShader={earthVert}
          fragmentShader={earthFrag}
          uniforms={uniforms}
        />
      </mesh>

      {/* Clouds drift slightly faster than the surface, giving parallax. */}
      <mesh ref={cloudRef} scale={1.006}>
        <sphereGeometry args={[1, 128, 96]} />
        <meshStandardMaterial
          color="#ffffff"
          alphaMap={clouds}
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Atmosphere ─────────────────────────────────────────────

const atmoVert = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const atmoFrag = /* glsl */ `
  uniform vec3 uInner;
  uniform vec3 uOuter;
  uniform vec3 uSunDir;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float f = pow(1.0 - max(dot(n, viewDir), 0.0), uPower);
    float sun = max(dot(n, normalize(uSunDir)), 0.0);
    vec3 col = mix(uOuter, uInner, f);
    gl_FragColor = vec4(col, f * uIntensity * (0.30 + 0.70 * sun));
    #include <colorspace_fragment>
  }
`;

function Atmosphere() {
  const uniforms = useMemo(
    () => ({
      uInner: { value: new THREE.Color("#6fb8ff") },
      uOuter: { value: new THREE.Color("#3d7fff") },
      uSunDir: { value: SUN_DIR },
      uPower: { value: 3.0 },
      uIntensity: { value: 1.35 },
    }),
    []
  );

  return (
    <mesh scale={1.055}>
      <sphereGeometry args={[1, 128, 96]} />
      <shaderMaterial
        vertexShader={atmoVert}
        fragmentShader={atmoFrag}
        uniforms={uniforms}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Satellite ──────────────────────────────────────────────

/**
 * A small canvas-drawn texture standing in for individual solar cells — a
 * flat emissive box read as "a wing," not "an instrument." Drawn once
 * (`useMemo`) and reused on both wings via `map` + `emissiveMap`, so the
 * cell grid actually glows rather than being a flat tint.
 */
function useSolarCellTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0b2258";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cols = 10;
    const rows = 3;
    ctx.strokeStyle = "rgba(111,184,255,0.65)";
    ctx.lineWidth = 2;
    for (let i = 1; i < cols; i++) {
      const x = (canvas.width / cols) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let j = 1; j < rows; j++) {
      const y = (canvas.height / rows) * j;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    // Frame edge, brighter — reads as the panel's structural border.
    ctx.strokeStyle = "rgba(159,201,255,0.9)";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/**
 * Procedural, not a glTF — at 40-70px on screen the silhouette is most of
 * what reads, so the upgrade here is in the details that survive at that
 * scale: a segmented solar-cell grid (real texture, not a flat tint), a
 * blinking status LED, a feed-horn on the dish, and a thruster nozzle —
 * rather than more geometry that would just blur together.
 */
function Satellite({ speed }: { speed: number }) {
  const group = useRef<THREE.Group>(null);
  const led = useRef<THREE.Mesh>(null);
  const theta = useRef(0.6);
  const solarTex = useSolarCellTexture();

  useFrame((state, dt) => {
    theta.current += dt * 0.22 * speed; // ~28s per orbit at 1x
    const t = theta.current;
    const g = group.current;
    if (g) {
      g.position.set(Math.cos(t) * ORBIT_R, 0, Math.sin(t) * ORBIT_R);
      // Nadir pointing falls out of looking at the origin.
      g.lookAt(0, 0, 0);
    }
    // Blinking status LED — real-time pulse, independent of the orbit
    // speed control (a beacon wouldn't speed up because you fast-forwarded
    // the view).
    if (led.current) {
      const mat = led.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + 2.2 * Math.max(0, Math.sin(state.clock.elapsedTime * 3));
    }
  });

  return (
    <group rotation={[ORBIT_INCLINATION, ORBIT_YAW, 0]}>
      <group ref={group} scale={1.7}>
        {/* Bus */}
        <mesh>
          <boxGeometry args={[0.1, 0.08, 0.13]} />
          <meshStandardMaterial
            color="#d7e4fb"
            metalness={0.88}
            roughness={0.3}
            emissive="#6fb8ff"
            emissiveIntensity={0.14}
          />
        </mesh>
        {/* MLI wrap band — the dark insulation blanket real buses carry
            around their midsection, breaking up the plain box silhouette. */}
        <mesh>
          <boxGeometry args={[0.104, 0.022, 0.134]} />
          <meshStandardMaterial color="#141e38" metalness={0.35} roughness={0.6} />
        </mesh>
        {/* Instrument module, top-mounted */}
        <mesh position={[0, 0.058, -0.015]}>
          <boxGeometry args={[0.05, 0.028, 0.05]} />
          <meshStandardMaterial color="#aab8d8" metalness={0.7} roughness={0.35} />
        </mesh>
        {/* Whip antenna */}
        <mesh position={[0.018, 0.095, -0.015]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.0015, 0.0015, 0.055, 6]} />
          <meshStandardMaterial color="#c9d4ea" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Status beacon — blinking */}
        <mesh ref={led} position={[0.053, 0.022, 0.035]}>
          <sphereGeometry args={[0.006, 8, 8]} />
          <meshStandardMaterial color="#9fd4ff" emissive="#6fb8ff" emissiveIntensity={1} toneMapped={false} />
        </mesh>

        {/* Solar arrays — support boom + segmented, textured panel per side. */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.075, 0, 0]}>
              <boxGeometry args={[0.04, 0.014, 0.014]} />
              <meshStandardMaterial color="#8fa6cc" metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position={[side * 0.245, 0, 0]}>
              <boxGeometry args={[0.3, 0.006, 0.09]} />
              <meshStandardMaterial
                map={solarTex}
                emissiveMap={solarTex}
                emissive="#3d7fff"
                emissiveIntensity={0.55}
                metalness={0.35}
                roughness={0.3}
              />
            </mesh>
          </group>
        ))}

        {/* Boom to dish */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.095]}>
          <cylinderGeometry args={[0.0045, 0.0045, 0.12, 8]} />
          <meshStandardMaterial color="#8fa6cc" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Feed horn, ahead of the dish */}
        <mesh position={[0, 0, 0.135]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.004, 0.008, 0.022, 8]} />
          <meshStandardMaterial color="#c9d4ea" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Dish, Earth-facing */}
        <mesh position={[0, 0, 0.165]} rotation={[Math.PI / 2, 0, 0]}>
          <sphereGeometry args={[0.05, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
          <meshStandardMaterial
            color="#eef3ff"
            metalness={0.25}
            roughness={0.45}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Thruster nozzle, aft */}
        <mesh position={[0, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.02, 0.03, 12, 1, true]} />
          <meshStandardMaterial color="#2a2f3a" metalness={0.75} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function OrbitTrail() {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 128; i++) {
      const t = (i / 128) * Math.PI * 2;
      pts.push([Math.cos(t) * ORBIT_R, 0, Math.sin(t) * ORBIT_R]);
    }
    return pts;
  }, []);

  return (
    <group rotation={[ORBIT_INCLINATION, ORBIT_YAW, 0]}>
      <Line
        points={points}
        color="#6fb8ff"
        lineWidth={1}
        transparent
        opacity={0.22}
        depthWrite={false}
      />
    </group>
  );
}

// ── Scene ──────────────────────────────────────────────────

const BASE_CAMERA_Z = 5.4;

// Camera dolly for the console's zoom control, on top of the existing
// pointer-parallax rig — pulled out to its own `useFrame` lerp rather than
// jumping straight to the target distance, so a zoom-button press reads as
// a smooth dolly instead of a cut.
function Rig({ interactive, zoom }: { interactive: boolean; zoom: number }) {
  const { camera, pointer } = useThree();
  useFrame((_, dt) => {
    const targetZ = BASE_CAMERA_Z / zoom;
    camera.position.z += (targetZ - camera.position.z) * Math.min(dt * 3, 1);

    if (!interactive) {
      camera.lookAt(0, -0.05, 0);
      return;
    }
    // Gentle parallax; never enough to break the composition.
    const tx = pointer.x * 0.16;
    const ty = 0.42 + pointer.y * 0.10;
    camera.position.x += (tx - camera.position.x) * Math.min(dt * 2.5, 1);
    camera.position.y += (ty - camera.position.y) * Math.min(dt * 2.5, 1);
    camera.lookAt(0, -0.05, 0);
  });
  return null;
}

export default function EarthScene({
  paused = false,
  reducedMotion = false,
  speed = 1,
  zoom = 1,
}: {
  paused?: boolean;
  reducedMotion?: boolean;
  /** Rotation/orbit speed multiplier — the console's speed control. */
  speed?: number;
  /** Camera dolly multiplier (>1 = closer) — the console's zoom control. */
  zoom?: number;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={paused || reducedMotion ? "never" : "always"}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      camera={{ fov: 32, position: [0, 0.42, BASE_CAMERA_Z] }}
    >
      <PerformanceMonitor />
      <AdaptiveDpr pixelated={false} />

      <ambientLight intensity={0.06} color="#3d7fff" />
      <directionalLight
        position={[-3, 1.2, 2]}
        intensity={1.6}
        color="#fff4e2"
      />

      <Earth speed={speed} />
      <Atmosphere />
      <OrbitTrail />
      <Satellite speed={speed} />

      <Rig interactive={!reducedMotion && !paused} zoom={zoom} />
    </Canvas>
  );
}
