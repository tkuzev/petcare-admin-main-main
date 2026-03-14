import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../data/auth.service';

@Component({
  selector: 'app-accept-invite-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './accept-invite.html',
  styleUrl: './accept-invite.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceptInvitePage {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly token = signal('');
  protected readonly inviteEmail = signal('');
  protected readonly companyName = signal('');
  protected readonly role = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly isLoading = signal(true);
  protected readonly isValidInvite = signal(false);
  protected readonly errorMessage = signal('');

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: [''],
  });

  constructor() {
    void this.loadInvitation();
  }

  protected async register(): Promise<void> {
    if (this.form.invalid || this.isSubmitting() || !this.token() || !this.isValidInvite()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      await this.authService.registerFromInvite({
        token: this.token(),
        firstName: this.form.controls.firstName.getRawValue(),
        lastName: this.form.controls.lastName.getRawValue(),
        password: this.form.controls.password.getRawValue(),
        phone: this.form.controls.phone.getRawValue(),
      });

      await this.router.navigateByUrl('/dashboard');
    } catch {
      this.errorMessage.set('Регистрацията не можа да бъде завършена.');
      this.isSubmitting.set(false);
    }
  }

  protected hasError(controlName: 'firstName' | 'lastName' | 'password'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  private async loadInvitation(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    
    if (!token) {
      this.errorMessage.set('Липсва token за поканата.');
      this.isLoading.set(false);
      this.isValidInvite.set(false);
      return;
    }

    this.token.set(token);

    try {
      const response = await firstValueFrom(this.authService.validateInvitation(token));

      if (!response.valid) {
        this.errorMessage.set('Поканата е невалидна или изтекла.');
        this.isValidInvite.set(false);
      } else {
        this.inviteEmail.set(response.email);
        this.companyName.set(response.companyName);
        this.role.set(response.role);
        this.isValidInvite.set(true);
      }
    } catch {
      this.errorMessage.set('Поканата е невалидна или изтекла.');
      this.isValidInvite.set(false);
    } finally {
      this.isLoading.set(false);
    }
  }
}