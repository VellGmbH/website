// hell/dunkel setzen bevor die Seite angezeigt wird, sonst blitzt es kurz
// eigene Datei weil Inline-Skripte durch die CSP blockiert werden
(function () {
  var theme;
  try {
    theme = localStorage.getItem('theme');
  } catch (e) {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
