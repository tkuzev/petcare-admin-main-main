import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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

  getSummary(staffId?: string | null): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>('/api/company/dashboard/summary', {
      params: this.buildParams(staffId),
    });
  }

  getAppointmentsChart(days = 7, staffId?: string | null): Observable<DashboardChartPoint[]> {
    return this.http.get<DashboardChartPoint[]>(
      `/api/company/dashboard/appointments-chart?days=${days}`,
      {
        params: this.buildParams(staffId),
      },
    );
  }

  private buildParams(staffId?: string | null): HttpParams | undefined {
    if (!staffId) {
      return undefined;
    }

    return new HttpParams().set('staffId', staffId);
  }
}
