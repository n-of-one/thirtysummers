import { describe, expect, it } from "vitest";
import * as C from "../src/config.ts";
import { FrameClock } from "../src/frameClock.ts";
import { World } from "../src/sim/world.ts";
import { NO_INPUT, type InputState } from "../src/input/keyboard.ts";

const east: InputState = { ...NO_INPUT, moveX: 1 };

describe("FrameClock", () => {
  it("runs exactly one step per frame at the tick rate", () => {
    const clock = new FrameClock();
    for (let i = 0; i < 100; i++) {
      expect(clock.tick(C.TICK_SEC).steps).toBe(1);
    }
  });

  it("carries the remainder rather than losing or repeating it", () => {
    const clock = new FrameClock();
    // Frames at twice the tick rate: every other one should step.
    expect(clock.tick(C.TICK_SEC / 2).steps).toBe(0);
    expect(clock.tick(C.TICK_SEC / 2).steps).toBe(1);
    expect(clock.tick(C.TICK_SEC / 2).steps).toBe(0);
    expect(clock.tick(C.TICK_SEC / 2).steps).toBe(1);
  });

  it("catches up over a slow frame instead of dropping the time", () => {
    const clock = new FrameClock();
    expect(clock.tick(C.TICK_SEC * 4).steps).toBe(4);
    expect(clock.tick(C.TICK_SEC * 2.5).steps).toBe(2);
    expect(clock.pending).toBeCloseTo(C.TICK_SEC * 0.5, 9);
  });

  it("does not drift over a long run of awkward frame times", () => {
    const clock = new FrameClock();
    let steps = 0;
    let real = 0;
    // 73 fps, which divides into the tick rate as badly as anything.
    for (let i = 0; i < 7300; i++) {
      steps += clock.tick(1 / 73).steps;
      real += 1 / 73;
    }
    expect(steps).toBe(Math.floor(real / C.TICK_SEC));
    expect(steps * C.TICK_SEC).toBeCloseTo(real, 1);
  });

  it("clamps a backgrounded tab instead of spiralling", () => {
    const clock = new FrameClock();
    const frame = clock.tick(600); // ten minutes in the background
    expect(frame.frameSec).toBe(C.MAX_FRAME_SEC);
    expect(frame.steps).toBe(Math.floor(C.MAX_FRAME_SEC / C.TICK_SEC));
    // The dropped time is gone for good, not owed back over later frames.
    expect(clock.pending).toBeLessThan(C.TICK_SEC);
    expect(clock.tick(C.TICK_SEC).steps).toBeLessThanOrEqual(2);
  });

  it("reports the clamped frame time, which is what smooth motion must use", () => {
    const clock = new FrameClock();
    expect(clock.tick(0.01).frameSec).toBeCloseTo(0.01, 9);
    expect(clock.tick(99).frameSec).toBe(C.MAX_FRAME_SEC);
  });

  it("survives a negative or zero frame time without running backwards", () => {
    const clock = new FrameClock();
    expect(clock.tick(0).steps).toBe(0);
    expect(clock.tick(-5).steps).toBe(0);
    expect(clock.pending).toBe(0);
    expect(clock.tick(C.TICK_SEC).steps).toBe(1);
  });

  it("runs the day faster at a higher time scale, and still in whole ticks", () => {
    const clock = new FrameClock();
    clock.timeScale = 10;
    const frame = clock.tick(1 / 60);
    expect(frame.steps).toBe(10);
    // The frame time is scaled too, so the camera and the animations keep up
    // with the simulation instead of gliding a tenth as fast.
    expect(frame.frameSec).toBeCloseTo(10 / 60, 9);
  });

  it("carries the remainder at a fractional scale as carefully as at 1x", () => {
    const clock = new FrameClock();
    clock.timeScale = 1.5;
    let steps = 0;
    for (let i = 0; i < 600; i++) steps += clock.tick(C.TICK_SEC).steps;
    expect(steps).toBe(900);
  });

  it("clamps before it scales, so speeding up cannot spiral either", () => {
    const clock = new FrameClock();
    clock.timeScale = 10;
    const frame = clock.tick(600); // ten minutes in the background
    expect(frame.frameSec).toBe(C.MAX_FRAME_SEC * 10);
    expect(frame.steps).toBe(Math.floor((C.MAX_FRAME_SEC * 10) / C.TICK_SEC));
  });

  it("moves the player the same distance however the frames are chopped up", () => {
    // The reason the whole thing exists: one second of walking is one second of
    // walking, at 60fps or at 13fps.
    const walk = (frameSec: number, frames: number) => {
      const world = World.fromSeed(1337);
      const clock = new FrameClock();
      const startX = world.player.x;
      for (let i = 0; i < frames; i++) {
        const { steps } = clock.tick(frameSec);
        for (let s = 0; s < steps; s++) world.step(C.TICK_SEC, east);
      }
      return world.player.x - startX;
    };
    const smooth = walk(1 / 60, 60);
    const choppy = walk(1 / 13, 13);
    expect(choppy).toBeCloseTo(smooth, 1);
    expect(smooth).toBeGreaterThan(0);
  });
});
