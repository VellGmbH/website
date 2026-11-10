// Standardtexte für den ersten Start, danach ändert man alles im Admin Bereich
// die Texte sind Markdown

// Name usw. für Seitenleiste, Titel und Footer
export const defaultSettings = {
  name: 'Daniel Shapiro',
  tagline: 'Informatik-Student · htw saar',
  githubUrl: 'https://github.com/VellGmbH',
};

// die Seiten, in der Reihenfolge wie im Admin Bereich
export const defaultPages = [
  {
    slug: 'about',
    label: 'Über mich (Startseite)',
    title: 'Über mich',
    content: `Hi! 👋

Ich bin Daniel und studiere Informatik an der htw saar. In meiner Freizeit und im Studium baue ich gerne kleine Programme und Webseiten – meistens, weil ich etwas selbst brauche oder einfach ausprobieren will, wie etwas funktioniert.

Auf dieser Seite sammle ich meine [Projekte](/projekte). Die Seite selbst ist auch eins davon: ein Angular-Frontend, das über eine REST-API mit einem kleinen Node.js-Server spricht. Meinen Code findest du auf [GitHub](https://github.com/VellGmbH).

Wenn du mir etwas sagen willst, schreib mir einfach über das [Kontaktformular](/kontakt).`,
  },
  {
    slug: 'projekte',
    label: 'Projekte (Einleitung)',
    title: 'Projekte',
    content: '',
  },
  {
    slug: 'kontakt',
    label: 'Kontakt (Text über dem Formular)',
    title: 'Kontakt',
    content: 'Fragen, Feedback oder einfach Hallo sagen – schreib mir hier.',
  },
  {
    slug: 'impressum',
    label: 'Impressum',
    title: 'Impressum',
    content: `## Angaben gemäß § 5 DDG

Daniel Shapiro
[Straße Hausnummer]
[PLZ Ort]

## Kontakt

E-Mail: [deine E-Mail-Adresse]

## Verantwortlich für den Inhalt

Daniel Shapiro (Anschrift wie oben)`,
  },
  {
    slug: 'datenschutz',
    label: 'Datenschutz',
    title: 'Datenschutz',
    content: `Kurz gesagt: Diese Seite sammelt so wenig wie möglich.

## Verantwortlicher

Daniel Shapiro, Kontaktdaten siehe [Impressum](/impressum).

## Kein Tracking

Es gibt keine Analyse-Tools, keine Werbung und keine eingebundenen Inhalte von Dritten (keine Google Fonts, kein CDN). Alle Dateien kommen direkt von diesem Server.

## Kontaktformular

Wenn du mir über das Formular schreibst, werden Name, E-Mail-Adresse, Betreff und Nachricht gespeichert, damit ich antworten kann (Art. 6 Abs. 1 lit. a DSGVO, deine Einwilligung). Die Daten werden verschlüsselt (AES-256) in der Datenbank abgelegt, nicht weitergegeben und spätestens nach 180 Tagen automatisch gelöscht. Du kannst deine Einwilligung jederzeit widerrufen und die Löschung verlangen – eine kurze Nachricht genügt.

## Server-Logs

Beim Aufruf der Seite verarbeitet der Server technisch notwendig deine IP-Adresse, z. B. um Spam im Kontaktformular zu begrenzen. Sie wird nur kurzzeitig im Arbeitsspeicher gehalten und nicht dauerhaft gespeichert.

## Cookies und lokaler Speicher

Für Besucher werden keine Cookies gesetzt. Nur im Admin-Bereich gibt es nach dem Login ein technisch notwendiges Sitzungs-Cookie. Ob du das helle oder dunkle Design gewählt hast, wird lokal in deinem Browser gespeichert und nie übertragen.

## Deine Rechte

Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung sowie das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.`,
  },
];

export const PAGE_SLUGS = defaultPages.map((p) => p.slug);
