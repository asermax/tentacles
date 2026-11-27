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
 * A fetch that sends the GitHub token on every HTTPS request to github.com and passes every other
 * request through unchanged, plain HTTP included. `onNotFound` hears each request GitHub answers 404 for.
 */
export const githubFetch =
  (token: string, onNotFound?: () => void): typeof fetch =>
  async (input, init) => {
    const request = new Request(input, init);

    const { protocol, hostname } = new URL(request.url);

    if (protocol !== "https:" || hostname !== githubHost) {
      return fetch(request);
    }

    const githubResponse = await fetchWithAuthorization(request, githubAuthorization(token));

    if (githubResponse.status === 404) {
      onNotFound?.();
    }

    return githubResponse;
  };
