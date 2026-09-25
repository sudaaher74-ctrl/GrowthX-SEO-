import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AutopilotService } from './autopilot.service';

/** Moves autopilot runs on while nobody has the page open. */
@Injectable()
export class AutopilotScheduler {
  private readonly logger = new Logger(AutopilotScheduler.name);
  private running = false;

  constructor(private readonly autopilot: AutopilotService) {}

  @Interval(30_000)
  async advanceRuns() {
    if (this.running) return;
    this.running = true;
    try {
      await this.autopilot.tick();
    } catch (err) {
      this.logger.warn(`Autopilot tick failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
