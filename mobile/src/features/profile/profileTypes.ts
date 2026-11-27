export type Visibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'

export type ProfileInformation = {
  publicBio: string
  friendsBio: string
  privateNote: string
}

export type Preferences = {
  favoriteGenres: string[]
  favoriteArtists: string[]
}
