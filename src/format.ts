import { DAY, YEAR } from "./physics";
export interface Quantity {
  value: string;
  unit: string;
}
export function offset(seconds: number, signed = true): Quantity {
  if (!Number.isFinite(seconds)) return { value: "—", unit: "" };
  const abs = Math.abs(seconds);
  const [factor, unit] =
    abs === 0 || abs < 1e-6
      ? [1e9, "ns"]
      : abs < 1e-3
        ? [1e6, "μs"]
        : abs < 1
          ? [1e3, "ms"]
          : abs < 3600
            ? [1, "s"]
            : [1 / 3600, "h"];
  const n = seconds * Number(factor);
  const text =
    Math.abs(n) > 0 && Math.abs(n) < 0.001
      ? n.toExponential(3)
      : Math.abs(n) >= 1e7
        ? n.toExponential(3)
        : n.toLocaleString("en-US", {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          });
  return {
    value: (signed && seconds > 0 ? "+" : "") + text.replace("-", "−"),
    unit: String(unit),
  };
}
export function drift(rate: number): Quantity {
  if (Math.abs(rate * DAY) < 1e-3) {
    const q = offset(rate * DAY);
    return { ...q, unit: q.unit + "/day" };
  }
  const q = offset(rate * YEAR);
  return { ...q, unit: q.unit + "/year" };
}
export const scientific = (x: number, digits = 4) =>
  Number.isFinite(x)
    ? x === 0
      ? "0"
      : x.toExponential(digits).replace("e-", "e−")
    : "—";
export const rateText = (deviation: number) => (1 + deviation).toFixed(15);
export function elapsed(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < DAY) return (seconds / 3600).toFixed(2) + " h";
  return (seconds / DAY).toFixed(2) + " d";
}
