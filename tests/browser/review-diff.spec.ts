import { test, expect } from './static-fixture';
test('review highlights only inserted lines and words, not the whole file',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/02 planner/i}).click();await page.getByRole('button',{name:'Create draft',exact:true}).click();
 const editor=page.locator('.skills-text-input');const original=await editor.inputValue();const lines=original.replace(/\r\n/g,'\n').split('\n');lines.splice(6,0,'hello','');await editor.fill(lines.join('\n'));
 await page.getByRole('button',{name:/Review changes \(1\)/}).click();
 await expect(page.locator('.planner-diff-source .added')).toHaveCount(2);await expect(page.locator('.planner-diff-source .removed')).toHaveCount(0);
 await expect(page.locator('.planner-diff-source .added').first()).toContainText('hello');
 const row=page.locator('.planner-diff-source').nth(1).locator('[data-line="9"]');await expect(row).not.toHaveClass(/added|removed/);
 await page.screenshot({path:'artifacts/planner-precise-review.png'});
 await page.getByRole('button',{name:'Close review',exact:true}).click();
 const updated=original.replace(/\r\n/g,'\n').split('\n');updated[6]+=' hello';await editor.fill(updated.join('\n'));
 await page.getByRole('button',{name:/Review changes \(1\)/}).click();await expect(page.locator('.planner-diff-source .added')).toHaveCount(1);await expect(page.locator('.planner-diff-source .removed')).toHaveCount(1);await expect(page.locator('.planner-diff-source .added mark')).toContainText(['hello']);
});
