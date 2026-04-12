import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

export type StaffRole = 'Vet' | 'Groomer' | 'Reception' | 'Manager' | 'Admin';

export type StaffMember = {
  id: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  roles: StaffRole[];
  roleLabel: string;
  active: boolean;
  userId?: string;
  email?: string;
};

export type StaffUpsertPayload = Omit<StaffMember, 'id' | 'name' | 'roleLabel'>;

type StaffApiResponse = {
  id: string;
  userId: number;
  name?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  email: string;
  role?: string | null;
  roles?: string[] | null;
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

  addMember(payload: StaffUpsertPayload): void {
    const name = this.buildStaffName(payload.firstName, payload.middleName, payload.lastName);
    const roleLabel = this.formatRoleLabel(payload.roles);
    const tempMember: StaffMember = {
      id: crypto.randomUUID(),
      ...payload,
      name,
      roleLabel,
    };

    this._staff.update(list => [tempMember, ...list]);
    console.warn('Staff add is frontend-only for now. Use invitation flow for real backend persistence.');
  }

  updateMember(id: string, patch: Partial<StaffUpsertPayload>): void {
    this._staff.update(list =>
      list.map(item => {
        if (item.id !== id) {
          return item;
        }

        const roles = patch.roles ?? item.roles;
        const firstName = patch.firstName ?? item.firstName;
        const middleName = patch.middleName ?? item.middleName;
        const lastName = patch.lastName ?? item.lastName;

        return {
          ...item,
          ...patch,
          firstName,
          middleName,
          lastName,
          roles,
          name: this.buildStaffName(firstName, middleName, lastName, item.name),
          roleLabel: this.formatRoleLabel(roles),
        };
      }),
    );
    console.warn('Staff update is frontend-only for now. Backend endpoint is not implemented yet.');
  }

  nameById(id: string): string | undefined {
    return this.staff().find(item => item.id === id)?.name;
  }

  isBookable(member: StaffMember): boolean {
    return member.roles.includes('Vet') || member.roles.includes('Groomer');
  }

  readonly bookableStaff = computed(() => this.staff().filter(member => member.active && this.isBookable(member)));

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

    return this.bookableStaff().find(item => item.userId === userId)?.id ?? null;
  });

  private mapFromApi(item: StaffApiResponse): StaffMember {
    const roles = this.mapRoles(item);
    const firstName = item.firstName?.trim() || undefined;
    const middleName = item.middleName?.trim() || undefined;
    const lastName = item.lastName?.trim() || undefined;

    return {
      id: item.id,
      userId: String(item.userId),
      name: this.buildStaffName(firstName, middleName, lastName, item.name ?? undefined),
      firstName,
      middleName,
      lastName,
      email: item.email,
      roles,
      roleLabel: this.formatRoleLabel(roles),
      active: item.active,
    };
  }

  private mapRoles(item: StaffApiResponse): StaffRole[] {
    const rawRoles = item.roles?.length ? item.roles : [item.role];
    const seen = new Set<StaffRole>();

    for (const rawRole of rawRoles) {
      switch (String(rawRole ?? '').trim().toLowerCase()) {
        case 'company_admin':
        case 'admin':
          seen.add('Admin');
          break;
        case 'manager':
          seen.add('Manager');
          break;
        case 'employee':
        case 'vet':
        case 'veterinarian':
          seen.add('Vet');
          break;
        case 'groomer':
          seen.add('Groomer');
          break;
        case 'reception':
        case 'receptionist':
          seen.add('Reception');
          break;
      }
    }

    return Array.from(seen);
  }

  private buildStaffName(
    firstName?: string,
    middleName?: string,
    lastName?: string,
    fallbackName?: string,
  ): string {
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
    return fullName || fallbackName?.trim() || 'Unknown member';
  }

  private formatRoleLabel(roles: StaffRole[]): string {
    return roles.join(', ');
  }
}
