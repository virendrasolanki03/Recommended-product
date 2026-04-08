/**
 * Mock Recommendation API
 * 
 * Simulates an external recommendation engine that would normally live behind
 * a separate microservice or third-party API. In production you would replace
 * this module with actual HTTP calls to your recommendation provider.
 *
 * Features:
 *   - Customer-specific recommendations (seeded by customer ID)
 *   - Context-aware results (different for home page vs. product page)
 *   - Simulated network latency to test caching effectiveness
 *   - Realistic product data with images from Shopify's placeholder CDN
 */

// ─────────────────────────────────────────────────────────────────────────────
// Product Catalog (mock)
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCT_CATALOG = [
  {
    id: 7630148436035,
    title: 'BEYOND T-SHIRT',
    description: 'Premium full-grain leather with a modern slim fit.',
    price: '3,200.00',
    compare_at_price: '3,800.00',
    image: 'https://virendrasolanki-tranning.myshopify.com/cdn/shop/files/Front_64f0a5f2-0fc0-4161-a437-b2d6f64aa5fa.jpg?v=1775488736&width=990',
    handle: 'beyond-t-shirt',
    rating: 4.8,
    reviews_count: 124,
  },
  {
    id: 7629497598019,
    title: 'Campus',
    description: 'Ultra-soft merino wool blend, perfect for layering.',
    price: '132.96',
    compare_at_price: null,
    image: 'https://virendrasolanki-tranning.myshopify.com/cdn/shop/files/13068100389_1_1487x2100_300_RGB.jpg?v=1775284042&width=990',
    handle: 'burton-campus-mens-jacket-2015',
    rating: 4.6,
    reviews_count: 87,
  },
  {
    id: 7629497925699,
    title: 'Freestyle',
    description: 'Sustainably sourced cotton, pre-shrunk and garment-dyed.',
    price: '139.95',
    compare_at_price: '169.95',
    image: 'https://virendrasolanki-tranning.myshopify.com/cdn/shop/files/10544102424_1_646x720_72_RGB.jpg?v=1775284050&width=990',
    handle: 'burton-freestyle-binding-2016',
    rating: 4.5,
    reviews_count: 213,
  },
  {
    id: 7606754312259,
    title: 'Antique Drawers',
    description: 'Stretch-woven chinos with a tailored silhouette.',
    price: '250.00',
    compare_at_price: null,
    image: 'https://virendrasolanki-tranning.myshopify.com/cdn/shop/files/babys-room_925x_029475cd-916a-4a4c-832e-6e3d014c662d.jpg?v=1772257727&width=990',
    handle: 'antique-drawers',
    rating: 4.4,
    reviews_count: 156,
  },
  {
    id: 7606754312259,
    title: 'Antique Drawers',
    description: 'Stretch-woven chinos with a tailored silhouette.',
    price: '250.00',
    compare_at_price: null,
    image: 'https://virendrasolanki-tranning.myshopify.com/cdn/shop/files/babys-room_925x_029475cd-916a-4a4c-832e-6e3d014c662d.jpg?v=1772257727&width=990',
    handle: 'antique-drawers',
    rating: 4.4,
    reviews_count: 156,
  },
  {
    id: 1006,
    title: 'Black Beanbag',
    description: 'Waxed canvas with leather trim — ready for any trip.',
    price: '69.99',
    compare_at_price: null,
    image: 'https://virendrasolanki-tranning.myshopify.com/cdn/shop/files/comfortable-living-room-cat_925x_ce93afe9-8e8d-4553-a97a-c717ae1b284a.jpg?v=1772257737&width=533',
    handle: 'black-bean-bag',
    rating: 4.7,
    reviews_count: 98,
  },
  {
    id: 1007,
    title: 'Aviator Sunglasses',
    description: 'Polarised lenses with titanium frames.',
    price: '179.99',
    compare_at_price: '219.99',
    image: 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png',
    handle: 'aviator-sunglasses',
    rating: 4.3,
    reviews_count: 67,
  },
  {
    id: 1008,
    title: 'Cashmere Scarf',
    description: 'Pure cashmere in a generous wrap size.',
    price: '119.99',
    compare_at_price: null,
    image: 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-2_large.png',
    handle: 'cashmere-scarf',
    rating: 4.6,
    reviews_count: 45,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple deterministic hash so the same customer always gets the same
 * recommendations (mimics a real ML model's consistency).
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Shuffle an array deterministically based on a seed value.
 */
function seededShuffle(array, seed) {
  const shuffled = [...array];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = ((s * 9301 + 49297) % 233280);
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch personalised recommendations from the "external" API.
 *
 * @param {string} customerId  - Shopify customer ID
 * @param {string|null} productId - Current product ID (null for home page)
 * @returns {Promise<Object>} Recommendation payload
 */
async function fetchRecommendations(customerId, productId = null) {
  // Simulate network latency (100 – 300 ms)
  const latency = 100 + Math.floor(Math.random() * 200);
  await new Promise((resolve) => setTimeout(resolve, latency));

  const seed = hashCode(String(customerId) + String(productId || 'home'));
  const shuffled = seededShuffle(PRODUCT_CATALOG, seed);

  // If we're on a product page, exclude the current product from results
  const filtered = productId
    ? shuffled.filter((p) => String(p.id) !== String(productId))
    : shuffled;

  // Return top 4 recommendations
  const recommendations = filtered.slice(0, 4);

  return {
    customer_id: customerId,
    context: productId ? 'product' : 'home',
    product_id: productId || null,
    generated_at: new Date().toISOString(),
    recommendations,
  };
}

module.exports = { fetchRecommendations };
