/* ============================================================
   chunk-shape.test.js · 「最少切几段」判据的单测 + 防散落护栏
   node chunk-shape.test.js

   ★ 背景：除单字句外，少数固定表达（如 Good night）拆分后也会产生误导性对照。
     现按**句子形态**判定：单字句与人工审核的固定表达允许 1 段，其余仍 ≥2。

   ★ 这个判据曾散落在 7 个文件里（本项目反复踩「改一处必漏一处」）。
     所以本测试做两件事：
       1) 判据本身的正反例（含负向自证：2 词句切 1 段必须判红）
       2) **护栏**：扫描全部 git 跟踪的源文件，除白名单外不许再出现硬编码段数比较；
          并断言各校验器确实引用同一份实现 —— 防止判据再被复制回各处
   ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var CS = require('./js/chunk-shape.js');

var pass = 0, fail = 0;
function assert(cond, name) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name); }
}
function assertEq(actual, expected, name) {
  if (actual === expected) { pass++; console.log('  ✓ ' + name + ' = ' + JSON.stringify(expected)); }
  else { fail++; console.log('  ✗ ' + name + ' → ' + JSON.stringify(actual) + '（期望 ' + JSON.stringify(expected) + '）'); }
}

console.log('== 1. wordCount：去标点后的词数 ==');
[['Help!', 1], ['Thief!', 1], ['Thanks.', 1], ['Hi!', 1], ['Really?', 1], ['Maybe.', 1],
 ['Sure.', 1], ["Don't.", 1], ['OK.', 1], ['U.S.', 1], ['Wow!', 1],          /* 单字句：撇号/缩写算 1 词 */
 ["I'm late!", 2], ["Let's go.", 2], ['Good morning.', 2], ['Mr. Smith', 2],  /* 2 词：必须切 2 段 */
 ['How are you?', 3], ['', 0], ['...', 0], ['   ', 0]
].forEach(function (c) { assertEq(CS.wordCount(c[0]), c[1], 'wordCount(' + JSON.stringify(c[0]) + ')'); });

