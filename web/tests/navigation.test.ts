import { describe, expect, it } from 'vitest';
import { parsePage } from '../src/app/useNavigation';

describe('Navigation Music Room', () => {
  it('ouvre accueil par defaut', () => {
    expect(parsePage('')).toBe('home');
  });

  it('ouvre les evenements', () => {
    expect(parsePage('?view=events')).toBe('events');
  });

  it('ouvre les amis', () => {
    expect(parsePage('?view=friends')).toBe('friends');
  });

  it('ouvre les parametres', () => {
    expect(parsePage('?view=settings')).toBe('settings');
  });

  it('refuse une page inconnue', () => {
    expect(parsePage('?view=unknown')).toBe('home');
  });

  it('conserve la compatibilite avec les liens evenement', () => {
    expect(parsePage('?event=123&view=events')).toBe('events');
  });

  it('ne confond pas un lien de verification avec une page', () => {
    expect(parsePage('?verify=123')).toBe('home');
  });
});
