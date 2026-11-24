import assert from 'node:assert/strict';
import test from 'node:test';
import {validateRun} from '../scripts/release.mjs';

const sha = 'a'.repeat(40);
const run = {headSha: sha, status: 'completed', conclusion: 'success'};
const job = {name: 'Validate site', status: 'completed', conclusion: 'success'};

test('发布仅接受指定提交已完成并成功的 CI', () => {
  validateRun(sha, run, [job]);
  for (const other of [
    undefined,
    {...run, headSha: 'b'.repeat(40)},
    {...run, status: 'in_progress'},
    {...run, conclusion: 'failure'},
  ]) {
    assert.throws(() => validateRun(sha, other, [job]), /推送检查/);
  }
});

test('CI 整体成功时，仍须确认 Validate site 确实执行成功', () => {
  for (const jobs of [
    [],
    [{...job, name: 'Build preview'}],
    [{...job, conclusion: 'skipped'}],
    [{...job, status: 'queued'}],
  ]) {
    assert.throws(() => validateRun(sha, run, jobs), /Validate site/);
  }
});
