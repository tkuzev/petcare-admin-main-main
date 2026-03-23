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

type UserRole = 'COMPANY_ADMIN' | 'MANAGER' | 'EMPLOYEE';

type InvitationValidationResponse = {
  valid: boolean;
  email: string;
  companyName: string;
  role: string;
};

type RegisterFromInviteRequest = {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  phone?: string;
};

export type UpdateProfileRequest = {
  email: string;
  name: string;
  phone?: string;
  pictureUrl?: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _token = signal<string | null>(localStorage.getItem('access_token'));
  private readonly _user = signal<AuthUser | null>(this.readUser());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthed = computed(() => !!this._token() && !!this._user());

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>('/api/public/auth/login', { email, password }),
    );

    localStorage.setItem('access_token', res.accessToken);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    localStorage.setItem('X-Company-Id', res.company.companyId); // Assuming company_id is the same as user id, adjust if needed
    this._token.set(res.accessToken);
    this._user.set(res.user);
  }

  validateInvitation(token: string) {
    return this.http.get<InvitationValidationResponse>(
      `/api/public/invitations/validate?token=${encodeURIComponent(token)}`,
    );
  }

  async registerFromInvite(payload: RegisterFromInviteRequest): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>('/api/public/auth/register-from-invite', payload),
    );

    localStorage.setItem('access_token', res.accessToken);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    this._token.set(res.accessToken);
    this._user.set(res.user);
  }

  async updateProfile(payload: UpdateProfileRequest): Promise<void> {
    const updatedUser = await firstValueFrom(
      this.http.patch<AuthUser>('/api/users/me', payload),
    );

    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
    this._user.set(updatedUser);
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    this._token.set(null);
    this._user.set(null);
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
}