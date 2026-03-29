import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { AppointmentCreate } from '../../data/appointments.service';
import { StaffService } from '../../data/staff.service';
import { ServicesService } from '../../data/services.service';
import { AuthService } from '../../data/auth.service';

type PetType = 'Dog' | 'Cat' | 'Other';
type DurationValue = '15' | '30' | '45' | '60' | 'custom';

@Component({
  selector: 'app-add-appointment-dialog',
  templateUrl: './add-appointment-dialog.html',
  styleUrl: './add-appointment-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgIf],
})
export class AddAppointmentDialog {
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject(DialogRef<AppointmentCreate | null>);
  private readonly auth = inject(AuthService);

  readonly staffSvc = inject(StaffService);
  readonly servicesSvc = inject(ServicesService);

  readonly form = this.fb.nonNullable.group({
    staffId: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    petType: this.fb.nonNullable.control<PetType>('Dog', { validators: [Validators.required] }),
    otherPetType: this.fb.nonNullable.control('', []),
    petName: this.fb.nonNullable.control('', []),
    ownerEmail: this.fb.nonNullable.control('', [Validators.required]),
    serviceId: this.fb.nonNullable.control('', [Validators.required]),

    date: this.fb.nonNullable.control('', [Validators.required]),
    startTime: this.fb.nonNullable.control('', [Validators.required]),
    duration: this.fb.nonNullable.control<DurationValue>('30', [Validators.required]),
    customEndTime: this.fb.nonNullable.control('', []),

    notes: this.fb.nonNullable.control('', []),
  });

  private readonly durationSig = toSignal(
    this.form.controls.duration.valueChanges.pipe(startWith(this.form.controls.duration.value)),
    { initialValue: this.form.controls.duration.value },
  );

  private readonly petTypeSig = toSignal(
    this.form.controls.petType.valueChanges.pipe(startWith(this.form.controls.petType.value)),
    { initialValue: this.form.controls.petType.value },
  );

  readonly showCustomEnd = computed(() => this.durationSig() === 'custom');
  readonly showOtherPetType = computed(() => this.petTypeSig() === 'Other');

  readonly activeServices = computed(() =>
    this.servicesSvc.services().filter(service => service.active),
  );

  readonly canChooseStaff = computed(() => {
    const role = this.auth.companyRole();
    return role === 'COMPANY_ADMIN' || role === 'MANAGER';
  });

  readonly availableStaff = computed(() => {
    const all = this.staffSvc.staff().filter(member => member.active);

    if (this.canChooseStaff()) {
      return all;
    }

    const currentStaffId = this.staffSvc.currentStaffId();
    return all.filter(member => member.id === currentStaffId);
  });

  constructor() {
    this.servicesSvc.loadAll();
    this.staffSvc.loadAll();

    effect(() => {
      const endCtrl = this.form.controls.customEndTime;
      if (this.showCustomEnd()) {
        endCtrl.setValidators([Validators.required]);
      } else {
        endCtrl.clearValidators();
        endCtrl.setValue('');
      }
      endCtrl.updateValueAndValidity({ emitEvent: false });
    });

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
      const list = this.availableStaff();
      if (!list.length) return;

      const current = this.form.controls.staffId.value;
      const exists = list.some(item => item.id === current);

      if (!exists) {
        this.form.controls.staffId.setValue(list[0]!.id);
      }
    });

    effect(() => {
      const services = this.activeServices();
      const selected = this.form.controls.serviceId.value;
      if (!selected && services.length > 0) {
        this.form.controls.serviceId.setValue(services[0]!.id);
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

    if (!selectedService) {
      this.form.controls.serviceId.setErrors({ required: true });
      this.form.controls.serviceId.markAsTouched();
      return;
    }

    const resolvedPetType = v.petType === 'Other'
      ? v.otherPetType.trim()
      : v.petType;

    const startIso = `${v.date}T${v.startTime}`;
    const endIso = this.buildEndIso(v.date, v.startTime, v.duration, v.customEndTime);

    const payload: AppointmentCreate = {
      staffId: v.staffId,
      petType: resolvedPetType as AppointmentCreate['petType'],
      petName: v.petName.trim() || undefined,
      ownerEmail: v.ownerEmail.trim(),
      service: selectedService.name,
      startIso,
      endIso,
      notes: v.notes.trim() || undefined,
      status: 'CONFIRMED',
    };

    this.ref.close(payload);
  }

  private buildEndIso(date: string, startTime: string, duration: DurationValue, customEndTime: string): string {
    if (duration === 'custom') {
      return `${date}T${customEndTime}`;
    }

    const minutes = Number(duration);
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = startTime.split(':').map(Number);
    const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
    dt.setMinutes(dt.getMinutes() + minutes);

    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hour = String(dt.getHours()).padStart(2, '0');
    const minute = String(dt.getMinutes()).padStart(2, '0');

    return `${dt.getFullYear()}-${month}-${day}T${hour}:${minute}`;
  }
}