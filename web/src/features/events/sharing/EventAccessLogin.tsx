type Props = {
  token: string
  close: () => void
}

export default function EventAccessLogin({
  token, close
}: Props) {
    return (
      <aside
        className="music-deeplink-login"
        role="status"
        aria-label="Connexion pour rejoindre une soirée"
      >
        <h2>Connexion nécessaire</h2>

        <p>
          Connecte-toi à Music Room avec le formulaire habituel.
          La soirée s'ouvrira après vérification de ton accès.
        </p>

        {token && (
          <>
            <p>
              Ta connexion actuelle n'est plus autorisée.
            </p>

            <button
              type="button"
              onClick={() => {
                // Le lien ?event= reste intact.
                sessionStorage.removeItem('token')
                window.dispatchEvent(
                  new Event('music-room:auth-changed')
                )
                window.location.reload()
              }}
            >
              Se reconnecter
            </button>
          </>
        )}

        <button
          type="button"
          className="secondary"
          onClick={close}
        >
          Ignorer ce lien
        </button>
      </aside>
    )

}
