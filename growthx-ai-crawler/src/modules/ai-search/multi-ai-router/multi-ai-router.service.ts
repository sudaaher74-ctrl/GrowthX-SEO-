import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

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
    
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in .env');
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
      }
    });

    return response.text || '';
  }

  private async callOpenAiMock(prompt: string, systemInstruction?: string): Promise<string> {
    this.logger.log('Executing via OpenAI GPT-4o Mock API...');
    throw new NotImplementedException('OpenAI GPT-4o integration is pending.');
  }

  private async callFastModelMock(prompt: string, systemInstruction?: string): Promise<string> {
    this.logger.log('Executing via Fast Local Model Mock...');
    throw new NotImplementedException('Local Fast Model integration is pending.');
  }
}

