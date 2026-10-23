const fs=require('node:fs');
const version=require('../package.json').version;
const release=require('../app/releases.json').find(r=>r.version===version);
if(!release)throw Error('Inclua as novidades da versão em app/releases.json antes de publicar.');
fs.writeFileSync('RELEASE_NOTES.md',`# ${release.title}\n\n${release.items.map(i=>`- ${i}`).join('\n')}\n\nBaixe Troven-Tarefas-Setup-${version}.exe. A atualização preserva suas tarefas.\n`);
