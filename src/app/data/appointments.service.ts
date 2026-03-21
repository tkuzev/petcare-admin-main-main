import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type Appointment = {
  id: string;
  staffId: string;
  petType: 'Dog' | 'Cat' | 'Other';
  petName?: string;
  ownerName?: string;
  service: string;
  startIso: string;
  endIso: string;
  clinic?: string;
  notes?: string;
  status: AppointmentStatus;
  lastUpdatedIso?: string;
};

export type AppointmentCreate = Omit<Appointment, 'id'>;

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly http = inject(HttpClient);
  private readonly items = signal<Appointment[]>([]);

  readonly all = computed(() => this.items());

  loadAll(): Appointment[] {
    this.http.get<Appointment[]>('/api/company/appointments').subscribe({
      next: data => this.items.set(data),
      error: error => console.error('Failed to load appointments', error),
    });
    return this.items();
  }

  create(payload: AppointmentCreate): void {
    this.http.post<Appointment>('/api/company/appointments', payload).subscribe({
      next: created => {
        this.items.update(list => [created, ...list]);
      },
      error: error => {
        console.error('Failed to create appointment', error);
      },
    });
  }

  approve(id: string): void {
    this.http.patch<Appointment>(`/api/company/appointments/${id}/approve`, {}).subscribe({
      next: updated => {
        this.items.update(list => list.map(item => (item.id === id ? updated : item)));
      },
      error: error => {
        console.error('Failed to approve appointment', error);
      },
    });
  }

  decline(id: string): void {
    this.http.patch<Appointment>(`/api/company/appointments/${id}/decline`, {}).subscribe({
      next: updated => {
        this.items.update(list => list.map(item => (item.id === id ? updated : item)));
      },
      error: error => {
        console.error('Failed to decline appointment', error);
      },
    });
  }
}
