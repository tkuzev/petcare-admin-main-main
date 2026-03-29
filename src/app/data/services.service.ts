import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type ServiceItem = {
  id: string;
  name: string;
  /** Duration in minutes. */
  durationMin: number;
  price: number;
  active: boolean;
};

type ServiceApiResponse = {
  id: number;
  name: string;
  durationMin: number;
  price: number;
  active: boolean;
};

type UpsertServiceRequest = {
  name: string;
  durationMin: number;
  price: number;
  active: boolean;
};

@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly http = inject(HttpClient);
  private readonly _services = signal<ServiceItem[]>([]);

  readonly services = this._services.asReadonly();
  readonly activeCount = computed(() => this.services().filter(service => service.active).length);

  loadAll(): void {
    this.http.get<ServiceApiResponse[]>('/api/company/services').subscribe({
      next: items => {
        this._services.set(items.map(item => this.mapFromApi(item)));
      },
      error: error => {
        console.error('Failed to load services', error);
      },
    });
  }

  addService(payload: Omit<ServiceItem, 'id'>): void {
    const request = this.toRequest(payload);

    this.http.post<ServiceApiResponse>('/api/company/services', request).subscribe({
      next: created => {
        this._services.update(list => [this.mapFromApi(created), ...list]);
      },
      error: error => {
        console.error('Failed to create service', error);
      },
    });
  }

  updateService(id: string, patch: Partial<Omit<ServiceItem, 'id'>>): void {
    const current = this._services().find(item => item.id === id);
    if (!current) {
      return;
    }

    const request = this.toRequest({ ...current, ...patch });

    this.http.put<ServiceApiResponse>(`/api/company/services/${id}`, request).subscribe({
      next: updated => {
        const mapped = this.mapFromApi(updated);
        this._services.update(list => list.map(item => (item.id === id ? mapped : item)));
      },
      error: error => {
        console.error('Failed to update service', error);
      },
    });
  }

  private mapFromApi(item: ServiceApiResponse): ServiceItem {
    return {
      id: String(item.id),
      name: item.name,
      durationMin: item.durationMin,
      price: item.price,
      active: item.active,
    };
  }

  private toRequest(payload: Omit<ServiceItem, 'id'>): UpsertServiceRequest {
    return {
      name: payload.name.trim(),
      durationMin: payload.durationMin,
      price: payload.price,
      active: payload.active,
    };
  }
}
