import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';

import { ApprovalDialog, AppointmentRequest } from '../../shared/approval-dialog/approval-dialog';
import { AddAppointmentDialog } from '../../shared/add-appointment-dialog/add-appointment-dialog';

import { AppointmentsService, AppointmentCreate, AppointmentStatus } from '../../data/appointments.service';
import { StaffService } from '../../data/staff.service';
import { DashboardChartPoint, DashboardService, DashboardSummary } from '../../data/dashboard.service';
import { AppointmentsChartComponent } from '../../shared/appointments-chart/appointments-chart';

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
  imports: [NgIf, NgFor, ApprovalDialog, AppointmentsChartComponent],
})
export class Dashboard {
  private readonly appts = inject(AppointmentsService);
  private readonly dialog = inject(Dialog);
  private readonly staffSvc = inject(StaffService);
  private readonly dashboardSvc = inject(DashboardService);

  readonly staff = this.staffSvc.staff;

  readonly selectedStaffId = signal<string | null>(null);
  readonly activeStaffId = computed<string | null>(() => this.selectedStaffId() ?? this.staffSvc.defaultStaffId());

  readonly summary = signal<DashboardSummary | null>(null);
  readonly chartPoints = signal<DashboardChartPoint[]>([]);
  readonly dashboardLoading = signal(true);

  constructor() {
    effect(() => {
      if (this.selectedStaffId() !== null) return;
      const def = this.staffSvc.defaultStaffId();
      if (def) this.selectedStaffId.set(def);
    });

    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.dashboardLoading.set(true);

    this.dashboardSvc.getSummary().subscribe({
      next: data => this.summary.set(data),
      error: error => console.error('Failed to load dashboard summary', error),
    });

    this.dashboardSvc.getAppointmentsChart(7).subscribe({
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

  openAdd(): void {
    const ref = this.dialog.open<AppointmentCreate | null>(AddAppointmentDialog, {
      hasBackdrop: true,
      disableClose: false,
      panelClass: 'pc-dialog-panel',
    });

    ref.closed.subscribe(result => {
      if (!result) return;
      this.appts.create(result);
    });
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
}
