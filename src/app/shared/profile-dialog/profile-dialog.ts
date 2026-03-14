import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthUser, UpdateProfileRequest } from '../../data/auth.service';

@Component({
  selector: 'app-profile-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './profile-dialog.html',
  styleUrl: './profile-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileDialog {
  readonly open = input(false);
  readonly profile = input<AuthUser | null>(null);
  readonly saving = input(false);

  readonly close = output<void>();
  readonly save = output<UpdateProfileRequest>();

  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: [''],
    pictureUrl: [''],
  });

  constructor() {
    effect(() => {
      const profile = this.profile();
      const isOpen = this.open();

      if (!profile || !isOpen) return;

      this.form.reset({
        email: profile.email ?? '',
        name: profile.name ?? '',
        phone: profile.phone ?? '',
        pictureUrl: profile.pictureUrl ?? '',
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.save.emit({
      email: this.form.controls.email.getRawValue(),
      name: this.form.controls.name.getRawValue(),
      phone: this.form.controls.phone.getRawValue(),
      pictureUrl: this.form.controls.pictureUrl.getRawValue(),
    });
  }

  protected cancel(): void {
    this.close.emit();
  }

  protected hasError(controlName: 'email' | 'name'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }
}
