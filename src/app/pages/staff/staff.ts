import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../data/auth.service';
import { InvitationsService, InvitationRole } from '../../data/invitations.service';
import { StaffService } from '../../data/staff.service';
import { StaffDialog, StaffDraft } from '../../shared/staff-dialog/staff-dialog';

@Component({
  selector: 'app-staff',
  imports: [StaffDialog],
  templateUrl: './staff.html',
  styleUrl: './staff.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Staff {
  private readonly staffSvc = inject(StaffService);
  private readonly invitationsSvc = inject(InvitationsService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly staff = this.staffSvc.staff;
  readonly activeCount = this.staffSvc.activeCount;
  readonly canManageStaff = computed(() => this.auth.hasCompanyRole('OWNER', 'COMPANY_ADMIN'));

  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly editing = () => {
    const id = this.editingId();
    if (!id) {
      return null;
    }

    return this.staff().find(member => member.id === id) ?? null;
  };

  constructor() {
    if (!this.canManageStaff()) {
      void this.router.navigateByUrl('/dashboard');
      return;
    }

    this.staffSvc.loadAll();
  }

  openAdd(): void {
    this.editingId.set(null);
    this.dialogOpen.set(true);
  }

  openEdit(id: string): void {
    this.editingId.set(id);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  async save(draft: StaffDraft): Promise<void> {
    this.errorMessage.set(null);
    const id = this.editingId();
    if (id) {
      this.staffSvc.updateMember(id, draft);
      this.closeDialog();
      return;
    }

    this.saving.set(true);

    try {
      await this.invitationsSvc.create({
        email: draft.email,
      });
      this.closeDialog();
    } catch (error) {
      console.error('Failed to invite member', error);
      this.errorMessage.set('Could not create the invitation. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

}
