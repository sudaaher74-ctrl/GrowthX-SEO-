import { Injectable } from '@nestjs/common';
import {
  ALERT_CTR_PTS,
  ALERT_MIN_PREVIOUS,
  ALERT_PCT,
  ALERT_POSITION_PLACES,
  PAGE_DROP_MIN_CLICKS,
  PAGE_DROP_PCT,
  detectAlerts,
} from './google-alerts';
import { GoogleOverviewService, GoogleWindow } from './google-overview.service';

/** Changes and alerts, detected on read from the two stored periods the overview already compares. */
@Injectable()
export class GoogleAlertsService {
  constructor(private readonly google: GoogleOverviewService) {}

  async alerts(projectId: string, days: GoogleWindow) {
    const [overview, pages] = await Promise.all([this.google.overview(projectId, days), this.google.pages(projectId, days, { limit: 500 })]);
    const comparable = overview.kpis.some((k) => k.delta !== null);
    const alerts = detectAlerts(
      overview.kpis,
      pages.rows.flatMap((r) => (r.gsc && r.gsc.previousClicks !== null ? [{ url: r.url, previousClicks: r.gsc.previousClicks, clicks: r.gsc.clicks }] : [])),
      days,
    );
    return {
      days,
      /** False when no earlier period is stored, so "no alerts" is not read as "nothing changed". */
      comparable,
      alerts,
      rules: { alertPct: ALERT_PCT, minPrevious: ALERT_MIN_PREVIOUS, ctrPoints: ALERT_CTR_PTS, positionPlaces: ALERT_POSITION_PLACES, pageDropPct: PAGE_DROP_PCT, pageDropMinClicks: PAGE_DROP_MIN_CLICKS },
    };
  }
}
