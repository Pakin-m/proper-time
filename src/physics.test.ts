import { describe, expect, it } from "vitest";
import {
  C,
  DAY,
  G,
  SOLAR_MASS,
  accumulatedDifference,
  advanceAccumulator,
  angularVelocity,
  circularOrbit,
  evaluate,
  gravitationalRadius,
  interiorRate,
  kerrGeometry,
  kerrHorizon,
  kerrISCO,
  kerrRate,
  potential,
  potentialDifference,
  rateDifference,
  rotationSupport,
  schwarzschildRate,
  weakFieldRate,
  type Probe,
  type Result,
} from "./physics";
import { preset } from "./presets";
function value<T>(r: Result<T>): T {
  if (!r.ok) throw Error(r.reason);
  return r.value;
}
const earth = preset("earth");
const probe = (
  r: number,
  motion: Probe["motion"] = "static",
  latitude = 0,
): Probe => ({
  body: earth,
  radius: r,
  latitude,
  longitude: 0,
  motion,
  omega: 0,
});
describe("spherical potentials and rates", () => {
  it("matches exterior potential and continuous surface", () => {
    expect(value(potential(earth.mass, earth.radius, earth.radius))).toBe(
      (-G * earth.mass) / earth.radius,
    );
    expect(value(potential(earth.mass, earth.radius, 0))).toBe(
      (-1.5 * G * earth.mass) / earth.radius,
    );
    expect(
      value(potential(earth.mass, earth.radius, earth.radius * (1 - 1e-9))),
    ).toBeCloseTo((-G * earth.mass) / earth.radius, 0);
  });
  it("matches exact uniform-density center and surface", () => {
    const M = SOLAR_MASS,
      R = 20000,
      u = (2 * gravitationalRadius(M)) / R;
    expect(value(interiorRate(M, R, 0)) + 1).toBeCloseTo(
      (3 * Math.sqrt(1 - u) - 1) / 2,
      14,
    );
    expect(value(interiorRate(M, R, R))).toBeCloseTo(
      value(schwarzschildRate(M, R)),
      15,
    );
  });
  it("rejects Buchdahl bound, horizon, and invalid parameters", () => {
    const m = gravitationalRadius(SOLAR_MASS);
    expect(interiorRate(SOLAR_MASS, (2 * m) / (8 / 9), 0).ok).toBe(false);
    expect(schwarzschildRate(SOLAR_MASS, 2 * m).ok).toBe(false);
    expect(potential(-1, 10, 1).ok).toBe(false);
    expect(evaluate(probe(NaN), "altitude").ok).toBe(false);
  });
  it("approaches zero field and agrees with first-order expansion", () => {
    expect(value(weakFieldRate(0, 0))).toBe(0);
    expect(Math.abs(value(schwarzschildRate(1, 1e20)))).toBeLessThan(1e-40);
    const phi = value(potential(earth.mass, earth.radius, earth.radius));
    expect(value(schwarzschildRate(earth.mass, earth.radius))).toBeCloseTo(
      phi / C ** 2,
      17,
    );
  });
  it("resolves 1 km Earth altitude independently", () => {
    const a = probe(earth.radius),
      b = probe(earth.radius + 1000);
    const diff = value(rateDifference(a, b, "altitude"));
    const predicted =
      (G * earth.mass * 1000) / (C * C * earth.radius * (earth.radius + 1000));
    expect(diff / predicted).toBeCloseTo(1, 8);
    expect(value(accumulatedDifference(diff, DAY)) * 1e9).toBeCloseTo(9.439, 2);
  });
  it("preserves nanosecond and smaller offsets without subtracting totals", () => {
    const a = probe(earth.radius),
      b = probe(earth.radius + 1e-6);
    const diff = value(rateDifference(a, b, "altitude"));
    const expected =
      (G * earth.mass * (b.radius - a.radius)) / (C * C * a.radius * b.radius);
    expect(diff / expected).toBeCloseTo(1, 8);
    expect(diff).toBeGreaterThan(0);
    expect(value(rateDifference(a, a, "altitude"))).toBe(0);
    expect(value(rateDifference(b, a, "altitude"))).toBe(-diff);
  });
  it("handles interior and mixed potential differences", () => {
    for (const [ra, rb] of [
      [0, earth.radius / 2],
      [earth.radius / 2, earth.radius + 1000],
    ]) {
      const expected =
        value(potential(earth.mass, earth.radius, rb)) -
        value(potential(earth.mass, earth.radius, ra));
      expect(potentialDifference(earth, ra, rb) / expected).toBeCloseTo(1, 12);
    }
    const a = probe(100),
      b = probe(100.00001);
    const u = (2 * gravitationalRadius(earth.mass)) / earth.radius;
    const expected =
      (u * (b.radius - a.radius) * (b.radius + a.radius)) /
      (4 * earth.radius ** 2);
    expect(value(rateDifference(a, b, "altitude")) / expected).toBeCloseTo(
      1,
      8,
    );
  });
});
describe("rotation and free orbits", () => {
  it("equatorial corotation loses proper time relative to poles", () => {
    const a = probe(earth.radius, "corotate", 0),
      b = probe(earth.radius, "corotate", 90);
    const diff = value(rateDifference(a, b, "rotation"));
    const v = angularVelocity(earth.period) * earth.radius;
    expect(diff).toBeCloseTo((v * v) / (2 * C * C), 24);
    expect(
      value(
        rotationSupport(
          earth.mass,
          earth.radius,
          angularVelocity(earth.period),
        ),
      ),
    ).toBeCloseTo(0.00345, 4);
  });
  it("rejects unsupported field, speed, and rotation", () => {
    expect(weakFieldRate(-C * C * 1e-3, 0).ok).toBe(false);
    expect(weakFieldRate(0, C / 2).ok).toBe(false);
    const p = probe(earth.radius, "angular");
    p.omega = 1;
    expect(evaluate(p, "rotation").ok).toBe(false);
    expect(
      evaluate({ ...p, body: preset("neutron-star") }, "rotation").ok,
    ).toBe(false);
  });
  it("matches circular Schwarzschild rates and rejects forbidden orbits", () => {
    const m = gravitationalRadius(SOLAR_MASS);
    expect(
      value(circularOrbit(SOLAR_MASS, 2 * m, 6 * m)).deviation + 1,
    ).toBeCloseTo(Math.SQRT1_2, 14);
    expect(circularOrbit(SOLAR_MASS, 2 * m, 5 * m).ok).toBe(false);
    expect(circularOrbit(earth.mass, earth.radius, earth.radius).ok).toBe(
      false,
    );
    expect(
      evaluate(probe(earth.radius + 400000, "orbit", 30), "orbit").ok,
    ).toBe(false);
  });
});
describe("Kerr equatorial observers", () => {
  it("reduces to Schwarzschild static and circular limits", () => {
    const m = gravitationalRadius(SOLAR_MASS);
    expect(
      value(kerrRate(SOLAR_MASS, 10 * m, 0, "static")).deviation,
    ).toBeCloseTo(value(schwarzschildRate(SOLAR_MASS, 10 * m)), 14);
    expect(
      value(kerrRate(SOLAR_MASS, 10 * m, 0, "orbit")).deviation,
    ).toBeCloseTo(
      value(circularOrbit(SOLAR_MASS, 2 * m, 10 * m)).deviation,
      14,
    );
    expect(kerrISCO(0, 1)).toBe(6);
  });
  it("validates ZAMO normalization and spin reversal", () => {
    const m = gravitationalRadius(SOLAR_MASS),
      g = value(kerrGeometry(3, 0.7));
    const z = value(kerrRate(SOLAR_MASS, 3 * m, 0.7, "zamo"));
    expect(z.deviation + 1).toBeCloseTo(Math.sqrt(g.alpha2), 14);
    expect(z.beta).toBe(0);
    expect(value(kerrRate(SOLAR_MASS, 3 * m, -0.7, "zamo")).deviation).toBe(
      z.deviation,
    );
    expect(value(kerrRate(SOLAR_MASS, 10 * m, -0.7, "orbit")).deviation).toBe(
      value(kerrRate(SOLAR_MASS, 10 * m, 0.7, "orbit")).deviation,
    );
  });
  it("rejects horizons, extremality, lightlike bounds, and ergosphere static observers", () => {
    const m = gravitationalRadius(SOLAR_MASS);
    expect(kerrRate(SOLAR_MASS, kerrHorizon(0.7) * m, 0.7, "zamo").ok).toBe(
      false,
    );
    expect(kerrRate(SOLAR_MASS, 10 * m, 1, "static").ok).toBe(false);
    expect(kerrRate(SOLAR_MASS, 1.9 * m, 0.7, "static").ok).toBe(false);
    expect(kerrRate(SOLAR_MASS, 2 * m, 0.7, "static").ok).toBe(false);
    const g = value(kerrGeometry(4, 0.7));
    expect(
      kerrRate(SOLAR_MASS, 4 * m, 0.7, "angular", ((g.upper + 1e-10) * C) / m)
        .ok,
    ).toBe(false);
    expect(kerrRate(SOLAR_MASS, 2 * m, 0.7, "zamo").ok).toBe(true);
  });
  it("uses known prograde/retrograde ISCO values", () => {
    expect(kerrISCO(0.5, 1)).toBeCloseTo(4.2330025295, 9);
    expect(kerrISCO(0.5, -1)).toBeCloseTo(7.5545847145, 9);
    expect(
      kerrRate(SOLAR_MASS, 3 * gravitationalRadius(SOLAR_MASS), 0.7, "orbit")
        .ok,
    ).toBe(false);
  });
});
describe("elapsed time", () => {
  it("integrates piecewise settings and compensated offsets", () => {
    let s = { elapsed: 0, offset: 0, correction: 0 };
    s = advanceAccumulator(s, 100, 1e-12);
    s = advanceAccumulator(s, 50, -2e-12);
    expect(s.elapsed).toBe(150);
    expect(s.offset).toBe(0);
    expect(accumulatedDifference(NaN, DAY).ok).toBe(false);
    expect(accumulatedDifference(1, -1).ok).toBe(false);
  });
});

