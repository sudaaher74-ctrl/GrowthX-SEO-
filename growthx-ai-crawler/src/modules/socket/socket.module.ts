import { Global, Module } from '@nestjs/common';
import { CrawlerGateway } from './crawler.gateway';

@Global()
@Module({
  providers: [CrawlerGateway],
  exports: [CrawlerGateway],
})
export class SocketModule {}
