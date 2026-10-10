import type { LabState } from "./state";
import { accumulatedDifference, evaluate, rateDifference } from "./physics";
import { elapsed, offset, rateText, scientific } from "./format";
export async function snapshot(
  state: LabState,
  rates: ReturnType<typeof evaluate>[],
  delta: ReturnType<typeof rateDifference>,
  live: { elapsed: number; offset: number },
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1100;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0b0e12";
  ctx.fillRect(0, 0, 1600, 1100);
  const source = document.querySelector<HTMLCanvasElement>(".workspace canvas");
  if (source) {
    const aspect = source.width / source.height,
      h = Math.min(600, 1400 / aspect),
      w = h * aspect;
    ctx.drawImage(source, (1600 - w) / 2, 90, w, h);
  } else {
    const svg = document.querySelector(".fallback svg");
    if (svg) {
      const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(svg)], {
          type: "image/svg+xml",
        }),
      );
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        ctx.drawImage(img, 350, 90, 900, 600);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  }
  ctx.fillStyle = "#e0e4e8";
  ctx.font = "28px monospace";
  ctx.fillText("PROPER TIME / Relativistic Clock Laboratory", 50, 55);
  ctx.font = "18px monospace";
  ctx.fillStyle = "#9aa6b1";
  ctx.fillText(state.experiment + " · t = asymptotic coordinate time", 50, 735);
  state.probes.forEach((p, i) => {
    ctx.fillStyle = i ? "#d3b18b" : "#94c9c2";
    const r = rates[i];
    ctx.fillText(
      (i ? "B" : "A") + " / " + p.body.name + " / " + p.motion,
      50,
      780 + i * 65,
    );
    ctx.font = "15px monospace";
    ctx.fillText(
      "r = " +
        scientific(p.radius) +
        " m; λ = " +
        p.latitude.toFixed(3) +
        "°; M = " +
        scientific(p.body.mass) +
        " kg; R = " +
        scientific(p.body.radius) +
        " m; χ = " +
        p.body.spin,
      50,
      803 + i * 65,
    );
    ctx.fillText(
      r.ok
        ? "dτ/dt = " +
            rateText(r.value.deviation) +
            "; deviation = " +
            scientific(r.value.deviation)
        : "Undefined: " + r.reason,
      50,
      825 + i * 65,
    );
    ctx.font = "18px monospace";
  });
  ctx.fillStyle = "#e0e4e8";
  const accumulated = delta.ok
    ? accumulatedDifference(delta.value, state.duration)
    : delta;
  const q = accumulated.ok
    ? offset(accumulated.value)
    : { value: "undefined", unit: "" };
  ctx.fillText(
    "Δτ = τB − τA: " +
      q.value +
      " " +
      q.unit +
      " over " +
      elapsed(state.duration) +
      " coordinate time",
    50,
    940,
  );
  const l = offset(live.offset);
  ctx.fillText(
    "Live Δτ: " + l.value + " " + l.unit + " at t = " + elapsed(live.elapsed),
    50,
    975,
  );
  ctx.fillStyle = "#9aa6b1";
  ctx.font = "14px monospace";
  ctx.fillText(
    state.compareBodies
      ? "Separate isolated spacetimes; equal elapsed asymptotic time assumed."
      : "Isolated spherical model or equatorial Kerr metric; see model assumptions.",
    50,
    1010,
  );
  ctx.fillText(
    "Uniform density is illustrative. Geoid, oblateness, tides and rotating stellar structure are omitted.",
    50,
    1040,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("PNG encoding failed."))),
      "image/png",
    ),
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "proper-time.png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
