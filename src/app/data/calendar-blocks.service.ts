import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, map } from 'rxjs';

export type CalendarBlock = {
  id: string;
  staffId: string;
  title: string;
  notes?: string;
  startIso: string;
  endIso: string;
  createdByUserId?: string;
};

export type CalendarBlockCreate = {
  staffId: string;
  title: string;
  notes?: string;
  startIso: string;
  endIso: string;
};

type CalendarBlockApiResponse = {
  id: number;
  staffId: string;
  title: string;
  notes?: string | null;
  startIso?: string | null;
  startAt?: string | null;
  endIso?: string | null;
  endAt?: string | null;
  createdByUserId?: string | null;
};

@Injectable({ providedIn: 'root' })
export class CalendarBlocksService {
  private readonly http = inject(HttpClient);

  fetchAll(staffId?: string | null): Observable<CalendarBlock[]> {
    const params = staffId ? { staffId } : undefined;

    return this.http
      .get<CalendarBlockApiResponse[]>('/api/company/calendar-blocks', { params })
      .pipe(map(items => items.map(item => this.mapFromApi(item))));
  }

  async create(payload: CalendarBlockCreate): Promise<CalendarBlock> {
    const created = await firstValueFrom(
      this.http.post<CalendarBlockApiResponse>('/api/company/calendar-blocks', payload),
    );

    return this.mapFromApi(created);
  }

  private mapFromApi(item: CalendarBlockApiResponse): CalendarBlock {
    return {
      id: String(item.id),
      staffId: item.staffId,
      title: item.title,
      notes: item.notes ?? undefined,
      startIso: item.startIso ?? item.startAt ?? '',
      endIso: item.endIso ?? item.endAt ?? '',
      createdByUserId: item.createdByUserId ?? undefined,
    };
  }
}
