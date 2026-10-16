(function(root){
  'use strict';
  var covers=['assets/catalog/default-bubble-v2.webp','assets/catalog/default-dragonfly-v2.webp','assets/catalog/default-butterfly-v2.webp'];
  function fallback(item){
    item=item||{};
    // Stable pseudo-random assignment: do not shuffle covers on redraw or store changes in course data.
    var key=String(item.courseId||item.resourceId||item.id||(item.contentRef||{}).id||item.title||item.kind||item.type||'default');
    var hash=2166136261;
    for(var i=0;i<key.length;i++){hash^=key.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return covers[(hash>>>0)%covers.length];
  }
  var api={fallback:fallback,variants:covers.slice()};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CourseCovers=api;
})(typeof window!=='undefined'?window:globalThis);
