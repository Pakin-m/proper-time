// SI constants: CODATA 2022 G; c is exact. Julian year = 365.25 SI days.
export const G = 6.6743e-11;
export const C = 299792458;
export const DAY = 86400;
export const YEAR = 365.25 * DAY;
export const SOLAR_MASS = 1.9884e30; // NASA Sun Fact Sheet; used for illustrative presets.
export const radians = (degrees: number) => (degrees * Math.PI) / 180;
export const gravitationalRadius = (mass: number) => (G * mass) / (C * C);
export const angularVelocity = (period: number) =>
  period === 0 ? 0 : (2 * Math.PI) / period;
export type BodyKind = "sphere" | "schwarzschild" | "kerr";
export interface Body {
  id: string;
  name: string;
  mass: number;
  radius: number;
  period: number;
  spin: number;
  kind: BodyKind;
}
export type Experiment = "altitude" | "rotation" | "orbit" | "compact";
export type Motion =
  "static" | "corotate" | "angular" | "orbit" | "retrograde" | "zamo";
export interface Probe {
  body: Body;
  radius: number;
  latitude: number;
  longitude: number;
  motion: Motion;
  omega: number;
}
export type Result<T> = { ok: true; value: T } | { ok: false; reason: string };
const good = <T>(value: T): Result<T> => ({ ok: true, value });
const bad = <T>(reason: string): Result<T> => ({ ok: false, reason });
const positive = (x: number) => Number.isFinite(x) && x > 0;
export function validateBody(b: Body): Result<Body> {
  if (
    !positive(b.mass) ||
    !positive(b.radius) ||
    !Number.isFinite(b.period) ||
    b.period < 0
  )
    return bad(
      "Mass and radius must be finite and positive; period must be nonnegative (0 means nonrotating).",
    );
  if (!Number.isFinite(b.spin) || Math.abs(b.spin) >= 1)
    return bad("Kerr spin must satisfy |χ| < 1.");
  if (!positive(gravitationalRadius(b.mass)))
    return bad("Mass is outside the numerical domain.");
  if (
    b.kind === "sphere" &&
    !((2 * gravitationalRadius(b.mass)) / b.radius < 8 / 9)
  )
    return bad("A uniform-density sphere requires 2GM/(Rc²) < 8/9.");
  if (b.kind === "schwarzschild" && b.spin !== 0)
    return bad("Schwarzschild requires zero spin.");
  return good(b);
}
export function potential(
  mass: number,
  radius: number,
  r: number,
): Result<number> {
  if (!positive(mass) || !positive(radius) || !Number.isFinite(r) || r < 0)
    return bad("Invalid spherical potential parameters.");
  const phi =
    r < radius
      ? ((-G * mass) / (2 * radius)) * (3 - (r / radius) ** 2)
      : (-G * mass) / r;
  return Number.isFinite(phi)
    ? good(phi)
    : bad("Potential is outside the numerical domain.");
}
// sqrt(1-x)-1 without losing its small deviation from unity.
export const sqrtDeviation = (x: number) => -x / (Math.sqrt(1 - x) + 1);
export interface Rate {
  deviation: number; // dτ/dt - 1, never obtained by subtracting rounded full rates
  beta: number;
  compactness: number;
  q: number | null;
  omega: number;
  model: "interior" | "schwarzschild" | "weak" | "kerr";
  argument: number; // Exterior rate radicand parameter; interior radial metric parameter.
}
export function schwarzschildRate(mass: number, r: number): Result<number> {
  if (!positive(mass) || !positive(r))
    return bad("Mass and radius must be positive.");
  const u = (2 * gravitationalRadius(mass)) / r;
  if (!(u < 1))
    return bad(
      "A static clock must be strictly outside the Schwarzschild horizon.",
    );
  return good(sqrtDeviation(u));
}
export function interiorRate(
  mass: number,
  radius: number,
  r: number,
): Result<number> {
  if (
    !positive(mass) ||
    !positive(radius) ||
    !Number.isFinite(r) ||
    r < 0 ||
    r > radius
  )
    return bad("Invalid interior radius.");
  const u = (2 * gravitationalRadius(mass)) / radius;
  if (!(u < 8 / 9))
    return bad(
      "Uniform-density interior requires 2GM/(Rc²) < 8/9 (Buchdahl bound).",
    );
  return good(
    (3 * sqrtDeviation(u) - sqrtDeviation(u * (r / radius) ** 2)) / 2,
  );
}
export function weakFieldRate(phi: number, speed: number): Result<number> {
  if (!Number.isFinite(phi) || !Number.isFinite(speed) || speed < 0 || phi > 0)
    return bad("Invalid potential or speed.");
  if (Math.abs(phi) / C ** 2 > 1e-4 || (speed / C) ** 2 > 1e-4)
    return bad("Weak-field domain exceeded: |Φ|/c² and v²/c² must be ≤ 10⁻⁴.");
  return good(phi / C ** 2 - speed ** 2 / (2 * C ** 2));
}
export function rotationSupport(
  mass: number,
  radius: number,
  omega: number,
): Result<number> {
  if (!positive(mass) || !positive(radius) || !Number.isFinite(omega))
    return bad("Invalid rotational support parameters.");
  const q = (omega ** 2 * radius ** 3) / (G * mass);
  return Number.isFinite(q)
    ? good(q)
    : bad("Rotational support is outside the numerical domain.");
}
export function circularOrbit(
  mass: number,
  surface: number,
  r: number,
): Result<{ deviation: number; omega: number; beta: number }> {
  if (!positive(mass) || !positive(surface) || !positive(r))
    return bad("Invalid orbit parameters.");
  const m = gravitationalRadius(mass);
  if (r <= surface)
    return bad(
      "A free circular orbit must be strictly outside the material surface.",
    );
  if (r < 6 * m)
    return bad("Stable Schwarzschild circular orbits require r ≥ 6GM/c².");
  const omega = Math.sqrt((G * mass) / r ** 3),
    beta = Math.sqrt(m / (r - 2 * m));
  if (![omega, beta].every(Number.isFinite))
    return bad("Orbit is outside the numerical domain.");
  return good({ deviation: sqrtDeviation((3 * m) / r), omega, beta });
}
export function kerrHorizon(spin: number): number {
  return 1 + Math.sqrt(1 - spin ** 2);
}
export function kerrISCO(spin: number, direction: 1 | -1): number {
  const a = spin * direction;
  const z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const z2 = Math.sqrt(3 * a * a + z1 * z1);
  return 3 + z2 - Math.sign(a) * Math.sqrt((3 - z1) * (3 + z1 + 2 * z2));
}
export interface KerrGeometry {
  alpha2: number;
  gphi: number;
  drag: number;
  lower: number;
  upper: number;
}
export function kerrGeometry(x: number, a: number): Result<KerrGeometry> {
  if (!positive(x) || !Number.isFinite(a) || Math.abs(a) >= 1)
    return bad("Kerr requires finite radius and |χ| < 1.");
  if (x <= kerrHorizon(a))
    return bad(
      "Stationary Kerr observers must be strictly outside the outer horizon.",
    );
  const delta = (x - kerrHorizon(a)) * (x - (1 - Math.sqrt(1 - a * a)));
  const gphi = x * x + a * a + (2 * a * a) / x;
  const alpha2 = delta / gphi;
  const drag = (2 * a) / (x * gphi);
  const width = Math.sqrt(alpha2 / gphi);
  if (![alpha2, gphi, drag, width].every(Number.isFinite) || alpha2 <= 0)
    return bad("Kerr geometry is outside the numerical domain.");
  return good({ alpha2, gphi, drag, lower: drag - width, upper: drag + width });
}
export function kerrRate(
  mass: number,
  r: number,
  spin: number,
  motion: Motion,
  omegaSI = 0,
): Result<Rate> {
  if (!positive(mass) || !positive(r)) return bad("Invalid Kerr parameters.");
  const m = gravitationalRadius(mass),
    x = r / m;
  const geometry = kerrGeometry(x, spin);
  if (!geometry.ok) return geometry;
  const { alpha2, gphi, drag, lower, upper } = geometry.value;
  let w = (omegaSI * m) / C;
  if (motion === "static") {
    if (x <= 2)
      return bad("Static Kerr observers require r > 2GM/c² at the equator.");
    w = 0;
  } else if (motion === "zamo") w = drag;
  else if (motion === "orbit" || motion === "retrograde") {
    const d: 1 | -1 =
      motion === "orbit" ? (spin < 0 ? -1 : 1) : spin < 0 ? 1 : -1;
    if (x < kerrISCO(spin, d))
      return bad(
        "This circular orbit lies inside its Kerr ISCO and is not stable.",
      );
    w = d / (x ** 1.5 + d * spin);
  } else if (motion !== "angular")
    return bad("Choose a Kerr static, ZAMO, angular, or circular observer.");
  if (!Number.isFinite(w) || !(w > lower && w < upper))
    return bad(
      "Observer is not timelike: Ω must lie strictly between Ω₋ and Ω₊.",
    );
  const beta = Math.abs((w - drag) * Math.sqrt(gphi / alpha2));
  const norm = alpha2 * (1 - beta * beta);
  if (!(norm > 0) || !Number.isFinite(norm))
    return bad("Observer normalization is outside the numerical domain.");
  // Analytic deviation of the metric norm from 1 avoids subtracting near-unity quantities.
  const normDelta = -2 / x + (4 * spin * w) / x - gphi * w * w;
  const deviation = normDelta / (Math.sqrt(norm) + 1);
  return good({
    deviation,
    beta,
    compactness: 2 / x,
    q: null,
    omega: (w * C) / m,
    model: "kerr",
    argument: -normDelta,
  });
}
export function evaluate(probe: Probe, experiment: Experiment): Result<Rate> {
  const { body: b, radius: r, latitude, longitude, motion } = probe;
  const body = validateBody(b);
  if (!body.ok) return body;
  if (
    !Number.isFinite(r) ||
    r < 0 ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(probe.omega)
  )
    return bad(
      "Coordinates and angular velocity must be finite; latitude must be between −90° and 90°.",
    );
  if (
    (experiment === "orbit" ||
      b.kind === "kerr" ||
      motion === "orbit" ||
      motion === "retrograde") &&
    latitude !== 0
  )
    return bad("This observer model is restricted to the equatorial plane.");
  if (b.kind === "kerr") {
    if (experiment !== "compact")
      return bad("Use the compact-object experiment for Kerr observers.");
    return kerrRate(b.mass, r, b.spin, motion, probe.omega);
  }
  const m = gravitationalRadius(b.mass);
  const compactness =
    b.kind === "sphere" && r < b.radius
      ? ((2 * m) / b.radius) * (r / b.radius) ** 2
      : (2 * m) / r;
  if (experiment === "rotation") {
    if (b.kind !== "sphere")
      return bad("Spherical rotational support is not a black-hole model.");
    if (!["static", "corotate", "angular"].includes(motion))
      return bad("Choose a stationary or prescribed rotating observer.");
    const omega =
      motion === "static"
        ? 0
        : motion === "corotate"
          ? angularVelocity(b.period)
          : probe.omega;
    const speed = Math.abs(omega * r * Math.cos(radians(latitude)));
    const phi = potential(b.mass, b.radius, r);
    if (!phi.ok) return phi;
    const q = rotationSupport(b.mass, b.radius, angularVelocity(b.period));
    if (!q.ok) return q;
    const observerQ = rotationSupport(b.mass, b.radius, omega);
    if (!observerQ.ok) return observerQ;
    if (q.value >= 0.1 || observerQ.value >= 0.1)
      return bad(
        "Spherical rotation domain exceeded: body and observer support ratios must be q < 0.1.",
      );
    const rate = weakFieldRate(phi.value, speed);
    if (!rate.ok) return rate;
    return good({
      deviation: rate.value,
      beta: speed / C,
      compactness,
      q: q.value,
      omega,
      model: "weak",
      argument: 0,
    });
  }
  if (motion === "orbit" || motion === "retrograde") {
    if (experiment !== "orbit" && experiment !== "compact")
      return bad(
        "Circular motion requires the orbit or compact-object experiment.",
      );
    const rate = circularOrbit(
      b.mass,
      b.kind === "sphere" ? b.radius : 2 * m,
      r,
    );
    if (!rate.ok) return rate;
    return good({
      ...rate.value,
      omega: motion === "retrograde" ? -rate.value.omega : rate.value.omega,
      compactness,
      q: null,
      model: "schwarzschild",
      argument: (3 * m) / r,
    });
  }
  if (motion !== "static")
    return bad("This spherical experiment requires a static observer.");
  const inside = b.kind === "sphere" && r < b.radius;
  const rate = inside
    ? interiorRate(b.mass, b.radius, r)
    : schwarzschildRate(b.mass, r);
  if (!rate.ok) return rate;
  return good({
    deviation: rate.value,
    beta: 0,
    compactness,
    q: null,
    omega: 0,
    model: inside ? "interior" : "schwarzschild",
    argument: compactness,
  });
}
// Error-free addition followed by compensated summation of small deviations.
export function compensatedSum(values: number[]): number {
  let sum = 0,
    error = 0;
  for (const value of values) {
    const next = sum + value;
    error +=
      Math.abs(sum) >= Math.abs(value)
        ? sum - next + value
        : value - next + sum;
    sum = next;
  }
  return sum + error;
}
// Analytic potential difference, including the mixed interior/exterior case.
export function potentialDifference(b: Body, ra: number, rb: number): number {
  const R = b.radius,
    gm = G * b.mass;
  if (ra >= R && rb >= R) return (gm * ((rb - ra) / ra)) / rb;
  if (ra <= R && rb <= R)
    return (gm / (2 * R)) * ((rb - ra) / R) * ((rb + ra) / R);
  const inner = Math.min(ra, rb),
    outer = Math.max(ra, rb);
  const diff =
    (gm * ((outer - R) / R)) / outer +
    (gm / (2 * R)) * ((R - inner) / R) * ((R + inner) / R);
  return rb > ra ? diff : -diff;
}
export function rateDifference(
  a: Probe,
  b: Probe,
  experiment: Experiment,
): Result<number> {
  const ar = evaluate(a, experiment),
    br = evaluate(b, experiment);
  if (!ar.ok) return bad("A: " + ar.reason);
  if (!br.ok) return bad("B: " + br.reason);
  const av = ar.value,
    bv = br.value;
  const same =
    a.body.mass === b.body.mass &&
    a.body.radius === b.body.radius &&
    a.body.kind === b.body.kind &&
    a.body.spin === b.body.spin;
  if (same && av.model === "schwarzschild" && bv.model === "schwarzschild") {
    const ka = a.motion === "static" ? 2 : 3,
      kb = b.motion === "static" ? 2 : 3;
    const delta =
      ka === kb
        ? (ka *
            gravitationalRadius(a.body.mass) *
            ((b.radius - a.radius) / Math.min(a.radius, b.radius))) /
          Math.max(a.radius, b.radius)
        : av.argument - bv.argument;
    return good(
      delta / (Math.sqrt(1 - av.argument) + Math.sqrt(1 - bv.argument)),
    );
  }
  if (same && av.model === "interior" && bv.model === "interior") {
    const u = (2 * gravitationalRadius(a.body.mass)) / a.body.radius;
    const xa = u * (a.radius / a.body.radius) ** 2,
      xb = u * (b.radius / a.body.radius) ** 2;
    return good(
      ((u / 2) *
        ((b.radius - a.radius) / a.body.radius) *
        ((b.radius + a.radius) / a.body.radius)) /
        (Math.sqrt(1 - xa) + Math.sqrt(1 - xb)),
    );
  }
  if (
    same &&
    a.motion === "static" &&
    b.motion === "static" &&
    av.model !== "kerr" &&
    bv.model !== "kerr" &&
    av.model !== bv.model &&
    experiment !== "rotation"
  ) {
    const R = a.body.radius,
      m = gravitationalRadius(a.body.mass),
      u = (2 * m) / R;
    const inner = Math.min(a.radius, b.radius),
      outer = Math.max(a.radius, b.radius);
    const xi = u * (inner / R) ** 2,
      xo = (2 * m) / outer;
    const left =
      (u * ((R - inner) / R) * ((R + inner) / R)) /
      (2 * (Math.sqrt(1 - xi) + Math.sqrt(1 - u)));
    const right =
      (2 * m * ((outer - R) / R)) /
      outer /
      (Math.sqrt(1 - u) + Math.sqrt(1 - xo));
    return good((b.radius > a.radius ? 1 : -1) * compensatedSum([left, right]));
  }
  if (same && av.model === "kerr" && bv.model === "kerr") {
    const m = gravitationalRadius(a.body.mass),
      xa = a.radius / m,
      xb = b.radius / m,
      spin = a.body.spin;
    const dx = (b.radius - a.radius) / m;
    const ga = xa * xa + spin * spin + (2 * spin * spin) / xa;
    const gb = xb * xb + spin * spin + (2 * spin * spin) / xb;
    const wa = (av.omega * m) / C,
      wb = (bv.omega * m) / C;
    let dw = wb - wa;
    if (a.motion === b.motion) {
      if (a.motion === "static") dw = 0;
      if (a.motion === "angular") dw = ((b.omega - a.omega) * m) / C;
      if (a.motion === "zamo")
        dw =
          (-2 * spin * dx * (xb * xb + xb * xa + xa * xa + spin * spin)) /
          (xa * ga * xb * gb);
      if (a.motion === "orbit" || a.motion === "retrograde") {
        const d =
          a.motion === "orbit" ? (spin < 0 ? -1 : 1) : spin < 0 ? 1 : -1;
        const sa = Math.sqrt(xa),
          sb = Math.sqrt(xb);
        const powerDifference = (dx * (xb + sa * sb + xa)) / (sb + sa);
        dw =
          (-d * powerDifference) /
          ((xa ** 1.5 + d * spin) * (xb ** 1.5 + d * spin));
      }
    }
    const dg = dx * (xb + xa) - (2 * spin * spin * dx) / (xa * xb);
    const normDifference = compensatedSum([
      (2 * dx) / (xa * xb),
      4 * spin * (dw / xb - (wa * dx) / (xa * xb)),
      -dg * wb * wb,
      -ga * dw * (wb + wa),
    ]);
    const result = normDifference / (2 + av.deviation + bv.deviation);
    return Number.isFinite(result)
      ? good(result)
      : bad("Kerr rate difference is outside the numerical domain.");
  }
  if (same && av.model === "weak" && bv.model === "weak") {
    const va = av.beta * C,
      vb = bv.beta * C;
    return good(
      compensatedSum([
        potentialDifference(a.body, a.radius, b.radius) / C ** 2,
        (-(vb - va) * (vb + va)) / (2 * C ** 2),
      ]),
    );
  }
  return good(compensatedSum([bv.deviation, -av.deviation]));
}
export function accumulatedDifference(
  rate: number,
  duration: number,
): Result<number> {
  if (!Number.isFinite(rate) || !Number.isFinite(duration) || duration < 0)
    return bad("Rate and nonnegative reference duration must be finite.");
  const offset = rate * duration;
  return Number.isFinite(offset)
    ? good(offset)
    : bad("Accumulated offset is outside the numerical domain.");
}
export function advanceAccumulator(
  state: { elapsed: number; offset: number; correction: number },
  seconds: number,
  difference: number,
) {
  const contribution = difference * seconds - state.correction;
  const offset = state.offset + contribution;
  return {
    elapsed: state.elapsed + seconds,
    offset,
    correction: offset - state.offset - contribution,
  };
}
