import { Routes } from '@angular/router';
import { Layout } from './layout/layout';

export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard),
      },
      {
        path: 'appointments',
        title: 'Appointments',
        loadComponent: () => import('./pages/appointments/appointments').then(m => m.Appointments),
      },
      {
        path: 'services',
        title: 'Services',
        loadComponent: () => import('./pages/services/services').then(m => m.Services),
      },
      {
        path: 'staff',
        title: 'Staff',
        loadComponent: () => import('./pages/staff/staff').then(m => m.Staff),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
