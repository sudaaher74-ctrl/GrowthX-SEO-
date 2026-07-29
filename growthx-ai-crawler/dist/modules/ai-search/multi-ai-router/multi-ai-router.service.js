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
        // Real implementation would use @google/genai SDK here.
        // For now, we mock the tool-calling output to simulate the RAG response.
        return Promise.resolve(`(Mock Gemini Response)\n\nBased on the evidence gathered:\n- Traffic dropped by 15%\n- 12 pages are missing canonicals.\n\nRecommended Fix: Run the Auto-Fix workflow to patch layout.tsx metadata.`);
    }
    async callOpenAiMock(prompt, systemInstruction) {
        this.logger.log('Executing via OpenAI GPT-4o Mock API...');
        return Promise.resolve(`(Mock GPT-4o Code Gen)\n\n{\n  "metadata": {\n    "title": "Fixed Title"\n  }\n}`);
    }
    async callFastModelMock(prompt, systemInstruction) {
        this.logger.log('Executing via Fast Local Model Mock...');
        return Promise.resolve(`(Mock Fast Model) Indexed 45 files.`);
    }
};
exports.MultiAiRouterService = MultiAiRouterService;
exports.MultiAiRouterService = MultiAiRouterService = MultiAiRouterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MultiAiRouterService);
//# sourceMappingURL=multi-ai-router.service.js.map