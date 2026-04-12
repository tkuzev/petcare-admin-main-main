import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';

import { ApprovalDialog, AppointmentRequest } from '../../shared/approval-dialog/approval-dialog';
import { AddAppointmentDialog } from '../../shared/add-appointment-dialog/add-appointment-dialog';
import { CalendarBlockDialog } from '../../shared/calendar-block-dialog/calendar-block-dialog';

import { AppointmentsService, AppointmentStatus, AppointmentCreate, Appointment } from '../../data/appointments.service';
import { CalendarBlocksService, CalendarBlockCreate, CalendarBlock } from '../../data/calendar-blocks.service';
import { StaffService } from '../../data/staff.service';
import { DashboardChartPoint, DashboardService, DashboardSummary } from '../../data/dashboard.service';
import { Calendar } from '../../shared/calendar/calendar';
import { AuthService } from '../../data/auth.service';

type RecentRow = {
  id: string;
  petName: string;
  ownerEmail: string;
  service: string;
  timeLabel: string;
  status: AppointmentStatus;
};

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIf, NgFor, ApprovalDialog, Calendar],
})
export class Dashboard {
  private readonly appts = inject(AppointmentsService);
  private readonly calendarBlocksSvc = inject(CalendarBlocksService);
  private readonly staffSvc = inject(StaffService);
  private readonly dashboardSvc = inject(DashboardService);
  private readonly dialog = inject(Dialog);
  private readonly auth = inject(AuthService);

  readonly staff = this.staffSvc.staff;
  readonly calendarOwners = this.staffSvc.bookableStaff;
  readonly canSwitchCalendars = computed(() => this.auth.hasCompanyRole('OWNER', 'COMPANY_ADMIN', 'MANAGER') || this.auth.hasAppRole('admin'));
  readonly canBlockCalendars = computed(() => this.auth.hasCompanyRole('OWNER', 'COMPANY_ADMIN') || !!this.staffSvc.currentStaffId());

  readonly selectedStaffId = signal<string | null>(null);
  readonly activeStaffId = computed<string | null>(() => {
    if (this.canSwitchCalendars()) {
      return this.selectedStaffId() ?? this.calendarOwners()[0]?.id ?? this.staffSvc.currentStaffId() ?? null;
    }

    return this.staffSvc.currentStaffId();
  });

  readonly summary = signal<DashboardSummary | null>(null);
  readonly chartPoints = signal<DashboardChartPoint[]>([]);
  readonly dashboardLoading = signal(true);
  readonly appointments = signal<Appointment[]>([]);
  readonly blocks = signal<CalendarBlock[]>([]);
  readonly blockFeedback = signal<string | null>(null);

  constructor() {
    this.staffSvc.loadAll();

    effect(() => {
      const staffId = this.activeStaffId();
      this.loadAppointmentsForStaff(staffId);
      this.loadBlocksForStaff(staffId);
      this.loadDashboardData(staffId);
    });
  }

  private loadAppointmentsForStaff(staffId?: string | null): void {
    this.appointments.set([]);
    this.appts.fetchAll(staffId).subscribe({
      next: items => this.appointments.set(items),
      error: error => console.error('Failed to load dashboard appointments', error),
    });
  }

  private loadBlocksForStaff(staffId?: string | null): void {
    this.blocks.set([]);
    this.calendarBlocksSvc.fetchAll(staffId).subscribe({
      next: items => this.blocks.set(items),
      error: error => console.error('Failed to load calendar blocks', error),
    });
  }

  private loadDashboardData(staffId?: string | null): void {
    this.dashboardLoading.set(true);

    this.dashboardSvc.getSummary(staffId).subscribe({
      next: data => this.summary.set(data),
      error: error => console.error('Failed to load dashboard summary', error),
    });

    this.dashboardSvc.getAppointmentsChart(7, staffId).subscribe({
      next: data => {
        this.chartPoints.set(data);
        this.dashboardLoading.set(false);
      },
      error: error => {
        console.error('Failed to load dashboard chart', error);
        this.dashboardLoading.set(false);
      },
    });
  }

  readonly pending = computed<AppointmentRequest[]>(() => {
    const fmtDay = new Intl.DateTimeFormat('bg-BG', { weekday: 'long' });
    const fmtTime = new Intl.DateTimeFormat('bg-BG', { hour: '2-digit', minute: '2-digit' });
    const staffId = this.activeStaffId();

    return this.appointments()
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
        ownerEmail: a.ownerEmail,
        notes: a.notes,
        status: a.status,
      }));
  });

  readonly rows = computed<RecentRow[]>(() => {
    const fmtTime = new Intl.DateTimeFormat('bg-BG', { hour: '2-digit', minute: '2-digit' });
    const staffId = this.activeStaffId();

    return this.appointments()
      .slice()
      .filter(a => (staffId ? a.staffId === staffId : true))
      .filter(a => a.status !== 'PENDING')
      .sort((a, b) => (b.lastUpdatedIso ?? b.startIso).localeCompare(a.lastUpdatedIso ?? a.startIso))
      .slice(0, 6)
      .map(a => ({
        id: a.id,
        petName: a.petName ?? a.petType,
        ownerEmail: a.ownerEmail ?? 'Unknown',
        service: a.service,
        timeLabel: fmtTime.format(new Date(a.startIso)),
        status: a.status,
      }));
  });

  readonly selected = signal<AppointmentRequest | null>(null);
  readonly approvalOpen = signal(false);

  openReview(r: AppointmentRequest): void {
    this.selected.set(r);
    this.approvalOpen.set(true);
  }

  openAppointmentDetails(id: string): void {
    const appointment = this.appointments().find(item => item.id === id);
    if (!appointment) {
      return;
    }

    const weekdayFmt = new Intl.DateTimeFormat('bg-BG', { weekday: 'long' });
    const timeFmt = new Intl.DateTimeFormat('bg-BG', { hour: '2-digit', minute: '2-digit' });

    this.selected.set({
      id: appointment.id,
      petType: appointment.petName ? `${appointment.petType} · ${appointment.petName}` : appointment.petType,
      service: appointment.service,
      dayLabel: weekdayFmt.format(new Date(appointment.startIso)),
      timeLabel: timeFmt.format(new Date(appointment.startIso)),
      ownerEmail: appointment.ownerEmail,
      notes: appointment.notes,
      status: appointment.status,
      staffName: this.staffSvc.nameById(appointment.staffId),
    });
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

  changeCalendarOwner(staffId: string | null): void {
    this.selectedStaffId.set(staffId);
    this.loadAppointmentsForStaff(staffId);
    this.loadBlocksForStaff(staffId);
  }

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

      this.appts.create(result);
      this.loadAppointmentsForStaff(this.activeStaffId());
    });
  }

  openBlockDialog(): void {
    const ref = this.dialog.open<CalendarBlockCreate | null>(CalendarBlockDialog, {
      hasBackdrop: true,
      disableClose: false,
      panelClass: 'pc-dialog-panel',
    });

    ref.closed.subscribe(async result => {
      if (!result) {
        return;
      }

      try {
        await this.calendarBlocksSvc.create(result);
        this.blockFeedback.set('Calendar block saved.');
        this.loadAppointmentsForStaff(this.activeStaffId());
        this.loadBlocksForStaff(this.activeStaffId());
        this.loadDashboardData(this.activeStaffId());
      } catch (error) {
        this.blockFeedback.set('Could not save the block. Please check the selected time range.');
        console.error('Failed to create calendar block', error);
      }
    });
  }
}
