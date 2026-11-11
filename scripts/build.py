"""构建可部署的站点到 dist/：先重新生成 sw.js，再只复制网站需要的文件。

    python scripts/build.py

Cloudflare Pages 的构建命令就是这一行，输出目录为 dist。
README、脚本、node_modules 等不会被发布。只用 Python 标准库。
"""
import shutil
from pathlib import Path

import build_sw

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'

FILES = ['index.html', 'guide.html', 'manifest.webmanifest', 'sw.js', '_headers', 'LICENSE']
DIRS = ['assets', 'js', 'data']


def main():
    build_sw.main()
    shutil.rmtree(DIST, ignore_errors=True)
    DIST.mkdir()
    for name in FILES:
        shutil.copy2(ROOT / name, DIST / name)
    for name in DIRS:
        shutil.copytree(ROOT / name, DIST / name)
    count = sum(1 for p in DIST.rglob('*') if p.is_file())
    print(f'dist/  {count} files')


if __name__ == '__main__':
    main()
