"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzerModule = void 0;
const common_1 = require("@nestjs/common");
const image_analyzer_service_1 = require("./image-analyzer.service");
const link_analyzer_service_1 = require("./link-analyzer.service");
const schema_validator_service_1 = require("./schema-validator.service");
const content_analyzer_service_1 = require("./content-analyzer.service");
let AnalyzerModule = class AnalyzerModule {
};
exports.AnalyzerModule = AnalyzerModule;
exports.AnalyzerModule = AnalyzerModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [image_analyzer_service_1.ImageAnalyzerService, link_analyzer_service_1.LinkAnalyzerService, schema_validator_service_1.SchemaValidatorService, content_analyzer_service_1.ContentAnalyzerService],
        exports: [image_analyzer_service_1.ImageAnalyzerService, link_analyzer_service_1.LinkAnalyzerService, schema_validator_service_1.SchemaValidatorService, content_analyzer_service_1.ContentAnalyzerService],
    })
], AnalyzerModule);
//# sourceMappingURL=analyzer.module.js.map