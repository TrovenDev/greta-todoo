const {spawnSync}=require('node:child_process');
const version=require('../package.json').version;
function run(command,args,quiet=false){const result=spawnSync(command,args,{stdio:quiet?'ignore':'inherit'});if(result.error)throw result.error;return result.status;}
if(run('gh',['--version'],true)!==0)throw Error('Instale o GitHub CLI (gh) para publicar localmente. Você também pode usar a Action no GitHub.');
require('./release-notes.cjs');
if(run(process.execPath,[require.resolve('electron-builder/cli.js'),'--win','nsis','--x64','--publish','never'])!==0)process.exit(1);
const tag='v'+version,installer=`dist/Troven-Tarefas-Setup-${version}.exe`;
const exists=run('gh',['release','view',tag],true)===0;
if(exists){
  if(run('gh',['release','upload',tag,installer,installer+'.blockmap','dist/latest.yml','--clobber'])!==0)process.exit(1);
  process.exitCode=run('gh',['release','edit',tag,'--notes-file','RELEASE_NOTES.md','--draft=false','--latest']);
}else{
  process.exitCode=run('gh',['release','create',tag,installer,installer+'.blockmap','dist/latest.yml','--verify-tag','--title','Troven Tarefas '+tag,'--notes-file','RELEASE_NOTES.md','--latest']);
}
