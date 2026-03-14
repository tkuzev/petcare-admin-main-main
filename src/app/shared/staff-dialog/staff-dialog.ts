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
import { StaffMember, StaffRole } from '../../data/staff.service';

export type StaffDraft = Omit<StaffMember, 'id'>;

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

  readonly roles: readonly StaffRole[] = ['Vet', 'Groomer', 'Reception'];

  private readonly fb = inject(NonNullableFormBuilder);

  readonly form = this.fb.group({
    name: this.fb.control('', { validators: [Validators.required, Validators.maxLength(80)] }),
    role: this.fb.control<StaffRole>('Vet', { validators: [Validators.required] }),
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
          this.form.setValue({ name: init.name, role: init.role, active: init.active });
        } else {
          this.form.setValue({ name: '', role: 'Vet', active: true });
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
