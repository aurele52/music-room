export type MusicPreferences = {
  favoriteGenres: string[];
  favoriteArtists: string[];
};

function cleanList(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value) || value.length > 15) {
    throw new Error('INVALID_MUSIC_LIST');
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Error('INVALID_MUSIC_ITEM');
    }

    const name = item.trim().replace(/ {2,}/g, ' ');

    if (
      name.length < 2 ||
      name.length > maxLength ||
      /[\u0000-\u001f\u007f]/u.test(name)
    ) {
      throw new Error('INVALID_MUSIC_ITEM');
    }

    const key = name.toLocaleLowerCase('fr-FR');

    if (!seen.has(key)) {
      result.push(name);
      seen.add(key);
    }
  }

  return result;
}

export function validateMusicPreferences(
  value: unknown
): MusicPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_MUSIC_PREFERENCES');
  }

  const data = value as Record<string, unknown>;

  return {
    favoriteGenres: cleanList(data.favoriteGenres, 40),
    favoriteArtists: cleanList(data.favoriteArtists, 80)
  };
}
