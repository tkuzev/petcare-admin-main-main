import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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

  readonly staff = this.staffSvc.staff;
  readonly activeCount = this.staffSvc.activeCount;

  readonly dialogOpen = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly editing = () => {
    const id = this.editingId();
    if (!id) {
      return null;
    }

    return this.staff().find(member => member.id === id) ?? null;
  };

  constructor() {
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

  save(draft: StaffDraft): void {
    const id = this.editingId();
    if (id) {
      this.staffSvc.updateMember(id, draft);
    } else {
      this.staffSvc.addMember(draft);
    }

    this.closeDialog();
  }
}
