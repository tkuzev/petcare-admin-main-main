import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'reception' | 'vet' | 'groomer';
};

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
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
    const res = await this.http
      .post<LoginResponse>('/api/auth/login', { email, password })
      .toPromise();

    if (!res) return;

    localStorage.setItem('access_token', res.accessToken);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    this._token.set(res.accessToken);
    this._user.set(res.user);
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