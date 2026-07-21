import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-skeleton-card',
  standalone: true,
  template: `
    <div class="sk-card">
      <div class="sk-thumb"></div>
      <div class="sk-info">
        <div class="sk-line w-60"></div>
      </div>
    </div>
  `,
  styles: [`
    .sk-card {
      border-radius: var(--rg-radius-md);
      overflow: hidden;
      background: var(--rg-surface-raised);

      .sk-thumb {
        width: 100%;
        padding-bottom: 100%;
        background: linear-gradient(90deg,
          var(--rg-surface-raised) 25%,
          var(--rg-surface-overlay) 50%,
          var(--rg-surface-raised) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
      }

      .sk-info { padding: var(--rg-space-2) var(--rg-space-2) var(--rg-space-3); }

      .sk-line {
        height: 12px;
        border-radius: var(--rg-radius-sm);
        background: linear-gradient(90deg,
          var(--rg-surface-overlay) 25%,
          color-mix(in srgb, var(--rg-surface-overlay), var(--rg-surface-border) 50%) 50%,
          var(--rg-surface-overlay) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        &.w-60 { width: 60%; }
      }
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonCardComponent {}
