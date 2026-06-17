// The principal attached by BearerOrApiKeyGuard (registered users) or by
// GuestOrAuthenticatedGuard (the single shared Guest row). `isGuest` is the
// single field the controller branches on to pick the quota-skipping path;
// it is typed as a required boolean so strict mode forces every guard that
// populates `user` to set it explicitly.
export interface AuthenticatedUser {
  id: string;
  isGuest: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
