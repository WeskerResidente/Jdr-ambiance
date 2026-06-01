# Guide de Déploiement - Google Play & Apple App Store

## 📱 Quickstart

### Build & Submit (Automatique avec EAS)
```bash
# Android
npm run build:android:prod
npm run submit:android

# iOS
npm run build:ios:prod
npm run submit:ios

# Tous les deux
npm run build:all:prod
npm run submit:android && npm run submit:ios
```

---

## 🤖 Android - Google Play Store

### 1. Créer un compte Google Play Developer
- Aller sur https://play.google.com/apps/publish/
- Payer $25 (une seule fois)
- Compléter le profil entreprise

### 2. Créer une app sur Google Play Console
1. Cliquer **"Créer une app"**
2. Remplir les détails :
   - **Nom** : JDR Ambiances
   - **Langage par défaut** : Français
   - **Type** : Apps
   - **Catégorie** : Divertissement ou Musique
3. Accepter les conditions

### 3. Configurer les credentials

#### Option A: Via EAS (Recommandé)
```bash
eas credentials
# Sélectionner "Android"
# Laisser EAS générer la clé signing automatiquement
```

#### Option B: Créer manuellement
```bash
# Créer une Service Account sur Google Cloud
# Télécharger le JSON
# Placer dans ~/.android/play-store-credentials.json
```

### 4. Préparer le store listing
Dans Google Play Console:
1. Aller à **"Gestion des versions"** → **"Publication sur le Play Store"**
2. Remplir :
   - Screenshots (minimum 2)
   - Description courte (80 caractères max)
   - Description complète
   - Catégorie, contenu, note PEGI
3. Ajouter l'APK/AAB

### 5. Soumettre
```bash
npm run build:android:prod    # Attendre la compilation
npm run submit:android         # Envoyer à Google Play
```

**Temps d'approbation** : 2-4 heures généralement

---

## 🍎 iOS - Apple App Store

### 1. Créer un compte Apple Developer
- Aller sur https://developer.apple.com/
- Payer $99/an
- Compléter le profil

### 2. Créer une app sur App Store Connect
https://appstoreconnect.apple.com

1. Aller à **"Mes apps"**
2. Cliquer **"Nouvelle app"**
3. Remplir :
   - **Plateforme** : iOS
   - **Nom** : JDR Ambiances
   - **ID du bundle** : com.jdrambiances.app (doit correspondre à app.json)
   - **SKU** : jdr-ambiances-v1

### 3. Configurer les certificates et profiles

#### Via EAS (Automatique)
```bash
eas credentials
# Sélectionner iOS
# Entrer Apple ID
# Laisser EAS gérer l'authentification
```

#### Manuel (Plus complexe)
1. Aller à https://developer.apple.com/account/resources/certificates/list
2. Créer un Certificate Signing Request (CSR)
3. Créer un "iOS App Development" certificate
4. Créer un provisioning profile
5. Télécharger et installer

### 4. Préparer l'app store listing
Dans App Store Connect:
1. **Informations générales**
   - Catégorie principale : Musique ou Divertissement
   - Sous-catégorie : À déterminer

2. **Disponibilité**
   - Sélectionner les pays
   - Prix (gratuit)

3. **Screenshots & Aperçu**
   - Minimum 2 screenshots par dispositif
   - Format: 1242×2208px (iPhone)
   - Format: 2048×2732px (iPad)

4. **Description**
   - **Nom** : JDR Ambiances
   - **Sous-titre** : Ambiances sonores pour MJ
   - **Description** : Max 4000 caractères

5. **Notes de version** : v1.0.0 - Version initiale

6. **Informations de contact & Support**
   - Email de support
   - URL support (optionnel)

### 5. Remplir les informations de l'application
- **Confidentialité & Sécurité**
  - Indiquer qu'on accède à : AsyncStorage, Spotify
- **Classification du contenu**
  - Remplir le questionnaire

### 6. Soumettre
```bash
npm run build:ios:prod        # Attendre la compilation
npm run submit:ios            # Envoyer à l'App Store
```

**Temps d'approbation** : 24-48 heures (Apple est plus strict)

---

## 🔄 Mises à Jour

### Incrementer la version
```json
// app.json
{
  "version": "1.0.1",
  "ios": {
    "build": "2"
  },
  "android": {
    "buildNumber": 2
  }
}
```

### Recompiler et soumettre
```bash
npm run build:all:prod
npm run submit:android && npm run submit:ios
```

---

## 🐛 Troubleshooting

### Build échoue
```bash
# Voir les logs
eas build:log <build-id>

# Nettoyer et recommencer
npm run start:clear
eas build -p android --profile production
```

### Credentials perdus
```bash
# Réinitialiser
eas credentials
# Sélectionner "clear" si besoin
```

### App Store Connect - Bundle ID error
```
❌ "Bundle ID already exists"
```
Solution: Utiliser un bundle ID unique (ex: com.jdrambiances.app.v2)

### iOS - Provisioning Profile expired
```bash
eas credentials --platform ios
# Renouveler les credentials
```

---

## 📋 Checklist Pré-Lancement

- [ ] Version correctement incrémentée
- [ ] app.json mis à jour (bundleId, version, build)
- [ ] eas.json configuré pour les deux platforms
- [ ] Credentials EAS vérifiées
- [ ] Screenshots prêts (Android + iOS)
- [ ] Descriptions rédigées
- [ ] Store listing complet
- [ ] Politique de confidentialité rédigée
- [ ] Email de support configuré
- [ ] Code compilé sans erreur : `npm run typecheck`
- [ ] App testée en production mode

---

## 📊 Monitoring

### Voir l'historique des builds
```bash
npm run builds:list
```

### Voir les stats download
- **Android** : Google Play Console → Statistiques
- **iOS** : App Store Connect → Ventes et tendances

### Répondre aux avis utilisateurs
- **Android** : Google Play Console → Avis
- **iOS** : App Store Connect → Avis

---

## 💡 Notes Importantes

1. **Bundling** : iOS accepte les IPA, Android accepte les AAB
2. **Signatures** : EAS gère automatiquement les signatures
3. **Versions** : Ne jamais soumettre la même version deux fois
4. **Testing** : Toujours tester le build prod en Expo Go avant submit
5. **Rollout** : Les mises à jour se font progressivement (pas instantanément)
