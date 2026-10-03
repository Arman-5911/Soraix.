import test from 'node:test';
import assert from 'node:assert/strict';
import {subtitleToVtt} from '../src/subtitles.js';
test('SRT conversion handles BOM and Windows lines without changing dialogue',()=>{
 const out=subtitleToVtt('\uFEFF1\r\n00:00:01,000 --> 00:00:03,500\r\nHello world\r\n');
 assert.ok(out.startsWith('WEBVTT\n\n')); assert.ok(out.includes('00:00:01.000 --> 00:00:03.500')); assert.ok(out.includes('Hello world'));
});
test('VTT is preserved and invalid or oversized subtitle files are rejected',()=>{
 const vtt='WEBVTT\n\n00:01.000 --> 00:03.000\nHello';
 assert.equal(subtitleToVtt(vtt),vtt+'\n');
 assert.throws(()=>subtitleToVtt('<html>Not subtitles</html>'),/No valid/);
 assert.throws(()=>subtitleToVtt('x'.repeat(2*1024*1024+1)),/2 MB/);
});
