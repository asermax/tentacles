const githubHost = "github.com";

/** The authorization GitHub accepts for the deploy's token over HTTPS. */
export const githubAuthorization = (token: string) => `Basic ${btoa(`x-access-token:${token}`)}`;

/**
 * A fetch that sends the GitHub token on every request to github.com and passes every other
 * request through unchanged. `onNotFound` hears the URL of each request GitHub answers 404 for.
 */
export const githubFetch =
  (token: string, onNotFound?: (url: string) => void): typeof fetch =>
  async (input, init) => {
    const request = new Request(input, init);

    if (new URL(request.url).hostname !== githubHost) {
      return fetch(request);
    }

    const headers = new Headers(request.headers);

    headers.set("authorization", githubAuthorization(token));

    const response = await fetch(new Request(request, { headers }));

    if (response.status === 404) {
      onNotFound?.(request.url);
    }

    return response;
  };
