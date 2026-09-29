'use strict';
// Builds the mockup from docs/mockup.src.html:
//   docs/mockup.html                       artifact page (no document skeleton; images inlined)
//   docs/HeadPinz-TV-Control-mockup.html   standalone file for sharing
//   public/index.html                      page served by the Node app
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p));
const dataUri = (p, mime) => `data:${mime};base64,${read(p).toString('base64')}`;

let page = read('docs/mockup.src.html').toString('utf8')
  .replace('{{APP_JS}}', () => read('docs/app.js').toString('utf8'))
  .replace('{{LOGO}}', dataUri('public/brand/headpinz-logo-520.png', 'image/png'))
  .replace('{{BG}}', dataUri('public/brand/bg-blur.jpg', 'image/jpeg'))
  .replace('{{FLOOR}}', dataUri('public/brand/floorplan.png', 'image/png'));

fs.writeFileSync(path.join(root, 'docs', 'mockup.html'), page);

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0e1729">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
</head>
<body>
${page}
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'docs', 'HeadPinz-TV-Control-mockup.html'), standalone);
fs.mkdirSync(path.join(root, 'public'), { recursive: true });
fs.writeFileSync(path.join(root, 'public', 'index.html'), standalone);
console.log(`built: docs/mockup.html (${(page.length / 1024).toFixed(0)} KB), docs/HeadPinz-TV-Control-mockup.html, public/index.html`);
