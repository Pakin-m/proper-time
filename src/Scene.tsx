import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";
import {
  validateBody,
  angularVelocity,
  evaluate,
  gravitationalRadius,
  kerrHorizon,
  radians,
  type Probe,
} from "./physics";
import type { LabState, View } from "./state";
import { preset } from "./presets";
const COLORS = ["#94c9c2", "#d3b18b"];
const BODY_SIZE = 1.55;
function unit(probe: Probe): number {
  return probe.body.kind === "sphere"
    ? probe.body.radius
    : 2 * gravitationalRadius(probe.body.mass);
}
export function visualRadius(probe: Probe): number {
  const ratio = probe.radius / unit(probe);
  return BODY_SIZE * (ratio <= 1 ? Math.max(0, ratio) : 1 + Math.log(ratio));
}
function physicalRadius(distance: number, probe: Probe): number {
  const ratio = distance / BODY_SIZE;
  return unit(probe) * (ratio <= 1 ? ratio : Math.exp(ratio - 1));
}
function position(probe: Probe, phase = 0): THREE.Vector3 {
  const r = visualRadius(probe),
    lat = radians(probe.latitude),
    lon = radians(probe.longitude) + phase;
  return new THREE.Vector3(
    r * Math.cos(lat) * Math.sin(lon),
    r * Math.sin(lat),
    r * Math.cos(lat) * Math.cos(lon),
  );
}
function path(points: THREE.Vector3[]) {
  return new THREE.BufferGeometry().setFromPoints(points);
}
function Ring({
  radius,
  color = "#52606c",
  opacity = 0.35,
  y = 0,
}: {
  radius: number;
  color?: string;
  opacity?: number;
  y?: number;
}) {
  const geometry = useMemo(
    () =>
      path(
        Array.from(
          { length: 129 },
          (_, i) =>
            new THREE.Vector3(
              radius * Math.cos((i * Math.PI) / 64),
              y,
              radius * Math.sin((i * Math.PI) / 64),
            ),
        ),
      ),
    [radius, y],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineLoop>
  );
}
function ContextWatch({ onLost }: { onLost: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onLost]);
  return null;
}
function Camera({
  view,
  dragging,
  reduced,
  multiple,
}: {
  view: View;
  dragging: boolean;
  reduced: boolean;
  multiple: boolean;
}) {
  const { camera, gl } = useThree();
  const controls = useMemo(
    () => new OrbitControls(camera, gl.domElement),
    [camera, gl],
  );
  const target = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    controls.enableDamping = !reduced;
    controls.dampingFactor = 0.1;
    controls.enablePan = false;
    controls.minDistance = 3.5;
    controls.maxDistance = 18;
    return () => controls.dispose();
  }, [controls, reduced]);
  useEffect(() => {
    controls.enabled = !dragging;
  }, [controls, dragging]);
  useEffect(() => {
    target.current = new THREE.Vector3(
      ...(view === "pole"
        ? ([0, 7, 0.001] as const)
        : view === "equator"
          ? ([0, 0, 7] as const)
          : ([3.8, 2.3, 6.3] as const)),
    );
    if (multiple) target.current.multiplyScalar(1.6);
    if (reduced) {
      camera.position.copy(target.current);
      target.current = null;
      controls.update();
    }
  }, [view, reduced, camera, controls, multiple]);
  useEffect(() => {
    const stop = () => {
      target.current = null;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);
  useFrame((_, dt) => {
    if (target.current) {
      camera.position.lerp(target.current, 1 - Math.exp(-dt * 7));
      if (camera.position.distanceTo(target.current) < 0.002)
        target.current = null;
    }
    controls.update();
  });
  return null;
}
function Planet({
  probe,
  crossSection,
  reduced,
}: {
  probe: Probe;
  crossSection: boolean;
  reduced: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const color = preset(probe.body.id.replace("custom:", "")).color;
  const blackHole = probe.body.kind !== "sphere";
  const m = gravitationalRadius(probe.body.mass);
  const horizon =
    probe.body.kind === "kerr" ? kerrHorizon(probe.body.spin) * m : 2 * m;
  const radius = blackHole
    ? visualRadius({ ...probe, radius: horizon })
    : BODY_SIZE;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          base: { value: new THREE.Color(color) },
          cut: { value: crossSection ? 1 : 0 },
        },
        vertexShader: `varying vec3 p; varying vec3 n; void main(){p=position;n=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `uniform vec3 base;uniform float cut;varying vec3 p;varying vec3 n;
      void main(){if(cut>0.5&&p.z>0.0)discard;
      float lat=asin(clamp(normalize(p).y,-1.,1.));float lon=atan(p.x,p.z);
      float gridLat=1.-smoothstep(.008,.018,abs(sin(lat*12.)));
      float gridLon=1.-smoothstep(.008,.018,abs(sin(lon*12.)));
      float light=.22+.68*max(0.,dot(normalize(n),normalize(vec3(-.5,.7,1.))));
      float latitudeShade=.025*sin(lat*42.)+.018*sin(lat*83.);
      gl_FragColor=vec4(base*(light+latitudeShade)+vec3(.06)*max(gridLat,gridLon),1.);
    }`,
        side: THREE.DoubleSide,
      }),
    [color, crossSection],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    if (mesh.current) {
      if (crossSection) mesh.current.rotation.y = 0;
      else if (!reduced && !blackHole && probe.body.period > 0)
        mesh.current.rotation.y +=
          Math.min(angularVelocity(probe.body.period), 0.025) * dt;
    }
  });
  const ergosphere = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 64, 32);
    const a = probe.body.spin;
    const v = g.attributes.position;
    for (let i = 0; i < v.count; i++) {
      const x = v.getX(i),
        y = v.getY(i),
        z = v.getZ(i);
      const er = (1 + Math.sqrt(1 - a * a * y * y)) * m;
      const vr = visualRadius({ ...probe, radius: er });
      v.setXYZ(i, x * vr, y * vr, z * vr);
    }
    g.computeVertexNormals();
    return g;
  }, [probe.body.spin, m, probe.body.radius, probe.body.kind]);
  useEffect(() => () => ergosphere.dispose(), [ergosphere]);
  return (
    <group>
      {blackHole ? (
        <mesh key="horizon">
          <sphereGeometry args={[radius, 64, 32]} />
          <meshBasicMaterial color="#080b0f" />
        </mesh>
      ) : (
        <mesh key="sphere" ref={mesh} material={material}>
          <sphereGeometry args={[radius, 72, 48]} />
        </mesh>
      )}
      {crossSection && !blackHole && (
        <group>
          <mesh rotation={[0, 0, 0]}>
            <circleGeometry args={[BODY_SIZE, 96]} />
            <meshBasicMaterial color="#252d34" side={THREE.DoubleSide} />
          </mesh>
          {[0.25, 0.5, 0.75, 1].map((r) => (
            <mesh key={r}>
              <ringGeometry
                args={[BODY_SIZE * r - 0.004, BODY_SIZE * r + 0.004, 96]}
              />
              <meshBasicMaterial color="#495660" side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      )}
      {blackHole && (
        <mesh>
          <sphereGeometry args={[radius * 1.003, 32, 24]} />
          <meshBasicMaterial
            wireframe
            color="#5b6e7a"
            transparent
            opacity={0.18}
          />
        </mesh>
      )}
      {probe.body.kind === "kerr" && (
        <mesh geometry={ergosphere}>
          <meshBasicMaterial
            color="#9b8669"
            wireframe
            transparent
            opacity={0.12}
          />
        </mesh>
      )}
      <Ring radius={radius * 1.006} color="#748795" opacity={0.5} />
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.003, 0.003, 5, 8]} />
        <meshBasicMaterial color="#44515d" />
      </mesh>
    </group>
  );
}
function Label({ index }: { index: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "500 40px monospace";
    ctx.fillStyle = COLORS[index];
    ctx.textAlign = "center";
    ctx.fillText(index ? "B" : "A", 32, 45);
    return new THREE.CanvasTexture(canvas);
  }, [index]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={[0.16, 0.15, 0]} scale={[0.24, 0.24, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
function ProbeMesh({
  probe,
  index,
  state,
  onMove,
  onDrag,
  reduced,
  origin = [0, 0, 0],
}: {
  probe: Probe;
  index: number;
  state: LabState;
  onMove: (index: number, patch: Partial<Probe>) => void;
  onDrag: (drag: boolean) => void;
  reduced: boolean;
  origin?: [number, number, number];
}) {
  const { camera, gl } = useThree();
  const group = useRef<THREE.Group>(null);
  const line = useRef<THREE.BufferGeometry>(null);
  const phase = useRef(0),
    drag = useRef(false);
  const plane = useRef(new THREE.Plane()),
    point = useRef(new THREE.Vector3());
  const result = evaluate(probe, state.experiment);
  useEffect(() => {
    phase.current = 0;
  }, [probe.motion, probe.body.id]);
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    drag.current = true;
    onDrag(true);
    plane.current.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()),
      position(probe, phase.current).add(new THREE.Vector3(...origin)),
    );
    (
      e.target as unknown as { setPointerCapture: (id: number) => void }
    ).setPointerCapture(e.pointerId);
    gl.domElement.style.cursor = "grabbing";
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    e.stopPropagation();
    if (e.ray.intersectPlane(plane.current, point.current)) {
      const p = point.current.sub(new THREE.Vector3(...origin)),
        equatorial =
          state.experiment === "orbit" ||
          probe.body.kind === "kerr" ||
          probe.motion === "orbit" ||
          probe.motion === "retrograde";
      if (equatorial) p.y = 0;
      const d = p.length();
      if (d > 0.001 && d < 8) {
        onMove(index, {
          radius: physicalRadius(d, probe),
          latitude: equatorial ? 0 : (Math.asin(p.y / d) * 180) / Math.PI,
          longitude: (Math.atan2(p.x, p.z) * 180) / Math.PI,
        });
        phase.current = 0;
      }
    }
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    e.stopPropagation();
    drag.current = false;
    onDrag(false);
    gl.domElement.style.cursor = "grab";
    (
      e.target as unknown as { releasePointerCapture: (id: number) => void }
    ).releasePointerCapture(e.pointerId);
  };
  useFrame((_, dt) => {
    if (!drag.current && !reduced && result.ok && result.value.omega !== 0)
      phase.current +=
        Math.sign(result.value.omega) *
        Math.min(Math.abs(result.value.omega) * state.acceleration, 0.3) *
        dt;
    const p = position(probe, phase.current);
    group.current?.position.copy(p);
    if (line.current) {
      const a = line.current.attributes.position as THREE.BufferAttribute;
      a.setXYZ(1, p.x, p.y, p.z);
      a.needsUpdate = true;
      line.current.computeBoundingSphere();
    }
  });
  const geometry = useMemo(
    () => path([new THREE.Vector3(), position(probe)]),
    [],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <>
      <line>
        <primitive ref={line} object={geometry} attach="geometry" />
        <lineBasicMaterial color={COLORS[index]} transparent opacity={0.35} />
      </line>
      {(probe.motion === "orbit" || probe.motion === "retrograde") && (
        <Ring
          radius={visualRadius(probe)}
          color={COLORS[index]}
          opacity={0.45}
        />
      )}
      <group ref={group} position={position(probe)}>
        <mesh
          onPointerDown={onDown}
          onPointerMove={onPointerMove}
          onPointerUp={onUp}
          onLostPointerCapture={() => {
            drag.current = false;
            onDrag(false);
          }}
          onPointerOver={() => {
            gl.domElement.style.cursor = "grab";
          }}
          onPointerOut={() => {
            if (!drag.current) gl.domElement.style.cursor = "grab";
          }}
        >
          <sphereGeometry args={[0.065, 20, 16]} />
          <meshBasicMaterial color={COLORS[index]} depthTest={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.11, 16, 12]} />
          <meshBasicMaterial
            color={COLORS[index]}
            wireframe
            transparent
            opacity={0.3}
            depthTest={false}
          />
        </mesh>
        <Label index={index} />
      </group>
    </>
  );
}
function FrameDragging({ probe, reduced }: { probe: Probe; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current && !reduced)
      ref.current.rotation.y += Math.sign(probe.body.spin) * dt * 0.07;
  });
  return (
    <group ref={ref}>
      {[1.7, 2, 2.35].map((r, i) => (
        <group key={r}>
          <Ring radius={r} color="#8e806e" opacity={0.18} />
          <mesh position={[r, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.025, 0.1, 8]} />
            <meshBasicMaterial
              color="#8e806e"
              transparent
              opacity={0.45 / (i + 1)}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function Fallback({
  state,
  onMove,
}: {
  state: LabState;
  onMove: (i: number, p: Partial<Probe>) => void;
}) {
  return (
    <div className="fallback">
      <svg
        viewBox="-3 -2.5 6 5"
        role="img"
        aria-label="Radial cross-section; WebGL unavailable"
      >
        <circle r="1.55" fill="#28343e" stroke="#647480" strokeWidth=".01" />
        {[0.5, 1].map((r) => (
          <circle
            key={r}
            r={r}
            fill="none"
            stroke="#647480"
            strokeWidth=".01"
          />
        ))}
        {state.probes.map((p, i) => {
          const v = position(p);
          return (
            <g key={i}>
              <line x2={v.x} y2={-v.y} stroke={COLORS[i]} strokeWidth=".01" />
              <circle cx={v.x} cy={-v.y} r=".06" fill={COLORS[i]} />
              <text
                x={v.x + 0.1}
                y={-v.y - 0.1}
                fontSize=".16"
                fill={COLORS[i]}
              >
                {i ? "B" : "A"}
              </text>
            </g>
          );
        })}
      </svg>
      <p>WebGL unavailable · numerical laboratory remains active</p>
      <div className="fallback-adjust">
        {state.probes.map((p, i) => (
          <button
            key={i}
            onClick={() => onMove(i, { radius: p.radius + unit(p) * 0.01 })}
          >
            Clock {i ? "B" : "A"}: +0.01 scale radius
          </button>
        ))}
      </div>
    </div>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function supported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
export default function Scene({
  state,
  onMove,
  reduced,
  cameraReset,
}: {
  state: LabState;
  onMove: (i: number, p: Partial<Probe>) => void;
  reduced: boolean;
  cameraReset: number;
}) {
  const [webgl] = useState(supported),
    [dragging, setDragging] = useState(false),
    [lost, setLost] = useState(false);
  const body = state.probes[0];
  if (state.probes.some((p) => !validateBody(p.body).ok))
    return <div className="scene-status">Invalid body parameters</div>;
  if (
    state.probes.some(
      (p) =>
        ![p.radius, p.latitude, p.longitude].every(Number.isFinite) ||
        p.radius < 0 ||
        Math.abs(p.latitude) > 90,
    )
  )
    return <div className="scene-status">Invalid coordinates</div>;
  const multiple = state.compareBodies;
  const fallback = <Fallback state={state} onMove={onMove} />;
  if (!webgl || lost) return fallback;
  return (
    <SceneBoundary fallback={fallback}>
      <Suspense
        fallback={<div className="scene-status">Initializing renderer</div>}
      >
        <Canvas
          camera={{ position: [3.8, 2.3, 6.3], fov: 38, near: 0.01, far: 80 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
          onCreated={({ gl }) => {
            gl.setClearColor("#0b0e12", 1);
          }}
        >
          <ContextWatch onLost={() => setLost(true)} />
          <Camera
            key={cameraReset}
            view={state.view}
            dragging={dragging}
            reduced={reduced}
            multiple={multiple}
          />
          {multiple ? (
            state.probes.map((probe, i) => {
              const origin: [number, number, number] = [i ? 2.25 : -2.25, 0, 0];
              return (
                <group key={i} position={origin}>
                  <Planet
                    probe={probe}
                    crossSection={state.crossSection}
                    reduced={reduced}
                  />
                  {probe.body.kind === "kerr" && (
                    <FrameDragging probe={probe} reduced={reduced} />
                  )}
                  <ProbeMesh
                    probe={probe}
                    index={i}
                    state={state}
                    onMove={onMove}
                    onDrag={setDragging}
                    reduced={reduced}
                    origin={origin}
                  />
                </group>
              );
            })
          ) : (
            <group>
              <Planet
                probe={body}
                crossSection={state.crossSection}
                reduced={reduced}
              />
              {[BODY_SIZE * 1.25, BODY_SIZE * 1.5, BODY_SIZE * 2].map((r) => (
                <Ring key={r} radius={r} opacity={0.12} />
              ))}
              {body.body.kind === "kerr" && (
                <FrameDragging probe={body} reduced={reduced} />
              )}
              {state.probes.map((probe, i) => (
                <ProbeMesh
                  key={i}
                  probe={probe}
                  index={i}
                  state={state}
                  onMove={onMove}
                  onDrag={setDragging}
                  reduced={reduced}
                />
              ))}
            </group>
          )}
        </Canvas>
      </Suspense>
    </SceneBoundary>
  );
}
