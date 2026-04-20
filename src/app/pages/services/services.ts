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
  readonly pendingDelete = signal<ServiceItem | null>(null);
  readonly selectedStaffId = signal<string | null>(null);
  readonly assignmentsSaving = signal(false);
  readonly assignmentsError = signal<string | null>(null);
  readonly serviceActionError = signal<string | null>(null);
  readonly deletingService = signal(false);
  readonly assignmentDrafts = signal<Record<string, StaffServiceAssignmentDraft>>({});

  readonly assignmentRows = computed(() => {
    const assignments = new Map(
      this.staffServicesSvc.assignmentsFor(this.selectedStaffId()).map(item => [item.serviceId, item]),
    );
    const drafts = this.assignmentDrafts();

    return this.services().map(service => {
      const assignment = assignments.get(service.id);
      const draft = drafts[service.id];
      const enabledBySalon = service.active;
      const assigned = enabledBySalon && (draft?.active ?? !!assignment);

      return {
        service,
        assigned,
        enabledBySalon,
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

    effect(() => {
      const activeServiceIds = new Set(this.services().filter(service => service.active).map(service => service.id));
      this.assignmentDrafts.update(current => {
        let changed = false;
        const next: Record<string, StaffServiceAssignmentDraft> = {};

        for (const [serviceId, draft] of Object.entries(current)) {
          if (!activeServiceIds.has(serviceId)) {
            changed = true;
            continue;
          }
          next[serviceId] = draft;
        }

        return changed ? next : current;
      });
    });
  }

  openAdd(): void {
    this.serviceActionError.set(null);
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  openEdit(item: ServiceItem): void {
    this.serviceActionError.set(null);
    this.editing.set(item);
    this.dialogOpen.set(true);
  }

  confirmDelete(item: ServiceItem): void {
    this.serviceActionError.set(null);
    this.pendingDelete.set(item);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  closeDeleteDialog(): void {
    if (this.deletingService()) {
      return;
    }
    this.pendingDelete.set(null);
  }

  async save(draft: ServiceDraft): Promise<void> {
    const editing = this.editing();
    this.serviceActionError.set(null);

    try {
      if (editing) {
        const updated = await this.servicesSvc.updateService(editing.id, draft);
        if (updated && !updated.active) {
          this.staffServicesSvc.deactivateService(updated.id);
        }
      } else {
        await this.servicesSvc.addService(draft);
      }
      this.closeDialog();
    } catch (error) {
      console.error('Failed to save service', error);
      this.serviceActionError.set('Could not save service. Please try again.');
    }
  }

  async deletePendingService(): Promise<void> {
    const item = this.pendingDelete();
    if (!item) {
      return;
    }

    this.deletingService.set(true);
    this.serviceActionError.set(null);

    try {
      await this.servicesSvc.deleteService(item.id);
      this.staffServicesSvc.removeService(item.id);
      this.assignmentDrafts.update(current => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      this.pendingDelete.set(null);
    } catch (error: any) {
      console.error('Failed to delete service', error);
      const message =
        error?.error?.message && typeof error.error.message === 'string'
          ? error.error.message
          : 'Could not delete service. Please try again.';
      this.serviceActionError.set(message);
    } finally {
      this.deletingService.set(false);
    }
  }

  selectStaff(staffId: string): void {
    this.selectedStaffId.set(staffId || null);
  }

  toggleAssignment(serviceId: string, checked: boolean): void {
    const service = this.services().find(item => item.id === serviceId);
    if (!service?.active && checked) {
      return;
    }

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
    const service = this.services().find(item => item.id === serviceId);
    if (!service?.active) {
      return;
    }

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
    const service = this.services().find(item => item.id === serviceId);
    if (!service?.active) {
      return;
    }

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
