const NodeCache = require('node-cache');
// Cache idempotency keys for 24 hours
const idempotencyCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

/**
 * Idempotency Middleware
 * Requires the client to send an 'Idempotency-Key' header for POST/PUT requests.
 * If the key has been seen before, returns the cached response instead of processing the request again.
 */
const idempotency = (req, res, next) => {
  // Only apply to state-changing requests
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return res.status(400).json({
      success: false,
      message: 'Idempotency-Key header is required for this operation to prevent double execution.',
    });
  }

  const cacheKey = `idemp_${idempotencyKey}`;
  const cachedResponse = idempotencyCache.get(cacheKey);

  if (cachedResponse) {
    console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
    return res.status(cachedResponse.statusCode).json(cachedResponse.body);
  }

  // Intercept res.json to cache the response before sending it
  const originalJson = res.json;
  res.json = function (body) {
    console.log(`[Idempotency] Intercepting res.json. Body:`, JSON.stringify(body));
    if (res.statusCode >= 200 && res.statusCode < 400) {
      idempotencyCache.set(cacheKey, { statusCode: res.statusCode, body });
    }
    // Call the original res.json
    return originalJson.call(this, body);
  };

  next();
};

module.exports = idempotency;
