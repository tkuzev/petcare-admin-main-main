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

export type StaffDraft = Omit<StaffMember, 'id' | 'name' | 'roleLabel'> & {
  email: string;
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

  save = output<StaffDraft>();
  closed = output<void>();

  readonly roles: readonly StaffRole[] = ['Vet', 'Groomer', 'Reception', 'Manager', 'Admin'];
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
  }, {
    validators: [this.timeOrderValidator()],
  });

  readonly submitted = signal(false);

  @ViewChild('dlg', { static: true })
  private dlg?: ElementRef<HTMLDialogElement>;

  constructor() {
    effect(() => {
      const el = this.dlg?.nativeElement;
      if (!el) return;

      if (this.isOpen()) {
        const init = this.initial();
        this.submitted.set(false);
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
          });
        }

        if (!el.open) el.showModal();
      } else {
        if (el.open) el.close();
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.form.invalid) return;
    this.save.emit(this.form.getRawValue());
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

  private applyModeValidators(isInviteMode: boolean): void {
    if (isInviteMode) {
      this.form.controls.firstName.clearValidators();
      this.form.controls.lastName.clearValidators();
      this.form.controls.roles.clearValidators();
      this.form.controls.workingStartTime.clearValidators();
      this.form.controls.workingEndTime.clearValidators();
    } else {
      this.form.controls.firstName.setValidators([Validators.required, Validators.maxLength(40)]);
      this.form.controls.lastName.setValidators([Validators.required, Validators.maxLength(40)]);
      this.form.controls.roles.setValidators([Validators.required]);
      this.form.controls.workingStartTime.setValidators([Validators.required, this.timeValidator()]);
      this.form.controls.workingEndTime.setValidators([Validators.required, this.timeValidator()]);
    }

    this.form.controls.firstName.updateValueAndValidity({ emitEvent: false });
    this.form.controls.lastName.updateValueAndValidity({ emitEvent: false });
    this.form.controls.roles.updateValueAndValidity({ emitEvent: false });
    this.form.controls.workingStartTime.updateValueAndValidity({ emitEvent: false });
    this.form.controls.workingEndTime.updateValueAndValidity({ emitEvent: false });
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
      return end > start ? null : { timeOrder: true };
    };
  }

  private normalizeTime(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed || !StaffDialog.TIME_PATTERN.test(trimmed)) {
      return null;
    }
    return trimmed;
  }
}
