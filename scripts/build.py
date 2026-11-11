"""Compatibility entry for existing Cloudflare Pages build settings: python scripts/build.py.

Installs locked Node dependencies when needed and delegates the real build to Vite.
The published directory remains dist/. Requires Node.js 22.18+ (project default: 24).
"""
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def main():
    npm = shutil.which('npm.cmd') or shutil.which('npm')
    if not npm:
        raise RuntimeError('Node.js and npm are required to build the Vue application.')
    if not (ROOT / 'node_modules' / 'vite' / 'package.json').is_file():
        subprocess.run([npm, 'ci'], cwd=ROOT, check=True)
    subprocess.run([npm, 'run', 'build'], cwd=ROOT, check=True)

if __name__ == '__main__':
    main()
