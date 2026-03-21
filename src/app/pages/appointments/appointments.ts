import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';

import {
  AppointmentsService,
  Appointment,
  AppointmentCreate,
  AppointmentStatus,
} from '../../data/appointments.service';
import { StaffService } from '../../data/staff.service';
import {
  ApprovalDialog,
  AppointmentRequest,
} from '../../shared/approval-dialog/approval-dialog';
import { AddAppointmentDialog } from '../../shared/add-appointment-dialog/add-appointment-dialog';

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
  private appointments: Appointment[] = [];

  readonly activeTab = signal<Tab>('PENDING');

  private readonly list = computed(() =>
    this.svc.all().filter(item => item.status === this.activeTab()),
  );

  readonly vms = computed<AppointmentVm[]>(() =>
    this.list().map(item => this.toVm(item)),
  );

  constructor() {
    this.appointments = this.svc.loadAll();
  }

  readonly dialogOpen = signal(false);
  readonly selectedRequest = signal<AppointmentRequest | null>(null);

  private readonly weekdayFmt = new Intl.DateTimeFormat('bg-BG', { weekday: 'long' });
  private readonly timeFmt = new Intl.DateTimeFormat('bg-BG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  private toVm(appointment: Appointment): AppointmentVm {
    return {
      id: appointment.id,
      title: this.titleFor(appointment),
      meta: this.metaFor(appointment),
      statusText: this.statusText(appointment.status),
      badgeClass: this.badgeClass(appointment.status),
      actions: this.actionsFor(appointment.status),
      raw: appointment,
    };
  }

  private titleFor(appointment: Appointment): string {
    const parts: string[] = [appointment.petType];

    if (appointment.petName) {
      parts.push(appointment.petName);
    }

    parts.push(appointment.service);

    return parts.join(' · ');
  }

  private metaFor(appointment: Appointment): string {
    const day = this.weekdayFmt.format(new Date(appointment.startIso));
    const time = this.timeFmt.format(new Date(appointment.startIso));

    const parts = [`${day} · ${time}`];
    const staffName = this.staff.nameById(appointment.staffId);

    if (staffName) {
      parts.push(staffName);
    }

    if (appointment.ownerName) {
      parts.push(appointment.ownerName);
    }

    return parts.join(' · ');
  }

  private statusText(status: AppointmentStatus): string {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'CONFIRMED':
        return 'Confirmed';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
    }
  }

  private badgeClass(status: AppointmentStatus): string {
    switch (status) {
      case 'CONFIRMED':
        return 'badge badge--ok';
      case 'COMPLETED':
        return 'badge badge--info';
      default:
        return 'badge';
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

  onAction(actionId: ActionId, vm: AppointmentVm): void {
    const appointment = vm.raw;

    switch (actionId) {
      case 'review': {
        const request: AppointmentRequest = {
          id: appointment.id,
          petType: appointment.petType,
          service: appointment.service,
          dayLabel: this.weekdayFmt.format(new Date(appointment.startIso)),
          timeLabel: this.timeFmt.format(new Date(appointment.startIso)),
          status: appointment.status,
          ownerName: appointment.ownerName,
          notes: appointment.notes,
          staffName: this.staff.nameById(appointment.staffId),
        };

        this.selectedRequest.set(request);
        this.dialogOpen.set(true);
        return;
      }

      case 'cancel':
        this.svc.decline(appointment.id);
        this.activeTab.set('CANCELLED');
        return;

      case 'complete':
        this.svc.approve(appointment.id);
        this.activeTab.set('COMPLETED');
        return;

      case 'view':
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
      disableClose: false,
      panelClass: 'pc-dialog-panel',
    });

    ref.closed.subscribe(result => {
      if (!result) {
        return;
      }

      this.svc.create(result);
      this.activeTab.set(result.status);
    });
  }
}
