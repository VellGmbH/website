// baut die Express App zusammen
// ist extra von server.js getrennt damit die Tests eine eigene DB benutzen können
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.js';
import { projectsRouter } from './routes/projects.js';
import { contactRouter } from './routes/contact.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { contentRouter } from './routes/content.js';
import { createMailOutbox } from './mail/outbox.js';
import { seoRouter } from './routes/seo.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

export function createApp(db, { rateLimitEnabled = true, staticDir } = {}) {
  const app = express();

  app.disable('x-powered-by');
  // falls ein Proxy davor ist (z.B. nginx), die echte IP nehmen
  app.set('trust proxy', 1);

  // Sicherheits-Header mit helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          // Angular braucht das für die Styles der Komponenten
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'upgrade-insecure-requests': config.isProduction ? [] : null,
        },
      },
      // HSTS nur online, lokal ist ja kein https
      strictTransportSecurity: config.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // CORS brauch ich nicht, Client und API laufen unter der gleichen Adresse
  // normale Anfragen max 20kb, der Admin Bereich hat ein eigenes Limit (siehe admin.js)
  const smallJson = express.json({ limit: '20kb' });
  app.use((req, res, next) => (req.path.startsWith('/api/admin') ? next() : smallJson(req, res, next)));
  app.use(cookieParser());

  // API Antworten nicht cachen
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/projects', projectsRouter(db));
  app.use('/api', contentRouter(db));
  // eine Outbox für alles, server.js holt sie sich für die regelmäßigen Versuche
  const outbox = createMailOutbox(db);
  app.locals.outbox = outbox;
  app.use('/api/contact', contactRouter(db, { rateLimitEnabled, outbox }));
  app.use('/api/auth', authRouter(db, { rateLimitEnabled }));
  app.use('/api/admin', adminRouter(db));
  app.use('/api', notFoundHandler);

  // robots.txt und sitemap.xml (vor dem Angular Client, sonst landet das bei index.html)
  app.use(seoRouter(db));

  // den gebauten Angular Client auch gleich mit ausliefern
  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false }));
    // alles andere geht an index.html, den Rest macht Angular
    app.get('/{*path}', (_req, res) => res.sendFile(join(staticDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
