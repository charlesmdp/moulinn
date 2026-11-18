// Ouvre une page du site construit (dist/) dans Chromium, pour les scripts qui lisent le moulin 3D
// (relief du plan, banc d'essai de la fête). Il faut Playwright : il est présent dans les sessions
// Claude ; sur un ordinateur, « npm install --no-save playwright » puis « npx playwright install chromium ».
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Ouvre /<route>/ une fois le jeu prêt. init : code exécuté avant les scripts de la page. */
export async function openMoulin({ route = "moulin", init = "" } = {}) {
  const port = 8100 + Math.floor(Math.random() * 800);
  const server = spawn(process.execPath, [path.join(here, "..", "serve.mjs")], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  const base = "http://localhost:" + port + "/";
  let up = false;
  for (let i = 0; i < 100 && !up; i++) {
    up = await fetch(base + route + "/").then((r) => r.ok, () => false);
    if (!up) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!up) {
    server.kill();
    throw new Error("Le serveur local n'a pas démarré : lancer d'abord « node scripts/build.mjs ».");
  }
  let browser;
  try {
    const { chromium } = createRequire(import.meta.url)("playwright");
    // Rendu logiciel : fonctionne sans carte graphique (le chargement prend une vingtaine de secondes).
    browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
    const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error).slice(0, 300)));
    if (init) await page.addInitScript(init);
    await page.goto(base + route + "/", { waitUntil: "load", timeout: 120000 });
    await page.waitForFunction(() => window.MoulinBoot && window.MoulinBoot.state.done && window.MoulinV32 && window.MoulinV32.context, null, { timeout: 600000 });
    return {
      page,
      errors,
      async close() {
        await browser.close();
        server.kill();
      },
    };
  } catch (error) {
    if (browser) await browser.close();
    server.kill();
    throw error;
  }
}
