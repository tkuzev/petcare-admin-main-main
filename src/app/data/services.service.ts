import { Injectable, computed, signal } from '@angular/core';

export type ServiceItem = {
  id: string;
  name: string;
  /** Duration in minutes. */
  durationMin: number;
  priceBgn: number;
  active: boolean;
};

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

@Injectable({ providedIn: 'root' })
export class ServicesService {
  readonly services = this._services.asReadonly();

  readonly activeCount = computed(() => this.services().filter(s => s.active).length);

  addService(payload: Omit<ServiceItem, 'id'>): void {
    const created: ServiceItem = { ...payload, id: createId('svc') };
    this._services.update(list => [created, ...list]);
  }

  updateService(id: string, patch: Partial<Omit<ServiceItem, 'id'>>): void {
    this._services.update(list => list.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }

  loadAll(): void {
    this.http.get<ServiceItem[]>('/api/company/services').subscribe({
      next: items => this._services.set(items),
      error: error => console.error('Failed to load services', error),
    });
  }
}
