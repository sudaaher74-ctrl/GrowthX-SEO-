"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MultiAiRouterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiAiRouterService = exports.ModelType = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const genai_1 = require("@google/genai");
var ModelType;
(function (ModelType) {
    ModelType["REASONING"] = "REASONING";
    ModelType["CODE_GEN"] = "CODE_GEN";
    ModelType["INDEXING"] = "INDEXING";
})(ModelType || (exports.ModelType = ModelType = {}));
let MultiAiRouterService = MultiAiRouterService_1 = class MultiAiRouterService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(MultiAiRouterService_1.name);
    }
    async generateResponse(prompt, modelType, systemInstruction) {
        this.logger.log(`Routing task to model type: ${modelType}`);
        if (modelType === ModelType.REASONING) {
            return this.callGemini(prompt, systemInstruction);
        }
        else if (modelType === ModelType.CODE_GEN) {
            return this.callOpenAiMock(prompt, systemInstruction);
        }
        else {
            return this.callFastModelMock(prompt, systemInstruction);
        }
    }
    async callGemini(prompt, systemInstruction) {
        this.logger.log('Executing via Google Gemini API...');
        const apiKey = this.configService.get('GEMINI_API_KEY');
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not configured in .env');
        }
        const ai = new genai_1.GoogleGenAI({ apiKey });
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
    async callOpenAiMock(prompt, systemInstruction) {
        this.logger.log('Executing via OpenAI GPT-4o Mock API...');
        throw new common_1.NotImplementedException('OpenAI GPT-4o integration is pending.');
    }
    async callFastModelMock(prompt, systemInstruction) {
        this.logger.log('Executing via Fast Local Model Mock...');
        throw new common_1.NotImplementedException('Local Fast Model integration is pending.');
    }
};
exports.MultiAiRouterService = MultiAiRouterService;
exports.MultiAiRouterService = MultiAiRouterService = MultiAiRouterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MultiAiRouterService);
//# sourceMappingURL=multi-ai-router.service.js.map