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
  // Good enough for a demo app; replace with backend ids later.
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly _services = signal<ServiceItem[]>([
    { id: 's1', name: 'Vet Consultation', priceBgn: 40, durationMin: 30, active: true },
    { id: 's2', name: 'Vaccinations', priceBgn: 30, durationMin: 20, active: true },
    { id: 's3', name: 'Dental Checkup', priceBgn: 45, durationMin: 40, active: false },
  ]);

  readonly services = this._services.asReadonly();

  readonly activeCount = computed(() => this.services().filter(s => s.active).length);

  addService(payload: Omit<ServiceItem, 'id'>): void {
    const created: ServiceItem = { ...payload, id: createId('svc') };
    this._services.update(list => [created, ...list]);
  }

  updateService(id: string, patch: Partial<Omit<ServiceItem, 'id'>>): void {
    this._services.update(list => list.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }
}
