import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum ModelType {
  REASONING = 'REASONING', // Gemini Pro / Claude
  CODE_GEN = 'CODE_GEN',   // GPT-4o / Gemini
  INDEXING = 'INDEXING',   // Fast local / small models
}

@Injectable()
export class MultiAiRouterService {
  private readonly logger = new Logger(MultiAiRouterService.name);
  
  constructor(private configService: ConfigService) {}

  async generateResponse(prompt: string, modelType: ModelType, systemInstruction?: string): Promise<string> {
    this.logger.log(`Routing task to model type: ${modelType}`);

    if (modelType === ModelType.REASONING) {
      return this.callGemini(prompt, systemInstruction);
    } else if (modelType === ModelType.CODE_GEN) {
      return this.callOpenAiMock(prompt, systemInstruction);
    } else {
      return this.callFastModelMock(prompt, systemInstruction);
    }
  }

  private async callGemini(prompt: string, systemInstruction?: string): Promise<string> {
    this.logger.log('Executing via Google Gemini API...');
    // Real implementation would use @google/genai SDK here.
    // For now, we mock the tool-calling output to simulate the RAG response.
    return Promise.resolve(`(Mock Gemini Response)\n\nBased on the evidence gathered:\n- Traffic dropped by 15%\n- 12 pages are missing canonicals.\n\nRecommended Fix: Run the Auto-Fix workflow to patch layout.tsx metadata.`);
  }

  private async callOpenAiMock(prompt: string, systemInstruction?: string): Promise<string> {
    this.logger.log('Executing via OpenAI GPT-4o Mock API...');
    return Promise.resolve(`(Mock GPT-4o Code Gen)\n\n{\n  "metadata": {\n    "title": "Fixed Title"\n  }\n}`);
  }

  private async callFastModelMock(prompt: string, systemInstruction?: string): Promise<string> {
    this.logger.log('Executing via Fast Local Model Mock...');
    return Promise.resolve(`(Mock Fast Model) Indexed 45 files.`);
  }
}

