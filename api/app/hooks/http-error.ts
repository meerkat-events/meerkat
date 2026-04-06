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
}
