# Shopify App Proxy — Personalised Product Recommendations

A secure Node.js/Express backend that integrates with Shopify's **App Proxy** to deliver personalised product recommendations to logged-in customers on the **home page** and **product page**.

---

## Table of Contents

- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Security Model](#security-model)
- [Caching Strategy](#caching-strategy)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Shopify Admin Configuration](#shopify-admin-configuration)
- [Theme Integration](#theme-integration)
- [API Endpoints](#api-endpoints)
- [Testing Locally](#testing-locally)
- [Extending to Production](#extending-to-production)

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────────┐
│  Customer's      │     │  Shopify         │     │  Express Backend         │
│  Browser         │────▶│  Storefront      │────▶│  (This Server)           │
│                  │     │  + App Proxy     │     │                          │
│  Liquid snippet  │     │  HMAC signed     │     │  ┌──────────────────┐   │
│  fetches /a/rec  │     │  request         │     │  │ HMAC Validation  │   │
│                  │     │                  │     │  └────────┬─────────┘   │
│                  │     │                  │     │           │             │
│                  │     │                  │     │  ┌────────▼─────────┐   │
│                  │◀────│◀────────────────│◀────│  │ In-Memory Cache  │   │
│                  │     │  Proxied HTML    │     │  │ (node-cache)     │   │
│  Renders cards   │     │  response        │     │  └────────┬─────────┘   │
└─────────────────┘     └─────────────────┘     │           │             │
                                                 │  ┌────────▼─────────┐   │
                                                 │  │ Mock Rec. API    │   │
                                                 │  │ (replaceable)    │   │
                                                 │  └──────────────────┘   │
                                                 └──────────────────────────┘
```

### Request Flow

1. **Customer visits** the home page or a product page on the Shopify storefront.
2. The **Liquid snippet** (embedded in the theme) makes a `fetch()` call to `/a/recommendation/recommendations`.
3. **Shopify's App Proxy** intercepts the request, appends an **HMAC signature** and the `logged_in_customer_id`, then forwards it to the Express backend.
4. The **backend verifies the HMAC** to ensure the request is genuinely from Shopify.
5. The **recommendation service** checks the in-memory cache:
   - **Cache hit** → returns the cached response instantly.
   - **Cache miss** → calls the mock recommendation API, caches the result, then responds.
6. The response (HTML with inline CSS) is sent back through the proxy and **rendered on the storefront**.

---

## How It Works

### App Proxy
Shopify's [App Proxy](https://shopify.dev/docs/apps/online-store/app-proxy) lets you expose external server endpoints under your store's domain. Instead of calling `https://your-server.com/recommendations`, customers call `/a/recommendation/recommendations` — which looks like a native store URL.

Shopify automatically:
- Adds `logged_in_customer_id` if the customer is signed in
- Signs the request with an HMAC so your server can verify authenticity
- Proxies the response back to the browser

### HMAC Verification
Every proxied request includes a `signature` query parameter. The backend:
1. Extracts all query params except `signature`
2. Sorts them alphabetically
3. Concatenates them as `key=value` pairs
4. Computes HMAC-SHA256 using the app's API secret
5. Compares the computed signature with the provided one

If they don't match, the request is rejected with **401 Unauthorized**.

---

## Security Model

| Concern | How It's Handled |
|---|---|
| **API secrets** | Stored in `.env`, never committed to Git |
| **Request authenticity** | HMAC-SHA256 verification on every request |
| **Customer identity** | `logged_in_customer_id` injected by Shopify, not the client |
| **Sensitive data** | All business logic runs server-side; frontend receives only rendered HTML |
| **No exposed endpoints** | Backend routes are behind the proxy; direct access requires valid HMAC |

### What's NOT in the frontend code:
- ❌ API keys or secrets
- ❌ Server URLs or internal endpoints
- ❌ Customer PII beyond what Shopify already exposes
- ❌ Recommendation algorithm logic

---

## Caching Strategy

| Property | Value |
|---|---|
| **Library** | [node-cache](https://github.com/node-cache/node-cache) (in-memory) |
| **TTL** | 300 seconds (5 minutes), configurable via `CACHE_TTL` env var |
| **Key format** | `rec_{customerId}_{productId\|home}` |
| **Eviction** | Automatic on TTL expiry |
| **Scope** | Per-customer, per-context (home vs. specific product) |

**Why in-memory?** For a single-server deployment, in-memory caching is the simplest and fastest option. For multi-server deployments, swap `node-cache` with Redis.

---

## Project Structure

```
recomended-product-app-proxy/
├── server.js                    # Express entry point
├── middleware/
│   └── verifyProxy.js           # HMAC signature validation
├── routes/
│   └── proxyRoutes.js           # App Proxy route handlers (HTML + JSON)
├── services/
│   ├── mockApi.js               # Mock recommendation engine
│   └── recommendationService.js # Cache layer + business logic
├── theme-snippets/
│   ├── recommendation-section.liquid          # Home page snippet
│   └── product-recommendation-section.liquid  # Product page snippet
├── .env.example                 # Environment variable template
├── .gitignore
├── package.json
└── README.md                    # ← You are here
```

---

## Setup & Installation

### Prerequisites
- **Node.js** ≥ 18
- **npm** ≥ 9
- A **Shopify Partner account** with an app created

### Steps

```bash
# 1. Clone / navigate to the project
cd recomended-product-app-proxy

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and set your SHOPIFY_API_SECRET

# 4. Start the server
npm start
# Or with auto-restart on file changes:
npm run dev
```

The server will start on `http://localhost:3000`.

---

## Shopify Admin Configuration

1. Go to your **Shopify Partners Dashboard** → **Apps** → your app.
2. Navigate to **App setup** → **App proxy**.
3. Configure:

| Field | Value |
|---|---|
| **Sub path prefix** | `apps` or `a` |
| **Sub path** | `recommendation` |
| **Proxy URL** | `https://your-server.com/proxy` |

This maps `https://your-store.myshopify.com/a/recommendation/*` → `https://your-server.com/proxy/*`.

4. **Save** and install/update the app on your development store.

> **Note:** For local development, use [ngrok](https://ngrok.com/) to expose your local server:
> ```bash
> ngrok http 3000
> ```
> Then use the ngrok HTTPS URL as your Proxy URL.

---

## Theme Integration

### Home Page

Add this to your home page template (e.g., `templates/index.liquid` or a custom section):

```liquid
{% render 'recommendation-section' %}
```

Copy `theme-snippets/recommendation-section.liquid` into your theme's `snippets/` directory.

### Product Page

Add this to your product page template (e.g., `sections/main-product.liquid`):

```liquid
{% render 'product-recommendation-section', product: product %}
```

Copy `theme-snippets/product-recommendation-section.liquid` into your theme's `snippets/` directory.

---

## API Endpoints

### `GET /proxy/recommendations`
Returns Liquid-compatible HTML (Content-Type: `application/liquid`).

| Query Parameter | Source | Description |
|---|---|---|
| `logged_in_customer_id` | Shopify (auto) | Customer ID, injected by proxy |
| `product_id` | Theme snippet | Current product ID (optional) |
| `signature` | Shopify (auto) | HMAC signature for verification |

### `GET /proxy/recommendations/json`
Returns JSON for fetch()-based integrations.

**Response format:**
```json
{
  "customer_id": "123456",
  "context": "home",
  "product_id": null,
  "generated_at": "2026-04-08T12:00:00.000Z",
  "fromCache": true,
  "recommendations": [
    {
      "id": 1001,
      "title": "Classic Leather Jacket",
      "price": "249.99",
      "image": "https://cdn.shopify.com/...",
      "handle": "classic-leather-jacket",
      "rating": 4.8,
      "reviews_count": 124
    }
  ]
}
```

### `GET /proxy/health`
Returns server health and cache statistics.

---

## Testing Locally

Since HMAC verification will reject unsigned requests, you can bypass it for local testing:

### Option 1: Generate a valid signature

```bash
# Generate a signature for testing
node -e "
  const crypto = require('crypto');
  const secret = 'test_secret_for_development';
  const params = 'logged_in_customer_id=12345';
  const sig = crypto.createHmac('sha256', secret).update(params).digest('hex');
  console.log('http://localhost:3000/proxy/recommendations?logged_in_customer_id=12345&signature=' + sig);
"
```

### Option 2: Test the root endpoint

```bash
curl http://localhost:3000/
```

---

## Extending to Production

### Replace the Mock API
In `services/mockApi.js`, replace the `fetchRecommendations` function with actual HTTP calls to your recommendation engine:

```javascript
const axios = require('axios');

async function fetchRecommendations(customerId, productId) {
  const response = await axios.get('https://your-ml-api.com/recommend', {
    params: { customer_id: customerId, product_id: productId },
    headers: { 'Authorization': `Bearer ${process.env.ML_API_KEY}` },
  });
  return response.data;
}
```

### Upgrade Caching
For multi-server deployments, replace `node-cache` with Redis:

```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

async function getRecommendations(customerId, productId) {
  const key = `rec_${customerId}_${productId || 'home'}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const data = await fetchRecommendations(customerId, productId);
  await redis.setex(key, 300, JSON.stringify(data));
  return data;
}
```

### Additional Improvements
- Add **rate limiting** (e.g., `express-rate-limit`)
- Add **structured logging** (e.g., `winston` or `pino`)
- Add **monitoring** (e.g., health check endpoint for load balancers)
- Deploy behind **HTTPS** with a reverse proxy (nginx, Cloudflare)
- Add **unit tests** with Jest or Mocha

---

## License

MIT
