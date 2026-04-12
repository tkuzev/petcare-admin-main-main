import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type Appointment = {
  id: string;
  staffId: string;
  serviceAssignmentId?: string;
  serviceId?: string;
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
  serviceAssignmentId?: string;
  petType: string;
  petName?: string;
  ownerEmail: string;
  serviceId?: string;
  customServiceName?: string;
  serviceName: string;
  startIso: string;
  endIso: string;
  notes?: string;
  status: AppointmentStatus;
};

type AppointmentApiStatus =
  | AppointmentStatus
  | 'APPROVED'
  | 'DECLINED'
  | 'approved'
  | 'declined'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

type AppointmentApiResponse = {
  id: number;
  staffId: string;
  serviceAssignmentId?: number | null;
  serviceId?: number | null;
  petType: string;
  petName?: string | null;
  customerEmail?: string | null;
  ownerEmail?: string | null;
  service?: string | null;
  serviceName?: string | null;
  startIso?: string | null;
  startAt?: string | null;
  endIso?: string | null;
  endAt?: string | null;
  notes?: string | null;
  status: AppointmentApiStatus;
  updatedAt?: string | null;
  lastUpdatedIso?: string | null;
};

type AppointmentApiListResponse =
  | AppointmentApiResponse[]
  | {
      data?: AppointmentApiResponse[] | null;
      items?: AppointmentApiResponse[] | null;
      content?: AppointmentApiResponse[] | null;
    };

type CreateAppointmentApiRequest = {
  staffId: string;
  serviceAssignmentId?: number;
  petType: string;
  petName?: string;
  ownerEmail: string;
  serviceId?: number;
  customServiceName?: string;
  startIso: string;
  endIso: string;
  notes?: string;
  status: AppointmentStatus;
};

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private static readonly STORAGE_KEY = 'pc_appointments_cache_v1';

  private readonly http = inject(HttpClient);
  private readonly items = signal<Appointment[]>(this.readCache());
  private loadRequestSeq = 0;

  readonly all = computed(() => this.items());

  fetchAll(staffId?: string | null): Observable<Appointment[]> {
    const params = staffId ? { staffId } : undefined;

    return this.http
      .get<AppointmentApiListResponse>('/api/company/appointments', { params })
      .pipe(map(data => this.extractItems(data).map(item => this.mapFromApi(item))));
  }

  loadAll(staffId?: string | null): void {
    const requestSeq = ++this.loadRequestSeq;

    this.fetchAll(staffId).subscribe({
      next: data => {
        if (requestSeq !== this.loadRequestSeq) {
          return;
        }
        this.items.set(data);
        this.writeCache(data);
      },
      error: error => {
        if (requestSeq !== this.loadRequestSeq) {
          return;
        }
        console.error('Failed to load appointments', error);
      },
    });
  }

  create(payload: AppointmentCreate): void {
    this.http
      .post<AppointmentApiResponse>('/api/company/appointments', this.toCreateRequest(payload))
      .subscribe({
        next: created => {
          this.items.update(list => {
            const next = [this.mapFromApi(created), ...list];
            this.writeCache(next);
            return next;
          });
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
        this.items.update(list => {
          const next = list.map(item => (item.id === id ? mapped : item));
          this.writeCache(next);
          return next;
        });
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
        this.items.update(list => {
          const next = list.map(item => (item.id === id ? mapped : item));
          this.writeCache(next);
          return next;
        });
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
        this.items.update(list => {
          const next = list.map(item => (item.id === id ? mapped : item));
          this.writeCache(next);
          return next;
        });
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
      serviceAssignmentId: item.serviceAssignmentId != null ? String(item.serviceAssignmentId) : undefined,
      serviceId: item.serviceId != null ? String(item.serviceId) : undefined,
      petType: item.petType,
      petName: item.petName ?? undefined,
      ownerEmail: item.customerEmail ?? item.ownerEmail ?? undefined,
      service: item.service ?? item.serviceName ?? 'Appointment',
      startIso: item.startIso ?? item.startAt ?? '',
      endIso: item.endIso ?? item.endAt ?? item.startIso ?? item.startAt ?? '',
      notes: item.notes ?? undefined,
      status: this.normalizeStatus(item.status),
      lastUpdatedIso: item.updatedAt ?? item.lastUpdatedIso ?? undefined,
    };
  }

  private extractItems(data: AppointmentApiListResponse): AppointmentApiResponse[] {
    if (Array.isArray(data)) {
      return data;
    }

    return data.data ?? data.items ?? data.content ?? [];
  }

  private normalizeStatus(status: AppointmentApiStatus): AppointmentStatus {
    switch (status) {
      case 'APPROVED':
      case 'approved':
        return 'CONFIRMED';
      case 'DECLINED':
      case 'declined':
        return 'CANCELLED';
      case 'pending':
        return 'PENDING';
      case 'confirmed':
        return 'CONFIRMED';
      case 'completed':
        return 'COMPLETED';
      case 'cancelled':
        return 'CANCELLED';
      default:
        return status;
    }
  }

  private readCache(): Appointment[] {
    const raw = localStorage.getItem(AppointmentsService.STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as Appointment[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeCache(items: Appointment[]): void {
    localStorage.setItem(AppointmentsService.STORAGE_KEY, JSON.stringify(items));
  }

  private toCreateRequest(payload: AppointmentCreate): CreateAppointmentApiRequest {
    return {
      staffId: payload.staffId,
      serviceAssignmentId: payload.serviceAssignmentId ? Number(payload.serviceAssignmentId) : undefined,
      petType: payload.petType.trim(),
      petName: payload.petName?.trim() || undefined,
      ownerEmail: payload.ownerEmail.trim(),
      serviceId: payload.serviceId ? Number(payload.serviceId) : undefined,
      customServiceName: payload.customServiceName?.trim() || undefined,
      startIso: payload.startIso,
      endIso: payload.endIso,
      notes: payload.notes?.trim() || undefined,
      status: payload.status,
    };
  }
}
