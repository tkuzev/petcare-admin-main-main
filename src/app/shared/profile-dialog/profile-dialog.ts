import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  inject,
  signal,
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
  protected readonly pendingConfirm = signal<'save' | 'cancel' | null>(null);

  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    middleName: [''],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
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
        firstName: profile.firstName ?? '',
        middleName: profile.middleName ?? '',
        lastName: profile.lastName ?? '',
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

    this.pendingConfirm.set('save');
  }

  protected confirmSave(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      this.pendingConfirm.set(null);
      return;
    }

    this.save.emit({
      email: this.form.controls.email.getRawValue(),
      firstName: this.form.controls.firstName.getRawValue(),
      middleName: this.form.controls.middleName.getRawValue(),
      lastName: this.form.controls.lastName.getRawValue(),
      phone: this.form.controls.phone.getRawValue(),
      pictureUrl: this.form.controls.pictureUrl.getRawValue(),
    });
    this.pendingConfirm.set(null);
  }

  protected cancel(): void {
    this.pendingConfirm.set('cancel');
  }

  protected confirmCancel(): void {
    this.pendingConfirm.set(null);
    this.close.emit();
  }

  protected closeConfirm(): void {
    this.pendingConfirm.set(null);
  }

  protected triggerAvatarUpload(input: HTMLInputElement): void {
    input.click();
  }

  protected onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        this.form.controls.pictureUrl.setValue(result);
      }
    };
    reader.readAsDataURL(file);
  }

  protected hasError(controlName: 'email' | 'firstName' | 'lastName'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }
}
