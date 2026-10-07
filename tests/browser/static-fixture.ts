import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
// Optional production-build fixture: serves files through Playwright interception,
// without starting a server or contacting the synthetic test domain.
export const test = base.extend<{ staticSite: void }>({
 staticSite: [async ({ context }, use) => {
  if (process.env.STUDIO_STATIC_TEST === '1') {
   const root=path.resolve('dist');
   await context.route('https://studio.test/**',async route=>{
    const pathname=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/agent-studio-prototype\//,'/');
    const file=path.resolve(root, '.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){await route.abort();return;}
    try {await route.fulfill({body:await readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:'Not found'});}
   });
  }
  await use();
 },{auto:true}],
});
export {expect};
