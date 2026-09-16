import * as C from "../config.ts";

/** A size in logical pixels. */
export interface ViewSize {
  width: number;
  height: number;
}

/**
 * The view size asked for by `?view=WxH`, or the configured one.
 *
 * Anything that does not read as two positive whole numbers falls back, since
 * a view of NaN pixels draws nothing and says nothing about why.
 */
export function parseViewParam(param: string | null): ViewSize {
  const fallback = { width: C.VIEW_W, height: C.VIEW_H };
  const match = param?.match(/^(\d+)x(\d+)$/);
  if (!match) return fallback;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : fallback;
}

/**
 * Device pixels per logical pixel for a view of `view` in a window of
 * `windowCss` CSS pixels at `dpr`.
 *
 * The largest scale that fits both ways, floored to a multiple of
 * `VIEW_SCALE_STEP`, so an art pixel is always a whole number of screen
 * pixels: 1.5 for 1280x720 on a full HD screen, 2 on 1440p, 3 on 4K. Never
 * below one step, so a tiny window still draws something.
 */
export function viewScale(windowCss: ViewSize, dpr: number, view: ViewSize): number {
  const fit = Math.min((windowCss.width * dpr) / view.width, (windowCss.height * dpr) / view.height);
  const steps = Math.floor(fit / C.VIEW_SCALE_STEP + 1e-9);
  return Math.max(1, steps) * C.VIEW_SCALE_STEP;
}

/**
 * Wire a button that takes the page full screen and back.
 *
 * In a browser window a full HD view on a full HD screen is scaled down to fit
 * under the browser's own bars; full screen gives it every pixel, at scale 1.
 * The label follows the state, including leaving by Esc, and focus goes back
 * to the game after a click so the next space bar is not another toggle.
 */
export function bindFullscreenButton(button: HTMLButtonElement): void {
  const label = () => {
    button.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
  };
  button.addEventListener("click", () => {
    button.blur();
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  });
  document.addEventListener("fullscreenchange", label);
  label();
}

/**
 * Keeps the wrapper holding the whole game at the view size, centred in the
 * window and scaled to fit it.
 *
 * Everything the player sees is inside the wrapper: the canvas, the grid, the
 * dusk, the fog, the HUD, the summary card and the debug panel, so one
 * transform scales them together and nothing else ever reads the window. What
 * is outside it is the page's black, which is the bars.
 */
export class FixedView {
  /** Device pixels per logical pixel, as last applied. */
  scale = 1;
  /**
   * Told the new scale whenever the window changes it, which is the resolution
   * the renderer should use. Set once the renderer exists.
   */
  onScale: ((scale: number) => void) | null = null;

  constructor(
    readonly size: ViewSize,
    private readonly wrapper: HTMLElement,
  ) {
    wrapper.style.width = `${size.width}px`;
    wrapper.style.height = `${size.height}px`;
    wrapper.style.setProperty("--view-w", `${size.width}px`);
    wrapper.style.setProperty("--view-h", `${size.height}px`);
    addEventListener("resize", this.fit);
    this.fit();
  }

  /** CSS pixels per logical pixel: what a click on the page is divided by. */
  get cssScale(): number {
    return this.scale / (devicePixelRatio || 1);
  }

  private readonly fit = (): void => {
    const dpr = devicePixelRatio || 1;
    this.scale = viewScale({ width: innerWidth, height: innerHeight }, dpr, this.size);
    const css = this.scale / dpr;
    // Placed on whole device pixels, so the canvas is not resampled half a
    // pixel off and blurred.
    const left = Math.round(((innerWidth - this.size.width * css) / 2) * dpr) / dpr;
    const top = Math.round(((innerHeight - this.size.height * css) / 2) * dpr) / dpr;
    this.wrapper.style.transform = `translate(${left}px, ${top}px) scale(${css})`;
    this.onScale?.(this.scale);
  };
}
