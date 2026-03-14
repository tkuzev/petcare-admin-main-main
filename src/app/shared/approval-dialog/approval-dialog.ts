import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  effect,
  input,
  output,
} from '@angular/core';
import { AppointmentStatus } from '../../data/appointments.service';

export type AppointmentRequest = {
  id: string;
  petType: 'Dog' | 'Cat' | 'Other';
  service: string;
  dayLabel: string;   // "Tuesday"
  timeLabel: string;  // "14:00"
  status: AppointmentStatus;
  ownerName?: string;
  notes?: string;
  staffName?: string;
};

@Component({
  selector: 'pc-approval-dialog',
  template: `
    <dialog #dlg class="pc-dialog" aria-labelledby="dlg-title" aria-describedby="dlg-desc">
      <form method="dialog" class="pc-dialog__inner">
        <header class="pc-dialog__header">
          <div>
            <div class="muted">Approval request</div>
            <h2 id="dlg-title" class="pc-dialog__title">Review appointment</h2>
          </div>

          <button type="button" class="pc-icon-btn" (click)="close()">✕</button>
        </header>

        <div class="pc-dialog__divider"></div>

        @if (request(); as r) {
          <section class="pc-dialog__body">
            <p id="dlg-desc" class="muted">
              Confirm or decline this booking request.
            </p>

            <div class="pc-kv">
              <div class="pc-kv__row">
                <div class="pc-kv__k">Pet</div>
                <div class="pc-kv__v">{{ r.petType }}</div>
              </div>
              <div class="pc-kv__row">
                <div class="pc-kv__k">Service</div>
                <div class="pc-kv__v">{{ r.service }}</div>
              </div>
              <div class="pc-kv__row">
                <div class="pc-kv__k">When</div>
                <div class="pc-kv__v">{{ r.dayLabel }} · {{ r.timeLabel }}</div>
              </div>

              @if (r.ownerName) {
                <div class="pc-kv__row">
                  <div class="pc-kv__k">Owner</div>
                  <div class="pc-kv__v">{{ r.ownerName }}</div>
                </div>
              }

              @if (r.notes) {
                <div class="pc-kv__row">
                  <div class="pc-kv__k">Notes</div>
                  <div class="pc-kv__v">{{ r.notes }}</div>
                </div>
              }
              @if (r.staffName) {
                <div class="pc-kv__row">
                  <div class="pc-kv__k">Doctor</div>
                  <div class="pc-kv__v">{{ r.staffName }}</div>
                </div>
              }
            </div>
          </section>

          <div class="pc-dialog__divider"></div>

          <footer class="pc-dialog__footer">
            <button type="button" class="btn" (click)="close()">Cancel</button>
            <div style="display:flex; gap:10px;">
              <button type="button" class="btn" (click)="decline.emit(r.id)">Decline</button>
              <button type="button" class="btn btn--primary" (click)="approve.emit(r.id)">Approve</button>
            </div>
          </footer>
        }
      </form>
    </dialog>
  `,
  styleUrl: './approval-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // make sure it's not taking space
    class: 'pc-dialog-host',
  },
})
export class ApprovalDialog {
  request = input<AppointmentRequest | null>(null);
  isOpen = input<boolean>(false);

  approve = output<string>();
  decline = output<string>();
  closed = output<void>();

  @ViewChild('dlg', { static: true })
  private dlg?: ElementRef<HTMLDialogElement>;

  constructor() {
    effect(() => {
      const el = this.dlg?.nativeElement;
      if (!el) return;

      if (this.isOpen()) {
        if (!el.open) el.showModal();
      } else {
        if (el.open) el.close();
      }
    });
  }

  close(): void {
    this.closed.emit();
  }
}
