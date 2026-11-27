import type { Auth } from '../useAuth'

export default function AuthForm({ auth }: { auth: Auth }) {
  const {
    mode, name, email, password, confirmPassword,
    loading, setName, setEmail, setPassword,
    setConfirmPassword, handleSubmit
  } = auth

  return (
    <form onSubmit={handleSubmit}>
      {mode === 'register' && (
        <label>
          Nom
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={100}
            autoComplete="name"
            required
          />
        </label>
      )}

      {['login', 'register', 'forgot'].includes(mode) && (
        <label>
          Adresse email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
      )}

      {['login', 'register', 'reset'].includes(mode) && (
        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === 'login' ? undefined : 8}
            autoComplete={
              mode === 'login'
                ? 'current-password'
                : 'new-password'
            }
            required
          />
        </label>
      )}

      {mode === 'reset' && (
        <label>
          Confirmer le mot de passe
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(e.target.value)
            }
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
      )}

      <button disabled={loading} type="submit">
        {loading
          ? 'Chargement...'
          : mode === 'login'
            ? 'Se connecter'
            : mode === 'register'
              ? "S'inscrire"
              : mode === 'forgot'
                ? 'Envoyer le lien'
                : 'Changer le mot de passe'}
      </button>
    </form>

  )
}
