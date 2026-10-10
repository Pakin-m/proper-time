import type { Experiment } from "./physics";
import { preset } from "./presets";
import type { LabState } from "./state";
const frac = (n: string, d: string) =>
  "<mfrac><mrow>" + n + "</mrow><mrow>" + d + "</mrow></mfrac>";
const root = (s: string) => "<msqrt><mrow>" + s + "</mrow></msqrt>";
const c2 = "<msup><mi>c</mi><mn>2</mn></msup>";
const gm = "<mi>G</mi><mi>M</mi>";
const rate = frac("<mi>d</mi><mi>τ</mi>", "<mi>d</mi><mi>t</mi>");
const staticRate =
  rate +
  "<mo>=</mo>" +
  root("<mn>1</mn><mo>−</mo>" + frac("<mn>2</mn>" + gm, "<mi>r</mi>" + c2));
const equations: Record<Experiment, string> = {
  altitude:
    staticRate +
    '<mspace width="2em"/><msub><mi>f</mi><mtext>interior</mtext></msub><mo>=</mo>' +
    frac(
      "<mn>3</mn>" +
        root("<mn>1</mn><mo>−</mo><mi>u</mi>") +
        "<mo>−</mo>" +
        root(
          "<mn>1</mn><mo>−</mo><mi>u</mi><msup><mrow><mo>(</mo><mi>r</mi><mo>/</mo><mi>R</mi><mo>)</mo></mrow><mn>2</mn></msup>",
        ),
      "<mn>2</mn>",
    ),
  rotation:
    rate +
    "<mo>≈</mo><mn>1</mn><mo>+</mo>" +
    frac("<mi>Φ</mi>", c2) +
    "<mo>−</mo>" +
    frac("<msup><mi>v</mi><mn>2</mn></msup>", "<mn>2</mn>" + c2) +
    '<mspace width="2em"/><mi>q</mi><mo>=</mo>' +
    frac(
      "<msup><mi>ω</mi><mn>2</mn></msup><msup><mi>R</mi><mn>3</mn></msup>",
      gm,
    ),
  orbit:
    "<msub><mi>Ω</mi><mtext>orbit</mtext></msub><mo>=</mo>" +
    root(frac(gm, "<msup><mi>r</mi><mn>3</mn></msup>")) +
    '<mspace width="2em"/>' +
    rate +
    "<mo>=</mo>" +
    root("<mn>1</mn><mo>−</mo>" + frac("<mn>3</mn>" + gm, "<mi>r</mi>" + c2)),
  compact:
    rate +
    "<mo>=</mo>" +
    root(
      "<mo>−</mo><msub><mi>g</mi><mrow><mi>t</mi><mi>t</mi></mrow></msub><mo>−</mo><mn>2</mn><msub><mi>g</mi><mrow><mi>t</mi><mi>φ</mi></mrow></msub><mover><mi>Ω</mi><mo>¯</mo></mover><mo>−</mo><msub><mi>g</mi><mrow><mi>φ</mi><mi>φ</mi></mrow></msub><msup><mover><mi>Ω</mi><mo>¯</mo></mover><mn>2</mn></msup>",
    ),
};
export default function Assumptions({
  state,
  selected,
}: {
  state: LabState;
  selected: number;
}) {
  const b = state.probes[selected].body,
    p = preset(b.id.replace("custom:", ""));
  return (
    <details>
      <summary>Equations & model assumptions</summary>
      <div className="assumptions">
        <div
          className="equation-block"
          dangerouslySetInnerHTML={{
            __html: equations[state.experiment]
              .split('<mspace width="2em"/>')
              .map((e) => '<math display="block"><mrow>' + e + "</mrow></math>")
              .join(""),
          }}
        />
        <p>
          Δτ = (f<sub>B</sub> − f<sub>A</sub>)t for fixed parameters; live
          offsets integrate successive parameter segments. Positive Δτ means B
          accumulates more proper time.
        </p>
        <p>
          {state.experiment === "rotation"
            ? "First-order weak field: v = ωr cos λ; |Φ|/c² ≤ 10⁻⁴, v²/c² ≤ 10⁻⁴, and body and observer q < 0.1. These are conservative application limits. Neglected terms are second order. q is an equatorial support diagnostic, not a structural solution."
            : state.experiment === "orbit"
              ? "Exterior Schwarzschild geodesics only. Stable orbits require r ≥ 6GM/c² and r above the material surface. Hovering clocks require acceleration and are distinct from free orbital observers."
              : state.experiment === "compact"
                ? "Exact Schwarzschild or equatorial Kerr normalization. The metric equation uses signature (−,+,+,+), x = rc²/(GM), a = χ, and dimensionless Ω̄ = ΩGM/c³. Timelike stationary observers require r > r₊ and Ω₋ < Ω < Ω₊. Circular geodesics must lie at or beyond their ISCO."
                : "Exact static Schwarzschild exterior and constant-density Schwarzschild interior; u = 2GM/(Rc²) < 8/9. The uniform density and pressure profile are illustrative, including for compact stars."}
        </p>
        {state.experiment === "compact" && (
          <p>
            Kerr equator: g<sub>tt</sub> = −(1 − 2/x), g<sub>tφ</sub> = −2a/x, g
            <sub>φφ</sub> = x² + a² + 2a²/x. Ω̄<sub>ZAMO</sub> = −g<sub>tφ</sub>
            /g<sub>φφ</sub>. Ω̄<sub>±</sub> = Ω̄<sub>ZAMO</sub> ± α/√g
            <sub>φφ</sub>, α² = (x² − 2x + a²)/g<sub>φφ</sub>. Schwarzschild has
            χ = 0.
          </p>
        )}
        <p>
          Φ = −GM/r outside; Φ = −GM[3 − (r/R)²]/(2R) inside. Spherical
          approximations omit geoid structure, oblateness, tides, other bodies,
          differential rotation, and rotating stellar structure. No grid is a
          numerical solution of Einstein's equations.
        </p>
        <p>
          v/c is measured by local static observers for Schwarzschild orbits, by
          ZAMOs for Kerr, and uses Newtonian speed in the rotation model. M(r)
          is enclosed gravitational mass; compactness tends to zero at the
          uniform-density center. Different-body comparisons assume equal
          asymptotic coordinate durations in separate isolated spacetimes.
        </p>
        <div className="provenance">
          <span className="eyebrow">Selected body provenance</span>
          <p>
            {b.id.startsWith("custom:")
              ? "Custom values are assumed; listed sources show preset lineage. "
              : p.assumed
                ? "Illustrative parameters. "
                : ""}
            {p.model}
          </p>
          {Object.entries(p.provenance).map(([key, source]) => (
            <p key={key}>
              <strong>{key}</strong> ·{" "}
              {source.startsWith("https:") ? (
                <a href={source} target="_blank" rel="noreferrer">
                  NASA source
                </a>
              ) : (
                source
              )}
            </p>
          ))}
          <p>
            Retrieved {p.retrieved} ·{" "}
            <a
              href="https://arxiv.org/abs/1801.06149"
              target="_blank"
              rel="noreferrer"
            >
              Kerr observer reference
            </a>{" "}
            ·{" "}
            <a
              href="https://physics.nist.gov/cuu/Constants/"
              target="_blank"
              rel="noreferrer"
            >
              CODATA constants
            </a>
            . G = 6.67430 × 10⁻¹¹ m³ kg⁻¹ s⁻²; c = 299,792,458 m/s (exact);
            Julian year = 365.25 days.
          </p>
        </div>
      </div>
    </details>
  );
}
