import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type InvitationRole = 'COMPANY_ADMIN' | 'OWNER' | 'MANAGER' | 'EMPLOYEE' | 'VET' | 'GROOMER' | 'RECEPTION';

export type CreateInvitationRequest = {
  email: string;
  roles?: InvitationRole[];
};

type InvitationApiResponse = {
  id: number;
  email: string;
  role?: InvitationRole | null;
  roles?: InvitationRole[] | null;
  status: string;
  expiresAt?: string | null;
  createdAt?: string | null;
};

@Injectable({ providedIn: 'root' })
export class InvitationsService {
  private readonly http = inject(HttpClient);

  async create(payload: CreateInvitationRequest): Promise<InvitationApiResponse> {
    return await firstValueFrom(
      this.http.post<InvitationApiResponse>('/api/company/invitations', {
        email: payload.email.trim(),
        roles: payload.roles,
      }),
    );
  }
}
