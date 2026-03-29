import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  pictureUrl?: string | null;
  role: 'admin' | 'reception' | 'vet' | 'groomer';
};

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
  company: Company;
};

type Company = {
  companyId: string;
  companyName: string;
  userRole: UserRole;
};

export type UserRole = 'COMPANY_ADMIN' | 'MANAGER' | 'EMPLOYEE';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _token = signal<string | null>(localStorage.getItem('access_token'));
  private readonly _user = signal<AuthUser | null>(this.readUser());
  private readonly _companyRole = signal<UserRole | null>(this.readCompanyRole());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly companyRole = this._companyRole.asReadonly();
  readonly isAuthed = computed(() => !!this._token() && !!this._user());

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>('/api/public/auth/login', { email, password }),
    );

    localStorage.setItem('access_token', res.accessToken);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    localStorage.setItem('company_user_role', res.company.userRole);
    localStorage.setItem('X-Company-Id', res.company.companyId);

    this._token.set(res.accessToken);
    this._user.set(res.user);
    this._companyRole.set(res.company.userRole);
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('company_user_role');

    this._token.set(null);
    this._user.set(null);
    this._companyRole.set(null);
  }

  private readUser(): AuthUser | null {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  private readCompanyRole(): UserRole | null {
    const raw = localStorage.getItem('company_user_role');
    if (raw === 'COMPANY_ADMIN' || raw === 'MANAGER' || raw === 'EMPLOYEE') {
      return raw;
    }
    return null;
  }
}