import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService, UpdateProfileRequest } from '../data/auth.service';
import { ProfileDialog } from '../shared/profile-dialog/profile-dialog';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.html',
  styleUrl: './layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ProfileDialog],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenus()',
  },
})
export class Layout {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  protected readonly isProfileMenuOpen = signal(false);
  protected readonly isProfileDialogOpen = signal(false);
  protected readonly isProfileSaving = signal(false);

  protected readonly currentUser = this.authService.user;
  protected readonly canAccessStaff = computed(() => this.authService.hasCompanyRole('OWNER', 'COMPANY_ADMIN'));
  protected readonly avatarLabel = computed(() => {
    const name = this.currentUser()?.name?.trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  });

  private readonly pageTitle$ = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map(() => this.deepestTitle(this.route) ?? 'Dashboard'),
  );

  readonly title = toSignal(this.pageTitle$, { initialValue: 'Dashboard' });

  readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected toggleProfileMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isProfileMenuOpen.update((value) => !value);
  }

  protected openProfileDialog(): void {
    this.isProfileMenuOpen.set(false);
    this.isProfileDialogOpen.set(true);
  }

  protected closeProfileDialog(): void {
    this.isProfileDialogOpen.set(false);
  }

  protected async logout(): Promise<void> {
    this.isProfileMenuOpen.set(false);
    this.authService.logout();
    await this.router.navigateByUrl('/login');
  }

  protected async saveProfile(payload: UpdateProfileRequest): Promise<void> {
    this.isProfileSaving.set(true);

    try {
      await this.authService.updateProfile(payload);
      this.isProfileDialogOpen.set(false);
    } finally {
      this.isProfileSaving.set(false);
    }
  }

  protected closeMenus(): void {
    this.isProfileMenuOpen.set(false);
  }

  protected onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('[data-profile-menu-root]')) {
      this.isProfileMenuOpen.set(false);
    }
  }

  private deepestTitle(ar: ActivatedRoute): string | null {
    let cursor: ActivatedRoute | null = ar;
    while (cursor?.firstChild) cursor = cursor.firstChild;
    return (cursor?.snapshot.title ?? null) as string | null;
  }
}
