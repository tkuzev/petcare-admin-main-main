import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';

export type UserRole = 'OWNER' | 'COMPANY_ADMIN' | 'MANAGER' | 'VET' | 'GROOMER' | 'RECEPTION' | 'EMPLOYEE' | 'STAFF';
export type AppRole = 'admin' | 'manager' | 'reception' | 'vet' | 'groomer';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string | null;
  pictureUrl?: string | null;
  roles: AppRole[];
};

export type UpdateProfileRequest = {
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  phone?: string;
  pictureUrl?: string;
};

type UpdateProfileApiRequest = {
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  phone?: string | null;
  pictureUrl?: string | null;
};

type UpdateProfileApiResponse = {
  email?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  mobile?: string | null;
  pictureUrl?: string | null;
  role?: string | null;
  roles?: string[] | null;
  user?: {
    email?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    phoneNumber?: string | null;
    mobile?: string | null;
    pictureUrl?: string | null;
    role?: string | null;
    roles?: string[] | null;
  } | null;
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
  phone?: string | null;
  phoneNumber?: string | null;
  pictureUrl?: string | null;
};

type LoginApiUser = {
  id: number;
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  phone?: string | null;
  phoneNumber?: string | null;
  mobile?: string | null;
  pictureUrl?: string | null;
  role?: string | null;
  roles?: string[] | null;
};

