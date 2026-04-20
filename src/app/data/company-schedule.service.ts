import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type WorkingDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type CompanySchedule = {
  workingStartTime: string;
  workingEndTime: string;
  workingDays: WorkingDay[];
  workingSchedule: WorkingDaySchedule[];
};

export type WorkingDaySchedule = {
  day: WorkingDay;
  startTime: string;
  endTime: string;
};

type CompanyScheduleApiResponse = {
  workingStartTime?: string | null;
  workingEndTime?: string | null;
  workingDays?: WorkingDay[] | null;
  workingSchedule?: Array<{
    day: WorkingDay;
    startTime?: string | null;
    endTime?: string | null;
  }> | null;
};

@Injectable({ providedIn: 'root' })
export class CompanyScheduleService {
  private readonly http = inject(HttpClient);
  private readonly _schedule = signal<CompanySchedule | null>(null);

  readonly schedule = this._schedule.asReadonly();

  load(): void {
    this.http.get<CompanyScheduleApiResponse>('/api/company/schedule').subscribe({
      next: item => this._schedule.set(this.mapFromApi(item)),
      error: error => console.error('Failed to load company schedule', error),
    });
  }

  async update(schedule: CompanySchedule): Promise<void> {
    const updated = await firstValueFrom(
      this.http.put<CompanyScheduleApiResponse>('/api/company/schedule', {
        workingStartTime: this.normalizeApiTime(schedule.workingStartTime),
        workingEndTime: this.normalizeApiTime(schedule.workingEndTime),
        workingDays: schedule.workingDays,
        workingSchedule: schedule.workingSchedule.map(item => ({
          day: item.day,
          startTime: this.normalizeApiTime(item.startTime),
          endTime: this.normalizeApiTime(item.endTime),
        })),
      }),
    );

    this._schedule.set(this.mapFromApi(updated));
  }

  private mapFromApi(item: CompanyScheduleApiResponse): CompanySchedule {
    const fallbackDays = item.workingDays?.length
      ? item.workingDays
      : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] satisfies WorkingDay[];
    const fallbackStart = this.normalizeDisplayTime(item.workingStartTime) ?? '09:00';
    const fallbackEnd = this.normalizeDisplayTime(item.workingEndTime) ?? '17:00';
    const workingSchedule = item.workingSchedule?.length
      ? item.workingSchedule.map(row => ({
          day: row.day,
          startTime: this.normalizeDisplayTime(row.startTime) ?? fallbackStart,
          endTime: this.normalizeDisplayTime(row.endTime) ?? fallbackEnd,
        }))
      : fallbackDays.map(day => ({
          day,
          startTime: fallbackStart,
          endTime: fallbackEnd,
        }));

    return {
      workingStartTime: fallbackStart,
      workingEndTime: fallbackEnd,
      workingDays: workingSchedule.map(row => row.day),
      workingSchedule,
    };
  }

  private normalizeDisplayTime(value?: string | null): string | undefined {
    if (!value) {
      return undefined;
    }
    return value.trim().slice(0, 5);
  }

  private normalizeApiTime(value: string): string {
    const trimmed = value.trim();
    return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
  }
}
