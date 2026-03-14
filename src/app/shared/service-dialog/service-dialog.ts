import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { ServiceItem } from '../../data/services.service';

export type ServiceDraft = Omit<ServiceItem, 'id'>;

@Component({
  selector: 'pc-service-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './service-dialog.html',
  styleUrl: './service-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pc-dialog-host',
  },
})
export class ServiceDialog {
  isOpen = input<boolean>(false);
  title = input<string>('Service');
  initial = input<ServiceItem | null>(null);

  save = output<ServiceDraft>();
  closed = output<void>();

  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({
    name: this.fb.control('', { validators: [Validators.required, Validators.maxLength(80)] }),
    durationMin: this.fb.control(30, { validators: [Validators.required, Validators.min(5), Validators.max(600)] }),
    priceBgn: this.fb.control(0, { validators: [Validators.required, Validators.min(0), Validators.max(10000)] }),
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
        // hydrate form on open
        const init = this.initial();
        this.submitted.set(false);
        if (init) {
          this.form.setValue({
            name: init.name,
            durationMin: init.durationMin,
            priceBgn: init.priceBgn,
            active: init.active,
          });
        } else {
          this.form.setValue({ name: '', durationMin: 30, priceBgn: 0, active: true });
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
}
