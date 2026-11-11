"""生成 sw.js：把可缓存资源清单和版本号填进 scripts/sw.template.js。

改动任何页面、脚本、样式、数据或图片后运行一次：

    python scripts/build_sw.py

版本号取所有文件内容的哈希，文件不变则版本不变，用户端不会重复下载。
"""
import hashlib
import json
from pathlib import Path
import build_preloads

ROOT = Path(__file__).resolve().parent.parent

# 可缓存资源清单：只保存访问过的内容，联网时优先取新版本。
CORE_GLOBS = ['*.html', 'manifest.webmanifest', 'assets/css/*.css', 'assets/icons/*', 'data/*.js', 'js/**/*.js']
# 头像与图标：按需加载，之后优先读缓存。
IMAGE_GLOBS = ['assets/img/*/*.webp']


def collect(globs, root):
    files = set()
    for pattern in globs:
        files.update(p for p in root.glob(pattern) if p.is_file())
    return sorted(p.relative_to(root).as_posix() for p in files)


def main(root=ROOT):
    """为指定站点目录生成 sw.js；源码目录同步预加载，dist 使用已注入版本的页面。"""
    if root == ROOT:
        build_preloads.main()
    core = collect(CORE_GLOBS, root)
    images = collect(IMAGE_GLOBS, root)

    template = (ROOT / 'scripts' / 'sw.template.js').read_text(encoding='utf-8')
    image_digest = hashlib.sha1()
    for path in images:
        image_digest.update(path.encode())
        image_digest.update((root / path).read_bytes())
    image_version = image_digest.hexdigest()[:10]
    digest = hashlib.sha1(template.encode())
    for path in core + images:
        digest.update(path.encode())
        digest.update((root / path).read_bytes())
    version = digest.hexdigest()[:10]

    output = (template
              .replace('__VERSION__', version)
              .replace('__IMAGE_VERSION__', image_version)
              .replace('__CORE__', json.dumps(['./'] + core, ensure_ascii=False, indent=2))
              .replace('__IMAGES__', json.dumps(images, indent=2)))
    (root / 'sw.js').write_text(output, encoding='utf-8', newline='\n')
    print(f'sw.js  version={version}  core={len(core) + 1}  images={len(images)}')


if __name__ == '__main__':
    main()
