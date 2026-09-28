# Moulin de Saint Christophe

Le jardin interactif 3D, version 31, avec le moulin, les véhicules, la météo,
la végétation, les animaux, l'aménagement et les commandes tactiles.

Ce dépôt contient le code source complet de la version actuelle et une copie
optimisée prête à héberger. Le transfert sur GitHub ne modifie pas le site
actuellement en ligne. GitHub conserve les fichiers ; Cloudflare Pages peut
servir le jeu depuis une adresse HTTPS.

## Mettre le jeu sur Cloudflare Pages

Dans **Workers & Pages > Create application > Pages**, importe le dépôt
GitHub **charlesmdp/moulinn**, puis utilise ces réglages :

| Réglage | Valeur |
| --- | --- |
| Branche de production | `main` |
| Framework | Aucun / `None` |
| Commande de build | `exit 0` |
| Dossier de sortie | `dist` |
| Dossier racine | Laisser vide |

Le dossier `dist` est déjà construit. Aucun secret ni service serveur n'est
nécessaire. Clique sur **Save and Deploy**, puis ouvre l'adresse HTTPS fournie
par Cloudflare sur ordinateur, iPhone ou iPad.

Les prochains commits sur `main` seront déployés si tu actives cette intégration.
Après une modification des sources, il faut reconstruire et committer `dist`
avec les sources. Modifier seulement `src` ne met pas à jour le jeu publié.

Si ton projet Cloudflare actuel a été créé en déposant un ZIP (Direct Upload),
crée un nouveau projet Pages pour l'intégration Git. Tu peux conserver l'ancien
site pendant la vérification du nouveau.

Documentation officielle :

- [Héberger un site statique](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)
- [Intégration Git](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## Lancer le jeu sur un ordinateur

Avec Node.js 22 ou une version compatible plus récente :

```sh
npm ci
npm run dev
```

Ouvre l'adresse affichée par Vite. Il sert directement le dossier `dist`.
Pour essayer sur un téléphone du même réseau Wi-Fi, utilise l'adresse réseau
affichée par Vite. Pour un accès depuis n'importe où, utilise Cloudflare Pages.

Sans installer Node.js, un serveur statique suffit également :

```sh
python3 -m http.server 8080 --directory dist
```

Ouvre ensuite `http://localhost:8080`. Le double-clic sur `dist/index.html`
ne convient pas : les ressources ont besoin d'un serveur HTTP ou HTTPS.

## Modifier et reconstruire

| Emplacement | Contenu |
| --- | --- |
| `src/moulin.html` | Source complète V31 : jeu, interface, scène et ressources intégrées |
| `scripts/build.py` | Extraction et optimisation du site statique |
| `scripts/loader-template.js` | Chargement progressif, vérification WebGL et gestion des erreurs |
| `scripts/minify.cjs` | Minification JavaScript et CSS avec esbuild |
| `vendor/` | Décodeur gzip pako et sa licence, pour les anciens Safari |
| `dist/` | Site complet prêt à publier |
| `docs/` | Instructions et compte rendu de vérification du transfert |

Le source complet conserve les données d'origine. Les ressources du jeu publié
sont séparées, compressées et nommées d'après leur contenu pour le cache.
Le site à servir pèse environ **5,6 Mo**, avec **54 fichiers**, avant compression
HTTP supplémentaire. Les anciennes versions et les dossiers d'installation
ne sont pas nécessaires au fonctionnement et ne sont pas recopiés ici.

Pour reconstruire après modification, installe Python 3.10 ou plus récent,
puis prépare un environnement Python :

```sh
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install -r requirements.txt
npm ci
npm run build
npm run dev
```

Sous Windows, active l'environnement avec `.venv\Scripts\Activate.ps1`
dans PowerShell, puis lance `python scripts/build.py` si la commande
`python3` n'est pas disponible.

Le build prépare d'abord les fichiers dans `.build`. Il remplace `dist` après
avoir terminé la génération et vérifié la présence des ressources.
Le rapport détaillé se trouve dans `.build/build-report.json`.

Pour publier une évolution, vérifie le jeu puis enregistre les sources et le
dossier généré dans le même commit :

```sh
git add src scripts vendor docs dist package.json package-lock.json requirements.txt
git commit -m "Mettre à jour le jardin"
git push origin main
```

## Retouches personnelles et compatibilité

Les retouches enregistrées dans le jeu restent dans le navigateur utilisé,
pour l'adresse du site concernée. GitHub et Cloudflare ne les synchronisent
pas entre appareils. Utilise l'export/import des retouches dans l'éditeur
pour les transférer sur une autre adresse ou un autre ordinateur.

Le jeu nécessite JavaScript et WebGL. Le dépôt reprend le comportement mobile
de la version V31 ; transférer les fichiers ne change pas les performances du
rendu 3D. Les essais automatisés ne remplacent pas une vérification sur un
iPhone ou un iPad physique.

Les mentions de licence des bibliothèques sont conservées dans le code et dans
`dist/LICENCES.txt`. Le décodeur gzip embarqué provient de
[pako 1.0.11](https://github.com/nodeca/pako/tree/1.0.11).
