# Music Room Mobile

Application mobile Music Room développée avec React Native et Expo.

## Configuration

Créer le fichier `.env` à partir de `.env.example` et renseigner
l'adresse du serveur API :

    EXPO_PUBLIC_API_URL=https://adresse-de-l-api

L'adresse ne doit pas contenir le suffixe `/api`.

## Lancement

Depuis la racine du projet :

    make mobile

## Fonctionnalités

- Inscription et connexion.
- Authentification Google.
- Gestion du profil et des amis.
- Création et découverte d'événements.
- Gestion des invitations.
- Propositions et votes musicaux.
- Édition collaborative de playlists.
- Lecture musicale.
- Restrictions horaires et géographiques.
- Synchronisation en temps réel.
- Mode hors ligne.
- Gestion des abonnements.
- Découverte Bluetooth sur Android.

## Authentification

Le jeton de session est conservé dans Secure Store.
La session est vérifiée auprès du serveur au démarrage.

## Tests

Depuis la racine du projet :

    pnpm --filter music-room-mobile check
    pnpm --filter music-room-mobile test
    pnpm --filter music-room-mobile lint
