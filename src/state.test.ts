import { expect, it } from "vitest";
import { initialState, parseState, serialize } from "./state";
import { drift, offset } from "./format";
import { DAY } from "./physics";
it("round trips reproducible state and rejects unsupported payloads", () => {
  const s = initialState();
  s.crossSection = true;
  s.probes[1].radius += 123.4;
  expect(parseState("?" + serialize(s))).toEqual({ state: s, error: null });
  expect(parseState("?v=2&lab={}").error).toMatch(/Unsupported/);
  expect(parseState("?v=1&lab=%7B").error).not.toBeNull();
  expect(
    parseState(
      "?v=1&lab=" + encodeURIComponent(JSON.stringify({ ...s, duration: -1 })),
    ).error,
  ).not.toBeNull();
});
it("keeps physical invalidity explicit rather than changing parameters", () => {
  const s = initialState();
  s.probes[0].radius = -1;
  expect(parseState("?" + serialize(s)).state.probes[0].radius).toBe(-1);
});
it("formats units and signs without changing the underlying value", () => {
  expect(offset(1e-9)).toEqual({ value: "+1.000", unit: "ns" });
  expect(offset(-2e-6)).toEqual({ value: "−2.000", unit: "μs" });
  expect(drift(1e-8 / DAY).unit).toBe("ns/day");
  expect(offset(NaN).value).toBe("—");
});

it("labels altered preset parameters as assumed and rejects unknown source lineage", () => {
  const s = initialState();
  s.probes = s.probes.map((p) => ({
    ...p,
    body: { ...p.body, mass: p.body.mass * 2 },
  })) as typeof s.probes;
  const parsed = parseState("?" + serialize(s));
  expect(parsed.error).toBeNull();
  expect(parsed.state.probes[0].body.id).toBe("custom:earth");
  s.probes[0].body.id = "unknown-body";
  expect(parseState("?" + serialize(s)).error).not.toBeNull();
});
