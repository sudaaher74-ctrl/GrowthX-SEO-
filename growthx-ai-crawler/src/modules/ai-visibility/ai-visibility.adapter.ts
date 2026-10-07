import { Injectable } from '@nestjs/common';

@Injectable()
export class AiVisibilityAdapter {
  source = 'MARKET' as any;
  
  async getRecentFindings(projectId: string) {
    return [];
  }

  async collect(projectId: string) {
    return [];
  }
}
