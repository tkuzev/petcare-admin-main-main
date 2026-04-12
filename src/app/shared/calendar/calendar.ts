import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { CalendarOptions, EventInput } from '@fullcalendar/core';
import { Appointment } from '../../data/appointments.service';
import { CalendarBlock } from '../../data/calendar-blocks.service';
import { StaffMember } from '../../data/staff.service';

type CalendarEventClass =
  | 'pc-event--consultation'
  | 'pc-event--vaccination'
  | 'pc-event--grooming'
  | 'pc-event--dental'
  | 'pc-event--default'
  | 'pc-event--completed'
  | 'pc-event--blocked';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FullCalendarModule, FormsModule],
})
export class Calendar implements AfterViewInit {
  @ViewChild(FullCalendarComponent)
  private calendarComponent?: FullCalendarComponent;

  staffId = input<string | null>(null);
  appointments = input<Appointment[]>([]);
  blocks = input<CalendarBlock[]>([]);
  calendarOwners = input<StaffMember[]>([]);
  canSwitchCalendars = input(false);
  canBlockCalendars = input(false);
  addRequested = output<void>();
  blockRequested = output<void>();
  staffChanged = output<string | null>();
  appointmentSelected = output<string>();

  private readonly calendarReady = signal(false);

  private eventClassFor(service: string): CalendarEventClass {
    const normalized = service.trim().toLowerCase();

    if (normalized.includes('consult')) return 'pc-event--consultation';
    if (normalized.includes('vaccin')) return 'pc-event--vaccination';
    if (normalized.includes('groom')) return 'pc-event--grooming';
    if (normalized.includes('dental')) return 'pc-event--dental';

    return 'pc-event--default';
  }

  private readonly focusDateIso = computed<string | null>(() => {
    const staffId = this.staffId();

    const rows = [...this.appointments(), ...this.blocks()]
      .filter(a => (staffId ? a.staffId === staffId : true))
      .slice()
      .sort((a, b) => a.startIso.localeCompare(b.startIso));

    if (rows.length === 0) {
      return null;
    }

    const now = Date.now();
    let best = rows[0]!;
    let bestDistance = Math.abs(new Date(best.startIso).getTime() - now);

    for (const row of rows.slice(1)) {
      const distance = Math.abs(new Date(row.startIso).getTime() - now);
      if (distance < bestDistance) {
        best = row;
        bestDistance = distance;
      }
    }

    return best.startIso;
  });

  private readonly events = computed<EventInput[]>(() => {
    const staffId = this.staffId();

    const appointmentEvents = this.appointments()
      .filter(a => (staffId ? a.staffId === staffId : true))
      .map(a => ({
        id: a.id,
        title: a.petName ? `${a.petName} - ${a.service}` : a.service,
        start: a.startIso,
        end: a.endIso,
        classNames: [
          this.eventClassFor(a.service),
          a.status === 'COMPLETED' ? 'pc-event--completed' : 'pc-event--default',
        ],
      }));

    const blockEvents = this.blocks()
      .filter(a => (staffId ? a.staffId === staffId : true))
      .map(a => ({
        id: `block:${a.id}`,
        title: a.title,
        start: a.startIso,
        end: a.endIso,
        editable: false,
        allDay: this.isFullDayBlock(a),
        display: this.isFullDayBlock(a) ? 'background' : 'auto',
        classNames: ['pc-event--blocked'],
        extendedProps: { kind: 'block' },
      }));

    return [...appointmentEvents, ...blockEvents];
  });

  readonly options = computed<CalendarOptions>(() => ({
    plugins: [timeGridPlugin, interactionPlugin],
    initialView: 'timeGridWeek',
    initialDate: this.focusDateIso() ?? undefined,
    timeZone: 'local',
    locale: 'en-gb',
    firstDay: 1,
    allDaySlot: true,
    nowIndicator: false,
    expandRows: true,
    contentHeight: 720,
    slotMinTime: '07:00:00',
    slotMaxTime: '20:00:00',
    slotDuration: '00:30:00',
    dayHeaderFormat: { weekday: 'short' },
    headerToolbar: {
    left: '',
    center: 'title',
    right: '',
    },
    buttonText: {
      today: 'Today',
    },
    eventClick: info => {
      if (info.event.id && !String(info.event.id).startsWith('block:')) {
        this.appointmentSelected.emit(info.event.id);
      }
    },
    events: this.events(),
  }));

  constructor() {
    effect(() => {
      if (!this.calendarReady()) {
        return;
      }

      const api = this.calendarComponent?.getApi();
      if (!api) {
        return;
      }

      const focusDate = this.focusDateIso();

      if (focusDate) {
        api.gotoDate(focusDate);
      }

      queueMicrotask(() => {
        api.updateSize();
      });
    });
  }

  ngAfterViewInit(): void {
    this.calendarReady.set(true);

    queueMicrotask(() => {
      this.calendarComponent?.getApi().updateSize();
    });
  }

  requestAdd(): void {
    this.addRequested.emit();
  }

  requestBlock(): void {
    this.blockRequested.emit();
  }

  goToPreviousWeek(): void {
    this.calendarComponent?.getApi().prev();
  }

  goToNextWeek(): void {
    this.calendarComponent?.getApi().next();
  }

  goToToday(): void {
    this.calendarComponent?.getApi().today();
  }

  onStaffChange(value: string): void {
    this.staffChanged.emit(value || null);
  }

  private isFullDayBlock(block: CalendarBlock): boolean {
    return block.startIso.endsWith('T00:00:00') && block.endIso.endsWith('T00:00:00');
  }
}
