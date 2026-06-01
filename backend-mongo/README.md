# Backend MongoDB Atlas

Backend Node minimal compatible avec les routes deja utilisees par l'app :

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /sync`
- `POST /sync`

## Configuration

Configure l'URI MongoDB Atlas dans une variable d'environnement.

PowerShell :

```powershell
$env:MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/"
$env:MONGODB_DB="jdr_ambiances"
npm.cmd run backend:mongo:start
```

Ne mets pas l'URI avec le mot de passe directement dans le code.

## Collections creees

- `users`
- `sessions`
- `user_sounds`
- `user_sound_folders`
- `user_custom_sounds`
- `user_campaign_images`
- `user_external_links`
- `user_scenes`
- `user_favorite_categories`

## Production

Pour le web public, heberge ce backend Node sur Render, Railway, Fly.io, VPS, etc. Ensuite build l'app avec :

```bash
EXPO_PUBLIC_API_URL=https://api.ton-domaine.fr
```

## Deploiement Render

Le fichier `render.yaml` a la racine du projet configure un Web Service Render.

Etapes :

1. Pousse le projet sur GitHub.
2. Dans Render, cree un nouveau **Blueprint** depuis ce repo.
3. Render detecte `render.yaml`.
4. Renseigne la variable secrete `MONGODB_URI`.
5. Deploie le service.
6. Ouvre `/health` sur l'URL Render pour verifier.

Render fournit une URL du type :

```text
https://jdr-ambiances-api.onrender.com
```

Utilise cette URL dans l'app avant de refaire le build :

```bash
EXPO_PUBLIC_API_URL=https://jdr-ambiances-api.onrender.com
```
