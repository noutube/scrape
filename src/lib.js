class RateLimitedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitedError';
  }
}

module.exports = {
  RateLimitedError
}
