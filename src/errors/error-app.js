class ErrorApp extends Error {
  constructor(message, code) {
    super();
    this.code = code;
    this.message = message;
  }
}

module.exports = ErrorApp;
