import { Routes } from '@angular/router';
import { authGuard } from './data/auth.guard';
import { guestGuard } from './data/guest.guard';
import { Layout } from './layout/layout';
import { LoginPage } from './pages/auth/login/login';
import { AcceptInvitePage } from './pages/auth/accept-invite/accept-invite';

export const routes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    component: LoginPage,
    title: 'Login',
  },
  {
    path: 'accept-invite',
    canMatch: [guestGuard],
    component: AcceptInvitePage,
    title: 'Accept invitation',
  },
  {
    path: '',
    component: Layout,
    canMatch: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'appointments',
        title: 'Appointments',
        loadComponent: () =>
          import('./pages/appointments/appointments').then((m) => m.Appointments),
      },
      {
        path: 'services',
        title: 'Services',
        loadComponent: () =>
          import('./pages/services/services').then((m) => m.Services),
      },
      {
        path: 'staff',
        title: 'Staff',
        loadComponent: () =>
          import('./pages/staff/staff').then((m) => m.Staff),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];