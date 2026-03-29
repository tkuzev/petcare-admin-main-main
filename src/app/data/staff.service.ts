import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  userId?: string;
};

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly _staff = signal<StaffMember[]>([]);
  readonly staff = this._staff.asReadonly();

  loadAll(): void {
    this.http.get<StaffMember[]>('/api/company/staff').subscribe({
      next: items => this._staff.set(items),
      error: error => console.error('Failed to load staff', error),
    });
  }

  readonly defaultStaffId = computed<string | null>(() => {
    const current = this.currentStaffId();
    if (current) return current;

    const active = this.staff().find(item => item.active);
    return active?.id ?? null;
  });

  readonly currentStaffId = computed<string | null>(() => {
    const userId = this.auth.user()?.id;
    if (!userId) return null;

    return this.staff().find(item => item.userId === userId)?.id ?? null;
  });
}