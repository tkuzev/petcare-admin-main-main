import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { AbstractControl, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators, NonNullableFormBuilder } from '@angular/forms';
import { StaffMember, StaffRole } from '../../data/staff.service';
import { CompanySchedule, WorkingDay, WorkingDaySchedule } from '../../data/company-schedule.service';

export type StaffDraft = Omit<StaffMember, 'id' | 'name' | 'roleLabel' | 'workingSchedule'> & {
  email: string;
  workingSchedule?: WorkingDaySchedule[];
};

@Component({
  selector: 'pc-staff-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './staff-dialog.html',
  styleUrl: './staff-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pc-dialog-host',
  },
})
export class StaffDialog {
  private static readonly TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

  isOpen = input<boolean>(false);
  title = input<string>('Staff member');
  initial = input<StaffMember | null>(null);
  salonSchedule = input<CompanySchedule | null>(null);

  save = output<StaffDraft>();
  closed = output<void>();

  readonly roles: readonly StaffRole[] = ['Vet', 'Groomer', 'Reception', 'Manager', 'Admin'];
  readonly weekDays: readonly { value: WorkingDay; label: string }[] = [
    { value: 'MONDAY', label: 'Mon' },
    { value: 'TUESDAY', label: 'Tue' },
    { value: 'WEDNESDAY', label: 'Wed' },
    { value: 'THURSDAY', label: 'Thu' },
    { value: 'FRIDAY', label: 'Fri' },
    { value: 'SATURDAY', label: 'Sat' },
    { value: 'SUNDAY', label: 'Sun' },
  ];
  readonly isInviteMode = computed(() => !this.initial());

  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({
    email: this.fb.control('', { validators: [Validators.required, Validators.email, Validators.maxLength(120)] }),
    firstName: this.fb.control('', { validators: [Validators.required, Validators.maxLength(40)] }),
    middleName: this.fb.control('', { validators: [Validators.maxLength(40)] }),
    lastName: this.fb.control('', { validators: [Validators.required, Validators.maxLength(40)] }),
    roles: this.fb.control<StaffRole[]>(['Vet'], { validators: [Validators.required] }),
    active: this.fb.control(true),
    workingStartTime: this.fb.control('09:00', { validators: [Validators.required, this.timeValidator()] }),
    workingEndTime: this.fb.control('17:00', { validators: [Validators.required, this.timeValidator()] }),
    workingDays: this.fb.control<WorkingDay[]>(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'], { validators: [Validators.required] }),
  }, {
    validators: [this.timeOrderValidator()],
  });

  readonly submitted = signal(false);
  readonly pendingScheduleConfirm = signal(false);

  @ViewChild('dlg', { static: true })
  private dlg?: ElementRef<HTMLDialogElement>;

  constructor() {
    effect(() => {
      const el = this.dlg?.nativeElement;
      if (!el) return;

      if (this.isOpen()) {
        const init = this.initial();
        this.submitted.set(false);
        this.pendingScheduleConfirm.set(false);
        if (init) {
          this.applyModeValidators(false);
          this.form.setValue({
            email: init.email ?? '',
            firstName: init.firstName ?? '',
            middleName: init.middleName ?? '',
            lastName: init.lastName ?? '',
            roles: init.roles.length > 0 ? [...init.roles] : ['Vet'],
            active: init.active,
            workingStartTime: init.workingStartTime ?? '09:00',
            workingEndTime: init.workingEndTime ?? '17:00',
            workingDays: init.workingDays.length ? [...init.workingDays] : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
          });
        } else {
          this.applyModeValidators(true);
          this.form.setValue({
            email: '',
            firstName: '',
            middleName: '',
            lastName: '',
            roles: [],
            active: true,
            workingStartTime: '09:00',
            workingEndTime: '17:00',
            workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
          });
        }

        if (!el.open) el.showModal();
      } else {
        if (el.open) el.close();
      }
    });

    effect(() => {
      this.salonSchedule();
      this.form.updateValueAndValidity({ emitEvent: false });
    });
  }

  close(): void {
    this.closed.emit();
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.form.invalid) return;
    if (!this.isInviteMode() && this.hasScheduleChanged()) {
      this.pendingScheduleConfirm.set(true);
      return;
    }
    this.save.emit(this.form.getRawValue());
  }

  confirmScheduleSave(): void {
    this.pendingScheduleConfirm.set(false);
    this.save.emit(this.form.getRawValue());
  }

  closeScheduleConfirm(): void {
    this.pendingScheduleConfirm.set(false);
  }

  formatTime(name: 'workingStartTime' | 'workingEndTime'): void {
    const control = this.form.controls[name];
    const normalized = this.normalizeTime(control.value);
    if (normalized) {
      control.setValue(normalized, { emitEvent: false });
    }
  }

  onTimeInput(name: 'workingStartTime' | 'workingEndTime', event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const digits = input.value.replace(/\D/g, '').slice(0, 4);
    const formatted = digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
    input.value = formatted;
    this.form.controls[name].setValue(formatted, { emitEvent: false });
  }