type LoginApiCompany = {
  companyId: number;
  companyName: string;
  role?: UserRole | null;
  roles?: UserRole[] | null;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _token = signal<string | null>(localStorage.getItem('access_token'));
  private readonly _user = signal<AuthUser | null>(this.readUser());
  private readonly _companyRoles = signal<UserRole[]>(this.readCompanyRoles());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly companyRoles = this._companyRoles.asReadonly();
  readonly companyRole = computed<UserRole | null>(() => this._companyRoles()[0] ?? null);
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

    const request: UpdateProfileApiRequest = {
      email: payload.email.trim(),
      firstName: payload.firstName.trim() || current.firstName || '',
      middleName: payload.middleName?.trim() || null,
      lastName: payload.lastName.trim() || current.lastName || '',
      phone: payload.phone?.trim() || null,
      pictureUrl: payload.pictureUrl?.trim() || null,
    };

    const response = await firstValueFrom(
      this.http.put<UpdateProfileApiResponse>('/api/company/users/update', request),
    );

    const responseUser = response.user ?? response;
    const mergedFirstName = this.pickFirstString([
      responseUser.firstName ?? undefined,
      request.firstName,
      current.firstName,
    ]);
    const mergedMiddleName = this.pickFirstString([
      responseUser.middleName ?? undefined,
      request.middleName ?? undefined,
      current.middleName,
    ]);
    const mergedLastName = this.pickFirstString([
      responseUser.lastName ?? undefined,
      request.lastName,
      current.lastName,
    ]);
    const mergedEmail = this.pickFirstString([
      responseUser.email ?? undefined,
      request.email,
      current.email,
    ]) ?? current.email;

    const updated: AuthUser = {
      ...current,
      email: mergedEmail,
      name: this.buildDisplayName(mergedFirstName, mergedMiddleName, mergedLastName),
      firstName: mergedFirstName ?? undefined,
      middleName: mergedMiddleName ?? undefined,
      lastName: mergedLastName ?? undefined,
      phone: this.pickFirstString([
        responseUser.phone ?? undefined,
        responseUser.phoneNumber ?? undefined,
        responseUser.mobile ?? undefined,
        request.phone ?? undefined,
      ]),
      pictureUrl: this.pickFirstString([
        responseUser.pictureUrl ?? undefined,
        request.pictureUrl ?? undefined,
      ]),
      roles: this.normalizeAppRoles([
        ...(responseUser.roles ?? []),
        responseUser.role ?? undefined,
        ...current.roles,
      ]),
    };

    localStorage.setItem('auth_user', JSON.stringify(updated));
    this._user.set(updated);
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('company_user_role');
    localStorage.removeItem('company_user_roles');
    localStorage.removeItem('X-Company-Id');

    this._token.set(null);
    this._user.set(null);
    this._companyRoles.set([]);
  }

  private persistSession(res: LoginApiResponse): void {
    const user = this.mapUser(res.user, res);
    const companyRoles = this.normalizeCompanyRoles([...(res.company.roles ?? []), res.company.role ?? undefined]);

    localStorage.setItem('access_token', res.accessToken);
    if (res.refreshToken) {
      localStorage.setItem('refresh_token', res.refreshToken);
    }
    localStorage.setItem('auth_user', JSON.stringify(user));
    if (companyRoles.length > 0) {
      localStorage.setItem('company_user_role', companyRoles[0]!);
      localStorage.setItem('company_user_roles', JSON.stringify(companyRoles));
    } else {
      localStorage.removeItem('company_user_role');
      localStorage.removeItem('company_user_roles');
    }
    localStorage.setItem('X-Company-Id', String(res.company.companyId));

    this._token.set(res.accessToken);
    this._user.set(user);
    this._companyRoles.set(companyRoles);
  }

  private mapUser(user: LoginApiUser, res?: LoginApiResponse): AuthUser {
    const fullName = this.buildDisplayName(user.firstName, user.middleName ?? undefined, user.lastName);
    const phone = this.pickFirstString([
      user.phone,
      user.phoneNumber,
      user.mobile,
      res?.phone,
      res?.phoneNumber,
    ]);
    const pictureUrl = this.pickFirstString([user.pictureUrl, res?.pictureUrl]);

    return {
      id: String(user.id),
      email: user.email,
      name: fullName,
      firstName: user.firstName,
      middleName: user.middleName ?? undefined,
      lastName: user.lastName,
      phone,
      pictureUrl,
      roles: this.normalizeAppRoles([
        ...(user.roles ?? []),
        user.role ?? undefined,
        ...(res?.company.roles ?? []),
        res?.company.role ?? undefined,
      ]),
    };
  }

  private readUser(): AuthUser | null {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const phone = this.pickFirstString([
        parsed['phone'] as string | null | undefined,
        parsed['phoneNumber'] as string | null | undefined,
        parsed['mobile'] as string | null | undefined,
      ]);
      const pictureUrl = this.pickFirstString([
        parsed['pictureUrl'] as string | null | undefined,
        parsed['avatarUrl'] as string | null | undefined,
      ]);

      return {
        ...(parsed as AuthUser),
        name: this.extractStoredDisplayName(parsed),
        firstName: this.pickFirstString([parsed['firstName'] as string | null | undefined]) ?? undefined,
        middleName: this.pickFirstString([parsed['middleName'] as string | null | undefined]) ?? undefined,
        lastName: this.pickFirstString([parsed['lastName'] as string | null | undefined]) ?? undefined,
        phone,
        pictureUrl,
        roles: this.normalizeAppRoles(this.readStoredRoles(parsed)),
      };
    } catch {
      return null;
    }
  }

  private pickFirstString(values: Array<string | null | undefined>): string | null {
    for (const value of values) {
      const normalized = value?.trim();
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  hasCompanyRole(...roles: UserRole[]): boolean {
    const activeRoles = this.companyRoles();
    return roles.some(role => activeRoles.includes(role));
  }

  hasAppRole(...roles: AppRole[]): boolean {
    const activeRoles = this.user()?.roles ?? [];
    return roles.some(role => activeRoles.includes(role));
  }

  private buildDisplayName(
    firstName?: string | null,
    middleName?: string | null,
    lastName?: string | null,
  ): string {
    return [firstName, middleName, lastName]
      .map(value => value?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
  }

  private extractStoredDisplayName(parsed: Record<string, unknown>): string {
    const firstName = this.pickFirstString([parsed['firstName'] as string | null | undefined]);
    const middleName = this.pickFirstString([parsed['middleName'] as string | null | undefined]);
    const lastName = this.pickFirstString([parsed['lastName'] as string | null | undefined]);
    const fullName = this.buildDisplayName(firstName, middleName, lastName);

    return fullName || this.pickFirstString([parsed['name'] as string | null | undefined]) || '';
  }

  private readStoredRoles(parsed: Record<string, unknown>): Array<string | null | undefined> {
    const rawRoles = parsed['roles'];
    if (Array.isArray(rawRoles)) {
      return rawRoles.map(role => String(role));
    }

    return [parsed['role'] as string | null | undefined];
  }

  private normalizeCompanyRoles(values: Array<string | UserRole | null | undefined>): UserRole[] {
    const seen = new Set<UserRole>();

    for (const value of values) {
      const normalized = String(value ?? '').trim().toUpperCase();
      if (normalized === 'OWNER') {
        seen.add('OWNER');
      } else if (normalized === 'COMPANY_ADMIN') {
        seen.add('COMPANY_ADMIN');
      } else if (normalized === 'MANAGER') {
        seen.add('MANAGER');
      } else if (normalized === 'VET') {
        seen.add('VET');
      } else if (normalized === 'GROOMER') {
        seen.add('GROOMER');
      } else if (normalized === 'RECEPTION') {
        seen.add('RECEPTION');
      } else if (normalized === 'EMPLOYEE') {
        seen.add('EMPLOYEE');
      } else if (normalized === 'STAFF') {
        seen.add('STAFF');
      }
    }

    return Array.from(seen);
  }

  private normalizeAppRoles(values: Array<string | AppRole | null | undefined>): AppRole[] {
    const seen = new Set<AppRole>();

    for (const value of values) {
      const normalized = String(value ?? '').trim().toLowerCase();
      if (!normalized) {
        continue;
      }

      switch (normalized) {
        case 'owner':
        case 'company_admin':
        case 'admin':
          seen.add('admin');
          break;
        case 'manager':
          seen.add('manager');
          break;
        case 'reception':
        case 'receptionist':
          seen.add('reception');
          break;
        case 'vet':
        case 'veterinarian':
          seen.add('vet');
          break;
        case 'groomer':
          seen.add('groomer');
          break;
        case 'employee':
          seen.add('vet');
          break;
      }
    }

    return Array.from(seen);
  }

  private readCompanyRoles(): UserRole[] {
    const rawArray = localStorage.getItem('company_user_roles');
    if (rawArray) {
      try {
        const parsed = JSON.parse(rawArray) as unknown[];
        if (Array.isArray(parsed)) {
          return this.normalizeCompanyRoles(parsed.map(item => String(item)));
        }
      } catch {
        // Fall back to the legacy single-role key.
      }
    }

    const raw = localStorage.getItem('company_user_role');
    if (
      raw === 'OWNER' ||
      raw === 'COMPANY_ADMIN' ||
      raw === 'MANAGER' ||
      raw === 'VET' ||
      raw === 'GROOMER' ||
      raw === 'RECEPTION' ||
      raw === 'EMPLOYEE' ||
      raw === 'STAFF'
    ) {
      return [raw];
    }

    return [];
  }
}
