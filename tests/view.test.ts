import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { parseViewParam, viewScale } from "../src/ui/view.ts";

const VIEW = { width: 1280, height: 720 };

describe("viewScale", () => {
  it("gives the whole-art-pixel scales the common screens should get", () => {
    expect(viewScale({ width: 1920, height: 1080 }, 1, VIEW)).toBe(1.5);
    expect(viewScale({ width: 2560, height: 1440 }, 1, VIEW)).toBe(2);
    expect(viewScale({ width: 3840, height: 2160 }, 1, VIEW)).toBe(3);
    // A 4K screen at 200% is the same device pixels.
    expect(viewScale({ width: 1920, height: 1080 }, 2, VIEW)).toBe(3);
  });

  it("floors to a multiple of the step, so an art pixel is whole screen pixels", () => {
    const scale = viewScale({ width: 1366, height: 768 }, 1, VIEW);
    expect(scale).toBe(1);
    for (const [w, h] of [[1500, 900], [1777, 1000], [3000, 1700]] as const) {
      const s = viewScale({ width: w, height: h }, 1, VIEW);
      expect(s / C.VIEW_SCALE_STEP).toBe(Math.round(s / C.VIEW_SCALE_STEP));
      expect(8 * s).toBe(Math.round(8 * s));
      expect(VIEW.width * s).toBeLessThanOrEqual(w);
      expect(VIEW.height * s).toBeLessThanOrEqual(h);
    }
  });

  it("fits the tighter of the two directions, leaving bars on the other", () => {
    // Tall and narrow: the width decides.
    expect(viewScale({ width: 1280, height: 2000 }, 1, VIEW)).toBe(1);
  });

  it("never goes below one step, so a tiny window still draws", () => {
    expect(viewScale({ width: 50, height: 30 }, 1, VIEW)).toBe(C.VIEW_SCALE_STEP);
  });
});

describe("parseViewParam", () => {
  it("reads WxH", () => {
    expect(parseViewParam("1920x1080")).toEqual({ width: 1920, height: 1080 });
  });

  it("falls back to the configured view on anything else", () => {
    const fallback = { width: C.VIEW_W, height: C.VIEW_H };
    expect(parseViewParam(null)).toEqual(fallback);
    expect(parseViewParam("")).toEqual(fallback);
    expect(parseViewParam("1920")).toEqual(fallback);
    expect(parseViewParam("0x1080")).toEqual(fallback);
    expect(parseViewParam("wide")).toEqual(fallback);
  });
});
