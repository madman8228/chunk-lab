export function normalize(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[.,!?。！？]/g,'').replace(/\s+/g,' ').trim();}
export function evaluate(text,target){
 const value=normalize(text);if(!value)return {kind:'empty',message:'先写一句，或选择口头尝试。'};
 const taught=new Set([`i need ${target}`,`i need some ${target}`,`i need ${target} please`,`i need some ${target} please`,`please i need ${target}`,`please i need some ${target}`]);
 if(taught.has(value))return {kind:'taught',features:{targetObject:true,taughtStructure:true,some:value.split(' ').includes('some'),please:value.split(' ').includes('please')},message:'这句表达了需要的东西，也用了本课的 I need… 结构。'+(target==='tea'&&!value.split(' ').includes('please')?' 本次情境还要求礼貌说明，可以补上 please。':'')};
 const alternatives=new Set([`some ${target} please`,`${target} please`,`i'd like some ${target}`,`i'd like some ${target} please`,`i would like some ${target}`,`i would like some ${target} please`,`can i have some ${target}`,`can i have some ${target} please`]);
 if(alternatives.has(value))return {kind:'alternative',message:'这个说法可以表达请求，但不是本课 I need… 结构；两者分开记录。'};
 return {kind:'review',message:'这句暂未收录，保留待核对，不自动判错。可对照参考检查意思。'};
}
