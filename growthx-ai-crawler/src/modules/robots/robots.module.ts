import { Global, Module } from '@nestjs/common';
import { RobotsService } from './robots.service';

@Global()
@Module({
  providers: [RobotsService],
  exports: [RobotsService],
})
export class RobotsModule {}
