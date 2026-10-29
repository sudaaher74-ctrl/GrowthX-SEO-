import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { RepoSandbox } from './engineer-sandbox';
import { metadataAcceptance } from './metadata-acceptance';

describe('Metadata proposal acceptance', () => {
  let dir: string, box: RepoSandbox;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'metadata-acceptance-'));
    await fs.mkdir(path.join(dir, 'frontend/src/data'), { recursive: true });
    await fs.mkdir(path.join(dir, 'frontend/src/pages'));
    await fs.writeFile(path.join(dir, 'frontend/package.json'), JSON.stringify({ dependencies: { 'react-helmet-async': '2' } }));
    await fs.writeFile(path.join(dir, 'frontend/src/main.jsx'), 'export const App = () => <HelmetProvider />;');
    await fs.writeFile(path.join(dir, 'frontend/src/router.jsx'), 'import Policy from "./pages/Policy"; const router = createBrowserRouter([{path:"/policy",element:<Policy/>}]);');
    await fs.writeFile(path.join(dir, 'frontend/src/pages/Policy.jsx'), 'const Policy = () => <main><h1>Policy</h1><p>Original policy text</p></main>; export default Policy;');
    await fs.writeFile(path.join(dir, 'frontend/src/data/seo-routes.js'), "export const pages=[{path:'/policy', title:'Old policy | Brand', source:'src/pages/Policy.jsx'}];");
    box = new RepoSandbox(dir);
  });
  afterEach(() => fs.rm(dir, { recursive: true, force: true }));

  it('rejects the real registry-only failure and accepts a connected metadata patch preserving page content', async () => {
    await box.edit('frontend/src/data/seo-routes.js', 'Old policy | Brand', 'Refund Policy | Brand');
    expect((await metadataAcceptance(box)).join()).toContain('registry-only');
    await box.title('frontend/src/pages/Policy.jsx', 'Refund Policy | Brand');
    expect(await metadataAcceptance(box)).toEqual([]);
    const page = await box.source('frontend/src/pages/Policy.jsx');
    expect(page).toContain('<h1>Policy</h1><p>Original policy text</p>');
    expect(page).toContain('<title>{"Refund Policy | Brand"}</title>');
  });
  it('does not accept a longer title as an improvement', async () => {
    await box.edit('frontend/src/data/seo-routes.js', 'Old policy | Brand', 'A'.repeat(78));
    expect((await metadataAcceptance(box)).join()).toContain('exceeds 60');
    await expect(box.title('frontend/src/pages/Policy.jsx', 'A'.repeat(78))).rejects.toThrow('60');
  });
  it('blocks a registry source that leaves the repository', async () => {
    await box.edit('frontend/src/data/seo-routes.js', "title:'Old policy | Brand', source:'src/pages/Policy.jsx'", "title:'New title', source:'../../outside.jsx'");
    expect((await metadataAcceptance(box)).join()).toMatch(/could not trace|cannot inspect/);
  });
});
