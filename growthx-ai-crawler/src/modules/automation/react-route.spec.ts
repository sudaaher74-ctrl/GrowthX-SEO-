import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { resolveReactRoute } from './react-route';

describe('React Router page resolution', () => {
  let root: string;
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'react-routes-'));
    await fs.mkdir(path.join(root, 'src/pages'), { recursive: true });
    for (const name of ['Home', 'Cart', 'AdminCart', 'Product']) await fs.writeFile(path.join(root, `src/pages/${name}.jsx`), 'export default () => <div />');
    await fs.writeFile(path.join(root, 'src/router.jsx'), `
      import { lazy } from 'react';
      import { createBrowserRouter } from 'react-router-dom';
      import Home from './pages/Home';
      const Cart = lazy(() => import('./pages/Cart'));
      const AdminCart = lazy(() => import('./pages/AdminCart'));
      const Product = lazy(() => import('./pages/Product'));
      createBrowserRouter([{path:'/', children:[
        {index:true, element:<Gate><Home /></Gate>},
        {path:'cart', element:<Cart />},
        {path:'admin', children:[{path:'cart', element:<AdminCart />}]},
        {path:'product/:slug', element:<Product />}
      ]}]);`);
  });
  afterEach(() => fs.rm(root, { recursive: true, force: true }));
  it('resolves lazy imports, index pages, wrappers and nested paths', async () => {
    for (const [url, component] of [['/', 'Home'], ['/cart', 'Cart'], ['/admin/cart', 'AdminCart']]) {
      await expect(resolveReactRoute(root, url)).resolves.toBe(path.join(root, `src/pages/${component}.jsx`));
    }
  });
  it('does not guess missing routes or patch a shared dynamic page', async () => {
    await expect(resolveReactRoute(root, '/missing')).resolves.toBeNull();
    await expect(resolveReactRoute(root, '/product/milk')).resolves.toBeNull();
  });
});
