# Art assets

## Minifantasy (paid, NOT committed)

The game uses Minifantasy art by Krishna Palacio when it is present, and falls
back to a code-drawn placeholder pack when it is not. `public/assets/minifantasy/`
is in `.gitignore` and must stay there: the licence permits using the art *in*
a game but forbids redistributing the asset files themselves.

To install:

1. Download your purchased packs from itch.io.
2. Unzip them into `public/assets/minifantasy/`, one directory per pack, e.g.

       public/assets/minifantasy/
         Minifantasy_ForgottenPlains/
         Minifantasy_.../

3. Reload the dev server. The console logs which pack loaded.

Obligations before the game ships anywhere public:
  - credit Krishna Palacio in the game credits
  - send Krishna a link to the finished project

## Placeholder pack

Generated at runtime in `src/render/packs/placeholder.ts` -- no files, no licence.
Always available, so the repository stays runnable for anyone who clones it.
Compare both packs side by side at http://localhost:5173/textures.html
