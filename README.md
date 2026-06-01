# JDR Ambiances

Application mobile Expo + React Native pour piloter des ambiances sonores pendant une partie de jeu de rôle.

Le projet est configuré en Expo SDK 54 pour être compatible avec Expo Go 54.x.

## Lancer le projet

```bash
npm install
npm run start
```

Sous Windows PowerShell, si `npm` est bloqué par la politique d'exécution, utilisez :

```bash
npm.cmd install
npm.cmd run start:lan
```

## Installer l'application sur Android

Pour creer un APK installable sur le telephone :

```bash
npm.cmd install
npm.cmd install -g eas-cli
eas login
eas build:configure
npm.cmd run build:apk
```

Quand le build est termine, Expo donne un lien de telechargement. Ouvrez ce lien sur le telephone, telechargez le fichier `.apk`, puis installez-le.

Android peut demander d'autoriser l'installation depuis le navigateur ou le gestionnaire de fichiers.

Si Expo Go tourne dans le vide sur le téléphone :

```bash
npm.cmd install
npm.cmd run start:clear
```

Puis scannez le nouveau QR code. Le téléphone doit être connecté au même Wi-Fi que l'ordinateur. Si le téléphone est en 4G/5G, le chargement peut rester bloqué.

Pour forcer le mode réseau local :

```bash
npm.cmd run start:lan
```

Si le téléphone ne charge toujours pas, le tunnel Expo peut aider, mais il dépend du service ngrok d'Expo et peut être indisponible :

```bash
npm.cmd run start:tunnel
```

## Première version

- Écran d'accueil sombre fantasy avec catégories d'ambiance.
- Import de fichiers audio locaux pour les ambiances et sons rapides.
- Association de liens Spotify ou web aux ambiances et sons rapides.
- Connexion a un compte Spotify avec OAuth PKCE.
- Controle Spotify comme piste externe : lancement de playlist/album/titre.
- Selection d'un appareil Spotify Connect disponible depuis l'app.
- Campagnes JDR personnalisees pour organiser les parties du MJ.
- Ajout de sons personnalises par campagne avec nom, icone et fichier audio local.
- Selection d'icones par grille, sans saisir le nom technique de l'icone.
- Ouverture d'une campagne JDR dans une vue separee pour garder l'accueil lisible.
- Modification du nom et de l'icone des sons personnalises.
- Suppression de sons personnalises ou d'une campagne JDR complete.
- Le bouton retour Android revient a l'accueil quand une campagne est ouverte.
- Lecteur audio avec play/pause, boucle automatique et fondu.
- Superposition de plusieurs ambiances et effets courts.
- Création de scène basique depuis les ambiances actuellement lancées.
- Sauvegarde locale des sons, scenes et favoris.
- Lien externe optionnel Spotify ou autre, sans telechargement integre.

Les liens Spotify et web sont ouverts dans leur application/site officiel. Ils ne sont pas telecharges ni mixes directement dans l'app.

## Spotify

Pour connecter Spotify :

Configuration developpeur, a faire une seule fois :

1. Creer une application sur https://developer.spotify.com/dashboard.
2. Copier le Client ID.
3. Creer un fichier `.env` a la racine du projet avec :

```bash
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=le_client_id_spotify
```

4. Ajouter dans Spotify Developer Dashboard la Redirect URI utilisee par l'app.

Ensuite, les utilisateurs n'ont qu'a appuyer sur Connecter Spotify dans l'application. Ils sont rediriges vers Spotify pour autoriser la liaison du compte.

Spotify Premium est requis pour piloter la lecture via l'API Spotify. L'audio Spotify n'est pas recupere ni reencode par l'application.

Si aucun appareil Spotify n'apparait, ouvrez Spotify sur le telephone, l'ordinateur ou l'enceinte cible, puis appuyez sur Rafraichir dans le panneau Spotify. Certains appareils ne sont pas exposes par l'API Spotify tant qu'ils ne sont pas actifs.

## Authentification

Un backend PHP + MySQL/MariaDB minimal est disponible dans `backend/`.

Avant de le lancer avec WAMP, importe `backend/schema.mysql.sql` dans phpMyAdmin. Cela cree la base `jdr_ambiances`.

Pour le lancer :

```bash
npm.cmd run backend:start
```

Ajoutez ensuite l'URL accessible depuis le telephone dans `.env` :

```bash
EXPO_PUBLIC_API_URL=http://IP_DU_PC:8000
```

Sur un telephone, n'utilisez pas `localhost` : il pointerait vers le telephone lui-meme.

Le compte synchronise automatiquement les donnees principales de l'app : campagnes, scenes, sons personnalises, images referencees, liens et favoris. Les fichiers importes depuis le telephone restent stockes sur le telephone pour l'instant.

Pour un export web public, l'API doit etre publique elle aussi. Si le backend est place sous `/api` sur le meme domaine que le site, l'app web le detecte automatiquement. Sinon, build le web avec :

```bash
EXPO_PUBLIC_API_URL=https://api.ton-domaine.fr
```

Un backend MongoDB Atlas est aussi disponible dans `backend-mongo/`. Il utilise les memes routes que l'app, avec les donnees separees par collections utilisateur.

