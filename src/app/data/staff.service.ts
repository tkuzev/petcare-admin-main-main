import { Injectable, computed, signal } from '@angular/core';

export type StaffRole = 'Vet' | 'Groomer' | 'Reception';

export type StaffMember = {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
};

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly _staff = signal<StaffMember[]>([
    { id: 'm1', name: 'Dr. Petar Ivanov', role: 'Vet', active: true },
    { id: 'm2', name: 'Maria Georgieva', role: 'Groomer', active: true },
    { id: 'm3', name: 'Nikolay Petrov', role: 'Reception', active: false },
  ]);

  readonly staff = this._staff.asReadonly();

  readonly activeCount = computed(() => this.staff().filter(x => x.active).length);

  /** Best-effort default selection: first active member, otherwise first member, otherwise null. */
  readonly defaultStaffId = computed<string | null>(() => {
    const list = this.staff();
    const active = list.find(x => x.active);
    return active?.id ?? list[0]?.id ?? null;
  });

  nameById(id: string | null | undefined): string {
    if (!id) return '';
    return this.staff().find(x => x.id === id)?.name ?? '';
  }

  addMember(payload: Omit<StaffMember, 'id'>): void {
    const created: StaffMember = { ...payload, id: createId('m') };
    this._staff.update(list => [created, ...list]);
  }

  updateMember(id: string, patch: Partial<Omit<StaffMember, 'id'>>): void {
    this._staff.update(list => list.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }
}
