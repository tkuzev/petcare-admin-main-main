import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { WorkingDay, WorkingDaySchedule } from './company-schedule.service';

export type StaffRole = 'Vet' | 'Groomer' | 'Reception' | 'Manager' | 'Admin';

export type StaffMember = {
  id: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  roles: StaffRole[];
  roleLabel: string;
  active: boolean;
  userId?: string;
  email?: string;
  workingStartTime?: string;
  workingEndTime?: string;
  workingDays: WorkingDay[];
  workingSchedule: WorkingDaySchedule[];
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
  phone?: string | null;
  role?: string | null;
  roles?: string[] | null;
  active: boolean;
  workingStartTime?: string | null;
  workingEndTime?: string | null;
  workingDays?: WorkingDay[] | null;
  workingSchedule?: Array<{
    day: WorkingDay;
    startTime?: string | null;
    endTime?: string | null;
  }> | null;
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
    const member = this.staff().find(item => item.id === id);
    if (!member) {
      return;
    }

    const payload = {
      email: (patch.email ?? member.email ?? '').trim(),
      firstName: (patch.firstName ?? member.firstName ?? '').trim(),
      lastName: (patch.lastName ?? member.lastName ?? '').trim(),
      phone: (patch.phone ?? member.phone ?? '').trim() || null,
      roles: this.mapRolesToApi(patch.roles ?? member.roles),
      status: (patch.active ?? member.active) ? 'ACTIVE' : 'DISABLED',
      workingStartTime: this.normalizeApiTime(patch.workingStartTime ?? member.workingStartTime),
      workingEndTime: this.normalizeApiTime(patch.workingEndTime ?? member.workingEndTime),
      workingDays: patch.workingDays?.length ? patch.workingDays : member.workingDays,
      workingSchedule: (patch.workingSchedule?.length ? patch.workingSchedule : member.workingSchedule).map(item => ({
        day: item.day,
        startTime: this.normalizeApiTime(item.startTime),
        endTime: this.normalizeApiTime(item.endTime),
      })),
    };

    this.http.put<StaffApiResponse>(`/api/company/staff/${id}`, payload).subscribe({
      next: updated => {
        this._staff.update(list => list.map(item => item.id === id ? this.mapFromApi(updated) : item));
      },
      error: error => console.error('Failed to update staff member', error),
    });
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

    const fallbackStart = this.normalizeDisplayTime(item.workingStartTime) ?? '09:00';
    const fallbackEnd = this.normalizeDisplayTime(item.workingEndTime) ?? '17:00';
    const fallbackDays = item.workingDays?.length
      ? item.workingDays
      : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] satisfies WorkingDay[];
    const workingSchedule = item.workingSchedule?.length
      ? item.workingSchedule.map(row => ({
          day: row.day,
          startTime: this.normalizeDisplayTime(row.startTime) ?? fallbackStart,
          endTime: this.normalizeDisplayTime(row.endTime) ?? fallbackEnd,
        }))
      : fallbackDays.map(day => ({
          day,
          startTime: fallbackStart,
          endTime: fallbackEnd,
        }));

    return {
      id: item.id,
      userId: String(item.userId),
      name: this.buildStaffName(firstName, middleName, lastName, item.name ?? undefined),
      firstName,
      middleName,
      lastName,
      phone: item.phone?.trim() || undefined,
      email: item.email,
      roles,
      roleLabel: this.formatRoleLabel(roles),
      active: item.active,
      workingStartTime: fallbackStart,
      workingEndTime: fallbackEnd,
      workingDays: workingSchedule.map(row => row.day),
      workingSchedule,
    };
  }

  private mapRolesToApi(roles: StaffRole[]): string[] {
    return roles.map(role => {
      switch (role) {
        case 'Admin':
          return 'COMPANY_ADMIN';
        case 'Manager':
          return 'MANAGER';
        case 'Vet':
          return 'VET';
        case 'Groomer':
          return 'GROOMER';
        case 'Reception':
          return 'RECEPTION';
      }
    });
  }

  private normalizeDisplayTime(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
  }

  private normalizeApiTime(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
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
