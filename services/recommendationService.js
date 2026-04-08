/**
 * Recommendation Service
 * 
 * Business-logic layer that sits between the route handlers and the mock API.
 * Implements an in-memory caching strategy so repeated requests for the same
 * customer + context are served instantly without hitting the (simulated)
 * external API again.
 *
 * Cache strategy:
 *   - Key format:  rec_{customerId}_{productId|home}
 *   - TTL:         Configurable via CACHE_TTL env var (default 300s / 5 min)
 *   - Eviction:    Automatic on TTL expiry (handled by node-cache)
 */

const NodeCache = require('node-cache');
const { fetchRecommendations } = require('./mockApi');

// ── Initialise cache ────────────────────────────────────────────────────────
const CACHE_TTL = parseInt(process.env.CACHE_TTL, 10) || 300; // seconds
const cache = new NodeCache({
  stdTTL: CACHE_TTL,
  checkperiod: Math.floor(CACHE_TTL * 0.2), // cleanup check at 20% of TTL
  useClones: false, // performance: return references, data is read-only
});

// Log cache events in development
cache.on('set', (key) => console.log(`[cache] SET  ${key}  (TTL: ${CACHE_TTL}s)`));
cache.on('del', (key) => console.log(`[cache] DEL  ${key}`));
cache.on('expired', (key) => console.log(`[cache] EXP  ${key}`));

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get personalised recommendations for a customer.
 *
 * @param {string} customerId - Shopify customer ID
 * @param {string|null} productId - Current product ID (null = home page)
 * @returns {Promise<Object>} Recommendation payload with `fromCache` flag
 */
async function getRecommendations(customerId, productId = null) {
  const cacheKey = `rec_${customerId}_${productId || 'home'}`;

  // ── Check cache first ───────────────────────────────────────────────
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[recommendationService] Cache HIT for ${cacheKey}`);
    return { ...cached, fromCache: true };
  }

  // ── Cache miss — fetch from API ─────────────────────────────────────
  console.log(`[recommendationService] Cache MISS for ${cacheKey} — fetching from API`);
  const data = await fetchRecommendations(customerId, productId);

  // Store in cache
  cache.set(cacheKey, data);

  return { ...data, fromCache: false };
}

/**
 * Return current cache statistics (useful for debugging / health checks).
 */
function getCacheStats() {
  return {
    keys: cache.keys(),
    stats: cache.getStats(),
    ttl: CACHE_TTL,
  };
}

module.exports = { getRecommendations, getCacheStats };
