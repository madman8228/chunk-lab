'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');

function verifyDependencies(directory){
  const root=path.resolve(directory);
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
  const dependencies=pkg.dependencies;
  const lockedRoot=lock.packages && lock.packages[''] && lock.packages[''].dependencies;
  if(!dependencies || !Object.keys(dependencies).length || !lockedRoot ||
      JSON.stringify(Object.entries(dependencies).sort())!==JSON.stringify(Object.entries(lockedRoot).sort())){
    throw new Error('Package declarations differ from lock root');
  }
  const load=createRequire(path.join(root,'package.json'));
  const checked=[];
  for(const name of Object.keys(dependencies)){
    const expected=lock.packages && lock.packages['node_modules/'+name];
    if(!expected || !expected.version)throw new Error('Missing locked dependency: '+name);
    const installed=JSON.parse(fs.readFileSync(path.join(root,'node_modules',name,'package.json'),'utf8'));
    if(installed.version!==expected.version)throw new Error('Installed version differs from lock: '+name);
    load(name); // Includes the native SQLite binding and real SMS SDK modules.
    checked.push({name,version:installed.version});
  }
  return checked;
}
if(require.main===module){
  try{console.log(JSON.stringify({verified:verifyDependencies(process.argv[2]||path.join(__dirname,'../server'))}));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={verifyDependencies};
