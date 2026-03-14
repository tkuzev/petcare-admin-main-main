import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
})
export class Layout {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly pageTitle$ = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map(() => this.deepestTitle(this.route) ?? 'Dashboard'),
  );

  /** Title shown in the top bar (derived from route title). */
  readonly title = toSignal(this.pageTitle$, { initialValue: 'Dashboard' });

  /** Current url for active link styling, etc. */
  readonly url = toSignal(this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map(() => this.router.url),
  ), { initialValue: this.router.url });

  private deepestTitle(ar: ActivatedRoute): string | null {
    let cursor: ActivatedRoute | null = ar;
    while (cursor?.firstChild) cursor = cursor.firstChild;
    return (cursor?.snapshot.title ?? null) as string | null;
  }
}
