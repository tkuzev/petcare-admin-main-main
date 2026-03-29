import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

export type StaffRole = 'Vet' | 'Groomer' | 'Reception' | 'Manager' | 'Admin';

export type StaffMember = {
  id: string;
  name: string;
  role: StaffRole;
  active: boolean;
  userId?: string;
  email?: string;
};

type StaffApiResponse = {
  id: string;
  userId: number;
  name: string;
  email: string;
  role: 'COMPANY_ADMIN' | 'MANAGER' | 'EMPLOYEE';
  active: boolean;
};

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _staff = signal<StaffMember[]>([]);
  readonly staff = this._staff.asReadonly();
  readonly activeCount = computed(() => this.staff().filter(member => member.active).length);

  loadAll(): void {
    this.http.get<StaffApiResponse[]>('/api/company/staff').subscribe({
      next: items => this._staff.set(items.map(item => this.mapFromApi(item))),
      error: error => console.error('Failed to load staff', error),
    });
  }

  addMember(payload: Omit<StaffMember, 'id'>): void {
    const tempMember: StaffMember = {
      id: crypto.randomUUID(),
      ...payload,
    };

    this._staff.update(list => [tempMember, ...list]);
    console.warn('Staff add is frontend-only for now. Use invitation flow for real backend persistence.');
  }

  updateMember(id: string, patch: Partial<Omit<StaffMember, 'id'>>): void {
    this._staff.update(list => list.map(item => (item.id === id ? { ...item, ...patch } : item)));
    console.warn('Staff update is frontend-only for now. Backend endpoint is not implemented yet.');
  }

  nameById(id: string): string | undefined {
    return this.staff().find(item => item.id === id)?.name;
  }

  readonly defaultStaffId = computed<string | null>(() => {
    const current = this.currentStaffId();
    if (current) {
      return current;
    }

    const active = this.staff().find(item => item.active);
    return active?.id ?? null;
  });

  readonly currentStaffId = computed<string | null>(() => {
    const userId = this.auth.user()?.id;
    if (!userId) {
      return null;
    }

    return this.staff().find(item => item.userId === userId)?.id ?? null;
  });

  private mapFromApi(item: StaffApiResponse): StaffMember {
    return {
      id: item.id,
      userId: String(item.userId),
      name: item.name,
      email: item.email,
      role: this.mapRole(item.role),
      active: item.active,
    };
  }

  private mapRole(role: StaffApiResponse['role']): StaffRole {
    switch (role) {
      case 'COMPANY_ADMIN':
        return 'Admin';
      case 'MANAGER':
        return 'Manager';
      case 'EMPLOYEE':
        return 'Vet';
    }
  }
}
