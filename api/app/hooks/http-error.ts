export class HTTPError extends Error {
  private readonly response: Response;

  constructor(response: Response, error?: string) {
    let errorMessage = "";
    if (error) {
      errorMessage = error;
    } else {
      errorMessage = `HTTP Error: ${response.status} - ${response.statusText}`;
    }

    super(errorMessage);
    this.response = response;
  }

  get status() {
    return this.response.status;
  }

  /** Seconds from the Retry-After header, if the response has one. */
  get retryAfter() {
    const seconds = Number(this.response.headers.get("Retry-After"));
    return seconds > 0 ? seconds : undefined;
  }
}
