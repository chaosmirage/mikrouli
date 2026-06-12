# auth

## Purpose

Provides the React authentication context: session bootstrapping, login,
registration, and logout. Session state is driven by the server-issued HttpOnly
cookies; no tokens are stored in script-accessible browser storage.

## Key pieces

- `AuthContext.tsx` -- `AuthProvider` and `useAuth` hook. On mount, probes
  `GET /api/auth/me` to determine whether a valid session cookie is present
  (returns `null` on 401, user object on success). Login and register call the
  corresponding API endpoints; on success the server sets the HttpOnly cookies
  and the response body carries the user profile. Logout calls
  `POST /api/auth/logout`, which instructs the server to revoke the refresh
  token and clear both cookies, then invalidates all TanStack Query caches and
  navigates to `/login`. `loginWithGithub` performs a full-page navigation to
  `GET /api/auth/github`; the API sets the CSRF state token and redirects the
  browser to GitHub's authorization endpoint. On a successful callback the API
  sets session cookies and redirects to `/dashboard` -- no client-side fetch is
  involved.
- `ProtectedRoute.tsx` -- redirects to `/login` when `useAuth().user` is null
  after bootstrapping completes.
- `GuestRoute.tsx` -- redirects authenticated users away from guest-only pages
  (login, register).

## How to extend safely

- Session state is owned by the server-side HttpOnly cookies. Do not mirror
  the session into localStorage, sessionStorage, or any other script-readable
  store -- the cookie model is intentional.
- The `user` query has `staleTime: Infinity` and `refetchOnWindowFocus: false`
  because the `/me` endpoint is not meant to poll; force a refetch only by
  calling `queryClient.invalidateQueries(['user'])`.
- Logout must always call the API endpoint before clearing the local state so
  the server-side refresh token is revoked. If the logout API call fails the
  user remains logged in -- do not add a "clear local state anyway" fallback
  that would leave an unrevoked refresh token on the server.
- New auth-related API calls should go through `apiFetch` from `../api/client`
  to inherit the `credentials: 'include'` cookie behaviour.
- `loginWithGithub` uses `window.location.assign` (full-page navigation), not
  `fetch` or `navigate`. Do not convert it to an API call: the OAuth flow
  requires the browser to follow server-side cross-origin redirects that
  `fetch` cannot follow in the same way.
