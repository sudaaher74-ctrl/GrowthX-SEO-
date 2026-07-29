"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AstParserService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AstParserService = void 0;
const common_1 = require("@nestjs/common");
const ts_morph_1 = require("ts-morph");
let AstParserService = AstParserService_1 = class AstParserService {
    constructor() {
        this.logger = new common_1.Logger(AstParserService_1.name);
    }
    /**
     * Mocks embedding a repository into a Vector DB.
     * In a real implementation, we would extract AST nodes, chunk them,
     * pass them to an embeddings API, and store them in pgvector/Pinecone.
     */
    async indexRepository(repoPath) {
        this.logger.log(`Indexing repository at ${repoPath} for Semantic Search...`);
        const project = new ts_morph_1.Project();
        project.addSourceFilesAtPaths(`${repoPath}/**/*.ts`);
        project.addSourceFilesAtPaths(`${repoPath}/**/*.tsx`);
        const sourceFiles = project.getSourceFiles();
        this.logger.log(`Parsed ${sourceFiles.length} files. Extracted embeddings for AST nodes.`);
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500));
        return sourceFiles.length;
    }
    /**
     * Mocks querying the Vector DB to find the exact AST node and file.
     */
    async semanticSearch(query, repoPath) {
        this.logger.log(`Executing semantic code search for: "${query}"`);
        // Mock response for PoC
        // If the query asks for metadata or layout, we return layout.tsx
        if (query.toLowerCase().includes('metadata') || query.toLowerCase().includes('canonical')) {
            return [
                {
                    filePath: 'app/layout.tsx',
                    nodeName: 'metadata',
                    confidence: 0.98,
                    snippet: 'export const metadata: Metadata = { title: "Acme" }'
                }
            ];
        }
        // Fallback mock
        return [
            {
                filePath: 'app/page.tsx',
                nodeName: 'HomePage',
                confidence: 0.85,
                snippet: 'export default function HomePage() { return <h1>Home</h1> }'
            }
        ];
    }
};
exports.AstParserService = AstParserService;
exports.AstParserService = AstParserService = AstParserService_1 = __decorate([
    (0, common_1.Injectable)()
], AstParserService);
//# sourceMappingURL=ast-parser.service.js.map