import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Scene from "./Scene";
import Assumptions from "./Assumptions";
import { snapshot } from "./snapshot";
import {
  C,
  DAY,
  YEAR,
  accumulatedDifference,
  advanceAccumulator,
  evaluate,
  gravitationalRadius,
  kerrGeometry,
  kerrHorizon,
  kerrISCO,
  rateDifference,
  validateBody,
  type Body,
  type Experiment,
  type Probe,
} from "./physics";
import { PRESETS, preset } from "./presets";
import {
  changeExperiment,
  defaultProbe,
  initialState,
  motionOptions,
  parseState,
  serialize,
  type LabState,
} from "./state";
import {
  drift,
  elapsed,
  offset,
  rateText,
  scientific,
  type Quantity,
} from "./format";
const experiments: { id: Experiment; label: string; short: string }[] = [
  { id: "altitude", label: "Interior & altitude", short: "Altitude" },
  { id: "rotation", label: "Rotation", short: "Rotation" },
  { id: "orbit", label: "Circular orbit", short: "Orbit" },
  { id: "compact", label: "Compact objects", short: "Compact" },
];
const colors = ["var(--clock-a)", "var(--clock-b)"];
function Mark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" />
      <ellipse
        cx="16"
        cy="16"
        rx="6"
        ry="12"
        fill="none"
        stroke="currentColor"
        strokeWidth=".7"
      />
      <path d="M4 16h24M16 4v24" stroke="currentColor" strokeWidth=".7" />
      <circle cx="24" cy="7" r="2" fill="var(--clock-a)" />
    </svg>
  );
}
function NumberField({
  label,
  value,
  onChange,
  unit,
  step = "any",
  min,
  max,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step?: number | "any";
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <span className="number-entry">
        <input
          type="number"
          value={Number.isFinite(value) ? Number(value.toPrecision(12)) : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? NaN : Number(e.target.value))
          }
          step={step}
          min={min}
          max={max}
          disabled={disabled}
        />
        <span className="field-unit">{unit}</span>
      </span>
    </label>
  );
}
function QuantityView({ quantity }: { quantity: Quantity }) {
  return (
    <>
      <span>{quantity.value}</span>
      <span className="quantity-unit">{quantity.unit}</span>
    </>
  );
}
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)"),
      listener = () => setReduced(m.matches);
    m.addEventListener("change", listener);
    return () => m.removeEventListener("change", listener);
  }, []);
  return reduced;
}
export default function App() {
  const loaded = useMemo(() => parseState(window.location.search), []);
  const [state, setState] = useState(loaded.state),
    [selected, setSelected] = useState(0),
    [notice, setNotice] = useState(loaded.error),
    [presentation, setPresentation] = useState(false),
    [cameraReset, setCameraReset] = useState(0),
    [running, setRunning] = useState(false),
    [live, setLive] = useState({ elapsed: 0, offset: 0, correction: 0 }),
    [shareURL, setShareURL] = useState(""),
    [customDuration, setCustomDuration] = useState(
      ![3600, DAY, 30 * DAY, YEAR].includes(loaded.state.duration),
    );
  const reduced = useReducedMotion(),
    rates = state.probes.map((p) => evaluate(p, state.experiment));
  const delta = rateDifference(
    state.probes[0],
    state.probes[1],
    state.experiment,
  );
  const projected = delta.ok
    ? accumulatedDifference(delta.value, state.duration)
    : delta;
  const sim = useRef({
    last: performance.now(),
    running: false,
    speed: state.acceleration,
    difference: delta.ok ? delta.value : null,
    value: { elapsed: 0, offset: 0, correction: 0 },
  });
  const flush = useCallback(() => {
    const s = sim.current,
      now = performance.now();
    if (s.running && s.difference !== null)
      s.value = advanceAccumulator(
        s.value,
        ((now - s.last) / 1000) * s.speed,
        s.difference,
      );
    s.last = now;
    return { ...s.value };
  }, []);
  useEffect(() => {
    let frame: number,
      paint = performance.now();
    const tick = () => {
      const value = flush();
      if (performance.now() - paint >= 100) {
        setLive(value);
        paint = performance.now();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [flush]);
  function commit(next: LabState) {
    setLive(flush());
    const d = rateDifference(next.probes[0], next.probes[1], next.experiment);
    sim.current.speed = next.acceleration;
    sim.current.difference = d.ok ? d.value : null;
    if (!d.ok) {
      sim.current.running = false;
      setRunning(false);
    }
    setState(next);
    setShareURL("");
  }
  function toggleRun() {
    setLive(flush());
    if (!sim.current.running && !delta.ok) return;
    sim.current.running = !sim.current.running;
    setRunning(sim.current.running);
  }
  function reset() {
    flush();
    sim.current.value = { elapsed: 0, offset: 0, correction: 0 };
    sim.current.last = performance.now();
    setLive({ ...sim.current.value });
  }
  function restore() {
    sim.current.running = false;
    setRunning(false);
    commit(initialState());
    reset();
    setSelected(0);
    setCustomDuration(false);
    setCameraReset((n) => n + 1);
    setNotice(null);
  }
  function move(index: number, patch: Partial<Probe>) {
    const probes = [...state.probes] as [Probe, Probe];
    probes[index] = { ...probes[index], ...patch };
    commit({ ...state, probes });
  }
  function setBody(index: number, id: string) {
    const body =
      id === "custom"
        ? { ...preset("earth"), id: "custom:earth", name: "Custom body" }
        : preset(id);
    const experiment = body.kind !== "sphere" ? "compact" : state.experiment;
    const probes = [...state.probes] as [Probe, Probe];
    if (!state.compareBodies) {
      probes[0] = defaultProbe(body, 0, experiment);
      probes[1] = defaultProbe(body, 1, experiment);
    } else probes[index] = defaultProbe(body, index, experiment);
    if (experiment !== state.experiment && state.compareBodies)
      for (let i = 0; i < 2; i++)
        if (i !== index)
          probes[i] = defaultProbe(probes[i].body, i, experiment);
    commit({ ...state, experiment, probes });
  }
  function editBody(patch: Partial<Body>) {
    const old = state.probes[selected].body;
    const body = {
      ...old,
      ...patch,
      id: old.id.startsWith("custom:") ? old.id : "custom:" + old.id,
      name:
        "Custom " + (old.kind === "sphere" ? "body" : old.kind + " black hole"),
    };
    const probes = state.probes.map((p, i) => {
      if (state.compareBodies && i !== selected) return p;
      const scale =
        old.kind === "sphere" ? body.radius / old.radius : body.mass / old.mass;
      return { ...p, body, radius: p.radius * scale };
    }) as [Probe, Probe];
    commit({ ...state, probes });
  }
  async function share() {
    if (
      !delta.ok ||
      !projected.ok ||
      parseState("?" + serialize(state)).error
    ) {
      setNotice("Correct invalid parameters before sharing.");
      return;
    }
    const url = new URL(window.location.href);
    url.search = serialize(state);
    url.hash = "";
    setShareURL(url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      setNotice("Experiment link copied. Shared runs start paused at t = 0.");
    } catch {
      setNotice(
        "Copy the experiment URL below. Shared runs start paused at t = 0.",
      );
    }
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresentation(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const probe = state.probes[selected],
    body = probe.body,
    selectedRate = rates[selected];
  const referenceDuration = elapsed(state.duration);
  const horizon = validateBody(body).ok
    ? gravitationalRadius(body.mass) *
      (body.kind === "kerr" ? kerrHorizon(body.spin) : 2)
    : NaN;
  const normalizedRadius =
    probe.radius /
    (body.kind === "sphere" ? body.radius : gravitationalRadius(body.mass));
  const extent = body.kind === "sphere" ? 3 : 20;
  const kerr =
    body.kind === "kerr"
      ? kerrGeometry(probe.radius / gravitationalRadius(body.mass), body.spin)
      : null;
  const timelineOffset = projected.ok
    ? offset(projected.value)
    : { value: "—", unit: "" };
  const driftQuantity = delta.ok
    ? drift(delta.value)
    : { value: "—", unit: "" };
  const sameBody =
    state.probes[0].body.mass === state.probes[1].body.mass &&
    state.probes[0].body.radius === state.probes[1].body.radius &&
    state.probes[0].body.kind === state.probes[1].body.kind;
  const bodyOptions = (
    <>
      {PRESETS.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.assumed ? " · illustrative" : ""}
        </option>
      ))}
      <option value="custom">Custom body</option>
    </>
  );
  return (
    <div className={"laboratory" + (presentation ? " presentation" : "")}>
      <header className="header">
        <div className="identity">
          <Mark />
          <div>
            <h1>Proper Time</h1>
            <p>Relativistic Clock Laboratory</p>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={share}>Share experiment</button>
          <button
            onClick={() =>
              snapshot(state, rates, delta, live).catch(() =>
                setNotice("Snapshot export failed. Try a supported browser."),
              )
            }
          >
            Export PNG
          </button>
          <button
            className={presentation ? "active" : ""}
            aria-pressed={presentation}
            onClick={() => {
              setPresentation((p) => !p);
              setCameraReset((n) => n + 1);
            }}
          >
            Presentation
          </button>
        </div>
      </header>
      <nav className="experiments" aria-label="Experiment">
        {experiments.map((e, i) => (
          <button
            key={e.id}
            className={state.experiment === e.id ? "selected" : ""}
            aria-current={state.experiment === e.id ? "page" : undefined}
            onClick={() => commit(changeExperiment(state, e.id))}
          >
            <span className="tab-number">0{i + 1}</span>
            <span className="tab-full">{e.label}</span>
            <span className="tab-short">{e.short}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}
      {shareURL && (
        <label className="share-url">
          Experiment URL
          <input readOnly value={shareURL} onFocus={(e) => e.target.select()} />
        </label>
      )}
      <main className="main">
        <section
          className="workspace"
          aria-label="Interactive celestial workspace"
        >
          <div className="workspace-top">
            <div>
              <span className="eyebrow">Coordinate workspace</span>
              <h2>
                {state.probes[0].body.name}
                {state.compareBodies && !sameBody
                  ? " / " + state.probes[1].body.name
                  : ""}
              </h2>
            </div>
            <div className="view-buttons">
              <button
                aria-pressed={state.crossSection}
                className={state.crossSection ? "active" : ""}
                onClick={() =>
                  commit({ ...state, crossSection: !state.crossSection })
                }
              >
                Section
              </button>
              <button onClick={() => setCameraReset((n) => n + 1)}>
                Reset view
              </button>
            </div>
          </div>
          <Scene
            state={state}
            onMove={move}
            reduced={reduced}
            cameraReset={cameraReset}
          />
          <div className="coordinates">
            {state.probes.map((p, i) => (
              <button
                key={i}
                className={selected === i ? "chosen" : ""}
                onClick={() => setSelected(i)}
                style={{ "--probe-color": colors[i] } as CSSProperties}
              >
                <span className="probe-symbol">{i ? "B" : "A"}</span>
                <span>
                  r{" "}
                  <strong>
                    {Number.isFinite(p.radius)
                      ? (p.radius / 1000).toLocaleString("en-US", {
                          maximumFractionDigits: 3,
                        })
                      : "—"}
                  </strong>{" "}
                  km
                  <br />
                  <span className="coordinate-angle">
                    λ{" "}
                    {Number.isFinite(p.latitude) ? p.latitude.toFixed(2) : "—"}°
                    · φ{" "}
                    {Number.isFinite(p.longitude)
                      ? p.longitude.toFixed(2)
                      : "—"}
                    °
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="workspace-bottom">
            <span>Drag probes · rotate · zoom</span>
            <label className="view-select">
              View
              <select
                aria-label="Camera view"
                value={state.view}
                onChange={(e) => {
                  commit({
                    ...state,
                    view: e.target.value as LabState["view"],
                  });
                  setCameraReset((n) => n + 1);
                }}
              >
                <option value="oblique">Oblique</option>
                <option value="equator">Equatorial</option>
                <option value="pole">Polar</option>
              </select>
            </label>
          </div>
          <p className="geometry-note">
            {state.compareBodies && !sameBody ? "Separate body scales · " : ""}
            {state.probes[0].body.kind === "kerr"
              ? "Horizon: blue · ergosphere: ochre · coordinate schematic · "
              : "Spherical · exterior radial scale: log · "}
            Schematic playback
          </p>
        </section>
        <aside className="controls" aria-label="Experiment controls">
          <section className="control-section system-controls">
            <div className="section-heading">
              <h2>Physical system</h2>
              <span>SI</span>
            </div>
            <label className="select-field">
              Celestial body
              <select
                aria-label="Celestial body"
                value={body.id.startsWith("custom:") ? "custom" : body.id}
                onChange={(e) => setBody(selected, e.target.value)}
              >
                {bodyOptions}
              </select>
            </label>
            <NumberField
              label="Mass"
              value={body.mass}
              onChange={(v) => editBody({ mass: v })}
              unit="kg"
              min={0}
            />
            {body.kind === "sphere" ? (
              <>
                <NumberField
                  label="Mean radius"
                  value={body.radius / 1000}
                  onChange={(v) => editBody({ radius: v * 1000 })}
                  unit="km"
                  min={0}
                />
                <NumberField
                  label="Rotation period"
                  value={body.period / 3600}
                  onChange={(v) => editBody({ period: v * 3600 })}
                  unit="h"
                  min={0}
                />
                <p className="field-note">0 = nonrotating</p>
              </>
            ) : (
              <>
                <NumberField
                  label="Dimensionless spin χ"
                  value={body.spin}
                  onChange={(v) => editBody({ spin: v })}
                  unit=""
                  step={0.01}
                  min={-0.999}
                  max={0.999}
                  disabled={body.kind === "schwarzschild"}
                />
                <div className="derived-field">
                  <span>Outer horizon</span>
                  <span>
                    {Number.isFinite(horizon)
                      ? (horizon / 1000).toFixed(3)
                      : "—"}{" "}
                    km
                  </span>
                </div>
              </>
            )}
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={state.compareBodies}
                onChange={(e) =>
                  commit(
                    e.target.checked
                      ? { ...state, compareBodies: true }
                      : {
                          ...state,
                          compareBodies: false,
                          probes: [
                            state.probes[0],
                            { ...state.probes[1], body: state.probes[0].body },
                          ],
                        },
                  )
                }
              />
              Compare isolated bodies
            </label>
            {state.compareBodies && (
              <label className="select-field">
                Clock B body
                <select
                  aria-label="Clock B body"
                  value={
                    state.probes[1].body.id.startsWith("custom:")
                      ? "custom"
                      : state.probes[1].body.id
                  }
                  onChange={(e) => setBody(1, e.target.value)}
                >
                  {bodyOptions}
                </select>
              </label>
            )}
          </section>
          <section className="control-section probe-controls">
            <div className="section-heading">
              <h2>Clock probes</h2>
              <div
                className="probe-switch"
                role="group"
                aria-label="Selected clock"
              >
                {[0, 1].map((i) => (
                  <button
                    key={i}
                    style={{ color: colors[i] }}
                    aria-pressed={selected === i}
                    className={selected === i ? "active" : ""}
                    onClick={() => setSelected(i)}
                  >
                    {i ? "B" : "A"}
                  </button>
                ))}
              </div>
            </div>
            <label className="select-field">
              Observer
              <select
                aria-label={"Clock " + (selected ? "B" : "A") + " observer"}
                value={probe.motion}
                onChange={(e) =>
                  move(selected, {
                    motion: e.target.value as Probe["motion"],
                    latitude:
                      state.experiment === "orbit" ||
                      body.kind === "kerr" ||
                      e.target.value === "orbit" ||
                      e.target.value === "retrograde"
                        ? 0
                        : probe.latitude,
                  })
                }
              >
                {motionOptions(state.experiment, body.kind).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <NumberField
              label="Radial coordinate r"
              value={probe.radius / 1000}
              onChange={(v) => move(selected, { radius: v * 1000 })}
              unit="km"
              step={body.radius / 100000}
              min={0}
            />
            {body.kind === "sphere" && (
              <NumberField
                label="Altitude r − R"
                value={(probe.radius - body.radius) / 1000}
                onChange={(v) =>
                  move(selected, { radius: body.radius + v * 1000 })
                }
                unit="km"
                step={0.001}
              />
            )}
            <label className="slider-field">
              <span>
                r / {body.kind === "sphere" ? "R" : "(GM/c²)"}{" "}
                <strong>
                  {Number.isFinite(normalizedRadius)
                    ? normalizedRadius.toFixed(4)
                    : "—"}
                </strong>
              </span>
              <input
                aria-label="Normalized clock radius"
                type="range"
                min="0"
                max={Math.max(
                  extent,
                  Number.isFinite(normalizedRadius) ? normalizedRadius : extent,
                )}
                step={0.001}
                value={Number.isFinite(normalizedRadius) ? normalizedRadius : 0}
                onChange={(e) =>
                  move(selected, {
                    radius:
                      Number(e.target.value) *
                      (body.kind === "sphere"
                        ? body.radius
                        : gravitationalRadius(body.mass)),
                  })
                }
              />
              <span className="range-labels">
                <span>0</span>
                <span>
                  {Math.max(
                    extent,
                    Number.isFinite(normalizedRadius)
                      ? normalizedRadius
                      : extent,
                  ).toFixed(0)}
                </span>
              </span>
            </label>
            <div className="angle-fields">
              <NumberField
                label="Latitude λ"
                value={probe.latitude}
                onChange={(v) => move(selected, { latitude: v })}
                unit="°"
                step={1}
                min={-90}
                max={90}
                disabled={
                  state.experiment === "orbit" ||
                  body.kind === "kerr" ||
                  probe.motion === "orbit" ||
                  probe.motion === "retrograde"
                }
              />
              <NumberField
                label="Longitude φ"
                value={probe.longitude}
                onChange={(v) => move(selected, { longitude: v })}
                unit="°"
                step={1}
              />
            </div>
            {probe.motion === "angular" && (
              <NumberField
                label="Angular velocity Ω"
                value={probe.omega}
                onChange={(v) => move(selected, { omega: v })}
                unit="rad/s"
              />
            )}
            {kerr?.ok && (
              <div className="observer-bounds">
                Timelike Ω interval
                <br />
                <span>
                  (
                  {scientific(
                    (kerr.value.lower * C) / gravitationalRadius(body.mass),
                    3,
                  )}
                  ,{" "}
                  {scientific(
                    (kerr.value.upper * C) / gravitationalRadius(body.mass),
                    3,
                  )}
                  ) rad/s
                </span>
              </div>
            )}
            {(probe.motion === "orbit" || probe.motion === "retrograde") && (
              <p className="field-note">
                Stable orbit: r ≥{" "}
                {(
                  ((body.kind === "kerr"
                    ? kerrISCO(
                        body.spin,
                        probe.motion === "orbit"
                          ? body.spin < 0
                            ? -1
                            : 1
                          : body.spin < 0
                            ? 1
                            : -1,
                      )
                    : 6) *
                    gravitationalRadius(body.mass)) /
                  1000
                ).toPrecision(5)}{" "}
                km; outside any material surface.
              </p>
            )}
            {!selectedRate.ok && (
              <p className="physics-error" role="alert">
                {selectedRate.reason}
              </p>
            )}
          </section>
          <section className="control-section time-controls">
            <div className="section-heading">
              <h2>Reference time</h2>
              <span>t</span>
            </div>
            <label className="select-field">
              Comparison interval
              <select
                aria-label="Reference duration"
                value={customDuration ? "custom" : state.duration}
                onChange={(e) => {
                  setCustomDuration(e.target.value === "custom");
                  if (e.target.value !== "custom")
                    commit({ ...state, duration: Number(e.target.value) });
                }}
              >
                <option value={3600}>1 hour</option>
                <option value={DAY}>1 day</option>
                <option value={30 * DAY}>30 days</option>
                <option value={YEAR}>1 Julian year</option>
                <option value="custom">Custom duration</option>
              </select>
            </label>
            {customDuration && (
              <NumberField
                label="Duration"
                value={state.duration / DAY}
                onChange={(v) => commit({ ...state, duration: v * DAY })}
                unit="days"
                min={0}
                step={0.01}
              />
            )}
            <label className="select-field">
              Time acceleration
              <select
                aria-label="Time acceleration"
                value={state.acceleration}
                onChange={(e) =>
                  commit({ ...state, acceleration: Number(e.target.value) })
                }
              >
                {[1, 60, 3600, 86400, 31557600].map((n) => (
                  <option key={n} value={n}>
                    {n.toLocaleString("en-US")}×
                  </option>
                ))}
                {![1, 60, 3600, 86400, 31557600].includes(
                  state.acceleration,
                ) && (
                  <option value={state.acceleration}>
                    {state.acceleration}×
                  </option>
                )}
              </select>
            </label>
            <div className="transport">
              <button
                className="run-button"
                disabled={!delta.ok}
                onClick={toggleRun}
              >
                {running ? "Pause" : "Run"}
              </button>
              <button onClick={reset}>Reset time</button>
              <button onClick={restore}>Restore</button>
            </div>
          </section>
        </aside>
        <section className="results" aria-label="Clock comparison">
          <div className="results-heading">
            <h2>Proper-time comparison</h2>
            <span>
              Δτ = τ<sub>B</sub> − τ<sub>A</sub> · positive: B gains time
            </span>
          </div>
          <div className="readouts">
            {rates.map((r, i) => (
              <div className="clock-readout" key={i}>
                <div className="readout-label">
                  <span className="clock-letter" style={{ color: colors[i] }}>
                    {i ? "B" : "A"}
                  </span>
                  <span>dτ / dt</span>
                  <span className="model-label">
                    {r.ok ? r.value.model : "undefined"}
                  </span>
                </div>
                <div className="rate-value">
                  {r.ok ? rateText(r.value.deviation) : "—"}
                </div>
                <div className="rate-deviation">
                  rate − 1{" "}
                  <span>{r.ok ? scientific(r.value.deviation, 6) : "—"}</span>
                </div>
              </div>
            ))}
            <div className="difference-readout">
              <div className="readout-label">
                Projected offset <span>after {referenceDuration}</span>
              </div>
              <div className="offset-value">
                <QuantityView quantity={timelineOffset} />
              </div>
              <div className="rate-deviation">
                relative drift{" "}
                <span>
                  {driftQuantity.value} {driftQuantity.unit}
                </span>
              </div>
            </div>
          </div>
          {!delta.ok && (
            <p className="comparison-error" role="alert">
              {delta.reason}
            </p>
          )}
          {delta.ok && !projected.ok && (
            <p className="comparison-error" role="alert">
              {projected.reason}
            </p>
          )}
          <div className="timeline-row">
            <div className="timeline">
              <svg
                width="100%"
                height="95"
                role="img"
                aria-label="Offset timeline relative to A; scaled to the projected difference"
              >
                {[2, 26, 50, 74, 98].map((x) => (
                  <line
                    key={x}
                    x1={x + "%"}
                    x2={x + "%"}
                    y1="18"
                    y2="70"
                    stroke="#26313b"
                  />
                ))}
                <line
                  x1="2%"
                  x2="98%"
                  y1="50"
                  y2="50"
                  stroke="#94c9c2"
                  strokeWidth="1.2"
                />
                {projected.ok && (
                  <line
                    x1="2%"
                    x2="98%"
                    y1="50"
                    y2={
                      projected.value === 0 ? 50 : projected.value > 0 ? 22 : 74
                    }
                    stroke="#d3b18b"
                    strokeWidth="1.5"
                  />
                )}
                <text x="2%" y="92">
                  0
                </text>
                <text x="50%" y="92" textAnchor="middle">
                  {elapsed(state.duration / 2)}
                </text>
                <text x="98%" y="92" textAnchor="end">
                  {referenceDuration}
                </text>
              </svg>
              <span className="timeline-description">
                Offset from A · vertical scale adapts to Δτ
              </span>
            </div>
            <div className="live-offset">
              <span className="eyebrow">Live accumulated offset</span>
              <div>
                <QuantityView quantity={offset(live.offset)} />
              </div>
              <p>
                t = {elapsed(live.elapsed)} · {running ? "running" : "paused"}
              </p>
            </div>
          </div>
          <div className="metrics">
            {rates.map((r, i) => (
              <div key={i}>
                <span style={{ color: colors[i] }}>{i ? "B" : "A"}</span>
                <span>
                  2GM(r) / rc²{" "}
                  <strong>
                    {r.ok ? scientific(r.value.compactness, 3) : "—"}
                  </strong>
                </span>
                <span>
                  v / c{" "}
                  <strong>{r.ok ? scientific(r.value.beta, 3) : "—"}</strong>
                </span>
                {r.ok && r.value.q !== null && (
                  <span>
                    q<sub>body</sub> <strong>{scientific(r.value.q, 3)}</strong>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="model-footer">
        <div className="reference-definition">
          <span className="eyebrow">Reference</span>
          <p>
            {state.compareBodies
              ? "Separate isolated spacetimes · equal asymptotic time assumed"
              : "t: static observer at infinity · isolated spacetime"}
          </p>
        </div>
        <Assumptions state={state} selected={selected} />
        <span className="footer-license">Proper Time · MIT</span>
      </footer>
    </div>
  );
}
