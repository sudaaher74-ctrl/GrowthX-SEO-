import { Injectable, Logger } from '@nestjs/common';
import { Project, SyntaxKind, ObjectLiteralExpression } from 'ts-morph';

@Injectable()
export class PatchGenerationService {
  private readonly logger = new Logger(PatchGenerationService.name);

  /**
   * AST-aware method to inject or update a Next.js metadata property (e.g. title)
   * in a specific file like layout.tsx or page.tsx.
   */
  async updateNextJsMetadata(filePath: string, propertyName: string, newValue: string): Promise<boolean> {
    this.logger.log(`Parsing AST for ${filePath}...`);
    
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(filePath);
    
    // Find the exported `metadata` object
    const metadataDecl = sourceFile.getVariableDeclaration('metadata');
    
    if (!metadataDecl) {
      this.logger.warn(`No 'metadata' export found in ${filePath}. Cannot patch.`);
      return false;
    }

    const initializer = metadataDecl.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
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
    } else {
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
}

