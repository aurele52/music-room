# Music Room — Documentation API REST

> Documentation du code existant, generee depuis les declarations de routes.
> Les schemas de corps et de reponses seront completes apres verification des controleurs.

## Informations generales

- Prefixe commun : `/api`
- Format des donnees : JSON pour les routes qui acceptent ou renvoient du JSON
- Authentification : jeton Bearer pour les routes protegees
- Les permissions dependent de la route, du role et de la visibilite des ressources
- Les parametres commencant par `:` sont des parametres de chemin

### Exemple d’appel authentifie

```http
GET /api/auth/me HTTP/1.1
Authorization: Bearer <token>
```

### Services musicaux

Le projet implemente deux services musicaux :

- Music Track Vote : `/api/tracks` et `/api/sessions`
- Music Playlist Editor : `/api/playlists`

Les sessions musicales permettent de suivre le classement
des votes pendant un evenement.

## Catalogue des endpoints

### Authentification classique

Source : `api/src/routes/auth.ts`

| Methode | Chemin |
|---|---|
| `POST` | `/api/auth/register` |
| `POST` | `/api/auth/login` |
| `GET` | `/api/auth/me` |
| `POST` | `/api/auth/verify-email` |
| `POST` | `/api/auth/resend-verification` |
| `POST` | `/api/auth/forgot-password` |
| `POST` | `/api/auth/reset-password` |

### Authentification Google

Source : `api/src/routes/google.ts`

| Methode | Chemin |
|---|---|
| `POST` | `/api/auth/google/login` |
| `POST` | `/api/auth/google/link` |
| `GET` | `/api/auth/google/status` |
| `DELETE` | `/api/auth/google/link` |

### Profils et preferences musicales

Source : `api/src/routes/profile.ts`

| Methode | Chemin |
|---|---|
| `PATCH` | `/api/profile/me` |
| `GET` | `/api/profile/me` |
| `PATCH` | `/api/profile/me/visibility` |
| `GET` | `/api/profile/me/music` |
| `PUT` | `/api/profile/me/music` |
| `GET` | `/api/profile/search` |
| `GET` | `/api/profile/:userId` |

### Relations entre utilisateurs

Source : `api/src/routes/friends.ts`

| Methode | Chemin |
|---|---|
| `GET` | `/api/friends/` |
| `POST` | `/api/friends/requests` |
| `POST` | `/api/friends/requests/:id/accept` |
| `DELETE` | `/api/friends/requests/:id` |
| `DELETE` | `/api/friends/:userId` |

### Evenements

Source : `api/src/routes/events.ts`

| Methode | Chemin |
|---|---|
| `POST` | `/api/events/` |
| `GET` | `/api/events/mine` |
| `GET` | `/api/events/discover` |
| `GET` | `/api/events/:id` |
| `PUT` | `/api/events/:id` |
| `DELETE` | `/api/events/:id` |

### Invitations

Source : `api/src/routes/eventInvitations.ts`

| Methode | Chemin |
|---|---|
| `GET` | `/api/events/invitations/mine` |
| `POST` | `/api/events/invitations/:id/accept` |
| `DELETE` | `/api/events/invitations/:id` |
| `GET` | `/api/events/:id/invitations` |
| `POST` | `/api/events/:id/invitations` |
| `DELETE` | `/api/events/:id/invitations/:invitationId` |

### Permissions musicales

Source : `api/src/routes/eventMusicPolicies.ts`

| Methode | Chemin |
|---|---|
| `GET` | `/api/events/:id/music-policies` |
| `PUT` | `/api/events/:id/music-policies` |

### Titres et votes

Source : `api/src/routes/tracks.ts`

| Methode | Chemin |
|---|---|
| `GET` | `/api/tracks/events/:eventId` |
| `POST` | `/api/tracks/events/:eventId` |
| `DELETE` | `/api/tracks/:trackId` |
| `POST` | `/api/tracks/:trackId/vote` |
| `DELETE` | `/api/tracks/:trackId/vote` |

### Playlists

Source : `api/src/routes/playlists.ts`

| Methode | Chemin |
|---|---|
| `GET` | `/api/playlists/events/:eventId` |
| `POST` | `/api/playlists/events/:eventId` |
| `DELETE` | `/api/playlists/:playlistId` |
| `POST` | `/api/playlists/:playlistId/items` |
| `DELETE` | `/api/playlists/:playlistId/items/:itemId` |
| `PUT` | `/api/playlists/:playlistId/order` |

### Sessions musicales

Source : `api/src/routes/musicSessions.ts`

