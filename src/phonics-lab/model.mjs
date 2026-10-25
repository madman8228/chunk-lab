export const letters=['m','s','a','t'];
export const phases=['听声音','认对应','看拼合','自己拼','拆声音','试新词'];
export const teachingWord='mat';
export const transferWord='sat';
export function matches(tokens,word){return tokens.length===word.length&&tokens.every((token,index)=>token===word[index]);}
export function makeSession(){return {phase:0,selected:[],blendIndex:-1,attempted:false,transferRevealed:false,results:{}};}
