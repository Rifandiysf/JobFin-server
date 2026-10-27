class AppError extends Error {
  constructor(message, statusCode = 500, reason = "APP_ERROR", options = undefined) {
    super(message, options);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.reason = reason;
  }
}

export { AppError };
