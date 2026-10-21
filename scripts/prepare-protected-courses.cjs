'use strict';
const {LegacyCourseInventory,prepareLegacyCourseBundle}=require('../server/services/membership/legacy-course-inventory');
function main(args){
  let appRoot=null,output=null,all=false;const courseIds=[];
  for(let index=0;index<args.length;index+=2){
    const flag=args[index],value=args[index+1];
    if(flag==='--all'){if(value!=='true'||all)throw new Error('--all 必须显式设置为 true 且不能重复');all=true;continue;}
    if(!value||value.startsWith('--')||!['--app-root','--output','--course'].includes(flag))throw new Error('参数无效：'+flag);
    if(flag==='--course')courseIds.push(value);
    else if(flag==='--app-root'){if(appRoot)throw new Error('--app-root 不能重复');appRoot=value;}
    else{if(output)throw new Error('--output 不能重复');output=value;}
  }
  if(!appRoot||(!courseIds.length&&!all)||all&&courseIds.length)throw new Error('请显式提供 --app-root，并选择 --course 或 --all true；可选 --output 生成全新的私有候选目录。');
  const inventory=new LegacyCourseInventory({appRoot});
  if(all)courseIds.push(...inventory.catalog().courses.map(course=>course.id));
  const result=output?prepareLegacyCourseBundle({inventory,courseIds,output}):inventory.inspect(courseIds);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
if(require.main===module){try{main(process.argv.slice(2));}catch(error){process.stderr.write((error.code||error.message)+'\n');process.exitCode=1;}}
module.exports={main};
