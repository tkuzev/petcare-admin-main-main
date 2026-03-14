import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ServicesService, ServiceItem } from '../../data/services.service';
import { ServiceDialog, ServiceDraft } from '../../shared/service-dialog/service-dialog';

@Component({
  selector: 'app-services',
  imports: [ServiceDialog],
  templateUrl: './services.html',
  styleUrl: './services.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Services {
  private readonly servicesSvc = inject(ServicesService);

  readonly services = this.servicesSvc.services;

  readonly dialogOpen = signal(false);
  readonly editing = signal<ServiceItem | null>(null);

  openAdd(): void {
    this.editing.set(null);
    this.dialogOpen.set(true);
  }

  openEdit(item: ServiceItem): void {
    this.editing.set(item);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
  }

  save(draft: ServiceDraft): void {
    const editing = this.editing();
    if (editing) {
      this.servicesSvc.updateService(editing.id, draft);
    } else {
      this.servicesSvc.addService(draft);
    }
    this.closeDialog();
  }
}
