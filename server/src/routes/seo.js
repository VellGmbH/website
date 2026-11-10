// robots.txt und sitemap.xml für Suchmaschinen
// robots.txt: Admin Bereich und API sollen nicht in die Suchergebnisse
// sitemap.xml: alle öffentlichen Seiten, die Projekte kommen aus der Datenbank
import { Router } from 'express';
import { config } from '../config.js';

const escapeXml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function seoRouter(db) {
  const router = Router();
  const listProjects = db.prepare('SELECT id, updated_at FROM projects ORDER BY sort_order ASC, created_at DESC');

  router.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(
      ['User-agent: *', 'Disallow: /admin/', 'Disallow: /api/', '', `Sitemap: ${config.publicUrl}/sitemap.xml`, ''].join(
        '\n',
      ),
    );
  });

  router.get('/sitemap.xml', (_req, res) => {
    // feste Seiten mit Priorität und wie oft sie sich ändern
    const urls = [
      { path: '/', changefreq: 'monthly', priority: '1.0' },
      { path: '/projekte', changefreq: 'monthly', priority: '0.8' },
      { path: '/kontakt', changefreq: 'yearly', priority: '0.5' },
      { path: '/impressum', changefreq: 'yearly', priority: '0.1' },
      { path: '/datenschutz', changefreq: 'yearly', priority: '0.1' },
    ];
    for (const p of listProjects.all()) {
      urls.push({ path: `/projekte/${p.id}`, changefreq: 'yearly', priority: '0.6', lastmod: p.updated_at.slice(0, 10) });
    }

    const body = urls
      .map(
        (u) =>
          '  <url>\n' +
          `    <loc>${escapeXml(config.publicUrl + u.path)}</loc>\n` +
          (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : '') +
          `    <changefreq>${u.changefreq}</changefreq>\n` +
          `    <priority>${u.priority}</priority>\n` +
          '  </url>',
      )
      .join('\n');

    res
      .type('application/xml')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
  });

  return router;
}
