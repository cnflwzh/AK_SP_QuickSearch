"""更新两个 HTML 的首屏 ES Module 预加载清单；动态 import 留到使用时加载。"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
PAGES = {'index.html': 'js/quickref/main.js', 'guide.html': 'js/guide/main.js'}
# 本项目只使用相对路径、具名静态导入 / 再导出。动态 import() 有意不匹配。
IMPORT = re.compile(r'^\s*(?:import|export)\s+(?:(?:[^;]*?)\s+from\s+)?[\'\"]([^\'\"]+)[\'\"]\s*;', re.M)
START = '<!-- modulepreload:start -->'
END = '<!-- modulepreload:end -->'


def dependencies(entry):
    """返回入口的本地静态依赖集合；缺失文件或越出站点目录时中止构建。"""
    visited = set()

    def visit(path):
        path = path.resolve()
        relative = path.relative_to(ROOT).as_posix()
        if relative in visited:
            return
        visited.add(relative)
        for source in IMPORT.findall(path.read_text(encoding='utf-8')):
            if not source.startswith('.'):
                raise ValueError('Only relative module paths are supported: ' + source)
            visit(path.parent / source)

    visit(ROOT / entry)
    return visited


def main():
    for filename, entry in PAGES.items():
        paths = dependencies(entry) | {'js/boot.js'}
        # 数据最先发现；浏览器把预载模块直接交给 import，不重复下载。
        ordered = sorted(paths, key=lambda p: (not p.startswith('data/'), p))
        tags = '\n'.join(f'<link rel="modulepreload" href="{path}">' for path in ordered)
        path = ROOT / filename
        html = path.read_text(encoding='utf-8')
        if START not in html or END not in html:
            raise ValueError('Missing modulepreload markers: ' + filename)
        html = re.sub(re.escape(START) + r'.*?' + re.escape(END),
                      START + '\n' + tags + '\n' + END, html, flags=re.S)
        path.write_text(html, encoding='utf-8', newline='\n')
        print(f'{filename}: {len(paths)} initial modules')


if __name__ == '__main__':
    main()
