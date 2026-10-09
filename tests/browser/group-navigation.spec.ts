import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
test.beforeEach(async ({context}) => {
 if (process.env.STUDIO_STATIC_TEST !== '1') return;
 const root=path.resolve('dist');
 await context.route('https://studio.test/**', async route => {
  const pathname=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/agent-studio-prototype\//,'/');
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){await route.abort();return;}
  try{await route.fulfill({body:await readFile(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:'Not found'});}
 });
});
test('group cards lead to sub-agent cards, retain search and return to the group after editing',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.group-entry')).toHaveCount(3);
 await expect(page.locator('.subagent-card')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Add sub-agent',exact:true})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Search agents and groups'}).fill('PQA');
 await expect(page.locator('.group-entry')).toHaveCount(1);
 await page.getByRole('button',{name:/Open Distribution Strategist/}).click();
 await expect(page.getByRole('heading',{level:2,name:'Distribution Strategist',exact:true})).toBeVisible();
 await page.locator('.subagent-card').filter({hasText:'PQA Analysis'}).click();
 await expect(page.getByRole('heading',{level:2,name:'PQA Analysis',exact:true})).toBeVisible();
 await expect(page.getByRole('tab',{name:/Models/})).toHaveCount(0);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await expect(page.locator('.subagent-card')).toHaveCount(1);
 await page.getByRole('textbox',{name:'Search sub-agents'}).fill('unknown');await expect(page.getByText('No matching sub-agents')).toBeVisible();
 await page.getByRole('button',{name:'Back to groups',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Search agents and groups'})).toHaveValue('PQA');
 await expect(page.locator('.group-entry')).toBeFocused();
 await page.getByRole('button',{name:'Clear search',exact:true}).click();
 await page.screenshot({path:'artifacts/group-catalog.png',fullPage:true});
});
test('group management, adding agents, empty groups and mobile layout work inside the group',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Create group',exact:true}).click();
 await page.getByLabel('Name',{exact:true}).fill('New Analysis Group');await page.getByLabel('Description',{exact:true}).fill('A group for additional analyses.');await page.getByRole('button',{name:'Create group',exact:true}).last().click();
 await page.getByRole('button',{name:/Open New Analysis Group, 0 sub-agents/}).click();await expect(page.getByText('No sub-agents yet')).toBeVisible();
 await page.getByRole('button',{name:'Add sub-agent',exact:true}).first().click();await page.getByLabel('Name',{exact:true}).fill('New Analyst');await page.getByLabel('Description',{exact:true}).fill('Answers new analysis questions.');await page.getByRole('button',{name:'Create sub-agent',exact:true}).click();
 await expect(page.getByRole('heading',{level:2,name:'New Analyst',exact:true})).toBeVisible();await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.locator('.subagent-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Manage group',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Renamed Group');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.getByRole('heading',{level:2,name:'Renamed Group',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'artifacts/group-detail-mobile.png',fullPage:true});
});
