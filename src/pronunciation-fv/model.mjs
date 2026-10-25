export const words={fan:{meaning:'风扇',sound:'f'},van:{meaning:'厢式货车',sound:'v'},fine:{meaning:'好的',sound:'f'},vine:{meaning:'藤蔓',sound:'v'}};
export function shuffle(items,random=Math.random){const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
export function makeTrials(pair,speaker,random=Math.random){return shuffle([...pair,...pair],random).map(word=>({word,speaker,options:shuffle(pair,random)}));}
export function recordFirst(results,key,expected,answer){if(Object.hasOwn(results,key))return results[key];return results[key]={correct:answer===expected,expected,answer};}
