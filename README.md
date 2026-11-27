# Music Room

Projet de l'Ecole 42 : application musicale collaborative.

## Services musicaux

- Music Track Vote : propositions et votes sur les morceaux.
- Music Playlist Editor : edition collaborative de playlists.

Les utilisateurs peuvent creer des evenements, inviter leurs amis,
configurer les permissions musicales et partager une soiree par QR code.

## Technologies

- Web : React, Vite, TypeScript
- Mobile : React Native, Expo, TypeScript
- Backend : Express, TypeScript
- Base de donnees : PostgreSQL, Prisma
- Temps reel : Socket.IO
- Monorepo : pnpm, Turborepo
- IoT : Bluetooth Low Energy, C#

## Structure

- api/ : serveur REST, temps reel et base de donnees
- web/ : application Web
- mobile/ : application mobile
- iot/ : developpements du bonus IoT
- scripts/ : validation du projet
- docs/ : documentation technique

## Prerequis

- Node.js
- pnpm
- Docker et Docker Compose

## Installation

Configurer les fichiers .env a partir des exemples disponibles.
Definir DB_PASSWORD pour Docker Compose.

Installer les dependances :

    make install

Demarrer PostgreSQL et Mailpit :

    make db
    make mail

Appliquer les migrations :

    make migrate

## Lancement

API et Web :

    make dev

Application mobile :

    make mobile

Il est aussi possible de lancer les services individuellement :

    make api
    make web

## Ports

| Service | Port par defaut ou configure |
|---|---|
| API | 3100 |
| Web | 3101 |
| Expo | 8081 |
| PostgreSQL | 5433 |
| Mailpit SMTP | 1025 |
| Mailpit Web | 8025 |
| API de test isolee | 3199 |

## Validation

    make check
    make lint
    make build
    make test

Les tests backend utilisent une base PostgreSQL isolee :
musicroom_test.

## Documentation

- docs/API.md : endpoints et contrats HTTP
- docs/PERFORMANCE.md : tests de charge et performances

## Bonus

- Support multiplateforme
- IoT
- Abonnements gratuits et payants
- Mode hors ligne

Les bonus sont en cours de developpement et de validation.

## Securite

Les fichiers .env et les identifiants ne doivent jamais etre
ajoutes au depot Git.
