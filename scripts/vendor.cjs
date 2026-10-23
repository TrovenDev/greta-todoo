const fs = require('node:fs');
fs.mkdirSync('app/vendor', { recursive: true });
for (const [src, dest] of [['gsap/dist/gsap.min.js','gsap.min.js'], ['lottie-web/build/player/lottie.min.js','lottie.min.js']]) {
  fs.copyFileSync(require.resolve(src), `app/vendor/${dest}`);
}
for(const pkg of ['gsap','lottie-web']) {
  const root=require('node:path').dirname(require.resolve(pkg+'/package.json'));
  for(const file of fs.readdirSync(root).filter(f=>/^licen[sc]e/i.test(f)))fs.copyFileSync(require('node:path').join(root,file),`app/vendor/${pkg}-${file}`);
}
