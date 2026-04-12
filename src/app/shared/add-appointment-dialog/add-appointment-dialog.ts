import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { AppointmentCreate } from '../../data/appointments.service';
import { StaffService } from '../../data/staff.service';
import { AuthService } from '../../data/auth.service';
import { StaffServicesService } from '../../data/staff-services.service';

type PetType = 'Dog' | 'Cat' | 'Other';

@Component({
  selector: 'app-add-appointment-dialog',
  templateUrl: './add-appointment-dialog.html',
  styleUrl: './add-appointment-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class AddAppointmentDialog {
  private static readonly TIME_PATTERN = /^(?:(?:0?[1-9]|1\d|2[0-3]):[0-5]\d|24:00)$/;
  readonly otherServiceId = '__OTHER__';

  private readonly fb = inject(FormBuilder);
  private readonly ref = inject(DialogRef<AppointmentCreate | null>);
  private readonly auth = inject(AuthService);

  readonly staffSvc = inject(StaffService);
  readonly staffServicesSvc = inject(StaffServicesService);

  readonly form = this.fb.nonNullable.group({
    staffId: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    petType: this.fb.nonNullable.control<PetType>('Dog', { validators: [Validators.required] }),
    otherPetType: this.fb.nonNullable.control('', []),
    petName: this.fb.nonNullable.control('', []),
    ownerEmail: this.fb.nonNullable.control('', [Validators.required]),
    serviceId: this.fb.nonNullable.control('', [Validators.required]),
    otherServiceName: this.fb.nonNullable.control('', []),

    date: this.fb.nonNullable.control(this.todayIsoDate(), [Validators.required]),
    startTime: this.fb.nonNullable.control('', [Validators.required, this.timeValidator(false)]),
    endTime: this.fb.nonNullable.control('', [this.timeValidator(true)]),

    notes: this.fb.nonNullable.control('', []),
  }, {
    validators: [this.timeOrderValidator()],
  });

  private readonly petTypeSig = toSignal(
    this.form.controls.petType.valueChanges.pipe(startWith(this.form.controls.petType.value)),
    { initialValue: this.form.controls.petType.value },
  );
  private readonly serviceIdSig = toSignal(
    this.form.controls.serviceId.valueChanges.pipe(startWith(this.form.controls.serviceId.value)),
    { initialValue: this.form.controls.serviceId.value },
  );
  private readonly staffIdSig = toSignal(
    this.form.controls.staffId.valueChanges.pipe(startWith(this.form.controls.staffId.value)),
    { initialValue: this.form.controls.staffId.value },
  );

  readonly showOtherPetType = computed(() => this.petTypeSig() === 'Other');

  readonly activeServices = computed(() => {
    const staffId = this.staffIdSig();
    if (!staffId) {
      return [];
    }

    return this.staffServicesSvc
      .assignmentsFor(staffId)
      .filter(service => service.active)
      .map(item => ({
        id: item.serviceId,
        assignmentId: item.id,
        name: item.serviceName,
        durationMin: item.effectiveDurationMin,
        price: item.effectivePrice,
        active: item.active,
      }));
  });
  readonly selectedService = computed(() =>
    this.activeServices().find(service => service.id === this.serviceIdSig()) ?? null,
  );
  readonly showManualEndTime = computed(() => this.serviceIdSig() === this.otherServiceId);

  readonly canChooseStaff = computed(() => {
    return this.auth.hasCompanyRole('OWNER', 'COMPANY_ADMIN', 'MANAGER') || this.auth.hasAppRole('admin');
  });

  readonly availableStaff = computed(() => {
    const all = this.staffSvc.bookableStaff();

    if (this.canChooseStaff()) {
      return all;
    }

    const currentStaffId = this.staffSvc.currentStaffId();
    return all.filter(member => member.id === currentStaffId);
  });

  constructor() {
    this.staffSvc.loadAll();

    effect(() => {
      const otherCtrl = this.form.controls.otherPetType;
      if (this.showOtherPetType()) {
        otherCtrl.setValidators([Validators.required]);
      } else {
        otherCtrl.clearValidators();
        otherCtrl.setValue('');
      }
      otherCtrl.updateValueAndValidity({ emitEvent: false });
    });

    effect(() => {
      const otherServiceCtrl = this.form.controls.otherServiceName;
      if (this.showManualEndTime()) {
        otherServiceCtrl.setValidators([Validators.required, Validators.maxLength(80)]);
      } else {
        otherServiceCtrl.clearValidators();
        otherServiceCtrl.setValue('', { emitEvent: false });
      }
      otherServiceCtrl.updateValueAndValidity({ emitEvent: false });
    });

    effect(() => {
      const endCtrl = this.form.controls.endTime;
      if (this.showManualEndTime()) {
        endCtrl.setValidators([Validators.required, this.timeValidator(true)]);
      } else {
        endCtrl.setValidators([this.timeValidator(true)]);
        endCtrl.setValue('', { emitEvent: false });
      }
      endCtrl.updateValueAndValidity({ emitEvent: false });
      this.form.updateValueAndValidity({ emitEvent: false });
    });

    effect(() => {
      const list = this.availableStaff();
      if (!list.length) return;

      const current = this.form.controls.staffId.value;
      const exists = list.some(item => item.id === current);

      if (!exists) {
        this.form.controls.staffId.setValue(list[0]!.id);
      }
    });

    effect(() => {
      const staffId = this.staffIdSig();
      if (staffId) {
        this.staffServicesSvc.loadForStaff(staffId);
      }
    });

    effect(() => {
      const services = this.activeServices();
      const selected = this.form.controls.serviceId.value;
      const exists = services.some(item => item.id === selected);
      if (!selected && services.length > 0) {
        this.form.controls.serviceId.setValue(services[0]!.id);
      } else if (selected && selected !== this.otherServiceId && !exists) {
        this.form.controls.serviceId.setValue(services[0]?.id ?? '');
      }
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  cancel(): void {
    this.ref.close(null);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const selectedService = this.activeServices().find(item => item.id === v.serviceId);
    const isOtherService = v.serviceId === this.otherServiceId;

    if (!selectedService && !isOtherService) {
      this.form.controls.serviceId.setErrors({ required: true });
      this.form.controls.serviceId.markAsTouched();
      return;
    }

    const resolvedPetType = v.petType === 'Other'
      ? v.otherPetType.trim()
      : v.petType;

    const normalizedStart = this.normalizeTime(v.startTime);
    const manualEnd = this.showManualEndTime();
    const normalizedEnd = manualEnd ? this.normalizeTime(v.endTime) : null;

    if (!normalizedStart || (manualEnd && !normalizedEnd)) {
      this.form.markAllAsTouched();
      return;
    }

    this.form.controls.startTime.setValue(normalizedStart, { emitEvent: false });
    if (manualEnd && normalizedEnd) {
      this.form.controls.endTime.setValue(normalizedEnd, { emitEvent: false });
    }

    const startIso = this.buildStartIso(v.date, normalizedStart);
    const endIso = manualEnd && normalizedEnd
      ? this.buildEndIso(v.date, normalizedEnd)
      : this.buildEndIsoFromDuration(v.date, normalizedStart, selectedService?.durationMin ?? 30);

    const payload: AppointmentCreate = {
      staffId: v.staffId,
      petType: resolvedPetType as AppointmentCreate['petType'],
      petName: v.petName.trim() || undefined,
      ownerEmail: v.ownerEmail.trim(),
      serviceAssignmentId: isOtherService ? undefined : selectedService!.assignmentId,
      serviceId: isOtherService ? undefined : selectedService!.id,
      customServiceName: isOtherService ? v.otherServiceName.trim() : undefined,
      serviceName: isOtherService ? v.otherServiceName.trim() : selectedService!.name,
      startIso,
      endIso,
      notes: v.notes.trim() || undefined,
      status: 'CONFIRMED',
    };

    this.ref.close(payload);
  }

  formatTime(name: 'startTime' | 'endTime'): void {
    const control = this.form.controls[name];
    const formatted = this.formatDigitsToTime(this.extractDigits(control.value));
    control.setValue(formatted, { emitEvent: false });

    const normalized = this.normalizeTime(formatted);
    if (normalized) {
      control.setValue(normalized, { emitEvent: false });
    }
  }

  onTimeInput(name: 'startTime' | 'endTime', event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const formatted = this.formatDigitsToTime(this.extractDigits(input.value));
    input.value = formatted;
    this.form.controls[name].setValue(formatted, { emitEvent: false });
    this.form.controls[name].updateValueAndValidity({ emitEvent: false });
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private timeValidator(allow24Hour: boolean): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const raw = String(control.value ?? '').trim();
      if (!raw) {
        return null;
      }

      const normalized = this.normalizeTime(raw);
      if (!normalized) {
        return { timeFormat: true };
      }

      if (!allow24Hour && normalized.startsWith('24:')) {
        return { timeRange: true };
      }

      return null;
    };
  }

  private timeOrderValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const serviceId = String(control.get('serviceId')?.value ?? '');
      if (serviceId !== this.otherServiceId) {
        return null;
      }

      const start = String(control.get('startTime')?.value ?? '').trim();
      const end = String(control.get('endTime')?.value ?? '').trim();

      const startMinutes = this.toMinutes(start);
      const endMinutes = this.toMinutes(end);

      if (startMinutes === null || endMinutes === null) {
        return null;
      }

      return endMinutes > startMinutes ? null : { endBeforeStart: true };
    };
  }

  private normalizeTime(raw: string): string | null {
    const value = raw.trim();
    if (!AddAppointmentDialog.TIME_PATTERN.test(value)) {
      return null;
    }

    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private extractDigits(raw: string): string {
    return raw.replace(/\D/g, '').slice(0, 4);
  }

  private formatDigitsToTime(digits: string): string {
    if (digits.length <= 2) {
      return digits;
    }

    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }

  private buildStartIso(date: string, startTime: string): string {
    return `${date}T${startTime}`;
  }

  private toMinutes(value: string): number | null {
    const normalized = this.normalizeTime(value);
    if (!normalized) {
      return null;
    }

    if (normalized === '24:00') {
      return 24 * 60;
    }

    const [hour, minute] = normalized.split(':').map(Number);
    return hour * 60 + minute;
  }

  private buildEndIso(date: string, endTime: string): string {
    if (endTime !== '24:00') {
      return `${date}T${endTime}`;
    }

    const [year, month, day] = date.split('-').map(Number);
    const dt = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}T00:00`;
  }

  private buildEndIsoFromDuration(date: string, startTime: string, durationMin: number): string {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = startTime.split(':').map(Number);
    const safeDuration = Number.isFinite(durationMin) && durationMin > 0 ? durationMin : 30;

    const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
    dt.setMinutes(dt.getMinutes() + safeDuration);

    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}T${hh}:${min}`;
  }

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
