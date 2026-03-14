import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { AppointmentCreate } from '../../data/appointments.service';
import { StaffService } from '../../data/staff.service';

type PetType = 'Dog' | 'Cat' | 'Other';
type DurationValue = '15' | '30' | '45' | '60' | 'custom';

@Component({
  selector: 'app-add-appointment-dialog',
  templateUrl: './add-appointment-dialog.html',
  styleUrl: './add-appointment-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, NgIf, NgFor],
})
export class AddAppointmentDialog {
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject(DialogRef<AppointmentCreate | null>);
  readonly staffSvc = inject(StaffService);

  readonly form = this.fb.nonNullable.group({
    staffId: this.fb.nonNullable.control<string>('', { validators: [Validators.required] }),
    petType: this.fb.nonNullable.control<PetType>('Dog', { validators: [Validators.required] }),
    petName: this.fb.nonNullable.control('', []),
    ownerName: this.fb.nonNullable.control('', [Validators.required]),
    service: this.fb.nonNullable.control('', [Validators.required]),

    date: this.fb.nonNullable.control('', [Validators.required]),      // YYYY-MM-DD
    startTime: this.fb.nonNullable.control('', [Validators.required]), // HH:mm
    duration: this.fb.nonNullable.control<DurationValue>('30', [Validators.required]),
    customEndTime: this.fb.nonNullable.control('', []),

    notes: this.fb.nonNullable.control('', []),
  });

  private readonly durationSig = toSignal(
    this.form.controls.duration.valueChanges.pipe(startWith(this.form.controls.duration.value)),
    { initialValue: this.form.controls.duration.value },
  );

  readonly showCustomEnd = computed(() => this.durationSig() === 'custom');

  constructor() {
    // Default staff selection (first active member)
    const defaultStaffId = this.staffSvc.defaultStaffId();
    if (defaultStaffId) this.form.controls.staffId.setValue(defaultStaffId);

    // Dynamic validator for custom end time
    effect(() => {
      const endCtrl = this.form.controls.customEndTime;
      if (this.showCustomEnd()) {
        endCtrl.addValidators([Validators.required]);
      } else {
        endCtrl.clearValidators();
        endCtrl.setValue('');
      }
      endCtrl.updateValueAndValidity({ emitEvent: false });
    });
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
    const startIso = `${v.date}T${v.startTime}`;
    const endIso = this.buildEndIso(v.date, v.startTime, v.duration, v.customEndTime);

    const payload: AppointmentCreate = {
      staffId: v.staffId,
      petType: v.petType,
      petName: v.petName.trim() || undefined,
      ownerName: v.ownerName.trim() || undefined,
      service: v.service.trim(),
      startIso,
      endIso,
      notes: v.notes.trim() || undefined,
      status: 'CONFIRMED',
    };

    this.ref.close(payload);
  }

  private buildEndIso(date: string, startTime: string, duration: DurationValue, customEndTime: string): string {
    if (duration === 'custom') return `${date}T${customEndTime}`;

    const minutes = Number(duration);
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = startTime.split(':').map(Number);
    const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
    dt.setMinutes(dt.getMinutes() + minutes);

    const mm2 = String(dt.getMonth() + 1).padStart(2, '0');
    const dd2 = String(dt.getDate()).padStart(2, '0');
    const hh2 = String(dt.getHours()).padStart(2, '0');
    const mi2 = String(dt.getMinutes()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm2}-${dd2}T${hh2}:${mi2}`;
  }

  trackByStaffId(_: number, m: { id: string }): string {
    return m.id;
  }
}