| Methode | Chemin |
|---|---|
| `GET` | `/api/sessions/events/:eventId` |
| `POST` | `/api/sessions/events/:eventId/start` |
| `POST` | `/api/sessions/events/:eventId/control` |

## Authentification et autorisations

Les routes de connexion et d’inscription sont accessibles sans session.
Les operations protegees necessitent un jeton valide, et certaines actions exigent des permissions supplementaires.

Les regles effectives sont definies dans les controleurs et middlewares de l’API.

## Documentation des reponses

Les codes HTTP, les champs JSON obligatoires et les cas d’erreur doivent etre confirmes dans chaque controleur avant d’etre documentes comme contrat stable.

## Verification

- Routes identifiees : **63**
- Inventaire produit par analyse statique
- Aucun appel au serveur ou a la base de donnees

## Contrats REST verifies

Les informations ci-dessous proviennent des controleurs.
Seuls les champs et les codes HTTP verifies sont documentes.
Les reponses d'erreur utilisent generalement un objet JSON
contenant une propriete `error`.

### Authentification classique

| Methode | Route | Entree JSON | Reponse ou statut confirme |
|---|---|---|---|
| POST | `/api/auth/register` | `email`, `password`, `name` | `201`, erreurs `400`, `409` |
| POST | `/api/auth/login` | `email`, `password` | `200`, erreurs `400`, `401`, `403` |
| GET | `/api/auth/me` | Bearer token | `{ "user": ... }` |
| POST | `/api/auth/verify-email` | `token` | Message de verification |
| POST | `/api/auth/resend-verification` | `email` | Message de confirmation |
| POST | `/api/auth/forgot-password` | `email` | Message de confirmation |
| POST | `/api/auth/reset-password` | `token`, `password` | Message de modification |

L'inscription peut renvoyer `409` lorsque l'email est deja utilise.

### Authentification Google

| Methode | Route | Entree | Reponse ou statut confirme |
|---|---|---|---|
| POST | `/api/auth/google/login` | `credential` | Connexion, erreurs `401`, `409`, `503` |
| POST | `/api/auth/google/link` | Bearer token, `credential` | Message d'association |
| GET | `/api/auth/google/status` | Bearer token | `{ "linked": true/false }` |
| DELETE | `/api/auth/google/link` | Bearer token, `password` | Message de dissociation |

L'association et la dissociation exigent une authentification
recente en plus de l'authentification habituelle.

### Profils

| Methode | Route | Entree | Reponse confirmee |
|---|---|---|---|
| PATCH | `/api/profile/me` | `name` | `{ "user": ... }` |
| GET | `/api/profile/me` | Bearer token | `{ "user": ... }` |
| PATCH | `/api/profile/me/visibility` | `visibility` | `{ "user": ... }` |
| GET | `/api/profile/me/music` | Bearer token | `{ "preferences": ... }` |
| PUT | `/api/profile/me/music` | Preferences musicales | `{ "preferences": ... }` |
| GET | `/api/profile/search` | Query `q` | `{ "users": [...] }` |
| GET | `/api/profile/:userId` | Parametre `userId` | `{ "user": ... }` |

Les preferences musicales sont validees par
`validateMusicPreferences`. La structure exacte est definie
dans ce validateur.

### Evenements

| Methode | Route | Entree | Reponse confirmee |
|---|---|---|---|
| POST | `/api/events/` | Evenement valide par `validateEvent` | `201`, `{ "event": ... }` |
| GET | `/api/events/mine` | Bearer token | `{ "events": [...] }` |
| GET | `/api/events/discover` | `q`, `location`, `page` | Resultat de recherche |
| GET | `/api/events/:id` | `id` | `{ "event": ... }` |
| PUT | `/api/events/:id` | `id`, evenement | `{ "event": ... }` |
| DELETE | `/api/events/:id` | `id` | Message de suppression |

### Service 1 — Music Track Vote

| Methode | Route | Entree | Reponse confirmee |
|---|---|---|---|
| GET | `/api/tracks/events/:eventId` | `eventId` | Liste des titres |
| POST | `/api/tracks/events/:eventId` | `title`, `artist` | `201`, `{ "track": ... }` |
| DELETE | `/api/tracks/:trackId` | `trackId` | Message de suppression |
| POST | `/api/tracks/:trackId/vote` | `trackId` | `201`, message de vote |
| DELETE | `/api/tracks/:trackId/vote` | `trackId` | Message de retrait |

Un vote deja enregistre peut produire une erreur `409`.
Les operations sont soumises aux permissions musicales
de l'evenement.

### Service 2 — Music Playlist Editor

