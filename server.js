require('dotenv').config();

const express = require('express');
const verifyProxy = require('./middleware/verifyProxy');
const proxyRoutes = require('./routes/proxyRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

// Parse query strings (built-in)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Request logging (lightweight)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// App Proxy routes — protected by HMAC verification
app.use('/proxy', verifyProxy, proxyRoutes);

// Root — simple health check (unprotected, for uptime monitors)
app.get('/', (_req, res) => {
  res.json({
    app: 'Shopify Recommendation App Proxy',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      proxy_html: '/proxy/recommendations',
      proxy_json: '/proxy/recommendations/json',
      proxy_health: '/proxy/health',
    },
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log(`  │  🚀 Recommendation Proxy running on :${PORT}      │`);
  console.log('  │                                              │');
  console.log('  │  Endpoints:                                  │');
  console.log('  │    GET /proxy/recommendations      (HTML)    │');
  console.log('  │    GET /proxy/recommendations/json (JSON)    │');
  console.log('  │    GET /proxy/health               (Stats)   │');
  console.log('  └──────────────────────────────────────────────┘');
  console.log('');
});