  toggleRole(role: StaffRole, checked: boolean): void {
    const current = this.form.controls.roles.getRawValue();
    const next = checked
      ? Array.from(new Set([...current, role]))
      : current.filter(item => item !== role);

    this.form.controls.roles.setValue(next);
    this.form.controls.roles.markAsDirty();
    this.form.controls.roles.markAsTouched();
  }

  hasRole(role: StaffRole): boolean {
    return this.form.controls.roles.getRawValue().includes(role);
  }

  toggleWorkingDay(day: WorkingDay, checked: boolean): void {
    const current = this.form.controls.workingDays.getRawValue();
    const next = checked
      ? Array.from(new Set([...current, day]))
      : current.filter(item => item !== day);

    this.form.controls.workingDays.setValue(next);
    this.form.controls.workingDays.markAsDirty();
    this.form.controls.workingDays.markAsTouched();
  }

  hasWorkingDay(day: WorkingDay): boolean {
    return this.form.controls.workingDays.getRawValue().includes(day);
  }

  isSalonClosed(day: WorkingDay): boolean {
    return !this.salonSchedule()?.workingSchedule.some(item => item.day === day);
  }

  salonHoursLabel(day: WorkingDay): string {
    const row = this.salonSchedule()?.workingSchedule.find(item => item.day === day);
    return row ? `${row.startTime}-${row.endTime}` : 'Closed';
  }

  scheduleValidationMessage(): string | null {
    const selectedDays = this.form.controls.workingDays.getRawValue();
    const start = this.normalizeTime(this.form.controls.workingStartTime.value);
    const end = this.normalizeTime(this.form.controls.workingEndTime.value);
    const salonSchedule = this.salonSchedule();

    if (!salonSchedule || !start || !end || this.isInviteMode()) {
      return null;
    }

    for (const day of selectedDays) {
      const salonDay = salonSchedule.workingSchedule.find(item => item.day === day);
      if (!salonDay) {
        return 'Staff cannot work on days when the salon is closed.';
      }
      if (start < salonDay.startTime || end > salonDay.endTime) {
        return 'Staff working hours must fit inside the salon hours for every selected day.';
      }
    }

    return null;
  }

  private applyModeValidators(isInviteMode: boolean): void {
    if (isInviteMode) {
      this.form.controls.firstName.clearValidators();
      this.form.controls.lastName.clearValidators();
      this.form.controls.roles.clearValidators();
      this.form.controls.workingStartTime.clearValidators();
      this.form.controls.workingEndTime.clearValidators();
      this.form.controls.workingDays.clearValidators();
    } else {
      this.form.controls.firstName.setValidators([Validators.required, Validators.maxLength(40)]);
      this.form.controls.lastName.setValidators([Validators.required, Validators.maxLength(40)]);
      this.form.controls.roles.setValidators([Validators.required]);
      this.form.controls.workingStartTime.setValidators([Validators.required, this.timeValidator()]);
      this.form.controls.workingEndTime.setValidators([Validators.required, this.timeValidator()]);
      this.form.controls.workingDays.setValidators([Validators.required]);
    }

    this.form.controls.firstName.updateValueAndValidity({ emitEvent: false });
    this.form.controls.lastName.updateValueAndValidity({ emitEvent: false });
    this.form.controls.roles.updateValueAndValidity({ emitEvent: false });
    this.form.controls.workingStartTime.updateValueAndValidity({ emitEvent: false });
    this.form.controls.workingEndTime.updateValueAndValidity({ emitEvent: false });
    this.form.controls.workingDays.updateValueAndValidity({ emitEvent: false });
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private timeValidator(): ValidatorFn {
    return (control: AbstractControl<string>): ValidationErrors | null => {
      const value = control.value?.trim() ?? '';
      if (!value) {
        return null;
      }
      return StaffDialog.TIME_PATTERN.test(value) ? null : { time: true };
    };
  }

  private timeOrderValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const start = this.normalizeTime(group.get('workingStartTime')?.value ?? '');
      const end = this.normalizeTime(group.get('workingEndTime')?.value ?? '');
      if (!start || !end) {
        return null;
      }
      if (end <= start) {
        return { timeOrder: true };
      }

      const selectedDays = group.get('workingDays')?.value as WorkingDay[] | null;
      const salonSchedule = this.salonSchedule();
      if (!salonSchedule || !selectedDays?.length || this.isInviteMode()) {
        return null;
      }

      for (const day of selectedDays) {
        const salonDay = salonSchedule.workingSchedule.find(item => item.day === day);
        if (!salonDay) {
          return { outsideSalonSchedule: true };
        }
        if (start < salonDay.startTime || end > salonDay.endTime) {
          return { outsideSalonSchedule: true };
        }
      }

      return null;
    };
  }

  private normalizeTime(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed || !StaffDialog.TIME_PATTERN.test(trimmed)) {
      return null;
    }
    return trimmed;
  }

  private hasScheduleChanged(): boolean {
    const initial = this.initial();
    if (!initial) {
      return false;
    }

    const value = this.form.getRawValue();
    const nextDays = [...value.workingDays].sort().join('|');
    const currentDays = [...initial.workingDays].sort().join('|');

    return value.workingStartTime !== (initial.workingStartTime ?? '09:00')
      || value.workingEndTime !== (initial.workingEndTime ?? '17:00')
      || nextDays !== currentDays;
  }
}
