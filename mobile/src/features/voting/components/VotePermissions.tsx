import { Notice } from '../../../ui/Controls'
import type { MusicTrackListing } from '../../../lib/musicTracks'

export default function VotePermissions({
  listing
}: { listing: MusicTrackListing }) {
  return (
    <>
          {listing.finished ? (
            <Notice>
              Cet événement est terminé.
              Les opérations musicales sont fermées.
            </Notice>
          ) : null}

          {!listing.finished &&
            !listing.canParticipate ? (
              <Notice>
                Tu peux consulter les morceaux,
                mais tu ne peux pas en ajouter.
              </Notice>
            ) : null}

          {!listing.finished &&
            listing.canParticipate ? (
              <Notice>
                Tu es autorisé à proposer des morceaux.
              </Notice>
            ) : null}

          {!listing.finished &&
            !listing.canVote ? (
              <Notice>
                Le vote est actuellement indisponible
                pour ton compte ou hors de la plage autorisée.
              </Notice>
            ) : null}

          {listing.requiresLocation ? (
            <Notice>
              Les votes sont soumis à une restriction
              géographique. La position sera vérifiée
              lors de chaque vote.
            </Notice>
          ) : null}
          {listing.canVote &&
            listing.requiresLocation &&
            !listing.finished ? (
              <Notice>
                Cette soirée exige une localisation GPS
                pour voter et retirer un vote.
                Ta position sera demandée lors de l’action
                et transmise à l’API pour vérification.
              </Notice>
            ) : null}

    </>
  )
}
