import { Application } from "pixi.js";

/**
 * Boots Pixi for pixel art: no antialiasing, nearest-neighbour scaling, and
 * sprites snapped to whole pixels so tiles never shimmer while scrolling.
 *
 * The renderer is given the view size once and never follows the window. Its
 * resolution is the view's scale, device pixels per logical pixel, so the
 * backing store is one device pixel per screen pixel; {@link setResolution}
 * follows the scale when the window changes.
 */
export async function createApp(
  mount: HTMLElement,
  width: number,
  height: number,
  resolution: number,
): Promise<Application> {
  const app = new Application();
  await app.init({
    width,
    height,
    background: "#0d0f0c",
    antialias: false,
    roundPixels: true,
    autoDensity: true,
    resolution,
    preference: "webgl",
  });
  mount.appendChild(app.canvas);
  return app;
}

/** Keep the logical size, change the backing store. */
export function setResolution(app: Application, resolution: number): void {
  if (app.renderer.resolution === resolution) return;
  app.renderer.resize(app.screen.width, app.screen.height, resolution);
}
