import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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

  async addService(payload: Omit<ServiceItem, 'id'>): Promise<ServiceItem> {
    const request = this.toRequest(payload);
    const created = await firstValueFrom(this.http.post<ServiceApiResponse>('/api/company/services', request));
    const mapped = this.mapFromApi(created);
    this._services.update(list => [mapped, ...list]);
    return mapped;
  }

  async updateService(id: string, patch: Partial<Omit<ServiceItem, 'id'>>): Promise<ServiceItem | null> {
    const current = this._services().find(item => item.id === id);
    if (!current) {
      return null;
    }

    const request = this.toRequest({ ...current, ...patch });
    const updated = await firstValueFrom(this.http.put<ServiceApiResponse>(`/api/company/services/${id}`, request));
    const mapped = this.mapFromApi(updated);
    this._services.update(list => list.map(item => (item.id === id ? mapped : item)));
    return mapped;
  }

  async deleteService(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`/api/company/services/${id}`));
    this._services.update(list => list.filter(item => item.id !== id));
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
