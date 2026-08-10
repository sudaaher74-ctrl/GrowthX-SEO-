"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtractorModule = void 0;
const common_1 = require("@nestjs/common");
const html_extractor_service_1 = require("./html-extractor.service");
let ExtractorModule = class ExtractorModule {
};
exports.ExtractorModule = ExtractorModule;
exports.ExtractorModule = ExtractorModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [html_extractor_service_1.HtmlExtractorService],
        exports: [html_extractor_service_1.HtmlExtractorService],
    })
], ExtractorModule);
//# sourceMappingURL=extractor.module.js.map