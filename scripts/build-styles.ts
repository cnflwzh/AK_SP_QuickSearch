import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, unlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {transform} from 'lightningcss';

/** Hash the fully compressed shared styles and update all entry points, including the static 404. */
export function publishStyles(directory: string): void {
  const bundles = join(directory, 'assets/bundles');
  mkdirSync(bundles, {recursive: true});
  const paths = new Map<string, string>();
  for (const name of ['base', 'quickref', 'guide', 'diff', 'fonts']) {
    const original = `/assets/css/${name}.css`;
    const file = join(directory, original);
    const {code} = transform({
      filename: file,
      code: readFileSync(file),
      minify: true,
    });
    const hash = createHash('sha256').update(code).digest('hex').slice(0, 16);
    const filename = `site-${name}-${hash}.css`;
    // Both directories are siblings of assets/fonts, preserving relative font URLs.
    writeFileSync(join(bundles, filename), code);
    paths.set(original, '/assets/bundles/' + filename);
    unlinkSync(file);
  }
  for (const name of ['index.html', 'guide.html', 'diff.html', '404.html']) {
    const file = join(directory, name);
    let html = readFileSync(file, 'utf8');
    for (const [original, published] of paths)
      html = html.replaceAll(`href="${original}"`, `href="${published}"`);
    writeFileSync(file, html);
  }
  // These regeneration inputs stay in the repository; OFL license texts ship with the fonts.
  for (const name of ['sources.json', 'README.md'])
    unlinkSync(join(directory, 'assets/fonts', name));
}
