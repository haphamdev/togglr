/**
 * A domain error carrying an animal-themed error `code` (error-codes.md is the
 * source of truth) plus the HTTP status it maps to. Thrown by services and
 * pipes; rendered into the `{ error: { code, message } }` envelope
 * (togglr-api.md:52-53) by AllExceptionsFilter. Distinct from Nest's
 * HttpException so the filter can tell domain errors from framework errors.
 */
export class DomainException extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DomainException";
  }
}
