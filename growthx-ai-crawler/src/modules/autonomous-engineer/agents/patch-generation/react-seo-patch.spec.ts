import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { patchReactSeo } from './react-seo-patch';

describe('React SEO patches', () => {
  let root: string;
  let file: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'react-seo-'));
    await fs.mkdir(path.join(root, 'src/pages'), { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'react-helmet-async': '^2' } }));
    await fs.writeFile(path.join(root, 'src/main.jsx'), '<HelmetProvider><App /></HelmetProvider>');
    file = path.join(root, 'src/pages/Cart.jsx');
    await fs.writeFile(file, 'const Card = () => <h2>Product</h2>; const Cart = () => { return (<main><Card /></main>); }; export default Cart;');
  });
  afterEach(() => fs.rm(root, { recursive: true, force: true }));
  it('updates page SEO without changing child components or inserting Next.js metadata', async () => {
    expect((await patchReactSeo(file, 'title', 'Cart & "Checkout"')).applied).toBe(true);
    expect((await patchReactSeo(file, 'description', 'Review your order')).applied).toBe(true);
    expect((await patchReactSeo(file, 'title', 'Final title')).applied).toBe(true);
    const source = await fs.readFile(file, 'utf8');
    expect(source).toContain('const Card = () => <h2>Product</h2>');
    expect(source.match(/<title>/g)).toHaveLength(1);
    expect(source).toContain('Final title');
    expect(source).toContain('Review your order');
    expect(source).not.toContain('export const metadata');
    const ts = await import('typescript');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    expect((ast as any).parseDiagnostics).toHaveLength(0);
  });
  it('refuses to patch an app without its existing SEO provider', async () => {
    await fs.writeFile(path.join(root, 'src/main.jsx'), '<App />');
    const before = await fs.readFile(file, 'utf8');
    expect((await patchReactSeo(file, 'title', 'New')).applied).toBe(false);
    expect(await fs.readFile(file, 'utf8')).toBe(before);
  });
  it('patches mutually exclusive page returns and can update their metadata again', async () => {
    await fs.writeFile(file, 'const Cart = () => { if (loading) return (<p>Loading</p>); if (empty) return (<p>Empty</p>); return (<main>Cart</main>); }; export default Cart;');
    expect((await patchReactSeo(file, 'title', 'Cart')).applied).toBe(true);
    expect((await patchReactSeo(file, 'description', 'Your order')).applied).toBe(true);
    expect((await patchReactSeo(file, 'title', 'Your Cart')).applied).toBe(true);
    const source = await fs.readFile(file, 'utf8');
    expect(source.match(/<title>/g)).toHaveLength(3);
    expect(source.match(/Your Cart/g)).toHaveLength(3);
    const ts = await import('typescript');
    expect((ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) as any).parseDiagnostics).toHaveLength(0);
  });
});
