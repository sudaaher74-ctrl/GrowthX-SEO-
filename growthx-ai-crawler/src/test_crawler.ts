import axios from 'axios';
import { HtmlExtractorService } from './modules/extractor/html-extractor.service';
import { ImageAnalyzerService } from './modules/analyzer/image-analyzer.service';
import { LinkAnalyzerService } from './modules/analyzer/link-analyzer.service';
import { SchemaValidatorService } from './modules/analyzer/schema-validator.service';
import { ContentAnalyzerService } from './modules/analyzer/content-analyzer.service';

async function runTest() {
  const url = 'https://github.com';
  console.log(`Starting crawl test for: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'GrowthX-AI-Bot/1.0 (+https://growthx.ai/bot)'
      }
    });

    const html = response.data;
    console.log(`Fetched HTML successfully! Length: ${html.length} characters`);

    const htmlExtractor = new HtmlExtractorService();
    const imageAnalyzer = new ImageAnalyzerService();
    const linkAnalyzer = new LinkAnalyzerService();
    const schemaValidator = new SchemaValidatorService();
    const contentAnalyzer = new ContentAnalyzerService();

    const htmlData = htmlExtractor.extract(html, url);
    const images = imageAnalyzer.analyzeImages(html, url);
    const links = linkAnalyzer.analyzeLinks(html, url);
    const schemas = schemaValidator.validateSchemas(htmlData.jsonLd);
    
    // We pass 0 for h1, h2, h3 lengths since we can compute them
    const content = contentAnalyzer.analyzeContent(
      html, 
      htmlData.h1, 
      htmlData.h2, 
      htmlData.h3, 
      images.length, 
      links.internalCount, 
      links.externalCount
    );

    console.log('\n--- Extraction Results ---');
    console.log(`Title: ${htmlData.title}`);
    console.log(`Description: ${htmlData.metaDescription}`);
    console.log(`H1 Count: ${htmlData.h1.length}`);
    console.log(`H2 Count: ${htmlData.h2.length}`);
    console.log(`Images: ${images.length} found`);
    
    let missingAltCount = images.filter(img => img.isMissingAlt).length;
    console.log(`Images missing ALT: ${missingAltCount}`);

    console.log(`Internal Links: ${links.internalCount}`);
    console.log(`External Links: ${links.externalCount}`);
    
    console.log(`Schema found: ${schemas.length > 0 ? schemas.map(s => s.schemaType).join(', ') : 'None'}`);
    console.log(`Word Count: ${content.wordCount}`);

  } catch (error: any) {
    console.error('Failed to fetch the website:', error.message);
  }
}

runTest();
