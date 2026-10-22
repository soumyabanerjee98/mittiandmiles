export type FieldDetail = {
  field: string;
  message: string;
};

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: readonly FieldDetail[];

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: readonly FieldDetail[] = [],
  ) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
