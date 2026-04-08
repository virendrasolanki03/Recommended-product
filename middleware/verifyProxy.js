/**
 * Shopify App Proxy — HMAC Signature Verification Middleware
 * 
 * Every request that comes through the Shopify App Proxy includes a `signature`
 * query parameter. This middleware verifies that the signature is valid, ensuring
 * the request genuinely originated from Shopify and was not tampered with.
 *
 * How Shopify signs requests:
 *   1. All query parameters (except `signature`) are sorted alphabetically by key.
 *   2. Parameters with array values have their values joined with commas.
 *   3. The sorted key=value pairs are joined with nothing (no separator).
 *   4. An HMAC-SHA256 is computed over that string using the app's API secret.
 *   5. The hex digest is sent as the `signature` parameter.
 *
 * @see https://shopify.dev/docs/apps/online-store/app-proxy#calculate-a-digital-signature
 */

const crypto = require('crypto');

/**
 * Express middleware that validates Shopify App Proxy HMAC signatures.
 * Responds with 401 if the signature is missing or invalid.
 */
function verifyProxy(req, res, next) {
  const { signature, ...queryParams } = req.query;

  // ── Guard: signature must be present ──────────────────────────────
  if (!signature) {
    console.warn('[verifyProxy] Request rejected — missing signature');
    return res.status(401).json({ error: 'Unauthorized: missing signature' });
  }

  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    console.error('[verifyProxy] SHOPIFY_API_SECRET is not configured');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  // ── Build the message string exactly as Shopify does ──────────────
  const sortedKeys = Object.keys(queryParams).sort();
  const message = sortedKeys
    .map((key) => {
      const value = queryParams[key];
      // Array values are joined with commas (e.g., ?ids=1&ids=2 → ids=1,2)
      return `${key}=${Array.isArray(value) ? value.join(',') : value}`;
    })
    .join('');

  // ── Compute HMAC-SHA256 and compare ───────────────────────────────
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  if (computedSignature !== signature) {
    console.warn('[verifyProxy] Request rejected — invalid signature');
    return res.status(401).json({ error: 'Unauthorized: invalid signature' });
  }

  // Signature is valid — continue to the route handler
  next();
}

module.exports = verifyProxy;
