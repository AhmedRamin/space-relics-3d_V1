const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');

/**
 * The built client, if it exists.
 *
 * Deploying as a SINGLE web service is the simplest setup: Express answers `/api/*` and
 * also serves the static client bundle plus an SPA fallback. If the client has not been
 * built (local API-only development) this resolves to a missing folder and is skipped,
 * which keeps the two-process `npm run dev` flow working unchanged.
 */
const CLIENT_DIST = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.resolve(__dirname, '..', '..', 'client', 'dist');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // The default CSP (`img-src 'self' data:`) silently blocks the Wikimedia/Commons
      // photographs that every detail panel uses — they are served from https:// hosts.
      // Allow https images (and data:/blob: for the generated SVG cards) so the picture
      // area always renders, while keeping scripts locked to self.
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'https:'],
          fontSrc: ["'self'", 'data:'],
          workerSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          baseUri: ["'self'"],
        },
      },
    })
  );

  const origins = String(process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origins.includes('*') || origins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed`));
      },
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use('/api', apiLimiter, routes);

  // --- static client + SPA fallback (single-service deployment) ---------------
  const hasClient = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));
  if (hasClient) {
    app.use(
      express.static(CLIENT_DIST, {
        index: false,
        maxAge: '1h',
        setHeaders(res, filePath) {
          // Hashed assets may be cached hard; index.html must never be.
          if (/\.[0-9a-f]{8,}\.(js|css|woff2?|png|jpg|svg)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  } else {
    app.get('/', (req, res) =>
      res.json({ ok: true, service: 'Space Relics 3D API', docs: '/api/health', client: 'not built' })
    );
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
