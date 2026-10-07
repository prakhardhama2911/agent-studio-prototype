import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewDiff } from '../src/lineDiff.ts';
test('inserting hello highlights only new lines and aligns original lines',()=>{
 const baseline=Array.from({length:15},(_,i)=>'Original '+(i+1)).join('\r\n')+'\r\n';
 const next=baseline.replace(/\r\n/g,'\n').split('\n');next.splice(6,0,'hello','');
 const d=buildReviewDiff(baseline,next.join('\n'));assert.equal(d.added,2);assert.equal(d.removed,0);
 assert.equal(d.rows[6].left,null);assert.equal(d.rows[6].right.text,'hello');assert.equal(d.rows[8].left.number,7);assert.equal(d.rows[8].right.number,9);assert.equal(d.rows[8].right.kind,'unchanged');
});
test('separate edits leave intermediate matching lines neutral and highlight words',()=>{
 const d=buildReviewDiff('first\nkeep\nlast\n','first hello\nkeep\nlast changed\n');
 assert.equal(d.added,2);assert.equal(d.removed,2);assert.equal(d.rows[1].left.kind,'unchanged');assert.equal(d.rows[1].right.kind,'unchanged');
 assert.ok(d.rows[0].right.parts.some(p=>p.changed&&p.value.includes('hello')));
});
test('file addition, deletion, repeated lines and final newline are represented',()=>{
 assert.equal(buildReviewDiff(undefined,'a\nb\n').added,2);assert.equal(buildReviewDiff('a\nb\n',undefined).removed,2);
 const repeated=buildReviewDiff('a\na\nb\n','a\nb\n');assert.equal(repeated.removed,1);assert.equal(repeated.added,0);
 const eof=buildReviewDiff('hello\n','hello');assert.equal(eof.rows[0].right.noNewline,true);assert.equal(eof.rows[0].left.noNewline,false);
 const normalized=buildReviewDiff('a\r\nb\r\n','a\nb\n');assert.equal(normalized.added,0);assert.equal(normalized.removed,0);assert.equal(normalized.lineEndingsOnly,true);
});