| Methode | Route | Entree | Reponse confirmee |
|---|---|---|---|
| GET | `/api/playlists/events/:eventId` | `eventId` | Liste des playlists |
| POST | `/api/playlists/events/:eventId` | `title`, `description` | `201`, `{ "playlist": ... }` |
| DELETE | `/api/playlists/:playlistId` | `playlistId` | Message de suppression |
| POST | `/api/playlists/:playlistId/items` | `title`, `artist` | `201`, `{ "item": ... }` |
| DELETE | `/api/playlists/:playlistId/items/:itemId` | Deux identifiants | Message de suppression |
| PUT | `/api/playlists/:playlistId/order` | `itemIds`, `revision` | Message de confirmation |

La revision permet au serveur de verifier la coherence
des modifications de l'ordre.

### Music Track Vote — Sessions musicales

| Methode | Route | Entree | Reponse confirmee |
|---|---|---|---|
| GET | `/api/sessions/events/:eventId` | `eventId` | Etat de la session |
| POST | `/api/sessions/events/:eventId/start` | `{}` | `201`, `{ "session": ... }` |
| POST | `/api/sessions/events/:eventId/control` | `action`, `revision` | `{ "session": ... }` |

Commandes disponibles : `play`, `pause`, `next`, `stop`.

Seul l'organisateur peut demarrer et controler la session
pendant un evenement actif.

Le classement est recalcule lors du passage au morceau
suivant, sans rejouer les morceaux deja parcourus.

Une commande invalide renvoie une erreur `400`.
Une revision obsolete ou une commande incompatible
avec l'etat courant renvoie une erreur `409`.

La session synchronise un ordre de lecture.
Elle ne diffuse pas directement de flux audio.

### Codes HTTP observes

| Code | Signification |
|---|---|
| `200` | Requete traitee avec succes |
| `201` | Ressource creee ou vote enregistre |
| `400` | Parametres ou corps invalides |
| `401` | Authentification absente ou invalide |
| `403` | Acces refuse ou action interdite |
| `404` | Ressource introuvable |
| `409` | Conflit avec l'etat existant |
| `500` | Erreur interne |
| `503` | Service Google non configure |

Ces codes sont observes dans les controleurs et ne sont
pas necessairement renvoyes par chaque endpoint.

### Limites de cet inventaire

Les champs internes complets des objets `user`, `event`,
`track`, `playlist` et `session` ne sont pas decrits ici.
Les routes annexes conservent leur inventaire dans le
catalogue precedent. Cette documentation ne remplace
pas une specification OpenAPI exhaustive.

## Contrats complementaires verifies

Cette section complete les contrats des modules sociaux
et des fonctionnalites musicales annexes. Les reponses
et les entrees indiquees proviennent des controleurs
existants.

### Relations entre utilisateurs

| Methode | Endpoint | Entree | Reponse |
|---|---|---|---|
| GET | `/api/friends/` | Authentification | `friends`, `incoming`, `outgoing` |
| POST | `/api/friends/requests` | JSON `userId` | `201` ou erreur |
| POST | `/api/friends/requests/:id/accept` | Parametre `id` | Message de confirmation |
| DELETE | `/api/friends/requests/:id` | Parametre `id` | Message de suppression |
| DELETE | `/api/friends/:userId` | Parametre `userId` | Message de suppression |

Une demande d'ami peut renvoyer `409` si elle entre
en conflit avec une relation existante.

### Invitations aux evenements

| Methode | Endpoint | Entree | Reponse |
|---|---|---|---|
| GET | `/api/events/invitations/mine` | Authentification | `invitations` |
| POST | `/api/events/invitations/:id/accept` | Identifiant d'invitation | Message de confirmation |
| DELETE | `/api/events/invitations/:id` | Identifiant d'invitation | Message de suppression |
| GET | `/api/events/:id/invitations` | Identifiant d'evenement | `invitations` |
| POST | `/api/events/:id/invitations` | JSON `userId` | `201`, objet `invitation` |
| DELETE | `/api/events/:id/invitations/:invitationId` | Deux identifiants | Message de suppression |

Les invitations sont soumises aux permissions et a
l'etat de l'evenement. Un evenement termine peut
provoquer une erreur `409`.

### Permissions musicales des evenements

| Methode | Endpoint | Entree | Reponse |
|---|---|---|---|
| GET | `/api/events/:id/music-policies` | Identifiant d'evenement | `policies` |
| PUT | `/api/events/:id/music-policies` | JSON `votePolicy`, `editPolicy` et restrictions eventuelles | `policies` |

Les restrictions de vote sont validees par
`parseVoteRestrictions`. La modification depend
des permissions de l'utilisateur.

## Portee de la documentation

Le document inventorie les 63 endpoints REST detectes
dans le projet, avec les principales entrees et
reponses confirmees.

