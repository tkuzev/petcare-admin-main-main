import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';

export type UserRole = 'COMPANY_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  pictureUrl?: string | null;
  role: 'admin' | 'reception' | 'vet' | 'groomer';
};

export type UpdateProfileRequest = {
  email: string;
  name: string;
  phone?: string;
  pictureUrl?: string;
};

export type RegisterFromInviteRequest = {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
};

export type InvitationValidationResponse = {
  valid: boolean;
  email: string;
  companyName: string;
  role: UserRole;
  expiresAt?: string;
};

type LoginApiResponse = {
  accessToken: string;
  refreshToken?: string;
  user: LoginApiUser;
  company: LoginApiCompany;
};

type LoginApiUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
};

type LoginApiCompany = {
  companyId: number;
  companyName: string;
  role: UserRole;
};

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
      this.http.post<LoginApiResponse>('/api/public/auth/login', { email, password }),
    );

    this.persistSession(res);
  }

  async registerFromInvite(payload: RegisterFromInviteRequest): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginApiResponse>('/api/public/auth/register-from-invite', payload),
    );

    this.persistSession(res);
  }

  validateInvitation(token: string): Observable<InvitationValidationResponse> {
    return this.http.get<InvitationValidationResponse>('/api/public/invitations/validate', {
      params: { token },
    });
  }

  async updateProfile(payload: UpdateProfileRequest): Promise<void> {
    const current = this._user();
    if (!current) {
      return;
    }

    const [firstName, ...rest] = payload.name.trim().split(/\s+/);
    const lastName = rest.join(' ');

    const updated: AuthUser = {
      ...current,
      email: payload.email.trim(),
      name: payload.name.trim(),
      firstName: firstName || current.firstName,
      lastName: lastName || current.lastName,
      phone: payload.phone?.trim() || null,
      pictureUrl: payload.pictureUrl?.trim() || null,
    };

    localStorage.setItem('auth_user', JSON.stringify(updated));
    this._user.set(updated);
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('company_user_role');
    localStorage.removeItem('X-Company-Id');

    this._token.set(null);
    this._user.set(null);
    this._companyRole.set(null);
  }

  private persistSession(res: LoginApiResponse): void {
    const user = this.mapUser(res.user);

    localStorage.setItem('access_token', res.accessToken);
    if (res.refreshToken) {
      localStorage.setItem('refresh_token', res.refreshToken);
    }
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('company_user_role', res.company.role);
    localStorage.setItem('X-Company-Id', String(res.company.companyId));

    this._token.set(res.accessToken);
    this._user.set(user);
    this._companyRole.set(res.company.role);
  }

  private mapUser(user: LoginApiUser): AuthUser {
    const fullName = `${user.firstName} ${user.lastName}`.trim();

    return {
      id: String(user.id),
      email: user.email,
      name: fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: null,
      pictureUrl: null,
      role: 'admin',
    };
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
