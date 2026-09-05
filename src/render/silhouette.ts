import { ColorMatrixFilter, Container, RenderTexture, Sprite, type Renderer, type Texture } from "pixi.js";
import { SILHOUETTE_ALPHA, SILHOUETTE_COLOR } from "../config.ts";
import type { AssetPack } from "./packs/pack.ts";

/**
 * The player redrawn as a flat colour on top of whatever is covering them.
 *
 * Trees are tall enough to swallow the player whole, so the player is drawn
 * behind them like any other prop and then drawn again here, above everything,
 * masked to exactly the pixels the canopies cover. Partial cover needs no
 * fading: the uncovered half of the character is still there underneath, in full
 * colour, so the two together read as one figure standing in shade.
 *
 * Owning a render texture, two colour matrices and a sprite pool, this is the
 * most Pixi-specific code in the project and none of it is about props, which is
 * why it is not in {@link PropLayer}. It is driven entirely by
 * {@link Silhouette.show} and {@link Silhouette.hide}.
 */
export class Silhouette {
  /**
   * The filter and the mask must sit on different objects. Both on one sprite
   * makes Pixi run the colour matrix over an already-masked, already-
   * premultiplied intermediate texture and the flat colour comes out muddied.
   * Filtering the sprite and masking its parent keeps the two passes independent.
   */
  private readonly holder = new Container();
  private readonly sprite = new Sprite();

  /**
   * Pixi's alpha mask must be a single Sprite, so the covering canopies are
   * first drawn into a render texture -- just the size of one player frame, not
   * the viewport -- and that texture becomes the mask.
   */
  private readonly maskScene = new Container();
  private readonly maskPool: Sprite[] = [];
  private readonly maskSprite = new Sprite();
  private maskTexture: RenderTexture | null = null;

  constructor(
    private readonly pack: AssetPack,
    private readonly renderer: Renderer,
    private readonly scale: number,
  ) {
    // A tint would only multiply the sprite's own shading; this matrix discards
    // the incoming colour entirely and emits one flat colour, keeping alpha, so
    // the result is a true silhouette. The colour is written pre-multiplied by
    // alpha because that is how Pixi composites.
    const flatten = new ColorMatrixFilter();
    const r = ((SILHOUETTE_COLOR >> 16) & 0xff) / 255;
    const g = ((SILHOUETTE_COLOR >> 8) & 0xff) / 255;
    const b = (SILHOUETTE_COLOR & 0xff) / 255;
    flatten.matrix = [0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 0, 1, 0];
    this.sprite.filters = [flatten];
    this.sprite.scale.set(scale);
    this.sprite.anchor.set(pack.playerAnchor.x, pack.playerAnchor.y);
    this.sprite.alpha = SILHOUETTE_ALPHA;

    // Pixi's alpha mask samples the RED channel by default, not alpha, so a
    // green canopy would mask only as strongly as it is red. Flattening the mask
    // scene to white makes red follow alpha, giving the canopy's exact shape.
    const toWhite = new ColorMatrixFilter();
    toWhite.matrix = [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
    this.maskScene.filters = [toWhite];

    this.holder.addChild(this.sprite);
    this.holder.visible = false;
    this.holder.mask = this.maskSprite;
    this.holder.zIndex = Number.MAX_SAFE_INTEGER;
  }

  /**
   * Add to the container that draws the player and the props.
   *
   * Both objects go in: the mask sprite has to be in the scene graph for Pixi to
   * position it, even though it is never drawn -- Pixi clears `renderable` on
   * anything used as a mask. The occluders passed to {@link show} are read in
   * this container's coordinates, so they have to be its children too.
   */
  addTo(container: Container): void {
    container.addChild(this.maskSprite, this.holder);
  }

  hide(): void {
    this.holder.visible = false;
  }

  /**
   * Draw the player flat at (x, y), showing only where `occluders` cover them.
   *
   * `x` and `y` are the player sprite's own position in the container this was
   * added to, so the silhouette lands exactly on top of the sprite it copies.
   * `occluders` are the sprites drawn in front of the player and overlapping it.
   */
  show(playerTexture: Texture, x: number, y: number, occluders: readonly Sprite[]): void {
    this.holder.visible = true;
    this.sprite.texture = playerTexture;
    this.sprite.x = x;
    this.sprite.y = y;
    this.renderMask(playerTexture, x, y, occluders);
  }

  /** Draw the covering canopies into the mask texture, aligned to the player. */
  private renderMask(
    playerTexture: Texture,
    x: number,
    y: number,
    occluders: readonly Sprite[],
  ): void {
    const w = Math.ceil(playerTexture.width * this.scale);
    const h = Math.ceil(playerTexture.height * this.scale);
    if (!this.maskTexture || this.maskTexture.width !== w || this.maskTexture.height !== h) {
      this.maskTexture?.destroy(true);
      this.maskTexture = RenderTexture.create({ width: w, height: h, antialias: false });
      this.maskSprite.texture = this.maskTexture;
    }

    // Top-left of the player's frame, in the parent container's coordinates.
    const frameX = x - this.pack.playerAnchor.x * w;
    const frameY = y - this.pack.playerAnchor.y * h;
    this.maskSprite.position.set(frameX, frameY);

    // Shift the copies so that frame corner maps to the texture's origin.
    this.maskScene.position.set(-frameX, -frameY);

    for (let i = 0; i < occluders.length; i++) {
      let copy = this.maskPool[i];
      if (!copy) {
        copy = new Sprite();
        this.maskPool.push(copy);
        this.maskScene.addChild(copy);
      }
      const from = occluders[i]!;
      copy.visible = true;
      copy.texture = from.texture;
      copy.anchor.copyFrom(from.anchor);
      copy.scale.copyFrom(from.scale);
      copy.position.copyFrom(from.position);
    }
    for (let i = occluders.length; i < this.maskPool.length; i++) this.maskPool[i]!.visible = false;

    this.renderer.render({ container: this.maskScene, target: this.maskTexture, clear: true });
  }

  /**
   * The holder and the mask sprite belong to the container they were added to,
   * which destroys them; the render texture and the offscreen scene do not.
   */
  destroy(): void {
    this.maskTexture?.destroy(true);
    this.maskTexture = null;
    this.maskScene.destroy({ children: true });
  }
}
