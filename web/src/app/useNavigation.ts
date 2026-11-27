import { useEffect, useState } from 'react';

export const pages = [
  'home',
  'events',
  'discovery',
  'friends',
  'profile',
  'settings'
] as const;

export type Page = typeof pages[number];

export function parsePage(search: string): Page {
  const value = new URLSearchParams(search).get('view');

  return pages.find(page => page === value) ?? 'home';
}

export function useNavigation() {
  const [page, setPage] = useState<Page>(
    () => parsePage(window.location.search)
  );

  useEffect(() => {
    function restorePage() {
      setPage(parsePage(window.location.search));
    }

    window.addEventListener('popstate', restorePage);

    return () => {
      window.removeEventListener('popstate', restorePage);
    };
  }, []);

  function navigate(next: Page) {
    const url = new URL(window.location.href);

    if (next === 'home') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', next);
    }

    if (url.href !== window.location.href) {
      window.history.pushState({}, '', url);
    }

    setPage(next);
  }

  return { page, navigate };
}
