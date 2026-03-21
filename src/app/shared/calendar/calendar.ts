// import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';
// import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
// import interactionPlugin from '@fullcalendar/interaction';
// import timeGridPlugin from '@fullcalendar/timegrid';
// import type { CalendarOptions, EventInput } from '@fullcalendar/core';
// import { AppointmentsService, AppointmentCreate } from '../../data/appointments.service';

// @Component({
//   selector: 'app-calendar',
//   templateUrl: './calendar.html',
//   changeDetection: ChangeDetectionStrategy.OnPush,
//   imports: [FullCalendarModule],
// })
// export class Calendar {
//   private readonly appts = inject(AppointmentsService);

//   private readonly calendarCmp = viewChild(FullCalendarComponent);

//   /** Filter the calendar to a single team member. If null, shows all confirmed appointments. */
//   staffId = input<string | null>(null);

//   addOpen = signal(false);

//   private readonly events = computed<EventInput[]>(() => {
//     const staffId = this.staffId();
//     const confirmed = this.appts
//       .all()
//       .filter(a => a.status === 'CONFIRMED')
//       .filter(a => (staffId ? a.staffId === staffId : true));
//     return confirmed.map(a => ({
//       id: a.id,
//       title: a.petName ? `${a.petType} · ${a.petName} · ${a.service}` : `${a.petType} · ${a.service}`,
//       start: a.startIso,
//       end: a.endIso,
//     }));
//   });

//   /**
//    * FullCalendar opens on the *current* week.
//    * If the next confirmed appointment is in a different week (very common), it looks like “nothing is shown”.
//    * We auto-focus the calendar to the next upcoming confirmed appointment (per staff filter).
//    */
//   private readonly focusDateIso = computed<string | null>(() => {
//     const staffId = this.staffId();
//     const nowIso = new Date().toISOString();

//     const confirmed = this.appts
//       .all()
//       .filter(a => a.status === 'CONFIRMED')
//       .filter(a => (staffId ? a.staffId === staffId : true))
//       .slice()
//       .sort((a, b) => a.startIso.localeCompare(b.startIso));

//     const next = confirmed.find(a => a.startIso >= nowIso) ?? confirmed[0];
//     return next?.startIso ?? null;
//   });

//   constructor() {
//     // When events change (approve/filters), jump to the relevant week/day so the user *sees* something.
//     effect(() => {
//       const iso = this.focusDateIso();
//       const cmp = this.calendarCmp();
//       if (!iso || !cmp) return;
//     });
//   }

//   readonly options = computed<CalendarOptions>(() => ({
//     plugins: [timeGridPlugin, interactionPlugin],
//     initialView: 'timeGridWeek',
//     initialDate: this.focusDateIso() ?? undefined,
//     timeZone: 'local',
//     height: 'auto',
//     nowIndicator: true,
//     firstDay: 1,
//     allDaySlot: false,
//     slotMinTime: '08:00:00',
//     slotMaxTime: '20:00:00',
//     headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
//     events: this.events() as unknown as CalendarOptions['events'],
//   }));

//   openAdd(): void {
//     this.addOpen.set(true);
//   }

//   closeAdd(): void {
//     this.addOpen.set(false);
//   }

//   saveAdd(payload: AppointmentCreate): void {
//     // datetime-local връща "YYYY-MM-DDTHH:mm" (без timezone).
//     // Ако искаш всичко да е UTC в бекенда, после ще нормализираме.
//     this.appts.create(payload);
//     this.closeAdd();
//   }
// }