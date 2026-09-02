import { Application } from "pixi.js";

/**
 * Boots Pixi for pixel art: no antialiasing, nearest-neighbour scaling, and
 * sprites snapped to whole pixels so tiles never shimmer while scrolling.
 */
export async function createApp(mount: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: "#0d0f0c",
    antialias: false,
    roundPixels: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
    preference: "webgl",
  });
  mount.appendChild(app.canvas);
  return app;
}
