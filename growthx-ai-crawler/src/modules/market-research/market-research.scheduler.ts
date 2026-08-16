import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutcomeMeasurementService } from './outcome-measurement.service';
import { WeeklyDeltaService } from './weekly-delta.service';

/**
 * Background work for Phase 3.
 *
 * Both jobs are opt-out via env so a deployment that is not ready for scheduled
 * spend can disable them without a code change. Neither job writes anything a
 * customer sees without a person looking first: deltas are reports, and
 * measurement only records numbers.
 */
@Injectable()
export class MarketResearchScheduler {
  private readonly logger = new Logger(MarketResearchScheduler.name);

  constructor(
    private readonly config: ConfigService,
    private readonly outcomes: OutcomeMeasurementService,
    private readonly weekly: WeeklyDeltaService,
  ) {}

  private enabled(key: string): boolean {
    return (this.config.get<string>(key) ?? 'true') !== 'false';
  }

  /** Re-measures converted work that is old enough to have moved. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async measureOutcomes() {
    if (!this.enabled('MARKET_RESEARCH_MEASUREMENT_ENABLED')) return;
    try {
      await this.outcomes.measureDueOutcomes();
    } catch (error) {
      this.logger.error(`Outcome measurement sweep failed: ${String(error)}`);
    }
  }

  /** Monday-morning client delta for every project with research activity. */
  @Cron(CronExpression.EVERY_WEEK)
  async weeklyDeltas() {
    if (!this.enabled('MARKET_RESEARCH_WEEKLY_DELTA_ENABLED')) return;
    try {
      const generated = await this.weekly.generateForAllProjects();
      this.logger.log(`Generated ${generated} weekly market delta(s).`);
    } catch (error) {
      this.logger.error(`Weekly delta sweep failed: ${String(error)}`);
    }
  }
}
