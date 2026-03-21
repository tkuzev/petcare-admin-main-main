import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type DashboardChartPoint = {
  label: string;
  value: number;
};

export type DashboardSummary = {
  todayAppointments: number;
  upcomingBookings: number;
  newClients: number;
  revenueThisMonth: number;
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/public/company/dashboard/summary');
  }

  getAppointmentsChart(days = 7): Observable<DashboardChartPoint[]> {
    return this.http.get<DashboardChartPoint[]>(
      `/api/public/company/dashboard/appointments-chart?days=${days}`,
    );
  }
}
