export interface SemanticSearchResult {
    filePath: string;
    nodeName: string;
    confidence: number;
    snippet: string;
}
export declare class AstParserService {
    private readonly logger;
    /**
     * Mocks embedding a repository into a Vector DB.
     * In a real implementation, we would extract AST nodes, chunk them,
     * pass them to an embeddings API, and store them in pgvector/Pinecone.
     */
    indexRepository(repoPath: string): Promise<number>;
    /**
     * Mocks querying the Vector DB to find the exact AST node and file.
     */
    semanticSearch(query: string, repoPath: string): Promise<SemanticSearchResult[]>;
}
