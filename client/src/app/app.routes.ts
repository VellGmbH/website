import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import type { AdminPages } from './admin/pages/admin-pages';

// Routen, alle mit Lazy Loading damit der Admin Code nicht bei jedem mitgeladen wird
// an den Titel wird automatisch der Name drangehängt (site-title.strategy.ts)
const contentPage = () => import('./shared/page-text').then((m) => m.ContentPage);

export const routes: Routes = [
  // Textseiten, der Text kommt aus der Datenbank
  { path: '', data: { slug: 'about' }, loadComponent: contentPage },
  { path: 'impressum', title: 'Impressum', data: { slug: 'impressum' }, loadComponent: contentPage },
  { path: 'datenschutz', title: 'Datenschutz', data: { slug: 'datenschutz' }, loadComponent: contentPage },
  {
    path: 'projekte',
    title: 'Projekte',
    loadComponent: () => import('./pages/projects/projects').then((m) => m.Projects),
  },
  {
    path: 'projekte/:id',
    title: 'Projekt',
    loadComponent: () => import('./pages/project-detail/project-detail').then((m) => m.ProjectDetail),
  },
  {
    path: 'kontakt',
    title: 'Kontakt',
    loadComponent: () => import('./pages/contact/contact').then((m) => m.Contact),
  },
  {
    path: 'admin/login',
    title: 'Login',
    loadComponent: () => import('./admin/login/login').then((m) => m.Login),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./admin/admin-shell/admin-shell').then((m) => m.AdminShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'nachrichten' },
      {
        path: 'nachrichten',
        title: 'Admin – Nachrichten',
        loadComponent: () => import('./admin/messages/messages').then((m) => m.Messages),
      },
      {
        path: 'seiten',
        title: 'Admin – Seiten',
        loadComponent: () => import('./admin/pages/admin-pages').then((m) => m.AdminPages),
        // nachfragen wenn noch was nicht gespeichert ist
        canDeactivate: [(page: AdminPages) => page.canLeave()],
      },
      {
        path: 'projekte',
        title: 'Admin – Projekte',
        loadComponent: () => import('./admin/admin-projects/admin-projects').then((m) => m.AdminProjects),
      },
      {
        path: 'profil',
        title: 'Admin – Profil',
        loadComponent: () => import('./admin/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'konto',
        title: 'Admin – Konto',
        loadComponent: () => import('./admin/account/account').then((m) => m.Account),
      },
    ],
  },
  {
    path: '**',
    title: 'Seite nicht gefunden',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
