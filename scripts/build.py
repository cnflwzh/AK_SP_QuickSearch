"""构建可部署的站点到 dist/：先重新生成 sw.js，再只复制网站需要的文件。

    python scripts/build.py

Cloudflare Pages 的构建命令就是这一行，输出目录为 dist。
README、脚本、node_modules 等不会被发布。只用 Python 标准库。
"""
import os
import re
import shutil
import subprocess
from pathlib import Path

import build_sw

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'

FILES = ['index.html', 'guide.html', 'manifest.webmanifest', 'sw.js', '_headers', 'LICENSE']
DIRS = ['assets', 'js', 'data']
VERSION_SLOT = '<code class="build-version" data-build-version hidden></code>'


def commit_sha():
    """返回本次构建的完整提交 SHA；无 Git 时读取部署变量，无法确定版本则中止。"""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', '--verify', 'HEAD^{commit}'],
            cwd=ROOT, capture_output=True, text=True, check=True, timeout=10,
        )
        sha = result.stdout.strip().lower()
    except (OSError, subprocess.SubprocessError):
        sha = (os.environ.get('CF_PAGES_COMMIT_SHA')
               or os.environ.get('BUILD_COMMIT_SHA', '')).strip().lower()
    if not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})', sha):
        raise RuntimeError('Cannot determine build commit; build from Git or set BUILD_COMMIT_SHA.')
    return sha


def write_build_version(sha):
    """将完整 SHA 的前 7 位写入 dist 的两个页脚；缺少唯一占位时中止，不改源码。"""
    version = (f'<code class="build-version" data-build-version '
               f'title="Git commit {sha}" aria-label="构建版本 {sha[:7]}">{sha[:7]}</code>')
    for filename in ['index.html', 'guide.html']:
        path = DIST / filename
        html = path.read_text(encoding='utf-8')
        if html.count(VERSION_SLOT) != 1:
            raise ValueError('Missing or duplicate build version slot: ' + filename)
        path.write_text(html.replace(VERSION_SLOT, version), encoding='utf-8', newline='\n')


def main():
    sha = commit_sha()
    build_sw.main()
    shutil.rmtree(DIST, ignore_errors=True)
    DIST.mkdir()
    for name in FILES:
        shutil.copy2(ROOT / name, DIST / name)
    for name in DIRS:
        shutil.copytree(ROOT / name, DIST / name)
    # SHA 只写进发布产物，避免把上一提交的版本号带进下一提交。
    write_build_version(sha)
    # 根据注入版本后的页面生成发布缓存版本，离线页脚与页面内容保持一致。
    build_sw.main(DIST)
    count = sum(1 for p in DIST.rglob('*') if p.is_file())
    print(f'dist/  {count} files  commit={sha[:7]}')


if __name__ == '__main__':
    main()
