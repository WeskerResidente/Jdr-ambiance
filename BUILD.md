# Guide de Build - Android & iOS

## Prérequis

```bash
npm install -g eas-cli
eas login
```

## Build Preview (Tests)

### Android (APK - pour test local)
```bash
eas build --platform android --profile preview
```
Cela génère un APK testable sur tout appareil Android.

### iOS (Simulator ou Device)
```bash
eas build --platform ios --profile preview
```

### Builds parallèles
```bash
eas build --platform all --profile preview
```

---

## Build Production (App Store & Google Play)

### Android (AAB - pour Google Play Store)
```bash
eas build --platform android --profile production
```

### iOS (IPA - pour Apple App Store)
```bash
eas build --platform ios --profile production
```

### Builds parallèles
```bash
eas build --platform all --profile production
```

---

## Soumission aux Stores

### Google Play Store

**Configuration requise :**
- Compte Google Play Developer ($25)
- Service Account JSON credentials
- Placer le fichier dans : `~/.android/play-store-credentials.json`

**Soumettre :**
```bash
eas submit --platform android --latest
```

### Apple App Store

**Configuration requise :**
- Compte Apple Developer ($99/an)
- Apple ID avec 2FA
- Team ID
- App ID dans App Store Connect

**Configurer les identifiants :**
```bash
eas credentials
```

**Soumettre :**
```bash
eas submit --platform ios --latest
```

---

## Vérifier les Builds

```bash
eas build:list
```

Récupérer le lien de téléchargement d'une version spécifique :
```bash
eas build:view <build-id>
```

---

## Fichiers de Configuration Actuels

- **app.json** : Configuration Expo générale
- **eas.json** : Configuration des builds (preview/production)
- **package.json** : Dépendances et versions

---

## Notes Importantes

- Les builds EAS utilisent des serveurs cloud (pas local)
- Les APK/IPA sont générés automatiquement
- Les credentials sont gérés par EAS Credentials
- Chaque build prend 5-10 minutes

---

## Statuts de Build

- `new` - Build queued
- `in-progress` - En construction
- `finished` - Prêt à télécharger
- `errored` - Erreur pendant le build

Consulter les logs en cas d'erreur :
```bash
eas build:log <build-id>
```
