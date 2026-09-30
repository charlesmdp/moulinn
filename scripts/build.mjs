// Construit le site statique publié dans dist/ à partir de src/.
//
//  src/index.html          page, avec les jetons {{asset:styles}} et {{asset:start}}
//  src/start.js            chargeur progressif, avec le jeton {{asset:app}}
//  src/app/v32/*.js        modules de la version 32 (ordre alphabétique)
//  src/app/moulin.js       jeu complet (V31 dé-minifiée, avec les points d'accroche V32)
//  src/styles/*.css        base.css puis les feuilles V32 (ordre alphabétique)
//  src/static/             ressources inchangées (déjà nommées d'après leur contenu)
//
// Le résultat est préparé dans .build/dist puis remplace dist/ d'un seul coup.

import { transform } from "esbuild";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");
const stage = path.join(root, ".build", "dist");
const dist = path.join(root, "dist");
const target = ["es2020", "safari15"];

const hash = (content) => crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);

async function listFiles(dir, extension) {
  try {
    return (await fs.readdir(dir))
      .filter((name) => name.endsWith(extension))
      .sort()
      .map((name) => path.join(dir, name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function concat(files, separator = "\n;\n") {
  const parts = [];
  for (const file of files) parts.push(await fs.readFile(file, "utf8"));
  return parts.join(separator);
}

async function emit(name, extension, content, report) {
  const file = `assets/${name}.${hash(content)}.${extension}`;
  await fs.writeFile(path.join(stage, file), content);
  report.files[file] = Buffer.byteLength(content);
  return file;
}

async function minifyJs(code, sourcefile) {
  const result = await transform(code, {
    loader: "js",
    minify: true,
    target,
    legalComments: "inline",
    sourcefile,
  });
  for (const warning of result.warnings) console.warn(`${sourcefile}: ${warning.text}`);
  return result.code;
}

async function main() {
  const started = Date.now();
  const report = { version: 32, builtAt: new Date().toISOString(), files: {} };
  await fs.rm(path.join(root, ".build"), { recursive: true, force: true });
  await fs.mkdir(path.join(stage, "assets"), { recursive: true });

  // Ressources inchangées : copiées telles quelles.
  await fs.cp(path.join(src, "static"), stage, { recursive: true });

  // Jeu : modules V32 d'abord (ils s'enregistrent sur globalThis), puis le jeu qui démarre.
  const appFiles = [...(await listFiles(path.join(src, "app", "v32"), ".js")), path.join(src, "app", "moulin.js")];
  // Vérification de syntaxe fichier par fichier : l'erreur cite le bon fichier et la bonne ligne.
  for (const file of appFiles)
    await transform(await fs.readFile(file, "utf8"), { loader: "js", sourcefile: path.relative(root, file) }).catch((error) => {
      throw new Error(error.message);
    });
  const app = await minifyJs(await concat(appFiles), "moulin.js");
  const appFile = await emit("moulin", "js", app, report);

  // Styles.
  const styleFiles = await listFiles(path.join(src, "styles"), ".css");
  styleFiles.sort((a, b) => (a.endsWith("base.css") ? -1 : b.endsWith("base.css") ? 1 : a.localeCompare(b)));
  const css = await transform(await concat(styleFiles, "\n"), { loader: "css", minify: true, target: ["safari15"] });
  const cssFile = await emit("styles", "css", css.code, report);

  // Chargeur.
  let start = await fs.readFile(path.join(src, "start.js"), "utf8");
  start = start.replaceAll("{{asset:app}}", appFile);
  const startFile = await emit("start", "js", await minifyJs(start, "start.js"), report);

  // Page.
  let html = await fs.readFile(path.join(src, "index.html"), "utf8");
  html = html.replaceAll("{{asset:styles}}", cssFile).replaceAll("{{asset:start}}", startFile);
  if (/\{\{asset:/.test(html)) throw new Error("Jeton {{asset:…}} non remplacé dans index.html");
  // Trois adresses pour la même page : l'accueil (Personnage, Vue libre, Météo, Jeu), /3D (avec
  // la vue 3D) et /build (vue 3D et atelier « Aménager »), pour que l'atelier ne soit ouvert
  // qu'à qui connaît l'adresse. Les sous-pages lisent les ressources à la racine (<base>).
  const pageFor = (route) => {
    const drop = (mode) => {
      const button = new RegExp(`\\n[ \\t]*<button type="button" data-mode="${mode}"[^\\n]*?</button>`);
      if (!button.test(page)) throw new Error(`Bouton « ${mode} » introuvable dans index.html`);
      page = page.replace(button, "");
    };
    let page = html.replace(/<p data-help-route="([^"]+)">.*?<\/p>/g, (paragraph, routes) =>
      routes.split(" ").includes(route) ? paragraph.replace(/ data-help-route="[^"]+"/, "") : "",
    );
    if (route !== "3d" && route !== "build") drop("orbit");
    if (route !== "build") drop("editor");
    if (route) {
      if (!page.includes('<html lang="fr">') || !page.includes("<head>")) throw new Error("En-tête de index.html inattendu");
      page = page
        .replace('<html lang="fr">', `<html lang="fr" data-route="${route}">`)
        .replace("<head>", '<head>\n<base href="../">' + (route === "build" ? '\n<meta name="robots" content="noindex,nofollow">' : ""));
    }
    return page;
  };
  await fs.writeFile(path.join(stage, "index.html"), pageFor(""));
  for (const [dir, route] of [["3D", "3d"], ["build", "build"]]) {
    await fs.mkdir(path.join(stage, dir), { recursive: true });
    await fs.writeFile(path.join(stage, dir, "index.html"), pageFor(route));
  }

  // Jeu « Pas touche à mes trésors » : page /jeu/ et ses scripts (socle, simulation, modèles,
  // personnages, effets, rendu, interface, puis main.js qui démarre la partie).
  const jeuDir = path.join(src, "jeu");
  const jeuFiles = [];
  for (const part of ["core", "sim", "models", "fx", "actors", "render", "ui"]) jeuFiles.push(...(await listFiles(path.join(jeuDir, part), ".js")));
  jeuFiles.push(path.join(jeuDir, "main.js"));
  for (const file of jeuFiles)
    await transform(await fs.readFile(file, "utf8"), { loader: "js", sourcefile: path.relative(root, file) }).catch((error) => {
      throw new Error(error.message);
    });
  const jeuFile = await emit("jeu", "js", await minifyJs(await concat(jeuFiles), "jeu.js"), report);
  const vendorFiles = ["GLTFLoader.js", "SkeletonUtils.js", "BufferGeometryUtils.js"].map((f) => path.join(jeuDir, "vendor", f));
  const jeuVendorFile = await emit("jeu-vendor", "js", await minifyJs(await concat(vendorFiles), "jeu-vendor.js"), report);
  // Police des titres et des boutons (Lilita One, licence SIL OFL, jointe à côté de la page du jeu).
  const jeuFontFile = await emit("lilita-one", "woff2", await fs.readFile(path.join(jeuDir, "fonts", "lilita-one-latin.woff2")), report);
  const jeuCssSource = (await fs.readFile(path.join(jeuDir, "jeu.css"), "utf8")).replaceAll("{{asset:jeu-font}}", path.basename(jeuFontFile));
  const jeuCss = await transform(jeuCssSource, { loader: "css", minify: true, target: ["safari15"] });
  const jeuCssFile = await emit("jeu", "css", jeuCss.code, report);
  let jeuBoot = await fs.readFile(path.join(jeuDir, "boot.js"), "utf8");
  jeuBoot = jeuBoot.replaceAll("{{asset:jeu-js}}", "../" + jeuFile).replaceAll("{{asset:jeu-vendor}}", "../" + jeuVendorFile);
  const jeuBootFile = await emit("jeu-boot", "js", await minifyJs(jeuBoot, "jeu-boot.js"), report);
  let jeuHtml = await fs.readFile(path.join(jeuDir, "index.html"), "utf8");
  jeuHtml = jeuHtml.replaceAll("{{asset:jeu-css}}", "../" + jeuCssFile).replaceAll("{{asset:jeu-boot}}", "../" + jeuBootFile);
  if (/\{\{asset:/.test(jeuHtml + jeuBoot + jeuCss.code)) throw new Error("Jeton {{asset:…}} non remplacé dans le jeu");
  await fs.mkdir(path.join(stage, "jeu"), { recursive: true });
  await fs.writeFile(path.join(stage, "jeu", "index.html"), jeuHtml);
  await fs.copyFile(path.join(jeuDir, "fonts", "OFL-LilitaOne.txt"), path.join(stage, "jeu", "OFL-LilitaOne.txt"));

  // Vérification : chaque ressource citée par le chargeur et la page existe.
  const referenced = new Set([...`${html}\n${start}\n${jeuHtml}\n${jeuBoot}`.matchAll(/assets\/[A-Za-z0-9_.-]+\.[a-z0-9]+/g)].map((m) => m[0]));
  const plan = JSON.parse(await fs.readFile(path.join(stage, "assets", path.basename(start.match(/assets\/garden-assets\.[a-f0-9]+\.json/)[0])), "utf8"));
  for (const texture of Object.values(plan.textures || {})) referenced.add(texture.uri);
  for (const file of referenced) {
    await fs.access(path.join(stage, file)).catch(() => {
      throw new Error(`Ressource manquante : ${file}`);
    });
  }

  let total = 0;
  let count = 0;
  for await (const entry of await fs.opendir(path.join(stage, "assets"))) {
    total += (await fs.stat(path.join(stage, "assets", entry.name))).size;
    count++;
  }
  report.assets = { count, bytes: total };
  report.durationMs = Date.now() - started;
  await fs.writeFile(path.join(root, ".build", "build-report.json"), JSON.stringify(report, null, 2));

  await fs.rm(dist, { recursive: true, force: true });
  await fs.rename(stage, dist);
  console.log(
    `dist/ prêt : ${count} ressources, ${(total / 1048576).toFixed(2)} Mo · ${appFile} (${(Buffer.byteLength(app) / 1024).toFixed(0)} Ko) · ${report.durationMs} ms`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
