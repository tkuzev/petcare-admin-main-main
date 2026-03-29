import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type Appointment = {
  id: string;
  staffId: string;
  petType: string;
  petName?: string;
  ownerEmail?: string;
  service: string;
  startIso: string;
  endIso: string;
  notes?: string;
  status: AppointmentStatus;
  lastUpdatedIso?: string;
};

export type AppointmentCreate = {
  staffId: string;
  petType: string;
  petName?: string;
  ownerEmail: string;
  service: string;
  startIso: string;
  endIso: string;
  notes?: string;
  status: AppointmentStatus;
};

type AppointmentApiResponse = {
  id: number;
  staffId: string;
  petType: string;
  petName?: string | null;
  customerEmail?: string | null;
  service: string;
  startIso: string;
  endIso: string;
  notes?: string | null;
  status: AppointmentStatus;
  updatedAt?: string | null;
};

type CreateAppointmentApiRequest = {
  staffId: string;
  petType: string;
  petName?: string;
  ownerEmail: string;
  serviceId: number;
  startIso: string;
  endIso: string;
  notes?: string;
  status: AppointmentStatus;
};

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly http = inject(HttpClient);
  private readonly items = signal<Appointment[]>([]);

  readonly all = computed(() => this.items());

  loadAll(): void {
    this.http.get<AppointmentApiResponse[]>('/api/company/appointments').subscribe({
      next: data => {
        this.items.set(data.map(item => this.mapFromApi(item)));
      },
      error: error => console.error('Failed to load appointments', error),
    });
  }

  create(payload: AppointmentCreate): void {
    this.http
      .post<AppointmentApiResponse>('/api/company/appointments', this.toCreateRequest(payload))
      .subscribe({
        next: created => {
          this.items.update(list => [this.mapFromApi(created), ...list]);
        },
        error: error => {
          console.error('Failed to create appointment', error);
        },
      });
  }

  approve(id: string): void {
    this.http.patch<AppointmentApiResponse>(`/api/company/appointments/${id}/approve`, {}).subscribe({
      next: updated => {
        const mapped = this.mapFromApi(updated);
        this.items.update(list => list.map(item => (item.id === id ? mapped : item)));
      },
      error: error => {
        console.error('Failed to approve appointment', error);
      },
    });
  }

  decline(id: string): void {
    this.http.patch<AppointmentApiResponse>(`/api/company/appointments/${id}/decline`, {}).subscribe({
      next: updated => {
        const mapped = this.mapFromApi(updated);
        this.items.update(list => list.map(item => (item.id === id ? mapped : item)));
      },
      error: error => {
        console.error('Failed to decline appointment', error);
      },
    });
  }

  complete(id: string): void {
    this.http.patch<AppointmentApiResponse>(`/api/company/appointments/${id}/complete`, {}).subscribe({
      next: updated => {
        const mapped = this.mapFromApi(updated);
        this.items.update(list => list.map(item => (item.id === id ? mapped : item)));
      },
      error: error => {
        console.error('Failed to complete appointment', error);
      },
    });
  }

  private mapFromApi(item: AppointmentApiResponse): Appointment {
    return {
      id: String(item.id),
      staffId: item.staffId,
      petType: item.petType,
      petName: item.petName ?? undefined,
      ownerEmail: item.customerEmail ?? undefined,
      service: item.service,
      startIso: item.startIso,
      endIso: item.endIso,
      notes: item.notes ?? undefined,
      status: item.status,
      lastUpdatedIso: item.updatedAt ?? undefined,
    };
  }

  private toCreateRequest(payload: AppointmentCreate): CreateAppointmentApiRequest {
    return {
      staffId: payload.staffId,
      petType: payload.petType.trim(),
      petName: payload.petName?.trim() || undefined,
      ownerEmail: payload.ownerEmail.trim(),
      serviceId: Number(payload.serviceId),
      startIso: payload.startIso,
      endIso: payload.endIso,
      notes: payload.notes?.trim() || undefined,
      status: payload.status,
    };
  }
}
