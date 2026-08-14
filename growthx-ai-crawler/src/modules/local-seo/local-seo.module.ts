import { Module } from '@nestjs/common';
import { LocalSeoService } from './local-seo.service';
import { LocalSeoController } from './local-seo.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [LocalSeoController],
  providers: [LocalSeoService],
  exports: [LocalSeoService],
})
export class LocalSeoModule {}
