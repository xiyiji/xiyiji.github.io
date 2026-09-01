// Pre-render every $...$ / $$...$$ into static KaTeX markup, and vendor the
// stylesheet + woff2 fonts into assets/katex/. After this the posts have no
// runtime dependency on any CDN: no script to load, nothing to go down, and the
// maths is already laid out when the HTML arrives.
//
// Usage:  node build-math.js blogs/post.html [more.html ...]

const fs = require('fs');
const path = require('path');
const katex = require('katex');

const ROOT = __dirname;
// Resolve through require so the script works wherever node_modules happens to
// live (repo root, a parent, a global install).
const KATEX_DIST = path.dirname(require.resolve('katex'));
const OUT_ASSETS = path.join(ROOT, 'assets/katex');

// ---- 1. vendor css + woff2 (skip ttf/woff: every current browser takes woff2)
function vendor() {
  fs.mkdirSync(path.join(OUT_ASSETS, 'fonts'), { recursive: true });
  let css = fs.readFileSync(path.join(KATEX_DIST, 'katex.min.css'), 'utf8');
  // Drop the ttf/woff sources so the browser never requests a file we did not ship.
  css = css.replace(/,url\([^)]*\.(?:ttf|woff)\)format\("(?:truetype|woff)"\)/g, '');
  fs.writeFileSync(path.join(OUT_ASSETS, 'katex.min.css'), css);

  let n = 0;
  for (const f of fs.readdirSync(path.join(KATEX_DIST, 'fonts'))) {
    if (!f.endsWith('.woff2')) continue;
    fs.copyFileSync(path.join(KATEX_DIST, 'fonts', f),
                    path.join(OUT_ASSETS, 'fonts', f));
    n++;
  }
  return n;
}

// ---- 2. replace maths in one file
function render(file) {
  let html = fs.readFileSync(file, 'utf8');

  // Remove the CDN block (stylesheet + two scripts, incl. the onload config).
  html = html.replace(
    /<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/npm\/katex[^>]*>\n?/g, '');
  html = html.replace(
    /<script defer src="https:\/\/cdn\.jsdelivr\.net\/npm\/katex[\s\S]*?<\/script>\n?/g, '');

  // Point at the vendored copy instead.
  const localLink =
    '<link rel="stylesheet" href="../assets/katex/katex.min.css">\n';
  html = html.replace('<link rel="stylesheet" href="../assets/style.css">',
                      '<link rel="stylesheet" href="../assets/style.css">\n' + localLink);

  // Only touch the article body, so nothing in <head> is ever rewritten.
  const start = html.indexOf('<article');
  const end = html.indexOf('</article>');
  if (start < 0 || end < 0) throw new Error(`no <article> in ${file}`);
  let body = html.slice(start, end);

  let display = 0, inline = 0;
  body = body.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    display++;
    return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: true });
  });
  body = body.replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, tex) => {
    inline++;
    return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: true });
  });

  fs.writeFileSync(file, html.slice(0, start) + body + html.slice(end));
  return { display, inline };
}

const fonts = vendor();
console.log(`vendored katex.min.css + ${fonts} woff2 fonts -> assets/katex/`);
for (const f of process.argv.slice(2)) {
  const { display, inline } = render(f);
  console.log(`${f}: ${display} display, ${inline} inline`);
}
