import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CompanyScheduleService, WorkingDay, WorkingDaySchedule } from '../../data/company-schedule.service';
import { AuthService } from '../../data/auth.service';
import { InvitationsService } from '../../data/invitations.service';
import { StaffService } from '../../data/staff.service';
import { StaffDialog, StaffDraft } from '../../shared/staff-dialog/staff-dialog';

@Component({
  selector: 'app-staff',
  imports: [StaffDialog],
  templateUrl: './staff.html',
  styleUrl: './staff.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Staff {
  private readonly staffSvc = inject(StaffService);
  private readonly companyScheduleSvc = inject(CompanyScheduleService);
  private readonly invitationsSvc = inject(InvitationsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly staff = this.staffSvc.staff;
  readonly salonSchedule = this.companyScheduleSvc.schedule;
  readonly activeCount = this.staffSvc.activeCount;
  readonly canManageStaff = computed(() => this.auth.hasCompanyRole('OWNER', 'COMPANY_ADMIN'));
  readonly weekDays: readonly { value: WorkingDay; label: string }[] = [
    { value: 'MONDAY', label: 'Mon' },
    { value: 'TUESDAY', label: 'Tue' },
    { value: 'WEDNESDAY', label: 'Wed' },
    { value: 'THURSDAY', label: 'Thu' },
    { value: 'FRIDAY', label: 'Fri' },
    { value: 'SATURDAY', label: 'Sat' },
    { value: 'SUNDAY', label: 'Sun' },
  ];

  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly scheduleSaving = signal(false);
  readonly scheduleMessage = signal<string | null>(null);
  readonly scheduleStartTime = signal('09:00');
  readonly scheduleEndTime = signal('17:00');
  readonly scheduleDays = signal<WorkingDay[]>(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
  readonly scheduleRows = signal<Array<WorkingDaySchedule & { active: boolean }>>([]);
  readonly confirmScheduleOpen = signal(false);

  readonly editing = () => {
    const id = this.editingId();
    if (!id) {
      return null;
    }

    return this.staff().find(member => member.id === id) ?? null;
  };

  constructor() {
    if (!this.canManageStaff()) {
      void this.router.navigateByUrl('/dashboard');
      return;
    }

    this.staffSvc.loadAll();
    this.companyScheduleSvc.load();

    effect(() => {
      this.syncSalonSchedule();
    });
  }

  openAdd(): void {
    this.editingId.set(null);
    this.dialogOpen.set(true);
  }

  openEdit(id: string): void {
    this.editingId.set(id);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  async save(draft: StaffDraft): Promise<void> {
    this.errorMessage.set(null);
    const id = this.editingId();
    if (id) {
      this.staffSvc.updateMember(id, draft);
      this.closeDialog();
      return;
    }

    this.saving.set(true);

    try {
      await this.invitationsSvc.create({
        email: draft.email,
      });
      this.closeDialog();
    } catch (error) {
      console.error('Failed to invite member', error);
      this.errorMessage.set('Could not create the invitation. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  syncSalonSchedule(): void {
    const schedule = this.salonSchedule();
    if (!schedule) {
      return;
    }

    this.scheduleStartTime.set(schedule.workingStartTime);
    this.scheduleEndTime.set(schedule.workingEndTime);
    this.scheduleDays.set([...schedule.workingDays]);
    this.scheduleRows.set(this.weekDays.map(day => {
      const existing = schedule.workingSchedule.find(row => row.day === day.value);
      return {
        day: day.value,
        startTime: existing?.startTime ?? schedule.workingStartTime,
        endTime: existing?.endTime ?? schedule.workingEndTime,
        active: !!existing,
      };
    }));
  }

  onScheduleTimeInput(kind: 'start' | 'end', event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    const formatted = digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
    input.value = formatted;

    if (kind === 'start') {
      this.scheduleStartTime.set(formatted);
    } else {
      this.scheduleEndTime.set(formatted);
    }
  }

  formatScheduleTime(kind: 'start' | 'end'): void {
    const value = kind === 'start' ? this.scheduleStartTime() : this.scheduleEndTime();
    const normalized = this.normalizeTime(value);
    if (!normalized) {
      return;
    }

    if (kind === 'start') {
      this.scheduleStartTime.set(normalized);
    } else {
      this.scheduleEndTime.set(normalized);
    }
  }

  toggleScheduleDay(day: WorkingDay, checked: boolean): void {
    this.scheduleRows.update(rows => rows.map(row => row.day === day ? { ...row, active: checked } : row));
    this.scheduleDays.set(this.scheduleRows().filter(row => row.active).map(row => row.day));
  }

  hasScheduleDay(day: WorkingDay): boolean {
    return this.scheduleRows().some(row => row.day === day && row.active);
  }

  scheduleRow(day: WorkingDay): WorkingDaySchedule & { active: boolean } {
    return this.scheduleRows().find(row => row.day === day) ?? {
      day,
      startTime: this.scheduleStartTime(),
      endTime: this.scheduleEndTime(),
      active: false,
    };
  }

  updateScheduleDayTime(day: WorkingDay, field: 'startTime' | 'endTime', event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    const formatted = digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
    input.value = formatted;
    this.scheduleRows.update(rows => rows.map(row => row.day === day ? { ...row, [field]: formatted } : row));
  }

  formatScheduleDayTime(day: WorkingDay, field: 'startTime' | 'endTime'): void {
    const row = this.scheduleRow(day);
    const normalized = this.normalizeTime(row[field]);
    if (!normalized) {
      return;
    }
    this.scheduleRows.update(rows => rows.map(item => item.day === day ? { ...item, [field]: normalized } : item));
  }

  requestSaveSalonSchedule(): void {
    this.confirmScheduleOpen.set(true);
  }

  closeScheduleConfirm(): void {
    this.confirmScheduleOpen.set(false);
  }

  async saveSalonSchedule(): Promise<void> {
    const schedule = this.scheduleRows()
      .filter(row => row.active)
      .map(row => ({
        day: row.day,
        startTime: this.normalizeTime(row.startTime),
        endTime: this.normalizeTime(row.endTime),
      }));

    if (
      schedule.length === 0 ||
      schedule.some(row => !row.startTime || !row.endTime || row.endTime <= row.startTime)
    ) {
      this.scheduleMessage.set('Please select valid working hours and at least one working day.');
      this.closeScheduleConfirm();
      return;
    }

    this.scheduleSaving.set(true);
    this.scheduleMessage.set(null);

    try {
      await this.companyScheduleSvc.update({
        workingStartTime: schedule[0]!.startTime!,
        workingEndTime: schedule[0]!.endTime!,
        workingDays: schedule.map(row => row.day),
        workingSchedule: schedule.map(row => ({
          day: row.day,
          startTime: row.startTime!,
          endTime: row.endTime!,
        })),
      });
      this.staffSvc.loadAll();
      this.scheduleMessage.set('Salon schedule saved.');
    } catch (error) {
      console.error('Failed to save salon schedule', error);
      this.scheduleMessage.set('Could not save salon schedule. Please try again.');
    } finally {
      this.scheduleSaving.set(false);
      this.closeScheduleConfirm();
    }
  }

  private normalizeTime(value: string): string | null {
    const trimmed = value.trim();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

}
