/** The host the deploy's GitHub token is sent to. */
export const githubHost = "github.com";

/** The authorization GitHub accepts for the deploy's token over HTTPS. */
const githubAuthorization = (token: string) => `Basic ${btoa(`x-access-token:${token}`)}`;

/** Fetches the request with its authorization header replaced. */
export const fetchWithAuthorization = (request: Request, authorization: string) => {
  const headers = new Headers(request.headers);

  headers.set("authorization", authorization);

  return fetch(new Request(request, { headers }));
};

/**
 * A fetch that sends the GitHub token on every request to github.com and passes every other
 * request through unchanged. `onNotFound` hears each request GitHub answers 404 for.
 */
export const githubFetch =
  (token: string, onNotFound?: () => void): typeof fetch =>
  async (input, init) => {
    const request = new Request(input, init);

    if (new URL(request.url).hostname !== githubHost) {
      return fetch(request);
    }

    const response = await fetchWithAuthorization(request, githubAuthorization(token));

    if (response.status === 404) {
      onNotFound?.();
    }

    return response;
  };
