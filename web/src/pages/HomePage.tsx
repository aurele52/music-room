import type { Page } from '../app/useNavigation';

const shortcuts = [
  {
    page: 'events',
    title: 'Mes événements',
    description: 'Créer et gérer mes soirées musicales.'
  },
  {
    page: 'discovery',
    title: 'Découvrir',
    description: 'Trouver de nouveaux événements.'
  },
  {
    page: 'friends',
    title: 'Mes amis',
    description: 'Retrouver et inviter mes contacts.'
  },
  {
    page: 'profile',
    title: 'Mon profil',
    description: 'Modifier mes informations.'
  }
] as const;

type Props = {
  name: string;
  navigate: (page: Page) => void;
};

export default function HomePage({ name, navigate }: Props) {
  return (
    <>
      <h1>Bienvenue, {name} !</h1>
      <p className="subtitle">
        Ta musique, tes amis et tes événements.
      </p>

      <div className="home-grid">
        {shortcuts.map(item => (
          <button
            className="home-shortcut"
            key={item.page}
            onClick={() => navigate(item.page)}
          >
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
    </>
  );
}
