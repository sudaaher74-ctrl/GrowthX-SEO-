import * as React from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface OpportunityProps {
  title: string;
  evidence: string[];
  businessImpact: string;
  recommendedAction: string;
  aiRecommendation: string;
  affectedPagesCount: number;
  estimatedImpact: string;
  onAnalyze?: () => void;
  onGenerateContent?: () => void;
  onGenerateFix?: () => void;
  onCreateTask?: () => void;
  isAnalyzing?: boolean;
  isGenerating?: boolean;
  analysisData?: any;
  patchData?: any;
}

export function OpportunityDetailPanel({
  title,
  evidence,
  businessImpact,
  recommendedAction,
  aiRecommendation,
  affectedPagesCount,
  estimatedImpact,
  onAnalyze,
  onGenerateContent,
  onGenerateFix,
  onCreateTask,
  isAnalyzing,
  isGenerating,
  analysisData,
  patchData,
}: OpportunityProps) {
  return (
    <div className="flex flex-col border rounded-lg bg-white shadow-sm w-full max-w-md overflow-hidden" style={{ borderColor: "var(--border-color)" }}>
      <div className="p-4 border-b bg-gray-50/50">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Opportunity</h3>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
      
      <div className="p-4 space-y-6 flex-1 overflow-y-auto text-sm text-gray-700">
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">Evidence</h4>
          <ul className="list-disc pl-5 space-y-1 text-gray-600">
            {evidence.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">Business Impact</h4>
          <p className="text-gray-600">{businessImpact}</p>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">Recommended Action</h4>
          <p className="text-gray-600">{recommendedAction}</p>
        </div>
        
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">AI Recommendation</h4>
          <p className="text-gray-600">{aiRecommendation}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 border-t pt-4 border-gray-100">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Affected Pages</h4>
            <p className="text-lg font-medium text-gray-900">{affectedPagesCount}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Estimated Impact</h4>
            <p className="text-sm font-medium text-gray-900 mt-1">{estimatedImpact}</p>
          </div>
        </div>
      </div>
      
      <div className="p-4 border-t bg-gray-50 flex flex-wrap gap-2">
        {onAnalyze && (
          <Button variant="outline" size="sm" onClick={onAnalyze} disabled={isAnalyzing || isGenerating}>
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </Button>
        )}
        {onGenerateContent && (
          <Button variant="secondary" size="sm" onClick={onGenerateContent} disabled={isAnalyzing || isGenerating}>
            Generate Content
          </Button>
        )}
        {onGenerateFix && (
          <Button variant="primary" size="sm" onClick={onGenerateFix} disabled={isAnalyzing || isGenerating}>
            {isGenerating ? "Generating..." : "Generate Fix"}
          </Button>
        )}
        {onCreateTask && <Button variant="outline" size="sm" onClick={onCreateTask}>Create Task</Button>}
      </div>

      {(analysisData || patchData) && (
        <div className="p-4 border-t bg-black text-green-400 font-mono text-xs overflow-auto max-h-64">
          {analysisData && (
            <div className="mb-4">
              <div className="text-gray-400 mb-1">{"// Analysis Complete"}</div>
              <pre>{JSON.stringify(analysisData, null, 2)}</pre>
            </div>
          )}
          {patchData && (
            <div>
              <div className="text-gray-400 mb-1">{"// Patch Generated"}</div>
              <pre>{JSON.stringify(patchData, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
