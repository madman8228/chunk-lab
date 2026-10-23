'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const deps=require('../../scripts/lib-deps');

// Copy only public UI dependencies to an owned temporary app root. Test-specific
// content stays in the fixture; never link a writable asset directory to the repo.
module.exports=function prepareUiRoot(destination){
  const target=path.resolve(destination),temporary=fs.realpathSync(os.tmpdir());
  assert.ok(target.startsWith(temporary+path.sep)&&target!==temporary,'UI fixture must be inside a temporary directory');
  assert.ok(target!==deps.ROOT&&!target.startsWith(deps.ROOT+path.sep),'UI fixture must not use the repository');
  fs.mkdirSync(target,{recursive:true});
  assert.ok(fs.realpathSync(target).startsWith(temporary+path.sep),'UI fixture cannot point outside temporary storage');
  const files=Array.from(new Set(deps.runtimeAssets(deps.HTML_ENTRIES).files.concat([
    'js/personal-center-dialogs.js',
    'assets/catalog/default-cloud-v1.svg','assets/catalog/default-balloon-v1.svg','assets/catalog/default-balloon-far-v1.svg',
    'assets/covers/oral-3000.webp','assets/covers/idioms.webp'
  ]))).filter(file=>!file.replace(/\\/g,'/').startsWith('content/'));
  for(const file of files){
    const source=path.resolve(deps.ROOT,file),output=path.resolve(target,file);
    assert.ok(source.startsWith(deps.ROOT+path.sep)&&output.startsWith(target+path.sep));
    fs.mkdirSync(path.dirname(output),{recursive:true});
    assert.ok(fs.realpathSync(path.dirname(output)).startsWith(fs.realpathSync(target)+path.sep)||path.dirname(output)===target);
    fs.copyFileSync(source,output,fs.constants.COPYFILE_EXCL);
  }
  return files;
};
