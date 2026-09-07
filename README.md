<div align="center">
  <img src="./assets/images/icon.png" alt="Chrysalide Logo" width="120" height="120" />
  <h1>Chrysalide</h1>
  <p>L'application étudiante de référence, développée avec ❤️ par <a href="https://www.epimac.org/">Epimac</a>.</p>
</div>

<br />

## 📱 À propos de Chrysalide

**Chrysalide** est une application mobile repensée et complète, spécialement conçue pour simplifier le quotidien des étudiants de l'EPITA. Développée avec React Native, elle permet d'accéder rapidement et intuitivement à toutes les informations essentielles de la vie scolaire et étudiante, même sans connexion Internet.

### ✨ Fonctionnalités clés

- 📅 **Emploi du temps en direct** : Consultez votre planning en temps réel (CM, TD, TP), et sachez exactement où et quand vous devez être.
- 💯 **Notes et Scolarité** : Suivez vos résultats, vos moyennes et vos absences depuis une interface claire.
- 📶 **Mode hors-ligne garanti** : Grâce à une base de données locale (WatermelonDB), accédez à vos emplois du temps et vos notes même dans le métro ou sans connexion.
- 🧩 **Widgets iOS & Android** : Retrouvez votre prochain cours ou votre moyenne directement sur l'écran d'accueil de votre téléphone.
- 🎨 **Design & Personnalisation** : Interface soignée, mode sombre/clair natif, et animations fluides pour une expérience utilisateur de qualité.

## 🛠️ Stack Technique

Le projet repose sur des technologies modernes pour garantir performance et maintenabilité :
* **Framework mobile** : [React Native](https://reactnative.dev/) propulsé par [Expo](https://expo.dev/) (Expo Router)
* **Base de données (Local-First)** : [WatermelonDB](https://nozbe.github.io/WatermelonDB/) (Synchronisation hors-ligne)
* **Animations et UI** : React Native Reanimated, React Native Skia, Lottie
* **Intégrations** : Auriga, Intracom, Absences

## 🚀 Hot Updater (OTA)

L'app utilise [hot-updater](https://github.com/gronxb/hot-updater) avec la stratégie **fingerprint** (matching strict du build natif). Le fingerprint dépend du contenu de `node_modules/`, qui diffère entre macOS et Linux Alpine (env du CI). Pour éviter le drift, **toute opération sur le fingerprint passe par Docker Alpine**.

### Prérequis

- Docker (Colima recommandé sur macOS) :
  ```bash
  brew install colima docker docker-buildx
  colima start
  ```

### Scripts npm

| Script | Quand l'utiliser |
|---|---|
| `npm run hu:fingerprint` | Régénère `fingerprint.json` (après une modif de deps natives) |
| `npm run hu:check` | Vérifie que le `fingerprint.json` commité matche l'env CI (mirror du check strict) |
| `npm run prebuild:ios` | Régénère le fingerprint + lance `expo prebuild --clean` (avant build Xcode local) |
| `npm run prebuild:android` | Idem pour Android |

Tous tournent via `scripts/hu-docker.sh`, qui build une image `chrysalide-hu:node20-alpine` (one-time) et utilise un volume nommé pour les `node_modules` du container — ton `node_modules` local n'est jamais touché.

### Workflow

**Modif JS uniquement** (texte, style, logique RN) :
1. `git push`
2. Sur GitLab, déclencher manuellement le job `deploy:ios` ou `deploy:android` (stage `deploy`, sur `main`)

**Modif native** (deps, plugin Expo, config touchant le natif) :
1. Faire la modif et `npm install`
2. `npm run prebuild:ios` — régénère le fingerprint + injecte le hash dans `Info.plist`
3. `git add fingerprint.json && git commit && git push`
4. Build Xcode local → upload TestFlight (via Transporter ou Xcode)
5. Une fois le build TestFlight approuvé, les déploiements OTA suivants fonctionneront

### Garde-fou CI

Le job `fingerprint:check` (`.gitlab/hot-updater.yml`) tourne sur chaque MR et sur `main`. Il **bloque le merge** si `fingerprint.json` est stale par rapport aux deps. Si ça fail, c'est qu'il faut lancer `npm run hu:fingerprint` localement et committer le résultat.

## 🔗 Liens utiles

* [Site web](https://chrysalide.app/)
* [Discord](https://discord.gg/3QYJJj4cr8)
* [GitLab](https://gitlab.com/epimac-asso/projects/chrysalide/ChrysalideApp)

## ⚖️ Licence

Ce projet est sous licence **GNU General Public License v3.0 (GPL-3.0)**. Consultez le fichier [LICENSE](./LICENSE) pour plus de détails.