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
  petType: string;
  service: string;
  dayLabel: string;
  timeLabel: string;
  status: AppointmentStatus;
  ownerEmail?: string;
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

        @if (request(); as requestItem) {
          <section class="pc-dialog__body">
            <p id="dlg-desc" class="muted">
              Confirm or decline this booking request.
            </p>

            <div class="pc-kv">
              <div class="pc-kv__row">
                <div class="pc-kv__k">Pet</div>
                <div class="pc-kv__v">{{ requestItem.petType }}</div>
              </div>
              <div class="pc-kv__row">
                <div class="pc-kv__k">Service</div>
                <div class="pc-kv__v">{{ requestItem.service }}</div>
              </div>
              <div class="pc-kv__row">
                <div class="pc-kv__k">When</div>
                <div class="pc-kv__v">{{ requestItem.dayLabel }} · {{ requestItem.timeLabel }}</div>
              </div>

              @if (requestItem.ownerEmail) {
                <div class="pc-kv__row">
                  <div class="pc-kv__k">Owner email</div>
                  <div class="pc-kv__v">{{ requestItem.ownerEmail }}</div>
                </div>
              }

              @if (requestItem.notes) {
                <div class="pc-kv__row">
                  <div class="pc-kv__k">Notes</div>
                  <div class="pc-kv__v">{{ requestItem.notes }}</div>
                </div>
              }

              @if (requestItem.staffName) {
                <div class="pc-kv__row">
                  <div class="pc-kv__k">Doctor</div>
                  <div class="pc-kv__v">{{ requestItem.staffName }}</div>
                </div>
              }
            </div>
          </section>

          <div class="pc-dialog__divider"></div>

          <footer class="pc-dialog__footer">
            <button type="button" class="btn" (click)="close()">Cancel</button>
            <div style="display:flex; gap:10px;">
              <button type="button" class="btn" (click)="decline.emit(requestItem.id)">Decline</button>
              <button type="button" class="btn btn--primary" (click)="approve.emit(requestItem.id)">Approve</button>
            </div>
          </footer>
        }
      </form>
    </dialog>
  `,
  styleUrl: './approval-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
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
      if (!el) {
        return;
      }

      if (this.isOpen()) {
        if (!el.open) {
          el.showModal();
        }
      } else if (el.open) {
        el.close();
      }
    });
  }

  close(): void {
    this.closed.emit();
  }
}