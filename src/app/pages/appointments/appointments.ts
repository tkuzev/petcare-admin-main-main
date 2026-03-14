import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AppointmentsService, Appointment, AppointmentStatus, AppointmentCreate } from '../../data/appointments.service';
import { StaffService } from '../../data/staff.service';
import {
  ApprovalDialog,
  AppointmentRequest,
} from '../../shared/approval-dialog/approval-dialog';
import { AddAppointmentDialog } from '../../shared/add-appointment-dialog/add-appointment-dialog';
import { Dialog } from '@angular/cdk/dialog';

type Tab = AppointmentStatus;

type ActionId = 'review' | 'cancel' | 'complete' | 'view';

type AppointmentVm = {
  id: string;
  title: string;
  meta: string;
  statusText: string;
  badgeClass: string;
  actions: { id: ActionId; label: string; primary?: boolean }[];
  raw: Appointment;
};

@Component({
  selector: 'app-appointments',
  templateUrl: './appointments.html',
  styleUrl: './appointments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ApprovalDialog],
})
export class Appointments {
  private readonly dialog = inject(Dialog);
  private readonly staff = inject(StaffService);
  private readonly svc = inject(AppointmentsService);
  private readonly appts = inject(AppointmentsService);

  readonly activeTab = signal<Tab>('PENDING');

  readonly counts = computed(() => this.svc.counts());

  private readonly list = computed(() =>
    this.svc.all().filter(x => x.status === this.activeTab()),
  );

  readonly vms = computed<AppointmentVm[]>(() =>
    this.list().map(a => this.toVm(a)),
  );

  readonly dialogOpen = signal(false);
  readonly selectedRequest = signal<AppointmentRequest | null>(null);

  private readonly weekdayFmt = new Intl.DateTimeFormat('bg-BG', { weekday: 'long' });
  private readonly timeFmt = new Intl.DateTimeFormat('bg-BG', { hour: '2-digit', minute: '2-digit' });

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  // ---------- View model mapping ----------
  private toVm(a: Appointment): AppointmentVm {
    const title = this.titleFor(a);
    const meta = this.metaFor(a);
    const statusText = this.statusText(a.status);
    const badgeClass = this.badgeClass(a.status);
    const actions = this.actionsFor(a.status);

    return {
      id: a.id,
      title,
      meta,
      statusText,
      badgeClass,
      actions,
      raw: a,
    };
  }

  private titleFor(a: Appointment): string {
    // Pet · (PetName) · Service
    const parts: string[] = [a.petType];
    if (a.petName) parts.push(a.petName);
    parts.push(a.service);
    return parts.join(' · ');
  }

  private metaFor(a: Appointment): string {
    const day = this.weekdayFmt.format(new Date(a.startIso));
    const time = this.timeFmt.format(new Date(a.startIso));
    const parts = [`${day} · ${time}`];
    const staffName = this.staff.nameById(a.staffId);
    if (staffName) parts.push(staffName);
    if (a.ownerName) parts.push(a.ownerName);
    return parts.join(' · ');
  }

  private statusText(status: AppointmentStatus): string {
    switch (status) {
      case 'PENDING': return 'Pending';
      case 'CONFIRMED': return 'Confirmed';
      case 'COMPLETED': return 'Completed';
      case 'CANCELLED': return 'Cancelled';
    }
  }

  private badgeClass(status: AppointmentStatus): string {
    switch (status) {
      case 'CONFIRMED': return 'badge badge--ok';
      case 'COMPLETED': return 'badge badge--info';
      default: return 'badge';
    }
  }

  private actionsFor(status: AppointmentStatus): { id: ActionId; label: string; primary?: boolean }[] {
    switch (status) {
      case 'PENDING':
        return [{ id: 'review', label: 'Review', primary: true }];
      case 'CONFIRMED':
        return [
          { id: 'cancel', label: 'Cancel' },
          { id: 'complete', label: 'Mark completed', primary: true },
        ];
      default:
        return [{ id: 'view', label: 'View' }];
    }
  }

  // ---------- Actions ----------
  onAction(actionId: ActionId, vm: AppointmentVm): void {
    const a = vm.raw;

    switch (actionId) {
      case 'review': {
        const req: AppointmentRequest = {
          id: a.id,
          petType: a.petType,
          service: a.service,
          dayLabel: this.weekdayFmt.format(new Date(a.startIso)),
          timeLabel: this.timeFmt.format(new Date(a.startIso)),
          status: a.status,
          ownerName: a.ownerName,
          notes: a.notes,
          staffName: this.staff.nameById(a.staffId),
        };
        this.selectedRequest.set(req);
        this.dialogOpen.set(true);
        return;
      }
      case 'cancel':
        this.svc.cancelConfirmed(a.id);
        return;

      case 'complete':
        this.svc.markCompleted(a.id);
        return;

      case 'view':
        // placeholder: по-късно ще отваря details drawer/page
        return;
    }
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.selectedRequest.set(null);
  }

  approve(id: string): void {
    this.svc.approve(id);
    this.closeDialog();
    this.activeTab.set('CONFIRMED');
  }

  decline(id: string): void {
    this.svc.decline(id);
    this.closeDialog();
    this.activeTab.set('CANCELLED');
  }

    openAdd(): void {
      const ref = this.dialog.open<AppointmentCreate | null>(AddAppointmentDialog, {
        hasBackdrop: true,
        disableClose: false, // ESC/backdrop close
        panelClass: 'pc-dialog-panel',
      });
  
      ref.closed.subscribe(result => {
        if (!result) return;
        this.appts.create(result);
      });
    }
}
