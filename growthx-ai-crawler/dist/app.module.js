"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const observability_module_1 = require("./modules/observability/observability.module");
const database_module_1 = require("./database/database.module");
const storage_module_1 = require("./storage/storage.module");
const security_module_1 = require("./modules/security/security.module");
const validator_module_1 = require("./modules/validator/validator.module");
const robots_module_1 = require("./modules/robots/robots.module");
const sitemap_module_1 = require("./modules/sitemap/sitemap.module");
const queue_module_1 = require("./modules/queue/queue.module");
const crawler_module_1 = require("./modules/crawler/crawler.module");
const extractor_module_1 = require("./modules/extractor/extractor.module");
const analyzer_module_1 = require("./modules/analyzer/analyzer.module");
const performance_module_1 = require("./modules/performance/performance.module");
const issues_module_1 = require("./modules/issues/issues.module");
const graph_module_1 = require("./modules/graph/graph.module");
const ai_module_1 = require("./modules/ai/ai.module");
const history_module_1 = require("./modules/history/history.module");
const scheduler_module_1 = require("./modules/scheduler/scheduler.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            observability_module_1.ObservabilityModule,
            database_module_1.DatabaseModule,
            storage_module_1.StorageModule,
            security_module_1.SecurityModule,
            validator_module_1.ValidatorModule,
            robots_module_1.RobotsModule,
            sitemap_module_1.SitemapModule,
            queue_module_1.QueueModule,
            extractor_module_1.ExtractorModule,
            analyzer_module_1.AnalyzerModule,
            performance_module_1.PerformanceModule,
            issues_module_1.IssuesModule,
            graph_module_1.GraphModule,
            ai_module_1.AiModule,
            history_module_1.HistoryModule,
            scheduler_module_1.CrawlerSchedulerModule,
            crawler_module_1.CrawlerModule,
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map