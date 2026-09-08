import { execSync } from "node:child_process";
import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";

/** Where the raw, licensed Minifantasy folders live. Never inside public/. */
const ART_DIR = resolve(import.meta.dirname, "art/minifantasy");
/** URL prefix the sheet table asks for, unchanged from when the art was public. */
const ART_URL = "/assets/minifantasy/";
/** Where dev/bake.ts POSTs the baked pack to. Copied into dist/ by Vite. */
export const BAKED_FILE = resolve(import.meta.dirname, "public/assets/baked/minifantasy.tspk");

/**
 * Serve the raw art during `npm run dev`, and take the bake back off the page.
 *
 * The art is a paid licence, so the one thing that must never happen is a build
 * that copies those files anywhere. Vite copies `public/` into `dist/` whole and
 * asks no questions, so the folder is outside `public/` and reachable only
 * through this plugin, which exists only in the dev server. `configureServer`
 * is not called for `vite build` or `vite preview`, so there is no path by
 * which a built artefact can contain a raw sheet.
 */
const CONTENT_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

function devArt(): Plugin {
  return {
    name: "thirtysummers:dev-art",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith(ART_URL)) return next();
        // The URL is decoded before it reaches the filesystem, so the traversal
        // check has to happen after decoding, not on the raw string.
        const rest = decodeURIComponent(url.slice(ART_URL.length).split("?")[0] ?? "");
        const target = normalize(join(ART_DIR, rest));
        if (target !== ART_DIR && !target.startsWith(ART_DIR + sep)) {
          res.statusCode = 403;
          res.end("outside the art folder");
          return;
        }
        let size = 0;
        try {
          const stat = statSync(target);
          if (!stat.isFile()) throw new Error("not a file");
          size = stat.size;
        } catch {
          res.statusCode = 404;
          res.end("no such art file");
          return;
        }
        res.setHeader("content-type", CONTENT_TYPE[extname(target).toLowerCase()] ?? "application/octet-stream");
        res.setHeader("content-length", String(size));
        // The pack probes with a HEAD before loading anything, so answer one
        // without opening the file.
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        createReadStream(target).pipe(res);
      });

      // Where dev/bake.html sends the atlas it just built. Writing the file is
      // the dev server's job because a browser tab cannot write to the repo,
      // and the bake has to run in a browser: the raw pack is built from
      // canvases.
      server.middlewares.use("/__bake", (req, res, next) => {
        if (req.method !== "POST") return next();
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          const bytes = Buffer.concat(chunks);
          mkdirSync(dirname(BAKED_FILE), { recursive: true });
          writeFileSync(BAKED_FILE, bytes);
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: true, bytes: bytes.length, path: BAKED_FILE }));
        });
      });
    },
  };
}

/**
 * Which build this is, for matching a pasted playtest log to the code that
 * produced it. A working tree with changes in it is marked, because a log from
 * one is not reproducible from the hash alone.
 */
export function buildId(): string {
  let hash = "nogit";
  try {
    hash = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    if (execSync("git status --porcelain", { encoding: "utf8" }).trim() !== "") hash += "+";
  } catch {
    // A copy of the source with no git in it still builds; it just says so.
  }
  return `${hash} ${new Date().toISOString().slice(0, 10)}`;
}

export default defineConfig({
  server: { port: 5173, open: false },
  // itch.io serves the game from a subdirectory, so every asset URL in the
  // built index.html has to be relative rather than rooted at /.
  base: "./",
  build: { target: "es2022" },
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  plugins: [devArt()],
});
