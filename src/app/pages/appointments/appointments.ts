import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';

import {
  AppointmentsService,
  Appointment,
  AppointmentCreate,
  AppointmentStatus,
} from '../../data/appointments.service';
import { AuthService } from '../../data/auth.service';
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
  actions: { id: ActionId; label: string; tone?: 'primary' | 'danger' | 'default' }[];
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
  private readonly auth = inject(AuthService);

  readonly activeTab = signal<Tab>('PENDING');
  private readonly initialReloadScheduled = signal(false);

  private readonly list = computed(() =>
    this.svc.all().filter(item => item.status === this.activeTab()),
  );

  readonly vms = computed<AppointmentVm[]>(() =>
    this.list().map(item => this.toVm(item)),
  );

  readonly dialogOpen = signal(false);
  readonly selectedRequest = signal<AppointmentRequest | null>(null);

  private readonly tabs: Tab[] = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

  private readonly weekdayFmt = new Intl.DateTimeFormat('bg-BG', { weekday: 'long' });
  private readonly timeFmt = new Intl.DateTimeFormat('bg-BG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  constructor() {
    effect(() => {
      if (!this.auth.isAuthed() || this.initialReloadScheduled()) {
        return;
      }

      this.initialReloadScheduled.set(true);
      queueMicrotask(() => this.svc.loadAll());
      setTimeout(() => this.svc.loadAll(), 0);
    });

    effect(() => {
      const all = this.svc.all();
      const active = this.activeTab();

      if (all.length === 0 || all.some(item => item.status === active)) {
        return;
      }

      const firstAvailable = this.tabs.find(tab => all.some(item => item.status === tab));
      if (firstAvailable) {
        this.activeTab.set(firstAvailable);
      }
    });

    this.staff.loadAll();
    this.svc.loadAll();
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  getPendingAppointmentsCount(): number {
    return this.svc.all().filter(item => item.status === 'PENDING').length;
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

    if (appointment.ownerEmail) {
      parts.push(appointment.ownerEmail);
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

  actionClass(action: { tone?: 'primary' | 'danger' | 'default' }): string {
    switch (action.tone) {
      case 'primary':
        return 'btn btn--primary';
      case 'danger':
        return 'btn appointments__btn--danger';
      default:
        return 'btn';
    }
  }

  private actionsFor(status: AppointmentStatus): { id: ActionId; label: string; tone?: 'primary' | 'danger' | 'default' }[] {
    switch (status) {
      case 'PENDING':
        return [{ id: 'review', label: 'Review', tone: 'primary' }];
      case 'CONFIRMED':
        return [
          { id: 'complete', label: 'Mark completed', tone: 'primary' },
          { id: 'cancel', label: 'Cancel', tone: 'danger' },
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
          ownerEmail: appointment.ownerEmail,
          notes: appointment.notes,
          staffName: this.staff.nameById(appointment.staffId),
          mode: 'review',
        };

        this.selectedRequest.set(request);
        this.dialogOpen.set(true);
        return;
      }

      case 'cancel':
        this.selectedRequest.set({
          id: appointment.id,
          petType: appointment.petName ? `${appointment.petType} · ${appointment.petName}` : appointment.petType,
          service: appointment.service,
          dayLabel: this.weekdayFmt.format(new Date(appointment.startIso)),
          timeLabel: this.timeFmt.format(new Date(appointment.startIso)),
          status: appointment.status,
          ownerEmail: appointment.ownerEmail,
          notes: appointment.notes,
          staffName: this.staff.nameById(appointment.staffId),
          mode: 'cancel',
        });
        this.dialogOpen.set(true);
        return;

      case 'complete':
        this.selectedRequest.set({
          id: appointment.id,
          petType: appointment.petName ? `${appointment.petType} · ${appointment.petName}` : appointment.petType,
          service: appointment.service,
          dayLabel: this.weekdayFmt.format(new Date(appointment.startIso)),
          timeLabel: this.timeFmt.format(new Date(appointment.startIso)),
          status: appointment.status,
          ownerEmail: appointment.ownerEmail,
          notes: appointment.notes,
          staffName: this.staff.nameById(appointment.staffId),
          mode: 'complete',
        });
        this.dialogOpen.set(true);
        return;

      case 'view':
        this.openDetails(appointment);
        return;
    }
  }

  private openDetails(appointment: Appointment): void {
    const request: AppointmentRequest = {
      id: appointment.id,
      petType: appointment.petName ? `${appointment.petType} · ${appointment.petName}` : appointment.petType,
      service: appointment.service,
      dayLabel: this.weekdayFmt.format(new Date(appointment.startIso)),
      timeLabel: this.timeFmt.format(new Date(appointment.startIso)),
      status: appointment.status,
      ownerEmail: appointment.ownerEmail,
      notes: appointment.notes,
      staffName: this.staff.nameById(appointment.staffId),
      mode: 'view',
    };

    this.selectedRequest.set(request);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.selectedRequest.set(null);
  }

  approve(id: string): void {
    const mode = this.selectedRequest()?.mode;
    if (mode === 'complete') {
      this.svc.complete(id);
    } else {
      this.svc.approve(id);
    }
    this.closeDialog();
  }

  decline(id: string): void {
    this.svc.decline(id);
    this.closeDialog();
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
