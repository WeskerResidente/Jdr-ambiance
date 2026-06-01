# Backend auth JDR Ambiances

Backend minimal PHP + MySQL/MariaDB pour l'authentification reelle de l'app.

## Base de donnees WAMP/phpMyAdmin

Dans phpMyAdmin, importe le fichier :

```text
backend/schema.mysql.sql
```

Il cree la base `jdr_ambiances` avec les tables principales :

- `users`
- `sessions`
- `user_sync`
- `user_sound_folders`
- `user_sounds`
- `user_custom_sounds`
- `user_campaign_images`
- `user_external_links`
- `user_scenes`
- `user_favorite_categories`

Par defaut, le backend utilise la configuration WAMP classique :

```text
JDR_DB_HOST=127.0.0.1
JDR_DB_PORT=3306
JDR_DB_NAME=jdr_ambiances
JDR_DB_USER=root
JDR_DB_PASSWORD=
```

Si ton mot de passe MySQL n'est pas vide, ajoute les variables d'environnement correspondantes avant de lancer le serveur.

## Lancer en local

```bash
php -S 192.168.1.84:8000 -t backend/public backend/public/index.php
```

L'app mobile doit pointer vers l'adresse accessible depuis le telephone, par exemple :

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.84:8000
```

Evite `localhost` sur un telephone : il pointerait vers le telephone lui-meme, pas vers ton PC.

## Export web en ligne

Pour que la creation de compte marche sur le site web public, le backend doit lui aussi etre en ligne.

Deux options :

1. Mettre le backend sur un sous-domaine, par exemple `https://api.ton-domaine.fr`, puis builder le web avec :

```bash
EXPO_PUBLIC_API_URL=https://api.ton-domaine.fr
```

2. Mettre le backend dans un dossier `/api` sur le meme domaine que le site. Dans ce cas, l'app web utilise automatiquement `/api` si `EXPO_PUBLIC_API_URL` n'est pas renseigne.

Le fichier `backend/public/.htaccess` permet aux routes `/auth/register`, `/auth/login`, `/auth/me` et `/sync` de fonctionner sur Apache.

Si le site web est en HTTPS, l'API doit aussi etre en HTTPS. Un navigateur bloque les appels HTTPS -> HTTP.

## Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /sync`
- `POST /sync`

Les routes `register` et `login` attendent :

```json
{
  "email": "mj@example.com",
  "password": "motdepasse"
}
```

Elles retournent :

```json
{
  "user": {
    "id": "...",
    "email": "mj@example.com",
    "createdAt": "..."
  },
  "token": "..."
}
```

Les routes protegees utilisent :

```http
Authorization: Bearer TOKEN
```

## Synchronisation

`POST /sync` sauvegarde les donnees utilisateur dans des tables separees :

- sons references par l'app
- campagnes
- sons personnalises
- images de campagne
- liens externes
- scenes
- favoris

Les fichiers locaux audio/image ne sont pas encore uploades. Pour les synchroniser entre telephones, il faudra ajouter un stockage de fichiers cloud.
