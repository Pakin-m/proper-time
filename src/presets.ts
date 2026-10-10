import { DAY, SOLAR_MASS, gravitationalRadius, type Body } from "./physics";
export interface Preset extends Body {
  source: string;
  retrieved: string;
  assumed: boolean;
  model: string;
  provenance: { mass: string; radius: string; period: string; spin: string };
  color: string;
}
const JPL = "https://ssd.jpl.nasa.gov/planets/phys_par.html";
const moon = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html";
const sun = "https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html";
function sphere(
  id: string,
  name: string,
  mass: number,
  radius: number,
  period: number,
  color: string,
  source = JPL,
  assumed = false,
  note = "",
): Preset {
  return {
    id,
    name,
    mass,
    radius,
    period,
    spin: 0,
    kind: "sphere",
    color,
    source,
    assumed,
    retrieved: "2026-10-11",
    model: "Mean-radius sphere; uniform-density interior. " + note,
    provenance: {
      mass: assumed ? "Illustrative mass; solar-mass scale from NASA." : source,
      radius: assumed ? "Illustrative assumed radius." : source,
      period: assumed ? "Assumed nonrotating." : source,
      spin: "No Kerr spin; spherical model.",
    },
  };
}
export const PRESETS: Preset[] = [
  sphere("earth", "Earth", 5.97217e24, 6371008.4, 0.99726968 * DAY, "#647f89"),
  sphere("moon", "Moon", 7.346e22, 1737400, 655.72 * 3600, "#939397", moon),
  sphere("mars", "Mars", 0.641691e24, 3389500, 1.02595676 * DAY, "#a17c68"),
  sphere(
    "jupiter",
    "Jupiter",
    1898.125e24,
    69911000,
    0.41354 * DAY,
    "#a38d75",
    JPL,
    false,
    "Adopted sidereal period; differential rotation omitted.",
  ),
  sphere(
    "saturn",
    "Saturn",
    568.317e24,
    58232000,
    0.44401 * DAY,
    "#b0a17f",
    JPL,
    false,
    "Adopted sidereal period; oblateness and rings omitted.",
  ),
  sphere(
    "sun",
    "Sun",
    SOLAR_MASS,
    695700000,
    609.12 * 3600,
    "#b7a276",
    sun,
    false,
    "Rotation period adopted at 16° latitude; rigid rotation assumed.",
  ),
  sphere(
    "white-dwarf",
    "White dwarf",
    0.6 * SOLAR_MASS,
    9000000,
    0,
    "#a3adb8",
    sun,
    true,
  ),
  sphere(
    "neutron-star",
    "Neutron star",
    1.4 * SOLAR_MASS,
    12000,
    0,
    "#829bb8",
    sun,
    true,
  ),
  ...(["schwarzschild", "kerr"] as const).map((kind) => ({
    id: kind,
    name: kind === "kerr" ? "Kerr black hole" : "Schwarzschild black hole",
    mass: 10 * SOLAR_MASS,
    radius: 2 * gravitationalRadius(10 * SOLAR_MASS),
    period: 0,
    spin: kind === "kerr" ? 0.7 : 0,
    kind,
    color: "#566979",
    source: "https://arxiv.org/abs/1801.06149",
    retrieved: "2026-10-11",
    assumed: true,
    model:
      "Illustrative isolated black hole; no material surface. Kerr uses Boyer–Lindquist coordinates.",
    provenance: {
      mass: "Assumed 10 solar masses.",
      radius: "Derived Schwarzschild scale 2GM/c²; not a surface.",
      period: "Not applicable; angular momentum specified by χ.",
      spin: kind === "kerr" ? "Assumed χ = 0.7." : "Nonrotating.",
    },
  })),
];
export const preset = (id: string) =>
  PRESETS.find((p) => p.id === id) ?? PRESETS[0];
