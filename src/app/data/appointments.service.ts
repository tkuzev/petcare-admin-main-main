import { Injectable, computed, signal } from '@angular/core';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type Appointment = {
  id: string;
  /** Which team member owns this slot */
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
  /** UI-friendly: used to sort “Latest activity” by last change, not by the appointment time. */
  lastUpdatedIso?: string;
};

export type AppointmentCreate = Omit<Appointment, 'id'>;

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly items = signal<Appointment[]>([
    {
      id: 'a1',
      staffId: 'm1',
      petType: 'Dog',
      petName: 'Bella',
      ownerName: 'Ivan',
      service: 'Checkup',
      startIso: '2026-03-03T14:00:00.000Z',
      endIso:   '2026-03-03T14:30:00.000Z',
      status: 'PENDING',
      notes: 'First visit',
      lastUpdatedIso: '2026-03-01T12:00:00.000Z',
    },
    {
      id: 'a2',
      staffId: 'm2',
      petType: 'Cat',
      petName: 'Milo',
      ownerName: 'Maria',
      service: 'Vaccination',
      startIso: '2026-03-04T10:30:00.000Z',
      endIso:   '2026-03-04T10:45:00.000Z',
      status: 'PENDING',
      lastUpdatedIso: '2026-03-01T12:05:00.000Z',
    },
    {
      id: 'a3',
      staffId: 'm1',
      petType: 'Dog',
      petName: 'Luna',
      ownerName: 'Georgi',
      service: 'Grooming',
      startIso: '2026-03-06T16:00:00.000Z',
      endIso:   '2026-03-06T17:00:00.000Z',
      status: 'CONFIRMED',
      lastUpdatedIso: '2026-03-01T12:10:00.000Z',
    },
    {
      id: 'a4',
      staffId: 'm2',
      petType: 'Cat',
      petName: 'Nala',
      ownerName: 'Stela',
      service: 'Dental cleaning',
      startIso: '2026-03-02T09:00:00.000Z',
      endIso:   '2026-03-02T09:45:00.000Z',
      status: 'COMPLETED',
      lastUpdatedIso: '2026-03-01T12:20:00.000Z',
    },
  ]);

  readonly all = computed(() => this.items());

  counts = computed(() => {
    const list = this.items();
    const by = (s: AppointmentStatus) => list.filter(x => x.status === s).length;
    return {
      PENDING: by('PENDING'),
      CONFIRMED: by('CONFIRMED'),
      COMPLETED: by('COMPLETED'),
      CANCELLED: by('CANCELLED'),
    };
  });

  approve(id: string): void {
    const now = new Date().toISOString();
    this.items.update(list =>
      list.map(x => (x.id === id ? { ...x, status: 'CONFIRMED', lastUpdatedIso: now } : x)),
    );
  }

  decline(id: string): void {
    const now = new Date().toISOString();
    this.items.update(list =>
      list.map(x => (x.id === id ? { ...x, status: 'CANCELLED', lastUpdatedIso: now } : x)),
    );
  }

  markCompleted(id: string): void {
    const now = new Date().toISOString();
    this.items.update(list =>
      list.map(x => (x.id === id ? { ...x, status: 'COMPLETED', lastUpdatedIso: now } : x)),
    );
  }

  cancelConfirmed(id: string): void {
    const now = new Date().toISOString();
    this.items.update(list =>
      list.map(x => (x.id === id ? { ...x, status: 'CANCELLED', lastUpdatedIso: now } : x)),
    );
  }

  create(payload: AppointmentCreate): string {
    const id = this.newId();
    const item: Appointment = { ...payload, id, lastUpdatedIso: new Date().toISOString() };

    this.items.update(list => [item, ...list]);
    return id;
  }

  private newId(): string {
    // browser-safe id; crypto.randomUUID ако го има, иначе fallback
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid ?? `a_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }
}
