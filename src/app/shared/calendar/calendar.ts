import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import type { CalendarOptions, EventInput } from '@fullcalendar/core';
import { AppointmentsService } from '../../data/appointments.service';

type CalendarEventClass =
  | 'pc-event--consultation'
  | 'pc-event--vaccination'
  | 'pc-event--grooming'
  | 'pc-event--dental'
  | 'pc-event--default';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FullCalendarModule],
})
export class Calendar implements AfterViewInit {
  private readonly appts = inject(AppointmentsService);

  @ViewChild(FullCalendarComponent)
  private calendarComponent?: FullCalendarComponent;

  staffId = input<string | null>(null);
  addRequested = output<void>();

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
    const nowIso = new Date().toISOString();

    const confirmed = this.appts
      .all()
      .filter(a => a.status === 'CONFIRMED')
      .filter(a => (staffId ? a.staffId === staffId : true))
      .slice()
      .sort((a, b) => a.startIso.localeCompare(b.startIso));

    const next = confirmed.find(a => a.startIso >= nowIso) ?? confirmed[0];
    return next?.startIso ?? null;
  });

  private readonly events = computed<EventInput[]>(() => {
    const staffId = this.staffId();

    return this.appts
      .all()
      .filter(a => a.status === 'CONFIRMED')
      .filter(a => (staffId ? a.staffId === staffId : true))
      .map(a => ({
        id: a.id,
        title: a.petName ? `${a.petName} - ${a.service}` : a.service,
        start: a.startIso,
        end: a.endIso,
        classNames: [this.eventClassFor(a.service)],
      }));
  });

  readonly options = computed<CalendarOptions>(() => ({
    plugins: [timeGridPlugin, interactionPlugin],
    initialView: 'timeGridWeek',
    initialDate: this.focusDateIso() ?? undefined,
    timeZone: 'local',
    locale: 'en-gb',
    firstDay: 1,
    allDaySlot: false,
    nowIndicator: false,
    expandRows: true,
    contentHeight: 720,
    slotMinTime: '09:00:00',
    slotMaxTime: '19:00:00',
    slotDuration: '01:00:00',
    dayHeaderFormat: { weekday: 'short' },
    headerToolbar: {
    left: '',
    center: 'title',
    right: '',
    },
    buttonText: {
      today: 'Today',
    },
    events: this.events(),
  }));

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.calendarComponent?.getApi().updateSize();
    });
  }

  requestAdd(): void {
    this.addRequested.emit();
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
}