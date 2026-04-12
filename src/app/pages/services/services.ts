import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../data/auth.service';
import { ServicesService, ServiceItem } from '../../data/services.service';
import { StaffService } from '../../data/staff.service';
import {
  StaffServiceAssignmentDraft,
  StaffServicesService,
} from '../../data/staff-services.service';
import { ServiceDialog, ServiceDraft } from '../../shared/service-dialog/service-dialog';

@Component({
  selector: 'app-services',
  imports: [ServiceDialog],
  templateUrl: './services.html',
  styleUrl: './services.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Services {
  private readonly servicesSvc = inject(ServicesService);
  private readonly staffSvc = inject(StaffService);
  private readonly staffServicesSvc = inject(StaffServicesService);
  private readonly auth = inject(AuthService);

  readonly services = this.servicesSvc.services;
  readonly practitioners = this.staffSvc.bookableStaff;
  readonly canManageCatalog = computed(() => this.auth.hasCompanyRole('OWNER', 'COMPANY_ADMIN', 'MANAGER'));
  readonly canManageAssignments = computed(() => this.auth.hasCompanyRole('OWNER', 'COMPANY_ADMIN'));

  readonly dialogOpen = signal(false);
  readonly editing = signal<ServiceItem | null>(null);
  readonly selectedStaffId = signal<string | null>(null);
  readonly assignmentsSaving = signal(false);
  readonly assignmentsError = signal<string | null>(null);
  readonly assignmentDrafts = signal<Record<string, StaffServiceAssignmentDraft>>({});

  readonly assignmentRows = computed(() => {
    const assignments = new Map(
      this.staffServicesSvc.assignmentsFor(this.selectedStaffId()).map(item => [item.serviceId, item]),
    );
    const drafts = this.assignmentDrafts();

    return this.services().map(service => {
      const assignment = assignments.get(service.id);
      const draft = drafts[service.id];

      return {
        service,
        assigned: draft?.active ?? !!assignment,
        durationMin: draft?.durationMin ?? assignment?.durationMin ?? null,
        price: draft?.price ?? assignment?.price ?? null,
      };
    });
  });

  constructor() {
    this.servicesSvc.loadAll();
    this.staffSvc.loadAll();

    effect(() => {
      const current = this.selectedStaffId();
      const practitioners = this.practitioners();
      if (!practitioners.length) {
        this.selectedStaffId.set(null);
        return;
      }

      if (!current || !practitioners.some(item => item.id === current)) {
        this.selectedStaffId.set(practitioners[0]!.id);
      }
    });

    effect(() => {
      const staffId = this.selectedStaffId();
      if (staffId) {
        this.staffServicesSvc.loadForStaff(staffId);
      }
    });

    effect(() => {
      const staffId = this.selectedStaffId();
      if (!staffId) {
        this.assignmentDrafts.set({});
        return;
      }

      const next: Record<string, StaffServiceAssignmentDraft> = {};
      for (const item of this.staffServicesSvc.assignmentsFor(staffId)) {
        next[item.serviceId] = {
          serviceId: item.serviceId,
          durationMin: item.durationMin ?? null,
          price: item.price ?? null,
          active: item.active,
        };
      }
      this.assignmentDrafts.set(next);
    });
  }

  openAdd(): void {
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  openEdit(item: ServiceItem): void {
    this.editing.set(item);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  save(draft: ServiceDraft): void {
    const editing = this.editing();

    if (editing) {
      this.servicesSvc.updateService(editing.id, draft);
    } else {
      this.servicesSvc.addService(draft);
    }

    this.closeDialog();
  }

  selectStaff(staffId: string): void {
    this.selectedStaffId.set(staffId || null);
  }

  toggleAssignment(serviceId: string, checked: boolean): void {
    this.assignmentDrafts.update(current => {
      const next = { ...current };
      if (!checked) {
        delete next[serviceId];
        return next;
      }

      next[serviceId] = next[serviceId] ?? {
        serviceId,
        durationMin: null,
        price: null,
        active: true,
      };
      next[serviceId] = { ...next[serviceId], active: true };
      return next;
    });
  }

  updateDuration(serviceId: string, value: string): void {
    const durationMin = value.trim() === '' ? null : Number(value);
    this.assignmentDrafts.update(current => ({
      ...current,
      [serviceId]: {
        serviceId,
        durationMin: Number.isFinite(durationMin) ? durationMin : null,
        price: current[serviceId]?.price ?? null,
        active: true,
      },
    }));
  }

  updatePrice(serviceId: string, value: string): void {
    const price = value.trim() === '' ? null : Number(value);
    this.assignmentDrafts.update(current => ({
      ...current,
      [serviceId]: {
        serviceId,
        durationMin: current[serviceId]?.durationMin ?? null,
        price: Number.isFinite(price) ? price : null,
        active: true,
      },
    }));
  }

  async saveAssignments(): Promise<void> {
    const staffId = this.selectedStaffId();
    if (!staffId) {
      return;
    }

    this.assignmentsSaving.set(true);
    this.assignmentsError.set(null);

    try {
      await this.staffServicesSvc.replaceForStaff(staffId, Object.values(this.assignmentDrafts()));
    } catch (error) {
      console.error('Failed to save staff services', error);
      this.assignmentsError.set('Could not save service assignments. Please try again.');
    } finally {
      this.assignmentsSaving.set(false);
    }
  }
}
