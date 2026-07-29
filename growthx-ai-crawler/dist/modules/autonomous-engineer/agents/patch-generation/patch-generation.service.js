"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PatchGenerationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatchGenerationService = void 0;
const common_1 = require("@nestjs/common");
const ts_morph_1 = require("ts-morph");
let PatchGenerationService = PatchGenerationService_1 = class PatchGenerationService {
    constructor() {
        this.logger = new common_1.Logger(PatchGenerationService_1.name);
    }
    /**
     * AST-aware method to inject or update a Next.js metadata property (e.g. title)
     * in a specific file like layout.tsx or page.tsx.
     */
    async updateNextJsMetadata(filePath, propertyName, newValue) {
        this.logger.log(`Parsing AST for ${filePath}...`);
        const project = new ts_morph_1.Project();
        const sourceFile = project.addSourceFileAtPath(filePath);
        // Find the exported `metadata` object
        const metadataDecl = sourceFile.getVariableDeclaration('metadata');
        if (!metadataDecl) {
            this.logger.warn(`No 'metadata' export found in ${filePath}. Cannot patch.`);
            return false;
        }
        const initializer = metadataDecl.getInitializerIfKind(ts_morph_1.SyntaxKind.ObjectLiteralExpression);
        if (!initializer) {
            this.logger.warn(`'metadata' is not an object literal. Cannot patch.`);
            return false;
        }
        // Check if the property already exists
        const existingProp = initializer.getProperty(propertyName);
        if (existingProp) {
            this.logger.log(`Property '${propertyName}' exists. Overwriting...`);
            // For simplicity in PoC, we remove it and re-add it. In production, we'd mutate the node directly.
            existingProp.remove();
        }
        else {
            this.logger.log(`Property '${propertyName}' does not exist. Adding...`);
        }
        // Add the new property
        initializer.addPropertyAssignment({
            name: propertyName,
            initializer: `"${newValue.replace(/"/g, '\\"')}"`
        });
        this.logger.log(`Saving AST modifications to ${filePath}...`);
        await sourceFile.save();
        return true;
    }
};
exports.PatchGenerationService = PatchGenerationService;
exports.PatchGenerationService = PatchGenerationService = PatchGenerationService_1 = __decorate([
    (0, common_1.Injectable)()
], PatchGenerationService);
//# sourceMappingURL=patch-generation.service.js.map