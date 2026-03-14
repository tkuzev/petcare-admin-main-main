import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';

import { Calendar } from '../../shared/calendar/calendar';
import { ApprovalDialog, AppointmentRequest } from '../../shared/approval-dialog/approval-dialog';
import { AddAppointmentDialog } from '../../shared/add-appointment-dialog/add-appointment-dialog';

import { AppointmentsService, AppointmentCreate, AppointmentStatus } from '../../data/appointments.service';
import { StaffService } from '../../data/staff.service';

type RecentRow = {
  id: string;
  petName: string;
  ownerName: string;
  service: string;
  timeLabel: string;
  status: AppointmentStatus;
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, NgFor, Calendar, ApprovalDialog],
})
export class Dashboard {
  private readonly appts = inject(AppointmentsService);
  private readonly dialog = inject(Dialog);
  private readonly staffSvc = inject(StaffService);

  readonly staff = this.staffSvc.staff;

  /** Which team member’s schedule we’re looking at. */
  readonly selectedStaffId = signal<string | null>(null);

  /** Always resolves to something usable when staff exists. */
  readonly activeStaffId = computed<string | null>(() => this.selectedStaffId() ?? this.staffSvc.defaultStaffId());

  constructor() {
    // Initialize selection once staff is available.
    effect(() => {
      if (this.selectedStaffId() !== null) return;
      const def = this.staffSvc.defaultStaffId();
      if (def) this.selectedStaffId.set(def);
    });
  }

  // ===== Pending requests (PENDING) =====
  readonly pending = computed<AppointmentRequest[]>(() => {
    const fmtDay = new Intl.DateTimeFormat('bg-BG', { weekday: 'long' });
    const fmtTime = new Intl.DateTimeFormat('bg-BG', { hour: '2-digit', minute: '2-digit' });
    const staffId = this.activeStaffId();

    return this.appts
      .all()
      .filter(a => a.status === 'PENDING')
      .filter(a => (staffId ? a.staffId === staffId : true))
      .slice()
      .sort((a, b) => a.startIso.localeCompare(b.startIso))
      .map(a => ({
        id: a.id,
        petType: a.petType,
        service: a.service,
        dayLabel: fmtDay.format(new Date(a.startIso)),
        timeLabel: fmtTime.format(new Date(a.startIso)),
        ownerName: a.ownerName,
        notes: a.notes,
        status: a.status,
      }));
  });

  // ===== Recent (latest 6) =====
  readonly rows = computed<RecentRow[]>(() => {
    const fmtTime = new Intl.DateTimeFormat('bg-BG', { hour: '2-digit', minute: '2-digit' });
    const staffId = this.activeStaffId();

    return this.appts
      .all()
      .slice()
      .filter(a => (staffId ? a.staffId === staffId : true))
      .filter(a => a.status !== 'PENDING')
      .sort((a, b) => (b.lastUpdatedIso ?? b.startIso).localeCompare(a.lastUpdatedIso ?? a.startIso))
      .slice(0, 6)
      .map(a => ({
        id: a.id,
        petName: a.petName ?? a.petType,
        ownerName: a.ownerName ?? 'Unknown',
        service: a.service,
        timeLabel: fmtTime.format(new Date(a.startIso)),
        status: a.status,
      }));
  });

  // ===== Approval dialog state =====
  readonly selected = signal<AppointmentRequest | null>(null);
  readonly approvalOpen = signal(false);

  openReview(r: AppointmentRequest): void {
    this.selected.set(r);
    this.approvalOpen.set(true);
  }

  closeApproval(): void {
    this.approvalOpen.set(false);
    this.selected.set(null);
  }

  approve(id: string): void {
    this.appts.approve(id);
    this.closeApproval();
  }

  decline(id: string): void {
    this.appts.decline(id);
    this.closeApproval();
  }

  onStaffSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value ?? '';
    this.selectedStaffId.set(value || null);
  }

  // ===== Add Appointment (CDK Dialog) =====
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

  // ===== UI helpers =====
  statusBadgeClass(status: AppointmentStatus | undefined): string {
    switch (status) {
      case 'CONFIRMED':
        return 'badge badge--success';
      case 'PENDING':
        return 'badge badge--warning';
      case 'CANCELLED':
        return 'badge badge--danger';
      case 'COMPLETED':
        return 'badge badge--neutral';
      default:
        return 'badge';
    }
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}