# Music Room — Rapport de performances

## Objectif

Evaluer la charge supportee par les endpoints musicaux
et documenter les ressources du serveur.

## Environnement

| Caracteristique | Valeur |
|---|---|
| Systeme | Linux 6.12.117+deb13-cloud-amd64 |
| Architecture | x86_64 |
| Processeur | AMD EPYC-Genoa Processor |
| vCPU | 2 |
| RAM totale | 3.7Gi |
| API | Node.js, Express, Prisma |
| PostgreSQL | Instance locale de test |
| Base | `musicroom_test` |
| API cible | `127.0.0.1:3102` |
| Client de charge | Node.js `fetch` |

## Methodologie

- Un evenement et un compte de test temporaires.
- Trois endpoints musicaux lus en HTTP.
- Paliers : 1, 5, 10, 20, 50 clients concurrents.
- 12 requetes par client et par service.
- Requetes sequentielles par client,
  clients executes en parallele.
- Un compte authentifie partage par les clients.
- Mesure des latences p50/p95, des erreurs
  et des requetes par seconde.
- Surveillance du processus Node.js serveur
  via `/proc` toutes les 200 ms.

### Endpoints testes

- Vote : `GET /api/tracks/events/:eventId`
- Playlist : `GET /api/playlists/events/:eventId`
- Session : `GET /api/sessions/events/:eventId`

## Resultats par service et palier

| Endpoint | Clients | Requetes | Erreurs | p50 (ms) | p95 (ms) | req/s |
|---|---:|---:|---:|---:|---:|---:|
| vote | 1 | 12 | 0 | 5 | 6 | 209.5 |
| playlist | 1 | 12 | 0 | 4 | 5 | 225.8 |
| session | 1 | 12 | 0 | 4 | 5 | 240.9 |
| vote | 5 | 60 | 0 | 11 | 23 | 375.6 |
| playlist | 5 | 60 | 0 | 10 | 18 | 430.6 |
| session | 5 | 60 | 0 | 8 | 11 | 586.7 |
| vote | 10 | 120 | 0 | 17 | 24 | 555.8 |
| playlist | 10 | 120 | 0 | 17 | 26 | 554.4 |
| session | 10 | 120 | 0 | 16 | 33 | 533.7 |
| vote | 20 | 240 | 0 | 26 | 34 | 734.8 |
| playlist | 20 | 240 | 0 | 29 | 42 | 655.2 |
| session | 20 | 240 | 0 | 27 | 49 | 687.6 |
| vote | 50 | 600 | 0 | 65 | 86 | 749.9 |
| playlist | 50 | 600 | 0 | 72 | 86 | 676.2 |
| session | 50 | 600 | 0 | 69 | 95 | 693.9 |

## Synthese

- Requetes executees : **3096**.
- Erreurs HTTP ou reseau : **0**.
- Clients HTTP concurrents testes : **50**.
- Latence p95 maximale par scenario : **95 ms**.
- Tous les paliers testes ont abouti sans erreur.

## Ressources du processus API

- Echantillons : **27**.
- CPU moyen echantillonne : **91.8 %**.
- CPU maximum echantillonne : **119.8 %**.
- RAM moyenne : **269.0 Mio**.
- RAM maximum : **270.9 Mio**.

La mesure CPU est exprimee en pourcentage
d'un coeur logique : 100 % correspond environ
a l'utilisation complete d'un coeur.

## Interpretation et limites

Les mesures demontrent que les trois endpoints
de lecture ont supporte 50 clients HTTP
concurrents dans les conditions du test.

Elles ne demontrent pas :

- un maximum absolu de capacite du serveur ;
- 50 comptes authentifies distincts ;
- une charge de production representative ;
- les performances des ecritures concurrentes ;
- la capacite du systeme depuis Internet.

Les tests ont ete realises en local sur
le VPS, avec une base de test et un jeu
de donnees limite.

Le seuil de stabilite utilise dans le banc
est de zero erreur et une latence p95
inferieure ou egale a 2000 ms.

## Reproduction

Script : `api/scripts/load-music.mjs`.

Prerequis : API de test sur `127.0.0.1:3102`
reliee exclusivement a `musicroom_test`.

Commande depuis `api/` :

```bash
node scripts/load-music.mjs
```

Ne jamais executer les tests de charge
sur la base de production.

