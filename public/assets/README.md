# Art assets

## Minifantasy (paid, NOT committed)

The game uses Minifantasy art by Krishna Palacio when it is present, and falls
back to a code-drawn placeholder pack when it is not. The licence permits using
the art *in* a game but forbids redistributing the asset files themselves, so
neither the raw packs nor anything baked from them is ever committed.

**The raw packs live in `art/minifantasy/`, outside `public/`.** That is not
tidiness: Vite copies `public/` into `dist/` whole and asks no questions, so
anything under it ships in every build. `art/` is gitignored, and a dev-only
route in `vite.config.ts` serves it at `/assets/minifantasy/*` during
`npm run dev` and nowhere else.

To install:

1. Download your purchased packs from itch.io.
2. Unzip them into `art/minifantasy/`, one directory per pack, e.g.

       art/minifantasy/
         Minifantasy_ForgottenPlains_v3.6_Commercial_Version/
         Minifantasy_Farm_v3.0/
         Minifantasy_.../

3. Reload the dev server. The console logs which pack loaded.

## The baked pack

What actually ships. `public/assets/baked/minifantasy.tspk` is one file holding
only the pixels the game draws -- a 512×256 atlas and a manifest saying where
each texture sits in it -- built from the raw packs and about 70 kB against
their 14 MB. It is gitignored too: it is still the licensed art.

To build it:

```
npm run dev
open http://localhost:5173/bake.html
```

The page prints the atlas size, the slot count and the file size, and writes the
file through the dev server. Rerun it whenever the art changes, or whenever
`minifantasy.sheets.ts` changes where a tile is cut from.

The bake runs in a browser because the raw pack builds half its tiles on
canvases -- the undergrowth stencil, the plank decks, the seven narrow shapes --
and there is no canvas outside one. `src/render/packs/bake.ts` is the packer and
the file format; `baked.ts` reads it back.

`npm run build:itch` refuses to make a zip if the baked file is missing, or if a
single raw PNG has found its way into `dist/`.

## Placeholder pack

Generated at runtime in `src/render/packs/placeholder.ts` -- no files, no
licence. Always available, so the repository stays runnable for anyone who
clones it. Compare the packs side by side at
http://localhost:5173/textures.html, or with `?pack=placeholder`,
`?pack=baked` and `?pack=minifantasy`.

## Obligations before the game ships anywhere public

  - credit Krishna Palacio in the game credits — the start card does this
  - send Krishna a link to the finished project