console.log('\n== 2. minChunks：单字句例外只此一条路径 ==');
assertEq(CS.minChunks('Help!'), 1, "minChunks('Help!')");
assertEq(CS.minChunks("Don't."), 1, "minChunks(\"Don't.\")");
assertEq(CS.minChunks("I'm late!"), 2, "minChunks(\"I'm late!\")");
assertEq(CS.minChunks('Good morning.'), 2, "minChunks('Good morning.')");
assertEq(CS.minChunks('Do the dishes!'), 1, "minChunks('Do the dishes!') 固定表达");
assertEq(CS.minChunks('Have a seat.'), 1, '固定待客表达按整体语义呈现');
assertEq(CS.minChunks('How nice of you to come!'), 1, '固定欢迎表达按整体语义呈现');
assertEq(CS.minChunks("Let's get together again sometime."), 1, '固定邀约表达按整体语义呈现');
assertEq(CS.minChunks('Nice to meet you, too.'), 1, '固定寒暄回应按整体语义呈现');
assertEq(CS.minChunks('Where are you from?'), 1, '固定身份问句按整体语义呈现');
assertEq(CS.minChunks('A little.'), 1, '数量短语按整体语义呈现');
assertEq(CS.minChunks('What year are you in?'), 1, '固定年级问句按整体语义呈现');
assertEq(CS.minChunks("What's your major?"), 1, '固定专业问句按整体语义呈现');
assertEq(CS.minChunks('Any brothers or sisters?'), 1, '固定家庭情况问句按整体语义呈现');
assertEq(CS.minChunks('How long have you been skiing?'), 1, '固定经历问句按整体语义呈现');
assertEq(CS.minChunks('How old are you?'), 1, '固定年龄问句按整体语义呈现');
assertEq(CS.minChunks('How much do you weigh?'), 1, '固定体重问句按整体语义呈现');
assertEq(CS.minChunks('How tall are you?'), 1, '固定身高问句按整体语义呈现');
[
  "It's blistering hot.", "It's raining.", "It's humid.", "It's dry.", "It's stormy.",
  "It's snowing.", "It's gloomy.", "It's foggy.", "It's freezing.", "It's pleasant.",
  "It's misty.", "It's miserable.", "It's getting windy."
].forEach(function (sentence) {
  assertEq(CS.minChunks(sentence), 1, '天气表达按整体语义呈现: ' + sentence);
});
assertEq(CS.minChunks('I know that much!'), 1, '固定强调表达按整体语义呈现');
assertEq(CS.minChunks('I hear you.'), 1, '固定回应表达按整体语义呈现');
assertEq(CS.minChunks("I'm following you."), 1, '固定理解表达按整体语义呈现');
assertEq(CS.minChunks('Makes sense.'), 1, '固定判断表达按整体语义呈现');
[
  'Was it good?', 'How did you like it?', 'To make a long story short,...', 'A piece of cake.',
  'It worked!', 'Going from bad to worse.', 'He made it big.', "Don't be silly."
].forEach(function (sentence) {
  assertEq(CS.minChunks(sentence), 1, '固定表达按整体语义呈现: ' + sentence);
});
[
  "It's on the tip of my tongue.", 'Beats me.', 'What do you call it?', 'How was your trip?',
  "I'm all ears.", 'How was the meeting?', 'How was the movie?', 'How was your day?',
  'To change the subject...', 'By the way,...', "It's up to you.",
  "That's easy for you to say.", "That's the name of the game.", 'Give it a shot.', "It's worth trying one more time.",
  'Easy does it.', "Let's not jump the gun.", 'Step on it!', 'Put yourself in my shoes.', 'I told you so.',
  "Don't call me names!", 'Move on!', 'Run for your lives!', 'Stand back!', 'Drop it!',
  'Get your hands off!', 'Stay down!', 'Get lost!', 'Get out of here!', 'Back off!',
  "I can't thank you enough.", "You've been very helpful.", 'Thanks for your time.',
  'Thanks for everything.', 'Thank you anyway.', 'How nice!', "You're welcome.",
  "Don't mention it.", "I'm sorry about that.", "That's all right.", 'After you.', 'Can I give you a hand?', 'Good for you.',
  'I think so, too.', "That's it!", 'You got it.', 'Hear, hear!', 'No doubt.', 'Fair enough.', 'That makes no sense.',
  "You ain't seen nothing yet.", "Let's leave well enough alone.", 'How come?',
  'How did it happen?', 'Explain it to me.', "That's why!", "Let's play hooky!",
  "What's the matter?", 'Anything for you.', 'That will do.', 'Not right now.', "That's beside the point.",
  "I'm game!", "If that's all right with you.", "If it's all right with you,…", 'Over my dead body!',
  'As a matter of fact, ...', 'What did you get for me?', "I'm walking on air.", 'What fun!',
  'Talk about luck.', 'This is it!',
  'Not now.', 'Not here.', 'Take a look!', "Don't ignore me.", "What's the big idea?",
  "I wasn't born yesterday.", 'Shut up!', 'Get off my back.', "Don't talk back to me!",
  'Big mouth!', 'Get out of my face!', 'You asshole!', 'Calm down.', 'Take your time.'
].forEach(function (sentence) {
  assertEq(CS.minChunks(sentence), 1, '完整固定意群呈现: ' + sentence);
});
assertEq(CS.minChunks('GOOD NIGHT.'), 1, "大小写/标点变化仍识别 Good night 固定表达");
assertEq(CS.minChunks("You've got a big mouth!"), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('A little bird told me.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('Will do.'), 1, '固定应允表达按整体语义呈现');
assertEq(CS.minChunks('What are you up to?'), 1, '俚语问句按整体语义呈现');
assertEq(CS.minChunks('Who does this belong to?'), 1, '倒装问句按整体语义呈现');
assertEq(CS.minChunks('For example?'), 1, '省略式举例提示按整体语义呈现');
assertEq(CS.minChunks('How often?'), 1, '频率问句按整体语义呈现');
assertEq(CS.minChunks('Oh, boy!'), 1, '感叹语按整体语义呈现');
assertEq(CS.minChunks('I feel like a million dollars.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('You did it!'), 1, '固定赞语按整体语义呈现');
assertEq(CS.minChunks("It's your lucky day."), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('Thank heavens!'), 1, '固定感叹语按整体语义呈现');
assertEq(CS.minChunks('What a relief!'), 1, '固定感叹语按整体语义呈现');
assertEq(CS.minChunks('Here we are at last.'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('Good riddance.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('It went down the drain.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('Play fair!'), 1, '固定指令按整体语义呈现');
assertEq(CS.minChunks("You're good for nothing."), 1, '固定评价表达按整体语义呈现');
assertEq(CS.minChunks('It drives me crazy.'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks("Don't tell me what to do!"), 1, '固定抗议表达按整体语义呈现');
assertEq(CS.minChunks("Don't make fun of me."), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks("I've run out of patience."), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('What nerve!'), 1, '固定感叹语按整体语义呈现');
assertEq(CS.minChunks('Have it your way!'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks("It's for the birds."), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks("It's outdated."), 1, '短句整体对应');
assertEq(CS.minChunks('Give me a break'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('Have a heart!'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('Stop putting us on.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks("Don't pull my leg!"), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('Take it back!'), 1, '固定指令按整体语义呈现');
assertEq(CS.minChunks('You coward!'), 1, '固定称呼按整体语义呈现');
assertEq(CS.minChunks('Fuck you!'), 1, '固定感叹语按整体语义呈现');
assertEq(CS.minChunks('You asshole!'), 1, '固定称呼按整体语义呈现');
assertEq(CS.minChunks('Hey, ugly!'), 1, '固定称呼按整体语义呈现');
assertEq(CS.minChunks('Kick back!'), 1, '短语动词按整体语义呈现');
assertEq(CS.minChunks("Don't get so uptight."), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks("Don't be so stiff."), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks("Let's forgive and forget!"), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('Alone at last.'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('I give up.'), 1, '短语动词按整体语义呈现');
assertEq(CS.minChunks("I can't help it."), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('Not a chance!'), 1, '固定拒绝表达按整体语义呈现');
assertEq(CS.minChunks("That's the way it goes."), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks("I'm throwing in the towel."), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('It beats me.'), 1, '固定口语表达按整体语义呈现');
assertEq(CS.minChunks('Serves you right.'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('You never know.'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('No wonder.'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('It was careless of me to do so.'), 1, '整句表达按整体语义呈现');
assertEq(CS.minChunks("We won't open until eleven."), 1, 'not ... until 语义按整体呈现');
assertEq(CS.minChunks('What are you looking for?'), 1, '疑问词与疑问句按整体呈现');
assertEq(CS.minChunks('Come in.'), 1, '固定邀请语按整体呈现');
assertEq(CS.minChunks('Family man.'), 1, '固定名词表达按整体呈现');
assertEq(CS.minChunks('Business is business.'), 1, '固定格言按整体呈现');
assertEq(CS.minChunks('Which Suzuki do you want to talk to?'), 1, '语序倒装问句按整体呈现');
assertEq(CS.minChunks('How do you spell your name?'), 1, '姓名拼写问句按整体呈现');
assertEq(CS.minChunks("What's your number?"), 1, '号码问句按整体呈现');
assertEq(CS.minChunks('What number are you calling?'), 1, '电话号码询问按整体语义呈现');
assertEq(CS.minChunks('Who would you like to talk to?'), 1, '电话转接问句按整体语义呈现');
assertEq(CS.minChunks("There's no Bob Hope in this office."), 1, '否定倒装句按整体语义呈现');
assertEq(CS.minChunks("He's wise for his age."), 1, '年龄比较语序按整体呈现');
assertEq(CS.minChunks('You have a lot of nerve.'), 1, '固定习语按整体呈现');
assertEq(CS.minChunks("There's something strange about her."), 1, '语序倒装表达按整体呈现');
assertEq(CS.minChunks("How's your married life?"), 1, '语序倒装问句按整体语义呈现');
assertEq(CS.minChunks('Are you seeing someone now?'), 1, '交往状态是非问句按整体语义呈现');
assertEq(CS.minChunks('What size are you?'), 1, '尺码问句按整体呈现');
assertEq(CS.minChunks('What size do you take in shoes?'), 1, '鞋码问句按整体呈现');
assertEq(CS.minChunks('Will that be cash or charge?'), 1, '二选一付款问句按整体呈现');
assertEq(CS.minChunks('How old is it?'), 1, '语序倒装问句按整体语义呈现');
assertEq(CS.minChunks('On the nose.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('As soon as possible.'), 1, '固定礼貌短语按整体语义呈现');
assertEq(CS.minChunks('behind my back'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('for a change'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('Money talks.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('Never say die.'), 1, '固定鼓励习语按整体语义呈现');
assertEq(CS.minChunks('all along'), 1, '固定时间短语按整体语义呈现');
assertEq(CS.minChunks('It slipped my mind.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('What a pity.'), 1, '固定感叹表达按整体语义呈现');
assertEq(CS.minChunks('a wild-goose chase.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('All that for nothing.'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('I blew it.'), 1, '固定口语表达按整体语义呈现');
assertEq(CS.minChunks('I have no clue.'), 1, '固定口语表达按整体语义呈现');
assertEq(CS.minChunks('Better than nothing.'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('It was fate.'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('That figures.'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('Oh, dear!'), 1, '固定感叹表达按整体语义呈现');
assertEq(CS.minChunks("You're nothing to me."), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks("What's the fuss about?"), 1, '固定疑问表达按整体语义呈现');
assertEq(CS.minChunks("I'm not in a good mood."), 1, '固定状态表达按整体语义呈现');
assertEq(CS.minChunks("I'm cranky today."), 1, '状态短句按整体语义呈现');
assertEq(CS.minChunks("Don't rob Peter to pay Paul."), 1, '固定谚语按整体语义呈现');
assertEq(CS.minChunks("I can't bear to watch."), 1, '固定情感表达按整体语义呈现');
assertEq(CS.minChunks("I'm hooked on..."), 1, '固定搭配按整体语义呈现');
assertEq(CS.minChunks('Tomato soup is my cup of tea.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('Never again!'), 1, '固定时间表达按整体语义呈现');
assertEq(CS.minChunks('Is something on your mind?'), 1, '固定关心问句按整体语义呈现');
assertEq(CS.minChunks("Please don't go out of your way."), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks("You don't look very happy today."), 1, '整句状态表达按整体语义呈现');
assertEq(CS.minChunks('Something is wrong with you today.'), 1, '整句状态表达按整体语义呈现');
assertEq(CS.minChunks('It happens!'), 1, '固定口语表达按整体语义呈现');
assertEq(CS.minChunks('Never mind.'), 1, '固定安慰表达按整体语义呈现');
assertEq(CS.minChunks('Cheer up!'), 1, '固定鼓励表达按整体语义呈现');
assertEq(CS.minChunks('You can do it!'), 1, '固定鼓励表达按整体语义呈现');
assertEq(CS.minChunks('Look on the bright side.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks("What's going on?"), 1, '固定疑问表达按整体语义呈现');
assertEq(CS.minChunks('Try harder next time.'), 1, '完整鼓励表达按整体语义呈现');
assertEq(CS.minChunks("It's too good to be true."), 1, '固定怀疑表达按整体语义呈现');
assertEq(CS.minChunks('Play nice with your little brother.'), 1, '固定祈使表达按整体语义呈现');
assertEq(CS.minChunks('You got me.'), 1, '固定口语表达按整体语义呈现');
assertEq(CS.minChunks('Whatever you want.'), 1, '固定回应按整体语义呈现');
assertEq(CS.minChunks("It doesn't matter."), 1, '固定回应按整体语义呈现');
assertEq(CS.minChunks("That's news to me."), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks("I'm really happy for you!"), 1, '固定祝贺表达按整体语义呈现');
assertEq(CS.minChunks("Let's make a toast!"), 1, '固定祝酒表达按整体语义呈现');
assertEq(CS.minChunks("Here's to your health!"), 1, '固定祝酒表达按整体语义呈现');
assertEq(CS.minChunks("Here's to the New Year!"), 1, '固定祝酒表达按整体语义呈现');
assertEq(CS.minChunks('Happy New Year!'), 1, '固定节日祝福按整体语义呈现');
assertEq(CS.minChunks("Happy Valentine's Day!"), 1, '固定节日祝福按整体语义呈现');
assertEq(CS.minChunks('Happy Easter!'), 1, '固定节日祝福按整体语义呈现');
assertEq(CS.minChunks("Happy Mother's Day!"), 1, '固定节日祝福按整体语义呈现');
assertEq(CS.minChunks('Happy Thanksgiving!'), 1, '固定节日祝福按整体语义呈现');
assertEq(CS.minChunks('Merry Christmas!'), 1, '固定节日祝福按整体语义呈现');
assertEq(CS.minChunks('Happy anniversary!'), 1, '固定纪念日祝福按整体语义呈现');
assertEq(CS.minChunks('How much money do you have?'), 1, '固定询问按整体语义呈现');
assertEq(CS.minChunks('Where is the Japan Airlines counter?'), 1, '固定地点问句按整体语义呈现');
assertEq(CS.minChunks('Where is the boarding gate?'), 1, '固定地点问句按整体语义呈现');
assertEq(CS.minChunks('Room service, please.'), 1, '固定服务请求按整体语义呈现');
assertEq(CS.minChunks('A wake-up call, please.'), 1, '固定服务请求按整体语义呈现');
assertEq(CS.minChunks('Your room number, please.'), 1, '固定服务请求按整体语义呈现');
assertEq(CS.minChunks('Laundry service, please.'), 1, '固定服务请求按整体语义呈现');
assertEq(CS.minChunks('What is the price of a dinner course?'), 1, '固定询价按整体语义呈现');
assertEq(CS.minChunks("I'm starving."), 1, '固定夸张表达按整体语义呈现');
assertEq(CS.minChunks('Keep the change.'), 1, '固定收款表达按整体语义呈现');
assertEq(CS.minChunks('Are they open on Saturdays?'), 1, '固定营业时间问句按整体语义呈现');
assertEq(CS.minChunks('A Japanese-speaking person, please.'), 1, '固定请求按整体语义呈现');
assertEq(CS.minChunks('We welcome this development very much.'), 1, '固定强调句按整体语义呈现');
assertEq(CS.minChunks('Yours very truly,'), 1, '固定商务信函结语按整体呈现');
assertEq(CS.minChunks('Sincerely yours,'), 1, '固定商务信函结语按整体呈现');
assertEq(CS.minChunks('My best regards,'), 1, '固定商务信函结语按整体呈现');
assertEq(CS.minChunks('With best regards,'), 1, '固定商务信函结语按整体呈现');
assertEq(CS.minChunks('The very best to you,'), 1, '固定商务信函结语按整体呈现');
assertEq(CS.minChunks('Best wishes,'), 1, '固定商务信函结语按整体呈现');
assertEq(CS.minChunks('Every Tom, Dick and Harry.'), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('There is no smoke without fire.'), 1, '固定谚语按整体语义呈现');
assertEq(CS.minChunks('I mean it.'), 1, '固定强调表达按整体语义呈现');
assertEq(CS.minChunks("I'm all right."), 1, '固定语境表达按整体语义呈现');
assertEq(CS.minChunks('Hold on.'), 1, '固定短语动词按整体语义呈现');
assertEq(CS.minChunks("It can't be helped."), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks("It's your attitude I don't like."), 1, '语序倒装句按整体语义呈现');
assertEq(CS.minChunks("I've had it."), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks("Don't give it another thought."), 1, '固定安慰表达按整体语义呈现');
assertEq(CS.minChunks('No big deal.'), 1, '固定口语表达按整体语义呈现');
assertEq(CS.minChunks('Hang in there!'), 1, '固定鼓励习语按整体语义呈现');
assertEq(CS.minChunks("Don't give up!"), 1, '固定鼓励表达按整体语义呈现');
assertEq(CS.minChunks('Keep your chin up!'), 1, '固定鼓励习语按整体语义呈现');
assertEq(CS.minChunks("Don't be a chicken."), 1, '固定习语按整体语义呈现');
assertEq(CS.minChunks('Take my word for it.'), 1, '固定保证表达按整体语义呈现');
assertEq(CS.minChunks("You'd better believe it!"), 1, '固定强调表达按整体语义呈现');
assertEq(CS.minChunks('Let it be.'), 1, '固定表达按整体语义呈现');
assertEq(CS.minChunks('Shame on you!'), 1, '固定责备表达按整体语义呈现');
assertEq(CS.minChunks('Oh, my!'), 1, '固定感叹表达按整体语义呈现');
assertEq(CS.minChunks("You don't say!"), 1, '固定反应表达按整体语义呈现');
assertEq(CS.minChunks("That'll be the day!"), 1, '固定反讽表达按整体语义呈现');
assertEq(CS.minChunks('We were surprised by the news.'), 1, '因果关系按整句语义呈现');
assertEq(CS.minChunks('Break a leg!'), 1, '固定祝愿习语按整体语义呈现');
assertEq(CS.minChunks("I'm so sorry."), 1, '吊唁语境按完整表达呈现');
assertEq(CS.minChunks('Trick or treat!'), 1, '节日固定口号按整体语义呈现');
assertEq(CS.minChunks('Where are you staying?'), 1, '语序倒装疑问句按整体语义呈现');
assertEq(CS.minChunks('Where to?'), 1, '省略式目的地问句整体对应');
assertEq(CS.minChunks('No outlet!'), 1, '道路标志按完整表达呈现');
assertEq(CS.minChunks('Going down?'), 1, '电梯省略问句按完整表达呈现');
assertEq(CS.minChunks('How much is this?'), 1, '价格问句按完整表达呈现');
assertEq(CS.minChunks('How much is it?'), 1, '价格问句按完整表达呈现');
assertEq(CS.minChunks('Take it or leave it.'), 1, '固定最后通牒表达按整体语义呈现');
assertEq(CS.minChunks('Come and get it!'), 1, "minChunks('Come and get it!') 固定表达");
assertEq(CS.minChunks('Sweet dreams.'), 1, "minChunks('Sweet dreams.') 固定表达");
assertEq(CS.minChunks('Let go.'), 1, "minChunks('Let go.') 固定表达");
assertEq(CS.minChunks('What a mess!'), 1, "minChunks('What a mess!') 固定表达");
assertEq(CS.minChunks('What a waste!'), 1, "minChunks('What a waste!') 固定表达");
assertEq(CS.minChunks("I'm broke."), 1, "minChunks(I'm broke) 固定表达");
assertEq(CS.minChunks('Take a walk.'), 1, "minChunks('Take a walk.') 固定表达");
assertEq(CS.minChunks('Where is... playing?'), 1, "电影名称模板按完整语义句呈现");
assertEq(CS.minChunks('What are you going to sing?'), 1, '疑问词与动词句型整体对应');
assertEq(CS.minChunks('What are you drinking?'), 1, '疑问词与动作整体对应');
assertEq(CS.minChunks('Go for it,...!'), 1, '含占位符的鼓励句整体对应');
assertEq(CS.minChunks("What's wrong with you?"), 1, '固定问句按整体语义呈现');
assertEq(CS.minChunks("What's wrong with me?"), 1, '固定问句按整体语义呈现');
assertEq(CS.minChunks("What's wrong?"), 1, '固定问句按整体语义呈现');
assertEq(CS.minChunks("I don't feel well."), 1, '否定习语整体对应');
assertEq(CS.minChunks('Are you taking any medication regularly?'), 1, '医疗问句整体对应');
assertEq(CS.minChunks('Take a rest.'), 1, '固定短语整体对应');
assertEq(CS.minChunks('Lie down.'), 1, '短语动词整体对应');
assertEq(CS.minChunks('How long will the cast be on?'), 1, '医疗固定问句整体对应');
assertEq(CS.minChunks('It hurts.'), 1, '简短症状表达整体对应');
assertEq(CS.minChunks('I got stung by a bee.'), 1, '固定被动表达整体对应');
assertEq(CS.minChunks("What's on your mind?"), 1, '固定问句整体对应');
assertEq(CS.minChunks('Nothing is too good for you.'), 1, '固定习语整体对应');
assertEq(CS.minChunks('What did she have?'), 1, '依赖孕产语境的问句整体对应');
assertEq(CS.minChunks('Pull yourself together.'), 1, '固定短语整体对应');
assertEq(CS.minChunks("What's keeping you?"), 1, '固定问句整体对应');
assertEq(CS.minChunks("It's dark outside already."), 1, '时态与语序不可拆错的整句表达');
assertEq(CS.minChunks("It's close to me."), 1, 'close to me 整体对应“离我很近”');
assertEq(CS.minChunks('What floor is ABC on?'), 1, '楼层问句整体对应');
assertEq(CS.minChunks('Where are the elevators?'), 1, '电梯位置问句整体对应');
assertEq(CS.minChunks('Which side are you?'), 1, '立场问句因中文语序整体对应');
assertEq(CS.minChunks("That's the way he is."), 1, '指人行事风格的固定表达整体对应');
assertEq(CS.minChunks('Who is he like?'), 1, '人物相似度问句整体对应');
assertEq(CS.minChunks('What does he look like?'), 1, '外貌问句整体对应');
assertEq(CS.minChunks("He's good for nothing."), 1, '固定习语整体对应');
assertEq(CS.minChunks("You're too timid."), 1, '整体评价表达按完整语义对应');
assertEq(CS.minChunks("I'm all thumbs."), 1, '固定习语整体对应');
assertEq(CS.minChunks('I get embarrassed easily.'), 1, '副词语序调整后整句对应');
assertEq(CS.minChunks("I'm practical about everything."), 1, '整句语义整体对应');
assertEq(CS.minChunks('I have a one-track mind.'), 1, '固定习语整体对应');
assertEq(CS.minChunks("Who's calling, please?"), 1, '来电身份问句整体对应');
assertEq(CS.minChunks('Extension 103, please.'), 1, '分机转接请求整体对应');
assertEq(CS.minChunks("I'll get your party for you."), 1, '电话转接的固定表达整体对应');
assertEq(CS.minChunks('Please call again anytime.'), 1, '礼貌结束通话表达整体对应');
assertEq(CS.minChunks('I was cut off.'), 1, '电话中断表达整体对应');
assertEq(CS.minChunks("What's today's date?"), 1, '日期问句整体对应');
assertEq(CS.minChunks('What day is it?'), 1, '星期问句整体对应');
assertEq(CS.minChunks('Do you have the time?'), 1, '询问钟点的固定问句整体对应');
assertEq(CS.minChunks("How's the time?"), 1, '询问时间是否充裕的固定问句整体对应');
assertEq(CS.minChunks("It's about time."), 1, '固定表达整体对应');
assertEq(CS.minChunks("What's up?"), 1, '寒暄固定表达整体对应');
assertEq(CS.minChunks("What's the hurry?"), 1, '固定问句整体对应');
assertEq(CS.minChunks('Where are you headed?'), 1, '去向问句整体对应');
assertEq(CS.minChunks('Another day, another dollar.'), 1, '谚语式表达整体对应');
assertEq(CS.minChunks('How have you been?'), 1, '寒暄问句整体对应');
assertEq(CS.minChunks('How have you been doing?'), 1, '寒暄问句整体对应');
assertEq(CS.minChunks('What have you been doing?'), 1, '寒暄问句整体对应');
assertEq(CS.minChunks('How are you feeling?'), 1, '感受问句整体对应');
assertEq(CS.minChunks('Your number, please?'), 1, '省略式问句整体对应');
assertEq(CS.minChunks("I'm loaded."), 1, '饮酒语境下的固定俚语整体呈现');
assertEq(CS.minChunks('See you.'), 1, '告别短语整体对应');
assertEq(CS.minChunks('Good luck!'), 1, '祝福短语整体对应');
assertEq(CS.minChunks('Keep it up!'), 1, '鼓励短语整体对应');
assertEq(CS.minChunks('Come again.'), 1, '再次来访表达整体对应');
assertEq(CS.minChunks('Take care.'), 1, '告别关怀表达整体对应');
assertEq(CS.minChunks('Take it easy.'), 1, '固定习语整体对应');
assertEq(CS.minChunks("It's raining cats and dogs!"), 1, '习语含义不能按字面切分');
assertEq(CS.minChunks('Get the picture?'), 1, '固定习语按整体意思对应');
assertEq(CS.minChunks('What for?'), 1, '省略式疑问整体对应');
assertEq(CS.minChunks('Pardon me?'), 1, '请求重复的固定表达整体对应');
assertEq(CS.minChunks('Excuse me?'), 1, '礼貌打断/请求重复表达整体对应');
assertEq(CS.minChunks('You have?'), 1, '回声问句整体对应');
assertEq(CS.minChunks('Neither do I.'), 1, '否定附和倒装句整体对应');
assertEq(CS.minChunks('No kidding!'), 1, '口语感叹固定表达整体对应');
assertEq(CS.minChunks('You bet.'), 1, '肯定答复固定表达整体对应');
assertEq(CS.minChunks('What should I say...'), 1, '犹豫时的固定问句整体对应');
assertEq(CS.minChunks("It's all or nothing."), 1, '二选一固定表达整体对应');
assertEq(CS.minChunks('Watch out!'), 1, '警示表达整体对应');
assertEq(CS.minChunks('Hold it down!'), 1, '固定口语命令整体对应');
assertEq(CS.minChunks('Pay up!'), 1, '短语动词整体对应');
assertEq(CS.minChunks('Do as I said!'), 1, '固定命令按整体语义对应');
assertEq(CS.minChunks('Hold it!'), 1, '制止口令按整体语义对应');
assertEq(CS.minChunks('Hands up!'), 1, '固定口令按整体语义对应');
assertEq(CS.minChunks('Get down!'), 1, '固定口令按整体语义对应');
assertEq(CS.minChunks('Cut it out!'), 1, '固定制止表达按整体语义对应');
assertEq(CS.minChunks('Heads up!'), 1, '警示表达按整体语义对应');
assertEq(CS.minChunks('You asked for it!'), 1, '固定习语按整体语义对应');
assertEq(CS.minChunks('On your knees!'), 1, '固定口令按整体语义对应');
assertEq(CS.minChunks('Can it!'), 1, '固定口语命令按整体语义对应');
assertEq(CS.minChunks('Thank you.'), 1, '固定致谢按整体语义对应');
assertEq(CS.minChunks('Thank you very much.'), 1, '固定致谢按整体语义对应');
assertEq(CS.minChunks("You're welcome."), 1, '固定答谢按整体语义对应');
assertEq(CS.minChunks("I'm sorry."), 1, '固定道歉按整体语义对应');
assertEq(CS.minChunks('Good job!'), 1, '固定表扬按整体语义对应');
assertEq(CS.minChunks('Way to go!'), 1, '固定表扬按整体语义对应');
assertEq(CS.minChunks('Anything you say!'), 1, '固定应允表达按整体语义对应');
assertEq(CS.minChunks('You can say that again.'), 1, '固定赞同习语按整体语义对应');
assertEq(CS.minChunks('No way!'), 1, '固定拒绝表达按整体语义对应');
assertEq(CS.minChunks('Sort of.'), 1, '固定模糊应答按整体语义对应');
assertEq(CS.minChunks("It's the last straw."), 1, '固定习语按整体语义对应');
assertEq(CS.minChunks('Here you are.'), 1, '递交物品表达按整体语义对应');
assertEq(CS.minChunks('Hello, there!'), 1, '固定问候按整体语义对应');
assertEq(CS.minChunks('Of course.'), 1, '固定肯定答复按整体语义对应');
assertEq(CS.minChunks('Would you?'), 1, '省略式请求按整体语义对应');
assertEq(CS.minChunks("You're on!"), 1, '固定应允表达按整体语义对应');
assertEq(CS.minChunks('Count me out.'), 1, '固定拒绝表达按整体语义对应');
assertEq(CS.minChunks('Not yet.'), 1, '固定时间答复按整体语义对应');
assertEq(CS.minChunks('Not on your life!'), 1, '固定拒绝习语按整体语义对应');
assertEq(CS.minChunks('I passed by the skin of my teeth.'), 1, '固定习语与语境合成整体意群');
assertEq(CS.minChunks('You are what you eat.'), 1, '谚语整体对应其比喻义');
assertEq(CS.minChunks('Good afternoon.'), 1, '问候语按整体含义对应');
assertEq(CS.minChunks('Good evening.'), 1, '问候语按整体含义对应');
assertEq(CS.minChunks('How are you?'), 1, '固定寒暄问句整体对应');
assertEq(CS.minChunks("How's your family?"), 1, '问候家人近况的固定问句整体对应');
assertEq(CS.minChunks("How's everything?"), 1, '询问近况的固定问句整体对应');
assertEq(CS.minChunks("How's business?"), 1, '询问生意近况的固定问句整体对应');
assertEq(CS.minChunks('Not bad.'), 1, '固定应答整体对应');
assertEq(CS.minChunks('There you are!'), 1, '发现对方在场时的固定表达整体对应');
assertEq(CS.minChunks('Is Jeff around?'), 1, '询问某人是否在场的问句整体对应');
assertEq(CS.minChunks('Have you seen Scott?'), 1, '询问是否见到某人的问句整体对应');
assertEq(CS.minChunks("He's a stranger to me."), 1, '中文语序倒装的人物关系表达整体对应');
assertEq(CS.minChunks("It's been a long time."), 1, '好久不见的固定寒暄整体对应');
assertEq(CS.minChunks("It's been so long."), 1, '好久不见的固定寒暄整体对应');
assertEq(CS.minChunks('Long time no see.'), 1, '固定寒暄表达整体对应');
assertEq(CS.minChunks('Where have you been?'), 1, '询问对方去向的完整问句整体对应');
assertEq(CS.minChunks('Is John okay?'), 1, '询问他人近况的完整问句整体对应');
assertEq(CS.minChunks("How's he getting along these days?"), 1, '询问近况的完整问句整体对应');
assertEq(CS.minChunks('How was your weekend?'), 1, '询问周末近况的完整问句整体对应');
assertEq(CS.minChunks("I haven't seen you for ages."), 1, '固定寒暄表达整体对应');
assertEq(CS.minChunks('How are you doing these days?'), 1, '询问近况的完整问句整体对应');
assertEq(CS.minChunks("How ya doin'?"), 1, '口语化问候整体对应');
assertEq(CS.minChunks('Not too bad.'), 1, '固定应答整体对应');
assertEq(CS.minChunks("What's it about?"), 1, '固定问句按整体语义对应');
assertEq(CS.minChunks('Count me in.'), 1, '固定应允表达按整体语义对应');
assertEq(CS.minChunks(''), 1, "minChunks('') 空句按 1（无从判定词数，不额外施压）");
assertEq(CS.MAX_CHUNKS, 5, 'MAX_CHUNKS');

console.log('\n== 3. chunkCountOk：正例 ==');
[['Help!', ['Help!']], ['Thief!', ['Thief!']], ["Don't.", ["Don't."]],
 ["I'm late!", ["I'm", 'late!']], ['How are you?', ['How', 'are', 'you?']],
 ['a b c d e', ['a', 'b', 'c', 'd', 'e']]
].forEach(function (c) { assert(CS.chunkCountOk(c[0], c[1]) === true, JSON.stringify(c[1]) + ' → 合格（' + c[0] + '）'); });
[['Do the dishes!', ['Do the dishes!']], ['Good night.', ['Good night.']], ['Come and get it!', ['Come and get it!']], ['Sweet dreams.', ['Sweet dreams.']], ['Let go.', ['Let go.']], ['What a mess!', ['What a mess!']], ['What a waste!', ['What a waste!']], ["I'm broke.", ["I'm broke."]], ['Take a walk.', ['Take a walk.']], ['Where is... playing?', ['Where is... playing?']], ['What are you going to sing?', ['What are you going to sing?']], ['What are you drinking?', ['What are you drinking?']], ['Go for it,...!', ['Go for it,...!']], ["What's wrong with you?", ["What's wrong with you?"]], ["What's wrong with me?", ["What's wrong with me?"]], ["What's wrong?", ["What's wrong?"]], ["I don't feel well.", ["I don't feel well."]], ['Are you taking any medication regularly?', ['Are you taking any medication regularly?']], ['Take a rest.', ['Take a rest.']], ['Lie down.', ['Lie down.']], ['How long will the cast be on?', ['How long will the cast be on?']], ['It hurts.', ['It hurts.']], ['I got stung by a bee.', ['I got stung by a bee.']], ["I'm loaded.", ["I'm loaded."]]
].forEach(function (c) { assert(CS.chunkCountOk(c[0], c[1]) === true, JSON.stringify(c[1]) + ' → 固定表达整体合格（' + c[0] + '）'); });
assert(CS.chunkCountOk("What's on your mind?", ["What's on your mind?"]), '固定问句以完整语义单元通过校验');
assert(CS.chunkCountOk('Nothing is too good for you.', ['Nothing is too good for you.']), '固定习语以完整语义单元通过校验');
assert(CS.chunkCountOk('What did she have?', ['What did she have?']), '语境问句以完整语义单元通过校验');
assert(CS.chunkCountOk('Pull yourself together.', ['Pull yourself together.']), '固定短语以完整语义单元通过校验');
assert(CS.chunkCountOk("What's keeping you?", ["What's keeping you?"]), '固定问句以完整语义单元通过校验');
assert(CS.chunkCountOk('See you.', ['See you.']), '告别短语按整体语义单元通过校验');
assert(CS.chunkCountOk('Good luck!', ['Good luck!']), '祝福短语按整体语义单元通过校验');
assert(CS.chunkCountOk('Keep it up!', ['Keep it up!']), '鼓励短语按整体语义单元通过校验');
assert(CS.chunkCountOk('Come again.', ['Come again.']), '再次来访表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Take care.', ['Take care.']), '告别关怀表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Take it easy.', ['Take it easy.']), '固定习语按整体语义单元通过校验');
assert(CS.chunkCountOk("It's raining cats and dogs!", ["It's raining cats and dogs!"]), '天气习语按整体语义单元通过校验');
assert(CS.chunkCountOk('Get the picture?', ['Get the picture?']), '固定习语按整体语义单元通过校验');
assert(CS.chunkCountOk('What for?', ['What for?']), '省略式疑问按整体语义单元通过校验');
assert(CS.chunkCountOk('Pardon me?', ['Pardon me?']), '请求重复表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Excuse me?', ['Excuse me?']), '礼貌表达按整体语义单元通过校验');
assert(CS.chunkCountOk('You have?', ['You have?']), '回声问句按整体语义单元通过校验');
assert(CS.chunkCountOk('Neither do I.', ['Neither do I.']), '否定附和按整体语义单元通过校验');
assert(CS.chunkCountOk('No kidding!', ['No kidding!']), '口语感叹按整体语义单元通过校验');
assert(CS.chunkCountOk('You bet.', ['You bet.']), '肯定答复按整体语义单元通过校验');
assert(CS.chunkCountOk('What should I say...', ['What should I say...']), '犹豫问句按整体语义单元通过校验');
assert(CS.chunkCountOk("It's all or nothing.", ["It's all or nothing."]), '二选一表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Watch out!', ['Watch out!']), '警示表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Hold it down!', ['Hold it down!']), '口语命令按整体语义单元通过校验');
assert(CS.chunkCountOk('Pay up!', ['Pay up!']), '短语动词按整体语义单元通过校验');
assert(CS.chunkCountOk('Do as I said!', ['Do as I said!']), '固定命令按整体语义单元通过校验');
assert(CS.chunkCountOk('Hold it!', ['Hold it!']), '制止口令按整体语义单元通过校验');
assert(CS.chunkCountOk('Hands up!', ['Hands up!']), '固定口令按整体语义单元通过校验');
assert(CS.chunkCountOk('Get down!', ['Get down!']), '固定口令按整体语义单元通过校验');
assert(CS.chunkCountOk('Cut it out!', ['Cut it out!']), '固定制止表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Heads up!', ['Heads up!']), '警示表达按整体语义单元通过校验');
assert(CS.chunkCountOk('You asked for it!', ['You asked for it!']), '固定习语按整体语义单元通过校验');
assert(CS.chunkCountOk('On your knees!', ['On your knees!']), '固定口令按整体语义单元通过校验');
assert(CS.chunkCountOk('Can it!', ['Can it!']), '固定口语命令按整体语义单元通过校验');
assert(CS.chunkCountOk('Thank you.', ['Thank you.']), '固定致谢按整体语义单元通过校验');
assert(CS.chunkCountOk('Thank you very much.', ['Thank you very much.']), '固定致谢按整体语义单元通过校验');
assert(CS.chunkCountOk("You're welcome.", ["You're welcome."]), '固定答谢按整体语义单元通过校验');
assert(CS.chunkCountOk("I'm sorry.", ["I'm sorry."]), '固定道歉按整体语义单元通过校验');
assert(CS.chunkCountOk('Good job!', ['Good job!']), '固定表扬按整体语义单元通过校验');
assert(CS.chunkCountOk('Way to go!', ['Way to go!']), '固定表扬按整体语义单元通过校验');
assert(CS.chunkCountOk('Anything you say!', ['Anything you say!']), '固定应允表达按整体语义单元通过校验');
assert(CS.chunkCountOk('You can say that again.', ['You can say that again.']), '固定赞同习语按整体语义单元通过校验');
assert(CS.chunkCountOk('No way!', ['No way!']), '固定拒绝表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Sort of.', ['Sort of.']), '固定模糊应答按整体语义单元通过校验');
assert(CS.chunkCountOk("It's the last straw.", ["It's the last straw."]), '固定习语按整体语义单元通过校验');
assert(CS.chunkCountOk('Here you are.', ['Here you are.']), '递交物品表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Hello, there!', ['Hello, there!']), '固定问候按整体语义单元通过校验');
assert(CS.chunkCountOk('Of course.', ['Of course.']), '固定肯定答复按整体语义单元通过校验');
assert(CS.chunkCountOk('Would you?', ['Would you?']), '省略式请求按整体语义单元通过校验');
assert(CS.chunkCountOk("You're on!", ["You're on!"]), '固定应允表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Count me out.', ['Count me out.']), '固定拒绝表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Not yet.', ['Not yet.']), '固定时间答复按整体语义单元通过校验');
assert(CS.chunkCountOk('Not on your life!', ['Not on your life!']), '固定拒绝习语按整体语义单元通过校验');
assert(CS.chunkCountOk("What's it about?", ["What's it about?"]), '固定问句按整体语义单元通过校验');
assert(CS.chunkCountOk('Count me in.', ['Count me in.']), '固定应允表达按整体语义单元通过校验');
assert(CS.chunkCountOk('I passed by the skin of my teeth.', ['I passed by the skin of my teeth.']), '整句习语按完整意义通过校验');
assert(CS.chunkCountOk('You are what you eat.', ['You are what you eat.']), '谚语按完整比喻意义通过校验');
assert(CS.chunkCountOk("It's dark outside already.", ["It's dark outside already."]), '整句语义单元通过校验');
assert(CS.chunkCountOk("It's close to me.", ["It's close to me."]), '固定搭配整体对应，通过校验');
assert(CS.chunkCountOk('What floor is ABC on?', ['What floor is ABC on?']), '楼层问句按整体语义单元通过校验');
assert(CS.chunkCountOk('Where are the elevators?', ['Where are the elevators?']), '电梯位置问句按整体语义单元通过校验');
assert(CS.chunkCountOk('Which side are you?', ['Which side are you?']), '立场问句按整体语义单元通过校验');
assert(CS.chunkCountOk("That's the way he is.", ["That's the way he is."]), '描述人物特点的表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Who is he like?', ['Who is he like?']), '人物相似度问句按整体语义单元通过校验');
assert(CS.chunkCountOk('What does he look like?', ['What does he look like?']), '外貌问句按整体语义单元通过校验');
assert(CS.chunkCountOk("He's good for nothing.", ["He's good for nothing."]), '固定习语按整体语义单元通过校验');
assert(CS.chunkCountOk("You're too timid.", ["You're too timid."]), '整体评价表达按完整语义单元通过校验');
assert(CS.chunkCountOk("I'm all thumbs.", ["I'm all thumbs."]), '固定习语按整体语义单元通过校验');
assert(CS.chunkCountOk('I get embarrassed easily.', ['I get embarrassed easily.']), '副词语序调整后整句按整体语义单元通过校验');
assert(CS.chunkCountOk("I'm practical about everything.", ["I'm practical about everything."]), '整句语义按整体单元通过校验');
assert(CS.chunkCountOk('I have a one-track mind.', ['I have a one-track mind.']), '固定习语按整体语义单元通过校验');
assert(CS.chunkCountOk("Who's calling, please?", ["Who's calling, please?"]), '来电身份问句按整体语义单元通过校验');
assert(CS.chunkCountOk('Extension 103, please.', ['Extension 103, please.']), '分机转接请求按整体语义单元通过校验');
assert(CS.chunkCountOk("I'll get your party for you.", ["I'll get your party for you."]), '电话转接表达按整体语义单元通过校验');
assert(CS.chunkCountOk('Please call again anytime.', ['Please call again anytime.']), '礼貌结束通话表达按整体语义单元通过校验');
assert(CS.chunkCountOk('I was cut off.', ['I was cut off.']), '电话中断表达按整体语义单元通过校验');
assert(CS.chunkCountOk("What's today's date?", ["What's today's date?"]), '日期问句按整体语义单元通过校验');
assert(CS.chunkCountOk('What day is it?', ['What day is it?']), '星期问句按整体语义单元通过校验');
assert(CS.chunkCountOk('Do you have the time?', ['Do you have the time?']), '询问钟点的问句按整体语义单元通过校验');
assert(CS.chunkCountOk("How's the time?", ["How's the time?"]), '询问时间是否充裕的问句按整体语义单元通过校验');
assert(CS.chunkCountOk("It's about time.", ["It's about time."]), '固定表达按整体语义单元通过校验');
assert(CS.chunkCountOk("What's up?", ["What's up?"]), '寒暄固定表达按整体语义单元通过校验');
assert(CS.chunkCountOk("What's the hurry?", ["What's the hurry?"]), '固定问句按整体语义单元通过校验');
assert(CS.chunkCountOk('Where are you headed?', ['Where are you headed?']), '去向问句按整体语义单元通过校验');
assert(CS.chunkCountOk('Another day, another dollar.', ['Another day, another dollar.']), '谚语式表达按整体语义单元通过校验');
assert(CS.chunkCountOk('How have you been?', ['How have you been?']), '寒暄问句按整体语义单元通过校验');
assert(CS.chunkCountOk('How have you been doing?', ['How have you been doing?']), '寒暄问句按整体语义单元通过校验');
assert(CS.chunkCountOk('What have you been doing?', ['What have you been doing?']), '寒暄问句按整体语义单元通过校验');
assert(CS.chunkCountOk('How are you feeling?', ['How are you feeling?']), '感受问句按整体语义单元通过校验');
assert(CS.chunkCountOk('Your number, please?', ['Your number, please?']), '省略式问句按整体语义单元通过校验');

console.log('\n== 4. chunkCountOk：负向自证（必须能判红）==');
assert(CS.chunkCountOk("I'm late!", ["I'm late!"]) === false, '双词句切 1 段 → 判红（例外不可滥用）');
assert(CS.chunkCountOk('Good morning.', ['Good morning.']) === false, '双词句切 1 段（另一形态）→ 判红');
assert(CS.chunkCountOk('Can you swim?', ['Can']) === false, '三词句只切 1 段 → 判红');
assert(CS.chunkCountOk('Help!', []) === false, '空 chunks → 判红');
assert(CS.chunkCountOk('Help!', null) === false, 'chunks 非数组 → 判红');
assert(CS.chunkCountOk('a b c d e f', ['a', 'b', 'c', 'd', 'e', 'f']) === false, '6 段 > MAX_CHUNKS(5) → 判红');

console.log('\n== 5. chunkCountError：错误文案与判据同源 ==');
assertEq(CS.chunkCountError('Help!', ['Help!']), null, "chunkCountError('Help!') 合格时为 null");
assert(/2/.test(CS.chunkCountError("I'm late!", ["I'm late!"]) || ''), '双词句 1 段 → 提示需 2 段');
assert(/6/.test(CS.chunkCountError('a b c', ['a', 'b', 'c', 'd', 'e', 'f']) || ''), '超 5 段 → 提示段数');

console.log('\n== 6. 护栏：判据必须只有一处实现 ==');
/* 各校验器 / 构建器必须引用同一份，而不是自己再写一遍 */
var MUST_REF = [
  'validate_oral_book.js',
  'validate_freq_idioms.js',
  'scripts/book-content-check.mjs',
  'scripts/build-content.mjs',
  'scripts/check-oral-batch.mjs',
  'scripts/gen-fast-content.mjs',
  'scripts/inject-freq-idioms.js'
];
MUST_REF.forEach(function (f) {
  var src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  assert(/chunk-shape/.test(src), f + ' 引用了 chunk-shape 判据');
});

/* 作者侧必须走共享判据。主导入与追加导入都会调用 validateDeck；追加流程复用
   共享校验器，而不是复制 ChunkShape 判据。 */
['decks.html', 'main.html'].forEach(function (f) {
  var src = fs.readFileSync(path.join(__dirname, f), 'utf8');
  assert(/<script src="js\/chunk-shape\.js">/.test(src), f + ' 引入了判据脚本 js/chunk-shape.js');
  if (f === 'main.html') {
    assert(/var r = validateDeck\(data\)/.test(src) && /var checked = validateDeck\(data\)/.test(src),
      '主导入与追加导入均复用 validateDeck 的 ChunkShape 校验');
  } else {
    var n = (src.match(/ChunkShape\.chunkCountOk\(/g) || []).length;
    assert(n >= 2, f + ' 的 ' + n + ' 个独立作者入口均走 ChunkShape.chunkCountOk（应 ≥2）');
  }
});

/* ★ 匹配前必须剥注释：判据的**旧写法**会被写进注释做说明（本文件第 6 行就复述了
   `chunks.length >= 2`），不剥就会把「说明」当成「违规」——假阳性会让护栏失去可信度，
   最后被人整体关掉（比没有护栏更糟）。本项目既有做法：策略类断言前先剥注释。
   引号状态只为不让字符串里的 `//`（如 URL）被当成注释起点；字符串内容本身保留
   （写死在字符串里的段数比较仍算违规，宁可保守）。 */
function stripComments(src) {
  var out = '', i = 0, n = src.length, quote = null;
  while (i < n) {
    var c = src[i], d = src[i + 1];
    if (quote) {
      if (c === '\\') { out += c + (d || ''); i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && d === '*') { var e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; out += ' '; continue; }
    if (c === '/' && d === '/') { var f = src.indexOf('\n', i); i = f < 0 ? n : f; out += ' '; continue; }
    out += c; i++;
  }
  return out;
}

/* 白名单：这些文件里的段数比较是**已知豁免**，且都不是「判据的调用方」：
   - js/chunk-shape.js：判据的**唯一实现**，本来就该写段数比较
   - 本文件：判据自身的单测，负向自证的样例字面量（好样例 vs 坏样例）天然含这些写法
   ⚠️ decks.html / main.html **已移出白名单**（2026-09-16）：作者侧那 4 处硬编码已改为
      调用本判据 → 它们哪天退回 `chunks.length 2-5`，下面的散落检查会立刻报红。 */
var ALLOWED = ['js/chunk-shape.js', 'chunk-shape.test.js'];
var RE = /chunks\s*\.\s*length\s*[<>]=?\s*2|chunks\.length\s*[<>]=?\s*5/;

/* 负向自证：剥注释不许把护栏削钝 —— 真代码里的段数比较仍须被抓到，
   而同一句话只写在注释里则必须放行。两条缺一，剥注释就成了「关掉护栏」的借口。 */
assert(!RE.test(stripComments('/* 旧判据 chunks.length >= 2 一刀切 */')),
  '负向自证：只写在注释里的旧判据不算违规');
assert(RE.test(stripComments('if (it.chunks.length < 2) throw new Error("x");')),
  '负向自证：剥注释后仍能抓到真实代码里的段数比较（护栏未被削钝）');
assert(!RE.test(stripComments('var s = "a"; // chunks.length >= 5')),
  '负向自证：行尾注释里的段数比较被剥掉（避免把说明当违规）');
var tracked = [];
try {
  tracked = cp.execSync('git ls-files', { encoding: 'utf8', cwd: __dirname })
    .split(/\r?\n/).filter(function (f) { return /\.(js|mjs|html)$/.test(f); });
} catch (e) {
  tracked = [];
}
if (!tracked.length) {
  console.log('  ! SKIP：拿不到 git 文件清单（git 不可用？），散落检查未执行');
} else {
  var offenders = [];
  tracked.forEach(function (f) {
    if (ALLOWED.indexOf(f) >= 0) return;
    var src;
    try { src = fs.readFileSync(path.join(__dirname, f), 'utf8'); } catch (e) { return; }
    if (RE.test(stripComments(src))) offenders.push(f);
  });
  assert(offenders.length === 0,
    'git 跟踪的 ' + tracked.length + ' 个源文件中，除白名单外无硬编码段数比较' +
    (offenders.length ? '（违规：' + offenders.join(', ') + '）' : ''));
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
