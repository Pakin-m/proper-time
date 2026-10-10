import {
  DAY,
  gravitationalRadius,
  type Body,
  type Experiment,
  type Motion,
  type Probe,
} from "./physics";
import { PRESETS, preset } from "./presets";
export type View = "oblique" | "equator" | "pole";
export interface LabState {
  experiment: Experiment;
  probes: [Probe, Probe];
  duration: number;
  acceleration: number;
  crossSection: boolean;
  compareBodies: boolean;
  view: View;
}
export function defaultProbe(
  body: Body,
  index: number,
  experiment: Experiment,
): Probe {
  const compact = body.kind !== "sphere";
  const r = compact
    ? gravitationalRadius(body.mass) * (index ? 10 : 6)
    : body.radius + (index ? 1000 : 0);
  return {
    body: { ...body },
    radius:
      experiment === "orbit" && index
        ? Math.max(body.radius + 400000, 8 * gravitationalRadius(body.mass))
        : r,
    latitude:
      experiment === "altitude"
        ? index
          ? 25
          : 0
        : experiment === "rotation" && index
          ? 60
          : 0,
    longitude: index ? 38 : -38,
    motion:
      body.kind === "kerr"
        ? index
          ? "zamo"
          : "static"
        : experiment === "rotation"
          ? "corotate"
          : experiment === "orbit" && index
            ? "orbit"
            : "static",
    omega: 0,
  };
}
export function initialState(): LabState {
  return {
    experiment: "altitude",
    probes: [
      defaultProbe(preset("earth"), 0, "altitude"),
      defaultProbe(preset("earth"), 1, "altitude"),
    ],
    duration: DAY,
    acceleration: 3600,
    crossSection: false,
    compareBodies: false,
    view: "oblique",
  };
}
export function changeExperiment(
  s: LabState,
  experiment: Experiment,
): LabState {
  return {
    ...s,
    experiment,
    probes: s.probes.map((p, i) => defaultProbe(p.body, i, experiment)) as [
      Probe,
      Probe,
    ],
  };
}
export function serialize(s: LabState): string {
  return new URLSearchParams({ v: "1", lab: JSON.stringify(s) }).toString();
}
const experiments = ["altitude", "rotation", "orbit", "compact"];
const motions = [
  "static",
  "corotate",
  "angular",
  "orbit",
  "retrograde",
  "zamo",
];
const views = ["oblique", "equator", "pole"];
function number(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function record(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function validProbe(x: unknown): x is Probe {
  if (!record(x) || !record(x.body)) return false;
  const b = x.body;
  return (
    typeof b.id === "string" &&
    b.id.length < 80 &&
    typeof b.name === "string" &&
    b.name.length < 80 &&
    ["sphere", "schwarzschild", "kerr"].includes(String(b.kind)) &&
    ["mass", "radius", "period", "spin"].every((k) => number(b[k])) &&
    ["radius", "latitude", "longitude", "omega"].every((k) => number(x[k])) &&
    motions.includes(String(x.motion))
  );
}
export function parseState(search: string): {
  state: LabState;
  error: string | null;
} {
  const params = new URLSearchParams(search);
  if (!params.has("lab") && !params.has("v"))
    return { state: initialState(), error: null };
  try {
    if (params.get("v") !== "1")
      throw Error("Unsupported experiment URL version.");
    const payload = params.get("lab");
    if (!payload || payload.length > 12000)
      throw Error("Missing or oversized experiment configuration.");
    const s: unknown = JSON.parse(payload);
    if (
      !record(s) ||
      !experiments.includes(String(s.experiment)) ||
      !Array.isArray(s.probes) ||
      s.probes.length !== 2 ||
      !s.probes.every(validProbe) ||
      !number(s.duration) ||
      s.duration <= 0 ||
      s.duration > 1000 * 365.25 * DAY ||
      !number(s.acceleration) ||
      s.acceleration < 1 ||
      s.acceleration > 1e9 ||
      typeof s.crossSection !== "boolean" ||
      typeof s.compareBodies !== "boolean" ||
      !views.includes(String(s.view))
    )
      throw Error("Malformed experiment configuration.");
    if (
      !s.compareBodies &&
      JSON.stringify(s.probes[0].body) !== JSON.stringify(s.probes[1].body)
    )
      throw Error("Unlinked bodies require isolated-body comparison mode.");
    const state = s as unknown as LabState;
    for (const p of state.probes) {
      const source = PRESETS.find(
        (candidate) => candidate.id === p.body.id.replace(/^custom:/, ""),
      );
      if (!source || source.kind !== p.body.kind)
        throw Error("Unsupported body model or source lineage.");
      const modified = (["mass", "radius", "period", "spin"] as const).some(
        (key) => p.body[key] !== source[key],
      );
      if (modified && !p.body.id.startsWith("custom:"))
        p.body = { ...p.body, id: "custom:" + source.id, name: "Custom body" };
    }
    return { state, error: null };
  } catch (error) {
    return {
      state: initialState(),
      error:
        (error instanceof Error ? error.message : "Invalid URL.") +
        " Default experiment loaded.",
    };
  }
}
export function motionOptions(
  experiment: Experiment,
  kind: Body["kind"],
): { value: Motion; label: string }[] {
  if (kind === "kerr")
    return [
      { value: "static", label: "Static · Ω = 0" },
      { value: "zamo", label: "ZAMO · zero angular momentum" },
      { value: "angular", label: "Stationary · prescribed Ω" },
      { value: "orbit", label: "Circular orbit · prograde" },
      { value: "retrograde", label: "Circular orbit · retrograde" },
    ];
  if (experiment === "rotation")
    return [
      { value: "static", label: "Static · Ω = 0" },
      { value: "corotate", label: "Body corotation" },
      { value: "angular", label: "Prescribed angular velocity" },
    ];
  if (experiment === "orbit" || experiment === "compact")
    return [
      { value: "static", label: "Static / hovering" },
      { value: "orbit", label: "Circular orbit · forward" },
      { value: "retrograde", label: "Circular orbit · reverse" },
    ];
  return [{ value: "static", label: "Static · fixed coordinates" }];
}
