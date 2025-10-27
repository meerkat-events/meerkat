export class HTTPError extends Error {
  constructor(private readonly response: Response, error?: string) {
    let errorMessage = "";
    if (error) {
      errorMessage = error;
    } else {
      errorMessage = `HTTP Error: ${response.status} - ${response.statusText}`;
    }

    super(errorMessage);
  }

  get status() {
    return this.response.status;
  }
}
