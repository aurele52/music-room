export type PublicUser = {
  id: string;
  name: string;
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  createdAt: string;
  publicBio?: string;
  friendsBio?: string;
};

export type ApiError = Error & {
  status?: number;
  code?: string;
};

export type Props = {
  token: string;
  onAuthError: (error: unknown) => boolean;
  onFriendRequestSent: () => void;
};
