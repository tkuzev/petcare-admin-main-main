import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type StaffServiceAssignment = {
  id: string;
  staffId: string;
  serviceId: string;
  serviceName: string;
  defaultDurationMin: number;
  defaultPrice: number;
  durationMin?: number | null;
  price?: number | null;
  effectiveDurationMin: number;
  effectivePrice: number;
  active: boolean;
};

export type StaffServiceAssignmentDraft = {
  serviceId: string;
  durationMin?: number | null;
  price?: number | null;
  active: boolean;
};

type StaffServiceAssignmentApi = {
  id: number;
  staffId: string;
  serviceId: number;
  serviceName: string;
  defaultDurationMin: number;
  defaultPrice: number;
  durationMin?: number | null;
  price?: number | null;
  effectiveDurationMin: number;
  effectivePrice: number;
  active: boolean;
};

@Injectable({ providedIn: 'root' })
export class StaffServicesService {
  private readonly http = inject(HttpClient);
  private readonly assignmentsByStaff = signal<Record<string, StaffServiceAssignment[]>>({});

  readonly allAssignments = this.assignmentsByStaff.asReadonly();
  readonly hasAssignments = computed(() => Object.keys(this.assignmentsByStaff()).length > 0);

  assignmentsFor(staffId: string | null | undefined): StaffServiceAssignment[] {
    if (!staffId) {
      return [];
    }

    return this.assignmentsByStaff()[staffId] ?? [];
  }

  loadForStaff(staffId: string): void {
    this.http.get<StaffServiceAssignmentApi[]>(`/api/company/staff/${staffId}/services`).subscribe({
      next: items => {
        this.assignmentsByStaff.update(current => ({
          ...current,
          [staffId]: items.map(item => this.mapFromApi(item)),
        }));
      },
      error: error => {
        console.error('Failed to load staff services', error);
      },
    });
  }

  async replaceForStaff(staffId: string, assignments: StaffServiceAssignmentDraft[]): Promise<void> {
    const response = await firstValueFrom(
      this.http.put<StaffServiceAssignmentApi[]>(`/api/company/staff/${staffId}/services`, {
        assignments: assignments.map(item => ({
          serviceId: Number(item.serviceId),
          durationMin: item.durationMin ?? null,
          price: item.price ?? null,
          active: item.active,
        })),
      }),
    );

    this.assignmentsByStaff.update(current => ({
      ...current,
      [staffId]: response.map(item => this.mapFromApi(item)),
    }));
  }

  private mapFromApi(item: StaffServiceAssignmentApi): StaffServiceAssignment {
    return {
      id: String(item.id),
      staffId: item.staffId,
      serviceId: String(item.serviceId),
      serviceName: item.serviceName,
      defaultDurationMin: item.defaultDurationMin,
      defaultPrice: item.defaultPrice,
      durationMin: item.durationMin ?? null,
      price: item.price ?? null,
      effectiveDurationMin: item.effectiveDurationMin,
      effectivePrice: item.effectivePrice,
      active: item.active,
    };
  }
}
