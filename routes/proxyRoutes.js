/**
 * App Proxy Route Handlers
 *
 * These routes are mounted behind the HMAC verification middleware, so by the
 * time a request reaches here we know it originated from Shopify.
 *
 * Two response formats are supported:
 *   1. HTML (default) — Shopify renders this Liquid-compatible markup inline
 *      on the storefront page. Used when the snippet includes the section
 *      via {% render %} or a direct AJAX innerHTML swap.
 *   2. JSON — For AJAX / fetch()-based integrations where the frontend JS
 *      handles rendering.
 *
 * Shopify App Proxy supports returning content with these content types:
 *   - application/liquid  → Shopify processes Liquid tags before serving
 *   - application/json    → Passed through as-is
 */

const express = require('express');
const { getRecommendations, getCacheStats } = require('../services/recommendationService');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /proxy/recommendations
// Returns HTML (application/liquid) for direct rendering on the storefront.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/recommendations', async (req, res) => {

  try {
    const customerId = req.query.logged_in_customer_id;
    const productId = req.query.product_id || null;

    // ── Customer must be logged in ────────────────────────────────────
    if (!customerId) {
      res.set('Content-Type', 'application/liquid');
      return res.status(200).send(`
        <div class="rec-proxy-notice" style="text-align:center;padding:2rem;">
          <p style="color:#666;">Please <a href="/account/login">sign in</a> to see personalised recommendations.</p>
        </div>
      `);
    }

    const data = await getRecommendations(customerId, productId);

    // ── Build Liquid-compatible HTML ──────────────────────────────────
    const heading = productId
      ? 'You May Also Like'
      : 'Recommended For You';

    const productCards = data.recommendations
      .map((product) => {
        const saleBadge = product.compare_at_price
          ? `<span class="rec-badge rec-badge--sale">Sale</span>`
          : '';

        const stars = '★'.repeat(Math.round(product.rating)) + '☆'.repeat(5 - Math.round(product.rating));

        return `
          <div class="rec-card">
            ${saleBadge}
            <div class="rec-card__image-wrapper">
              <img
                src="${product.image}"
                alt="${product.title}"
                loading="lazy"
                class="rec-card__image"
              />
            </div>
            <div class="rec-card__body">
              <h3 class="rec-card__title">
                <a href="/products/${product.handle}">${product.title}</a>
              </h3>
              <p class="rec-card__description">${product.description}</p>
              <div class="rec-card__rating">
                <span class="rec-card__stars">${stars}</span>
                <span class="rec-card__reviews">(${product.reviews_count})</span>
              </div>
              <div class="rec-card__pricing">
                <span class="rec-card__price">$${product.price}</span>
                ${product.compare_at_price
            ? `<span class="rec-card__compare-price">$${product.compare_at_price}</span>`
            : ''}
              </div>
              <a href="/products/${product.handle}" class="rec-card__cta">View Product</a>
            </div>
          </div>
        `;
      })
      .join('');

    const html = `
      <style>
        /* ── Recommendation Section Styles ── */
        .rec-section {
          max-width: 1200px;
          margin: 3rem auto;
          padding: 0 1.5rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        .rec-section__header {
          text-align: center;
          margin-bottom: 2rem;
        }
        .rec-section__title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a1a2e;
          margin: 0 0 0.25rem;
          letter-spacing: -0.02em;
        }
        .rec-section__subtitle {
          font-size: 0.95rem;
          color: #888;
          margin: 0;
        }
        .rec-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1.5rem;
        }
        .rec-card {
          position: relative;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .rec-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        }
        .rec-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 2;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .rec-badge--sale {
          background: linear-gradient(135deg, #ff6b6b, #ee5a24);
          color: #fff;
        }
        .rec-card__image-wrapper {
          position: relative;
          overflow: hidden;
          background: #f5f5f5;
        }
        .rec-card__image {
          width: 100%;
          height: 240px;
          object-fit: cover;
          display: block;
          transition: transform 0.4s ease;
        }
        .rec-card:hover .rec-card__image {
          transform: scale(1.05);
        }
        .rec-card__body {
          padding: 1rem 1.25rem 1.25rem;
        }
        .rec-card__title {
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 0.35rem;
          line-height: 1.3;
        }
        .rec-card__title a {
          color: #1a1a2e;
          text-decoration: none;
        }
        .rec-card__title a:hover {
          color: #6c5ce7;
        }
        .rec-card__description {
          font-size: 0.82rem;
          color: #777;
          margin: 0 0 0.5rem;
          line-height: 1.4;
        }
        .rec-card__rating {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin-bottom: 0.5rem;
        }
        .rec-card__stars {
          color: #f9a825;
          font-size: 0.85rem;
          letter-spacing: 1px;
        }
        .rec-card__reviews {
          font-size: 0.75rem;
          color: #aaa;
        }
        .rec-card__pricing {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .rec-card__price {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1a1a2e;
        }
        .rec-card__compare-price {
          font-size: 0.85rem;
          color: #bbb;
          text-decoration: line-through;
        }
        .rec-card__cta {
          display: inline-block;
          padding: 0.55rem 1.25rem;
          background: linear-gradient(135deg, #6c5ce7, #a29bfe);
          color: #fff;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          text-decoration: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .rec-card__cta:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        /* ── Animations ── */
        @keyframes recFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rec-card {
          animation: recFadeUp 0.5s ease both;
        }
        .rec-card:nth-child(2) { animation-delay: 0.08s; }
        .rec-card:nth-child(3) { animation-delay: 0.16s; }
        .rec-card:nth-child(4) { animation-delay: 0.24s; }
        /* ── Responsive ── */
        @media (max-width: 600px) {
          .rec-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
          .rec-card__image { height: 160px; }
          .rec-section__title { font-size: 1.35rem; }
        }
      </style>

      <section class="rec-section" id="recommendations-section">
        <div class="rec-section__header">
          <h2 class="rec-section__title">${heading}</h2>
          <p class="rec-section__subtitle">
            ${productId ? 'Curated picks based on this product' : 'Hand-picked just for you'}
          </p>
        </div>
        <div class="rec-grid">
          ${productCards}
        </div>
      </section>
      <!-- served ${data.fromCache ? 'from cache' : 'fresh'} at ${data.generated_at} -->
    `;

    res.set('Content-Type', 'application/liquid');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[proxyRoutes] Error generating recommendations:', err);
    res.set('Content-Type', 'application/liquid');
    return res.status(200).send(`
      <div class="rec-proxy-notice" style="text-align:center;padding:2rem;">
        <p style="color:#999;">Unable to load recommendations right now.</p>
      </div>
    `);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /proxy/recommendations/json
// Returns JSON for fetch()-based integrations.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/recommendations/json', async (req, res) => {
  try {
    const customerId = req.query.logged_in_customer_id;
    const productId = req.query.product_id || null;

    if (!customerId) {
      return res.status(200).json({
        error: false,
        message: 'Customer not logged in',
        recommendations: [],
      });
    }

    const data = await getRecommendations(customerId, productId);
    return res.status(200).json(data);
  } catch (err) {
    console.error('[proxyRoutes] JSON endpoint error:', err);
    return res.status(500).json({ error: true, message: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /proxy/health
// Health check + cache stats (useful for monitoring).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/health', (_req, res) => {
  const stats = getCacheStats();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    cache: stats,
  });
});

module.exports = router;
