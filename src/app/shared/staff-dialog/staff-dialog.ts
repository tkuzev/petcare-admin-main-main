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
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
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
    } else {
      this.form.controls.firstName.setValidators([Validators.required, Validators.maxLength(40)]);
      this.form.controls.lastName.setValidators([Validators.required, Validators.maxLength(40)]);
      this.form.controls.roles.setValidators([Validators.required]);
    }

    this.form.controls.firstName.updateValueAndValidity({ emitEvent: false });
    this.form.controls.lastName.updateValueAndValidity({ emitEvent: false });
    this.form.controls.roles.updateValueAndValidity({ emitEvent: false });
  }
}
