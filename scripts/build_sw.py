"""生成 sw.js：把预缓存清单和版本号填进 scripts/sw.template.js。

改动任何页面、脚本、样式、数据或图片后运行一次：

    python scripts/build_sw.py

版本号取所有文件内容的哈希，文件不变则版本不变，用户端不会重复下载。
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 页面、样式、脚本、数据、图标：安装时全部缓存，联网时优先取新版本
CORE_GLOBS = ['*.html', 'manifest.webmanifest', 'assets/css/*.css', 'assets/icons/*', 'data/*.js', 'js/**/*.js']
# 头像与图标：安装时预取，之后优先读缓存
IMAGE_GLOBS = ['assets/img/*/*.webp']


def collect(globs):
    files = set()
    for pattern in globs:
        files.update(p for p in ROOT.glob(pattern) if p.is_file())
    return sorted(p.relative_to(ROOT).as_posix() for p in files)


def main():
    core = collect(CORE_GLOBS)
    images = collect(IMAGE_GLOBS)

    template = (ROOT / 'scripts' / 'sw.template.js').read_text(encoding='utf-8')
    image_digest = hashlib.sha1()
    for path in images:
        image_digest.update(path.encode())
        image_digest.update((ROOT / path).read_bytes())
    image_version = image_digest.hexdigest()[:10]
    digest = hashlib.sha1(template.encode())
    for path in core + images:
        digest.update(path.encode())
        digest.update((ROOT / path).read_bytes())
    version = digest.hexdigest()[:10]

    output = (template
              .replace('__VERSION__', version)
              .replace('__IMAGE_VERSION__', image_version)
              .replace('__CORE__', json.dumps(['./'] + core, ensure_ascii=False, indent=2))
              .replace('__IMAGES__', json.dumps(images, indent=2)))
    (ROOT / 'sw.js').write_text(output, encoding='utf-8', newline='\n')
    print(f'sw.js  version={version}  core={len(core) + 1}  images={len(images)}')


if __name__ == '__main__':
    main()
