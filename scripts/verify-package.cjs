const {_electron:electron}=require('@playwright/test');
const path=require('node:path');
(async()=>{
  const env={...process.env,TROVEN_SMOKE:'1'};delete env.ELECTRON_RUN_AS_NODE;
  const app=await electron.launch({executablePath:path.resolve('dist/win-unpacked/Troven Tarefas.exe'),env,timeout:20000});
  try {
    const page=await app.firstWindow();
    await page.waitForSelector('#version:has-text("'+require('../package.json').version+'")');
    const initial=await page.evaluate(()=>window.troven.call('init'));
    if(!initial.packaged)throw Error('A instância não está empacotada.');
    if(initial.version!==require('../package.json').version)throw Error('Versão incorreta.');
    console.log('PASS: executável empacotado abriu com dados locais e versão '+initial.version+'.');
  } finally {await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