describe("fine differences across model boundaries", () => {
  it("resolves tiny separations straddling the spherical surface", () => {
    const a = probe(earth.radius - 1e-6),
      b = probe(earth.radius + 1e-6);
    const diff = value(rateDifference(a, b, "altitude"));
    const expected =
      (G * earth.mass * (b.radius - a.radius)) / (C * C * earth.radius ** 2);
    expect(diff / expected).toBeCloseTo(1, 8);
    expect(value(rateDifference(b, a, "altitude"))).toBe(-diff);
  });
  it("resolves tiny equatorial Kerr static differences analytically", () => {
    const body = preset("kerr"),
      m = gravitationalRadius(body.mass);
    const a: Probe = {
      body,
      radius: 6 * m,
      latitude: 0,
      longitude: 0,
      motion: "static",
      omega: 0,
    };
    const b = { ...a, radius: a.radius + 1e-8 };
    const dx = (b.radius - a.radius) / m;
    const expected = dx / (36 * Math.sqrt(1 - 2 / 6));
    expect(value(rateDifference(a, b, "compact")) / expected).toBeCloseTo(
      1,
      10,
    );
  });
  it("resolves ZAMO and circular rates against independent derivatives", () => {
    const body = preset("kerr"),
      m = gravitationalRadius(body.mass),
      x = 10,
      aSpin = body.spin;
    for (const motion of ["zamo", "orbit"] as const) {
      const a: Probe = {
        body,
        radius: x * m,
        latitude: 0,
        longitude: 0,
        motion,
        omega: 0,
      };
      const b = { ...a, radius: a.radius + 1e-7 },
        dx = (b.radius - a.radius) / m;
      let derivative: number;
      if (motion === "zamo") {
        const delta = x * x - 2 * x + aSpin * aSpin,
          g = x * x + aSpin * aSpin + (2 * aSpin * aSpin) / x;
        derivative =
          ((2 * x - 2) * g - delta * (2 * x - (2 * aSpin * aSpin) / (x * x))) /
          (2 * g * g * Math.sqrt(delta / g));
      } else {
        const term = 1 - 3 / x + (2 * aSpin) / x ** 1.5,
          den = 1 + aSpin / x ** 1.5;
        const f = Math.sqrt(term) / den;
        derivative =
          f *
          ((0.5 * (3 / x ** 2 - (3 * aSpin) / x ** 2.5)) / term +
            (1.5 * aSpin) / x ** 2.5 / den);
      }
      expect(
        value(rateDifference(a, b, "compact")) / (derivative * dx),
      ).toBeCloseTo(1, 9);
    }
  });
  it("rejects nonuniform-compatible compactness even for exterior probes", () => {
    const body = { ...earth, radius: gravitationalRadius(earth.mass) * 2 };
    expect(evaluate({ ...probe(earth.radius), body }, "altitude").ok).toBe(
      false,
    );
    expect(
      evaluate(probe(earth.radius + 400000, "orbit", 30), "compact").ok,
    ).toBe(false);
  });
});

it("uses enclosed mass for interior compactness with a finite central limit", () => {
  const center = value(evaluate(probe(0), "altitude"));
  expect(center.compactness).toBe(0);
  expect(Number.isFinite(center.argument)).toBe(true);
  expect(
    value(evaluate(probe(earth.radius / 2), "altitude")).compactness,
  ).toBeCloseTo(gravitationalRadius(earth.mass) / (2 * earth.radius), 20);
});