Les objets JSON complexes sont documentes par leurs
champs principaux. Leur structure exhaustive reste
definie par les types et validateurs du code source.

La documentation ne garantit pas que toutes les
erreurs possibles sont enumerees pour chaque route.

Le rapport de charge se trouve dans
`docs/PERFORMANCE.md`.


## Informations personnelles et confidentialite

Les utilisateurs disposent de trois champs personnels :

| Champ | Type | Limite |
|---|---|---|
| publicBio | string | 500 caracteres |
| friendsBio | string | 500 caracteres |
| privateNote | string | 500 caracteres |

Les champs sont vides par defaut.

### GET /api/profile/me

Authentification obligatoire.

Renvoie le profil du compte connecte, y compris les trois
informations personnelles.

### PUT /api/profile/me/information

Authentification obligatoire.

Entree JSON :

```json
{
  "publicBio": "Presentation publique",
  "friendsBio": "Presentation pour les amis",
  "privateNote": "Note privee"
}
```

Les trois champs doivent etre fournis.
Les espaces en debut et fin sont supprimes.

Reponse HTTP 200 :

```json
{
  "information": {
    "publicBio": "Presentation publique",
    "friendsBio": "Presentation pour les amis",
    "privateNote": "Note privee"
  }
}
```

Une entree invalide renvoie HTTP 400 sans modifier le profil.
Une requete non authentifiee renvoie HTTP 401.

### GET /api/profile/:userId

Authentification obligatoire.

- PUBLIC : informations publiques accessibles.
- FRIENDS : profil reserve aux amis confirmes.
- PRIVATE : profil reserve au proprietaire.

Le champ friendsBio est uniquement transmis au proprietaire
ou a un ami confirme autorise a consulter le profil.

Le champ privateNote, l'email, les identifiants de connexion
et les preferences musicales ne sont jamais transmis par
cet endpoint.

Un profil inaccessible ou inexistant renvoie HTTP 404.

La recherche de profils ne transmet aucune information
personnelle reservee aux amis ou au proprietaire.


## Catalogue et lecture audio

### GET /api/catalog

Authentification obligatoire.

Renvoie le catalogue fixe de cinq morceaux de demonstration.

Exemple de reponse :

```json
{
  "tracks": [
    {
      "id": "blue-horizon",
      "title": "Blue Horizon",
      "artist": "Music Room",
      "audioUrl": "/api/audio/blue-horizon.wav"
    }
  ]
}
```

### GET /api/audio/:filename

Distribue les fichiers audio de demonstration.

Les fichiers sont des compositions synthetiques originales
generees par scripts/generate-audio.py.

### Sessions musicales

Les morceaux des sessions disposent d'un champ audioUrl.

Ce champ contient le chemin du fichier audio lorsque
le titre et l'artiste correspondent au catalogue.
Dans le cas contraire, sa valeur est null.

La commande ended permet au lecteur de signaler la fin
du morceau courant.

Elle exige la revision actuelle de la session et les
memes permissions que les autres commandes.

Le serveur selectionne le prochain morceau selon les
votes actualises. Si aucun morceau ne reste disponible,
la session passe a l'etat STOPPED.

### Limites volontaires

- Lecture audio dans l'interface de l'organisateur.
- Catalogue fixe de cinq morceaux de demonstration.
- Les propositions libres restent possibles sans audio.
- Pas de service externe de streaming.
- Pas de synchronisation de la position audio.
- Pas de gestion avancee des appareils de diffusion.

## Abonnements

Les offres disponibles sont `FREE` et `PREMIUM`.
Le changement d'offre est simule, sans paiement reel.

Les routes necessitent une authentification.

| Methode | Route | Entree | Reponse |
|---|---|---|---|
| GET | `/api/subscription` | Aucune | `subscription` |
| PATCH | `/api/subscription` | `subscription` | `subscription` |

Une offre invalide renvoie HTTP 400.
Une requete non authentifiee renvoie HTTP 401.
Une erreur interne renvoie HTTP 500.

## Permissions individuelles des playlists

### PATCH /api/playlists/:playlistId/policies

Authentification et permissions de modification requises.

Entree JSON :

    {
      "visibility": "PUBLIC",
      "editPolicy": "INVITED_ONLY"
    }

Valeurs autorisees :

- visibility : PUBLIC ou PRIVATE.
- editPolicy : PUBLIC ou INVITED_ONLY.

La modification incremente la revision de la playlist
et declenche une notification Socket.IO.

La reponse contient la playlist actualisee :
id, eventId, visibility, editPolicy et revision.

Les parametres invalides renvoient HTTP 400.
