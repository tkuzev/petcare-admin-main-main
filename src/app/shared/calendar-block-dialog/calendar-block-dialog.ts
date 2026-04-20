import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { AuthService } from '../../data/auth.service';
import { StaffService } from '../../data/staff.service';
import { CalendarBlockCreate } from '../../data/calendar-blocks.service';

type BlockMode = 'hours' | 'days';
type CalendarBlockDialogData = {
  staffId?: string | null;
};

@Component({
  selector: 'app-calendar-block-dialog',
  templateUrl: './calendar-block-dialog.html',
  styleUrl: './calendar-block-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class CalendarBlockDialog {
  private static readonly TIME_PATTERN = /^(?:(?:0?[1-9]|1\d|2[0-3]):[0-5]\d|24:00)$/;

  private readonly fb = inject(FormBuilder);
  private readonly ref = inject(DialogRef<CalendarBlockCreate | null>);
  private readonly auth = inject(AuthService);
  private readonly data = inject<CalendarBlockDialogData | null>(DIALOG_DATA, { optional: true });
  readonly staffSvc = inject(StaffService);

  readonly form = this.fb.nonNullable.group({
    staffId: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    title: this.fb.nonNullable.control('Blocked', { validators: [Validators.required, Validators.maxLength(120)] }),
    mode: this.fb.nonNullable.control<BlockMode>('hours', { validators: [Validators.required] }),
    date: this.fb.nonNullable.control(this.todayIsoDate(), { validators: [Validators.required] }),
    startDate: this.fb.nonNullable.control(this.todayIsoDate(), { validators: [Validators.required] }),
    endDate: this.fb.nonNullable.control(this.todayIsoDate(), { validators: [Validators.required] }),
    startTime: this.fb.nonNullable.control('', { validators: [Validators.required, this.timeValidator()] }),
    endTime: this.fb.nonNullable.control('', { validators: [Validators.required, this.timeValidator()] }),
    notes: this.fb.nonNullable.control('', { validators: [Validators.maxLength(500)] }),
  }, {
    validators: [this.timeOrderValidator()],
  });

  readonly mode = toSignal(
    this.form.controls.mode.valueChanges.pipe(startWith(this.form.controls.mode.value)),
    { initialValue: this.form.controls.mode.value },
  );
  readonly canChooseStaff = computed(() => this.auth.hasCompanyRole('OWNER', 'COMPANY_ADMIN'));
  readonly availableStaff = computed(() => {
    const all = this.staffSvc.bookableStaff();

    if (this.canChooseStaff()) {
      return all;
    }

    const currentStaffId = this.staffSvc.currentStaffId();
    return all.filter(item => item.id === currentStaffId);
  });
  constructor() {
    this.staffSvc.loadAll();

    effect(() => {
      const list = this.availableStaff();
      if (!list.length) {
        return;
      }

      const current = this.form.controls.staffId.value;
      const preferred = this.data?.staffId ?? '';
      if (!current || !list.some(item => item.id === current)) {
        this.form.controls.staffId.setValue(
          list.some(item => item.id === preferred) ? preferred : list[0]!.id,
        );
      }
    });

    effect(() => {
      this.applyModeValidators(this.mode());
    });
  }

  cancel(): void {
    this.ref.close(null);
  }

  submit(): void {
    this.applyModeValidators(this.form.controls.mode.value);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const isHours = value.mode === 'hours';
    const startTime = this.normalizeTime(value.startTime);
    const endTime = this.normalizeTime(value.endTime);
    const startIso = isHours
      ? (startTime ? this.buildIso(value.date, startTime) : null)
      : this.buildIso(value.startDate, '00:00');
    const endIso = isHours
      ? (endTime ? this.buildIso(value.date, endTime) : null)
      : this.buildNextDayIso(value.endDate);

    if (!startIso || !endIso) {
      this.form.markAllAsTouched();
      return;
    }

    this.ref.close({
      staffId: value.staffId,
      title: value.title.trim(),
      notes: value.notes.trim() || undefined,
      startIso,
      endIso,
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  formatTime(name: 'startTime' | 'endTime'): void {
    const control = this.form.controls[name];
    const normalized = this.normalizeTime(control.value);
    if (normalized) {
      control.setValue(normalized, { emitEvent: false });
    }
  }

  onTimeInput(name: 'startTime' | 'endTime', event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const digits = this.extractDigits(input.value);
    const formatted = this.formatDigitsToTime(digits);
    input.value = formatted;
    this.form.controls[name].setValue(formatted, { emitEvent: false });
  }

  private applyModeValidators(mode: BlockMode): void {
    const isHours = mode === 'hours';
    const dateCtrl = this.form.controls.date;
    const startDateCtrl = this.form.controls.startDate;
    const endDateCtrl = this.form.controls.endDate;
    const startTimeCtrl = this.form.controls.startTime;
    const endTimeCtrl = this.form.controls.endTime;

    if (isHours) {
      dateCtrl.setValidators([Validators.required]);
      startTimeCtrl.setValidators([Validators.required, this.timeValidator()]);
      endTimeCtrl.setValidators([Validators.required, this.timeValidator()]);
      startDateCtrl.clearValidators();
      endDateCtrl.clearValidators();
    } else {
      startDateCtrl.setValidators([Validators.required]);
      endDateCtrl.setValidators([Validators.required]);
      dateCtrl.clearValidators();
      startTimeCtrl.clearValidators();
      endTimeCtrl.clearValidators();
    }

    dateCtrl.updateValueAndValidity({ emitEvent: false });
    startDateCtrl.updateValueAndValidity({ emitEvent: false });
    endDateCtrl.updateValueAndValidity({ emitEvent: false });
    startTimeCtrl.updateValueAndValidity({ emitEvent: false });
    endTimeCtrl.updateValueAndValidity({ emitEvent: false });
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private timeValidator(): ValidatorFn {
    return (control: AbstractControl<string>): ValidationErrors | null => {
      const value = control.value?.trim() ?? '';
      if (!value) {
        return null;
      }
      return CalendarBlockDialog.TIME_PATTERN.test(value) ? null : { time: true };
    };
  }

  private timeOrderValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const mode = group.get('mode')?.value as BlockMode | null;
      if (mode === 'days') {
        const startDate = String(group.get('startDate')?.value ?? '');
        const endDate = String(group.get('endDate')?.value ?? '');
        if (!startDate || !endDate) {
          return null;
        }
        return endDate >= startDate ? null : { dateOrder: true };
      }

      const startTime = this.normalizeTime(group.get('startTime')?.value ?? '');
      const endTime = this.normalizeTime(group.get('endTime')?.value ?? '');
      if (!startTime || !endTime) {
        return null;
      }
      return endTime > startTime ? null : { timeOrder: true };
    };
  }

  private normalizeTime(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed || !CalendarBlockDialog.TIME_PATTERN.test(trimmed)) {
      return null;
    }

    const [hourText, minuteText] = trimmed.split(':');
    const hours = Number(hourText);
    const minutes = Number(minuteText);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private extractDigits(value: string): string {
    return value.replace(/\D/g, '').slice(0, 4);
  }

  private formatDigitsToTime(digits: string): string {
    if (!digits) {
      return '';
    }

    if (digits.length <= 2) {
      return digits;
    }

    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  private buildIso(date: string, time: string): string {
    return `${date}T${time}:00`;
  }

  private buildNextDayIso(date: string): string {
    const target = new Date(`${date}T00:00:00`);
    target.setDate(target.getDate() + 1);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00`;
  }

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
