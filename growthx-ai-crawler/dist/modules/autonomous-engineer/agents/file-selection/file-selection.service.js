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
var FileSelectionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSelectionService = void 0;
const common_1 = require("@nestjs/common");
const ast_parser_service_1 = require("../../../repository-graph/ast-parser/ast-parser.service");
let FileSelectionService = FileSelectionService_1 = class FileSelectionService {
    constructor(astParser) {
        this.astParser = astParser;
        this.logger = new common_1.Logger(FileSelectionService_1.name);
    }
    async selectTargetFiles(repoPath, issueType, recommendation) {
        this.logger.log(`Selecting target files for issue: ${issueType}`);
        // First, ensure the repo is indexed
        await this.astParser.indexRepository(repoPath);
        // Formulate a query based on the issue
        const query = `Find where ${issueType} is handled or needs to be applied based on: ${recommendation}`;
        // Use the semantic search from the Knowledge Graph
        const results = await this.astParser.semanticSearch(query, repoPath);
        this.logger.log(`Semantic Search returned ${results.length} files.`);
        return results;
    }
};
exports.FileSelectionService = FileSelectionService;
exports.FileSelectionService = FileSelectionService = FileSelectionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ast_parser_service_1.AstParserService])
], FileSelectionService);
//# sourceMappingURL=file-selection.service.js.map