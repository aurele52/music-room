export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type Mode =
  | 'login'
  | 'register'
  | 'pending'
  | 'forgot'
  | 'reset'
  | 'verify';

export type AuthResponse = {
  user: User;
  token: string;
};
