import type { ReactNode } from 'react';
import type { Page } from './useNavigation';

const navigation: { page: Page; label: string }[] = [
  { page: 'home', label: 'Accueil' },
  { page: 'events', label: 'Mes événements' },
  { page: 'discovery', label: 'Découvrir' },
  { page: 'friends', label: 'Mes amis' },
  { page: 'profile', label: 'Mon profil' },
  { page: 'settings', label: 'Paramètres' }
];

type Props = {
  page: Page;
  navigate: (page: Page) => void;
  name: string;
  logout: () => void;
  children: ReactNode;
};

export default function AppLayout({
  page, navigate, name, logout, children
}: Props) {
  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="brand">♫ Music Room</div>

        <nav className="app-menu" aria-label="Navigation principale">
          {navigation.map(item => (
            <button
              key={item.page}
              className={item.page === page ? 'active' : ''}
              aria-current={item.page === page ? 'page' : undefined}
              onClick={() => navigate(item.page)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="app-account">
          <strong>{name}</strong>
          <button className="secondary" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="app-content">
        {children}
      </main>
    </div>
  );
}
