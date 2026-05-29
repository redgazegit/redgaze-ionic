import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { RedgifsApiService } from './services/redgifs-api.service';
import { ThemeService } from './services/theme.service';
import { SettingsService } from './services/settings.service';
import { IonicModule } from '@ionic/angular';

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss'],
    imports: [IonicModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  private api = inject(RedgifsApiService);
  private theme = inject(ThemeService);
  private settings = inject(SettingsService);

  ngOnInit() {
    this.api.getAllTags().subscribe();
  }
}
