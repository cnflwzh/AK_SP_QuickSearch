import {execFileSync, spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const repo = 'cnflwzh/AK_SP_QuickSearch';
const usage = '用法：node scripts/release.mjs [--check] <已验收的完整提交 SHA>';

function read(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
}

function requireAncestor(older, newer, message) {
  const result = spawnSync(
    'git',
    ['merge-base', '--is-ancestor', older, newer],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status === 1) throw new Error(message);
  if (result.status !== 0)
    throw new Error('无法读取提交历史，请检查本地仓库是否完整。');
}

/** 校验指定 SHA 的 develop 推送及其实际运行的必需任务。缺失、跳过或失败均阻止发布。 */
export function validateRun(sha, run, jobs) {
  if (
    run?.headSha !== sha ||
    run.status !== 'completed' ||
    run.conclusion !== 'success'
  ) {
    throw new Error(
      '这个提交在 develop 的推送检查尚未成功。请查看 GitHub Actions 中的 CI。',
    );
  }
  if (
    !jobs.some(
      (job) =>
        job.name === 'Validate site' &&
        job.status === 'completed' &&
        job.conclusion === 'success',
    )
  ) {
    throw new Error('这次 CI 没有成功完成 Validate site。');
  }
}

function promote(args) {
  const checkOnly = args[0] === '--check';
  const [sha, ...extra] = checkOnly ? args.slice(1) : args;
  if (!/^[0-9a-f]{40}$/.test(sha ?? '') || extra.length) throw new Error(usage);

  read('git', [
    'fetch',
    '--no-tags',
    'origin',
    '+refs/heads/main:refs/remotes/origin/main',
    '+refs/heads/develop:refs/remotes/origin/develop',
  ]);
  const main = read('git', ['rev-parse', 'refs/remotes/origin/main']);
  requireAncestor(main, sha, '该提交无法从当前 main 快进，已停止发布。');
  requireAncestor(
    sha,
    'refs/remotes/origin/develop',
    '该提交不在远端 develop 的历史中，已停止发布。',
  );
  if (main === sha) {
    console.log(`main 已经是 ${sha}。`);
    return;
  }

  const [run] = JSON.parse(
    read('gh', [
      'run',
      'list',
      '-R',
      repo,
      '--workflow',
      'ci.yml',
      '--branch',
      'develop',
      '--event',
      'push',
      '--commit',
      sha,
      '--limit',
      '1',
      '--json',
      'databaseId,headSha,status,conclusion',
    ]),
  );
  const jobs =
    run?.conclusion === 'success'
      ? JSON.parse(
          read('gh', [
            'run',
            'view',
            String(run.databaseId),
            '-R',
            repo,
            '--json',
            'jobs',
          ]),
        ).jobs
      : [];
  validateRun(sha, run, jobs);
  const verified = read('gh', [
    'api',
    `repos/${repo}/commits/${sha}`,
    '--jq',
    '.commit.verification.verified',
  ]);
  if (verified !== 'true')
    throw new Error('GitHub 尚未验证该提交的签名，请检查提交的签名密钥。');

  console.log(`已验证 ${main.slice(0, 12)} → ${sha}，CI #${run.databaseId}。`);
  if (checkOnly) return;
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const tag = `release/${date}-${sha.slice(0, 12)}`;
  // 分支和版本标签一起生效。普通推送会拒绝覆盖并发发布的分叉提交。
  read('git', [
    'push',
    '--atomic',
    '--no-follow-tags',
    'origin',
    `${sha}:refs/heads/main`,
    `${sha}:refs/tags/${tag}`,
  ]);
  console.log(`已发布 ${sha}，版本标签为 ${tag}。`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    promote(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
