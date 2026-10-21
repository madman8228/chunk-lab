'use strict';
const crypto=require('node:crypto');
module.exports=require('../../src/vocabulary-material-library/core.cjs').createModel({
 hash:value=>crypto.createHash('sha256').update(value).digest('hex'),
 draftModel:require('../../js/wordbook-draft'),engine:require('../../landing/sentence-cloze-engine'),
 contract:require('../../js/vocabulary-course-contract'),applicationModel:require('../../js/vocabulary-application-material')
});
