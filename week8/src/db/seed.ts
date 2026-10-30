import { hashPassword } from '../core/password.js';
import type {
  Bookmark,
  Chapter,
  Comment,
  Database,
  Earning,
  Promotion,
  Tip,
  User,
  Withdrawal,
  Work,
} from '../types.js';

/** 所有示範帳號的預設密碼。 */
export const DEMO_PASSWORD = 'ink1234';

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY).toISOString();
}

function user(
  id: string,
  username: string,
  name: string,
  role: User['role'],
  plan: User['plan'],
  avatar: string,
  bio: string,
  planSince: string | null,
  createdAt: string,
): User {
  return {
    id,
    username,
    name,
    role,
    plan,
    email: `${username}@inkflow.example`,
    bio,
    avatar,
    planSince,
    createdAt,
    active: true,
    ...hashPassword(DEMO_PASSWORD),
  };
}

interface WorkSeed {
  id: string;
  creatorId: string;
  title: string;
  synopsis: string;
  type: Work['type'];
  tags: string[];
  cover: string;
  status: Work['status'];
  published: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  views: number;
}

function work(seed: WorkSeed): Work {
  return { ...seed };
}

interface ChapterSeed {
  id: string;
  workId: string;
  title: string;
  content: string;
  imageUrls?: string[];
  order: number;
  views: number;
  createdAt: string;
  updatedAt: string;
}

function chapter(seed: ChapterSeed): Chapter {
  return { ...seed, imageUrls: seed.imageUrls ?? [] };
}

function tip(
  id: string,
  workId: string,
  creatorId: string,
  fromUserId: string,
  amount: number,
  message: string,
  createdAt: string,
): Tip {
  const creatorShare = Math.round(amount * 90) / 100;
  return {
    id,
    workId,
    creatorId,
    fromUserId,
    amount,
    message,
    creatorShare,
    platformShare: Math.round((amount - creatorShare) * 100) / 100,
    createdAt,
  };
}

function earning(
  id: string,
  creatorId: string,
  workId: string | null,
  kind: Earning['kind'],
  amount: number,
  note: string,
  createdAt: string,
): Earning {
  return { id, creatorId, workId, kind, amount, note, createdAt };
}

function promotion(
  id: string,
  workId: string,
  creatorId: string,
  source: Promotion['source'],
  startedAt: string,
  expiresAt: string,
  impressions: number,
  clicks: number,
): Promotion {
  return { id, workId, creatorId, source, startedAt, expiresAt, impressions, clicks };
}

/**
 * 建立示範資料。
 *
 * 刻意安排了三種情境，方便第一次開啟就看到平台全貌：
 * - `aurora` 與 `quill` 是付費帳號，作品有收益、推流與提領紀錄。
 * - `inkcat` 是免費帳號，可投稿但不能收打賞，也不能取得閱讀收益。
 * - `aurora` 有一部未公開草稿，只有作者與管理員看得到。
 */
export function createSeedDatabase(): Database {
  const users: User[] = [
    user('u_admin', 'admin', '林墨', 'admin', 'pro', '🗂', '平台管理員，負責精選作品與撥款審核。', daysAgo(400), daysAgo(400)),
    user(
      'u_aurora',
      'aurora',
      '蘇晚晴',
      'member',
      'pro',
      '🌙',
      '寫都市奇幻與長篇小說。相信故事是城市裡最後一盞燈。',
      daysAgo(180),
      daysAgo(300),
    ),
    user(
      'u_quill',
      'quill',
      '沈墨言',
      'member',
      'pro',
      '🖋',
      '喜歡提燈、舊車站與所有還沒說完的告別。',
      daysAgo(120),
      daysAgo(260),
    ),
    user('u_inkcat', 'inkcat', '林小墨', 'member', 'free', '🐈', '新手漫畫家，用四格記錄生活裡的小事。', null, daysAgo(90)),
    user('u_reader', 'reader', '陳書宇', 'member', 'free', '🫧', '讀者。什麼都看，最愛深夜連載。', null, daysAgo(150)),
    user('u_novice', 'novice', '張雨青', 'member', 'free', '☔', '第一次投稿，請多多指教。', null, daysAgo(20)),
  ];

  const works: Work[] = [
    work({
      id: 'w_inkcity',
      creatorId: 'u_aurora',
      title: '墨城夜行',
      synopsis:
        '每逢下雨的深夜，墨城會多出一條地圖上不存在的街。偵探顧行舟為了尋找失蹤的妹妹，開始記錄那些只有雨夜才會出現的門牌。',
      type: 'novel',
      tags: ['都市奇幻', '懸疑', '連載'],
      cover: '🌃',
      status: 'serializing',
      published: true,
      featured: true,
      createdAt: daysAgo(64),
      updatedAt: daysAgo(2),
      views: 15200,
    }),
    work({
      id: 'w_stars',
      creatorId: 'u_aurora',
      title: '把星星寄給你',
      synopsis:
        '在天文館工作的女孩，每晚替無法出門的男孩錄一段星空。她不知道的是，男孩其實一直在數她錄音裡有多少次嘆息。',
      type: 'novel',
      tags: ['愛情', '療癒', '完結'],
      cover: '✨',
      status: 'completed',
      published: true,
      featured: false,
      createdAt: daysAgo(210),
      updatedAt: daysAgo(42),
      views: 9800,
    }),
    work({
      id: 'w_catcomic',
      creatorId: 'u_inkcat',
      title: '貓咪食堂的營業日誌',
      synopsis: '一隻橘貓在巷口開了食堂，專治人類的壞心情。今日特餐：味噌湯加一顆半熟蛋。',
      type: 'comic',
      tags: ['日常', '美食', '搞笑'],
      cover: '🍜',
      status: 'serializing',
      published: true,
      featured: false,
      createdAt: daysAgo(34),
      updatedAt: daysAgo(1),
      views: 5400,
    }),
    work({
      id: 'w_lantern',
      creatorId: 'u_quill',
      title: '提燈者',
      synopsis:
        '王國邊境有一群人，專門在霧裡替迷路的靈魂提燈。見習提燈者阿澈接到的第一盞燈，卻照出了自己的名字。',
      type: 'novel',
      tags: ['奇幻', '冒險', '連載'],
      cover: '🏮',
      status: 'serializing',
      published: true,
      featured: true,
      createdAt: daysAgo(96),
      updatedAt: daysAgo(3),
      views: 12800,
    }),
    work({
      id: 'w_summer',
      creatorId: 'u_quill',
      title: '無人車站的夏天',
      synopsis: '沿海支線的最後一站沒有站長。三個高中生在廢棄候車室裡，度過了一個漫長得不像話的夏天。',
      type: 'novel',
      tags: ['青春', '成長', '完結'],
      cover: '🚉',
      status: 'completed',
      published: true,
      featured: false,
      createdAt: daysAgo(320),
      updatedAt: daysAgo(80),
      views: 7600,
    }),
    work({
      id: 'w_robot',
      creatorId: 'u_inkcat',
      title: '充電五分鐘',
      synopsis: '家事機器人只充電五分鐘就能運作一整天，但它把剩下的二十三小時五十五分鐘都拿來想一件事：人類為什麼需要睡覺？',
      type: 'comic',
      tags: ['科幻', '搞笑', '連載'],
      cover: '🤖',
      status: 'serializing',
      published: true,
      featured: false,
      createdAt: daysAgo(13),
      updatedAt: daysAgo(2),
      views: 2100,
    }),
    work({
      id: 'w_tear',
      creatorId: 'u_novice',
      title: '雨落之時',
      synopsis: '每當這座城市下雨，少年就能看見別人的回憶。直到某天，他在雨裡看見了自己的葬禮。',
      type: 'novel',
      tags: ['奇幻', '懸疑', '新星'],
      cover: '☔',
      status: 'serializing',
      published: true,
      featured: false,
      createdAt: daysAgo(6),
      updatedAt: daysAgo(1),
      views: 430,
    }),
    work({
      id: 'w_draft',
      creatorId: 'u_aurora',
      title: '（草稿）潮汐圖書館',
      synopsis: '尚未公開的新作，講述一間只在退潮時出現的圖書館。',
      type: 'novel',
      tags: ['奇幻'],
      cover: '📚',
      status: 'serializing',
      published: false,
      featured: false,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
      views: 0,
    }),
  ];

  const chapters: Chapter[] = [
    chapter({
      id: 'ch_inkcity_1',
      workId: 'w_inkcity',
      title: '第一章：雨夜的第十三號門牌',
      order: 1,
      views: 6100,
      createdAt: daysAgo(64),
      updatedAt: daysAgo(64),
      content: `墨城的雨有一種奇怪的脾氣，總是在凌晨兩點停下來，像有人準時關掉了天空的水龍頭。

顧行舟站在便利商店的騎樓下，把菸按熄在鐵罐裡。他已經連續第四十三個夜晚沿著同一條街走，卻始終找不到那家妹妹失蹤前最後出現的雜貨店。

今晚不一樣。

雨停之後，柏油路上浮出一層薄薄的光，像是有人把月亮揉碎了灑在地上。他低頭看，水窪裡倒映的不是自己的臉，而是一扇陌生的木門。

門牌寫著：青雨街十三號。

他確定這條街只有十二戶。顧行舟伸手碰了碰水窪，指尖卻傳來木頭的觸感。下一秒，整條街的門牌同時翻了過來，十二號、十一號、十號……數字一路倒退，最後停在他腳邊。

他吞了吞口水，推開門。

門後沒有房間，只有一條更長的街，和一個撐著紅傘、背對著他的小女孩。

「哥，」她沒有回頭，「你終於來了。」`,
    }),
    chapter({
      id: 'ch_inkcity_2',
      workId: 'w_inkcity',
      title: '第二章：不存在的住戶名冊',
      order: 2,
      views: 5400,
      createdAt: daysAgo(40),
      updatedAt: daysAgo(40),
      content: `青雨街的每一戶都亮著燈，卻沒有一戶傳出聲音。

顧行舟跟著紅傘往前走。小女孩的步伐很輕，鞋跟踩在積水上，居然沒有濺起一滴水花。他想問她叫什麼名字，喉嚨卻像被什麼東西堵住。

「這裡的人都很安靜，」她說，「因為他們在等一個不會回來的人。」

街尾有一間管理室。桌上攤著一本住戶名冊，紙張泛黃，邊角被雨水泡得發皺。他翻開第一頁，看見自己的名字。

顧行舟，十三號，入住日期：二〇一四年六月七日。

那是妹妹失蹤的那一天。

他猛地往後翻，每一頁都是同一筆資料，只是入住日期不斷往前推移。最後一頁的墨跡還沒乾，寫著：顧行舟，遷出日期：今晚。

「別看了，」小女孩終於轉過身。她的臉和他記憶裡一模一樣，只是眼睛裡沒有光。「你再不走，就換你留在這裡等我了。」`,
    }),
    chapter({
      id: 'ch_inkcity_3',
      workId: 'w_inkcity',
      title: '第三章：天亮之前的訪客',
      order: 3,
      views: 3700,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
      content: `顧行舟把名冊塞進外套，拉著小女孩往來時的方向跑。

青雨街開始下雨，而且是從地面往天上下的雨。水珠離開柏油路，一顆一顆升向天空，打在路燈上發出細碎的聲響。

「你帶不走我的。」小女孩說。

「那就一起留下。」他回。

他們跑到街口時，那扇木門已經不見了，取而代之的是一面鏡子。鏡子裡站著一個穿風衣的男人，和他長得一模一樣，只是眼角多了幾道皺紋。

男人開口，聲音像從很深的水底傳來：「你確定，你要帶走的是她嗎？」

顧行舟低頭，發現自己握著的手不知道什麼時候變成了一把紅傘。小女孩站在鏡子另一側，朝他揮手。

天快亮了。

他深吸一口氣，把傘撐開，走進鏡子裡。`,
    }),
    chapter({
      id: 'ch_stars_1',
      workId: 'w_stars',
      title: '第一夜：夏季大三角',
      order: 1,
      views: 5000,
      createdAt: daysAgo(210),
      updatedAt: daysAgo(210),
      content: `「今晚的織女星很亮，」她把錄音筆放在天文館的圓頂下，「如果你抬頭，會看到三顆星連成一個很大的三角形。」

錄音筆的紅燈一閃一閃。她想像電話另一頭的他，正躺在病床上，把窗簾拉開一條縫。

「小時候我以為星星是釘子，」他曾經這樣說，「把天空釘住，才不會掉下來。」

她笑著把這段話也錄進去。回家的路上，她買了一瓶牛奶，經過醫院時沒有上樓。她知道他不想讓她看見自己插管的樣子。

那天晚上，她把錄音檔命名為「第一夜」，然後在備註欄寫：希望有一天，我們能一起看星星。`,
    }),
    chapter({
      id: 'ch_stars_2',
      workId: 'w_stars',
      title: '最後一夜：流星雨',
      order: 2,
      views: 4800,
      createdAt: daysAgo(42),
      updatedAt: daysAgo(42),
      content: `他走的那天，新聞說有流星雨。

她照常去了天文館，照常打開錄音筆，卻一個字也說不出來。圓頂的投影把整片夜空鋪在她頭上，星星一顆一顆亮起，又一顆一顆熄滅。

「今天我沒有故事可以說，」她終於開口，聲音有點啞，「但是我想告訴你，我很好。」

錄音筆的紅燈閃了很久。

隔天，她在他的遺物裡找到一支舊手機。相簿裡全是天空的照片，每一張都標了日期，最早的一張是十年前。最後一張的備註寫著：

「今天她說，織女星很亮。其實我看不見星星，但我聽得見她笑。」

她把臉埋進掌心，哭得像那場沒有停過的流星雨。`,
    }),
    chapter({
      id: 'ch_catcomic_1',
      workId: 'w_catcomic',
      title: '第 1 話：今日特餐是勇氣',
      order: 1,
      views: 3000,
      createdAt: daysAgo(34),
      updatedAt: daysAgo(34),
      content: `（分鏡示意）

第一格：巷口的紅燈籠亮起，橘貓老闆把「營業中」的木牌翻面。
旁白：這條巷子裡的人，都有一道說不出口的傷口。

第二格：剛被裁員的上班族推門進來，領帶歪一邊。
上班族：老闆，有沒有那種……吃了就會變勇敢的飯？

第三格：橘貓甩了甩尾巴，把一碗熱騰騰的味噌湯推到他面前。
橘貓：沒有那種飯。但吃飽之後，通常會比較敢哭。

第四格：上班族低頭喝湯，眼淚掉進碗裡。橘貓假裝沒看見，轉身去舔自己的爪子。`,
    }),
    chapter({
      id: 'ch_catcomic_2',
      workId: 'w_catcomic',
      title: '第 2 話：半熟蛋與離職信',
      order: 2,
      views: 2400,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      content: `（分鏡示意）

第一格：上班族坐在同一個位置，桌上多了一封牛皮紙袋。
旁白：他連續來了七天，每次都點一樣的味噌湯。

第二格：橘貓跳上桌，用肉球壓住那封信。
橘貓：這是什麼？

第三格：上班族苦笑。
上班族：離職信。我決定去開一間很小的店。

第四格：橘貓把半熟蛋撥到他碗裡，尾巴慢慢晃。
橘貓：那你要記得，湯不要煮太鹹。`,
    }),
    chapter({
      id: 'ch_lantern_1',
      workId: 'w_lantern',
      title: '第一章：霧裡的燈',
      order: 1,
      views: 4600,
      createdAt: daysAgo(96),
      updatedAt: daysAgo(96),
      content: `王國北境的霧，一年有十個月不會散。

阿澈跟著師傅走了三天，才看見第一盞燈。那是一盞很舊的提燈，玻璃罩上有裂痕，火光卻穩得像一顆心臟。

「提燈者不照路，」師傅說，「我們照的是還沒放下的人。」

霧裡站著一個老婦人，手裡抱著一件小孩的棉襖。她已經死了，卻不知道自己死了。阿澈的任務很簡單：把燈提到她面前，讓她順著光離開。

他照做了。老婦人低頭看了看燈，又看了看棉襖，忽然笑了。

「原來他在那裡等我。」她說。

光熄滅的時候，霧散了一小塊。阿澈第一次看見北境的天空，藍得讓人想哭。

師傅拍拍他的肩：「別急著哭。你的第一盞燈，還在後面。」`,
    }),
    chapter({
      id: 'ch_lantern_2',
      workId: 'w_lantern',
      title: '第二章：自己的名字',
      order: 2,
      views: 4300,
      createdAt: daysAgo(60),
      updatedAt: daysAgo(60),
      content: `見習的第七天，阿澈在霧裡遇見一個提著燈的少年。

少年背對著他，燈光把霧照出一圈溫暖的橘色。阿澈走近，才發現那盞燈的玻璃罩上刻著自己的名字。

「你是誰？」他問。

少年轉過頭。阿澈看見一張和自己一模一樣的臉，只是那張臉蒼白得不像活人。

「我是你沒有走完的那條路。」少年說。

阿澈想起師傅交代過的話：提燈者最怕遇見自己。因為每個人都有一條沒有選的路，而那條路會在霧裡等你很久很久。

他握緊燈柄，火光晃了一下。

「讓開。」他說。

少年笑了，側身讓出一條窄窄的縫。阿澈走過去的時候，聽見背後傳來輕輕的一句：

「總有一天，你會回來找我。」`,
    }),
    chapter({
      id: 'ch_lantern_3',
      workId: 'w_lantern',
      title: '第三章：不滅的火',
      order: 3,
      views: 3900,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
      content: `北境的霧開始退。

這是三十年來第一次。村民們走出家門，抬頭看見久違的太陽，有人跪下來哭，有人只是站在原地發呆。

阿澈站在邊境的石塔上，手裡的燈已經燒到最後一滴油。

師傅臨走前告訴他，提燈者的火，其實是自己的壽命。每帶走一個靈魂，火就短一截。他算了算，自己大概還能提七年。

七年，夠他走遍北境每一條霧裡的街。

他把燈舉高，讓最後一點火光落在遠方的山脈上。那裡有一盞新的燈正在亮起，很遠，很小，但沒有熄。

「下一個，」他對著霧說，「換我了。」`,
    }),
    chapter({
      id: 'ch_summer_1',
      workId: 'w_summer',
      title: '第一章：沒有站長的車站',
      order: 1,
      views: 3900,
      createdAt: daysAgo(320),
      updatedAt: daysAgo(320),
      content: `沿海支線一天只有四班車，最後一班在傍晚六點零七分。

林澄第一次走進那座車站時，候車室的玻璃窗破了一角，風從缺口灌進來，把時刻表吹得啪啪作響。月台上沒有人，連售票機都被拆走了，只剩一個鏽掉的投幣孔。

「所以我們要從這裡出發？」阿凱把腳踏車靠在牆邊。

「不是出發，」林澄說，「是等。」

他們三個人——林澄、阿凱、還有一整個暑假都不說話的許願——在候車室的長椅上坐了下來。他們沒有要去哪裡，只是不想待在家裡。

六點零七分，車沒有來。

六點零八分，車站廣播忽然響了。一個很舊的女聲說：「本班列車因故停駛，請旅客於候車室等候，下一班車將在夏天結束時抵達。」`,
    }),
    chapter({
      id: 'ch_summer_2',
      workId: 'w_summer',
      title: '第二章：夏天結束時',
      order: 2,
      views: 3700,
      createdAt: daysAgo(80),
      updatedAt: daysAgo(80),
      content: `暑假最後一天，他們又回到那座車站。

許願帶了一台拍立得，阿凱帶了三瓶彈珠汽水，林澄什麼都沒帶，只帶了一張寫好卻沒寄出去的信。

「如果車真的來了，你們要上去嗎？」阿凱問。

沒有人回答。

六點零七分，遠方傳來鐵軌震動的聲音。一道白色的車頭燈切開暮色，慢慢駛進月台。車門打開，裡面空無一人。

許願第一個站起來。她走到車門口，回頭看了他們一眼，然後笑了——那是整個夏天她第一次笑。

「我先走了，」她說，「你們要記得寫信。」

車門關上。列車駛向海的方向，把月台留在原地。

林澄把信放在長椅上。信封上寫著：給明年夏天的我們。`,
    }),
    chapter({
      id: 'ch_robot_1',
      workId: 'w_robot',
      title: '第 1 話：二十三小時五十五分鐘',
      order: 1,
      views: 2100,
      createdAt: daysAgo(13),
      updatedAt: daysAgo(13),
      content: `（分鏡示意）

第一格：插頭拔掉，機器人睜開眼。電量顯示 100%。
旁白：家事機器人 T-5，每天只需要充電五分鐘。

第二格：T-5 拖地、洗碗、曬衣服，動作飛快。牆上時鐘走了五分鐘。
T-5：工作完成。剩餘時間：二十三小時五十五分鐘。

第三格：T-5 坐在沙發邊，看著主人睡覺。
T-5：為什麼人類需要花八小時關機？

第四格：T-5 拿出一本筆記本，寫下第一行字。
旁白：於是，它開始研究一個對它來說最難的問題——夢。`,
    }),
    chapter({
      id: 'ch_tear_1',
      workId: 'w_tear',
      title: '第一章：別人的雨',
      order: 1,
      views: 430,
      createdAt: daysAgo(6),
      updatedAt: daysAgo(6),
      content: `第一次看見別人的回憶，是在便利商店的門口。

那天雨下得很大，一個穿西裝的男人沒帶傘，站在屋簷下抽菸。少年只是不小心看了他一眼，眼前就閃過一段畫面：男人蹲在醫院走廊，手裡捏著一張超音波照片，照片上什麼也沒有。

畫面只持續了半秒。少年回過神，男人已經走進雨裡。

他沒有告訴任何人。從那天起，他開始害怕下雨，因為每一滴雨都像一個人的抽屜，只要碰到，就會有東西掉出來。

直到那天放學，他看見自己站在馬路對面，撐著一把黑傘，朝他揮手。

而那個「自己」，臉上沒有五官。`,
    }),
    chapter({
      id: 'ch_draft_1',
      workId: 'w_draft',
      title: '第一章：退潮',
      order: 1,
      views: 0,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
      content: '（草稿）圖書館在退潮時出現，在漲潮前消失。管理員說，每一本被借走的書，都會變成一段沒人記得的記憶。',
    }),
  ];

  const tips: Tip[] = [
    tip('tip_001', 'w_inkcity', 'u_aurora', 'u_reader', 100, '雨夜的描寫太有畫面了，謝謝你寫這個故事。', daysAgo(4)),
    tip('tip_002', 'w_lantern', 'u_quill', 'u_reader', 300, '提燈者的設定很迷人，期待下一章！', daysAgo(3)),
    tip('tip_003', 'w_stars', 'u_aurora', 'u_novice', 50, '看完最後一夜哭了好久。', daysAgo(20)),
  ];

  const earnings: Earning[] = [
    earning('earn_001', 'u_aurora', 'w_inkcity', 'view', 190, '章節閱讀收益（系統種子彙總）', daysAgo(7)),
    earning('earn_002', 'u_aurora', 'w_stars', 'view', 86, '章節閱讀收益（系統種子彙總）', daysAgo(7)),
    earning('earn_003', 'u_aurora', 'w_inkcity', 'tip', 90, '讀者打賞分潤 90%', daysAgo(4)),
    earning('earn_004', 'u_aurora', 'w_stars', 'tip', 45, '讀者打賞分潤 90%', daysAgo(20)),
    earning('earn_005', 'u_quill', 'w_lantern', 'view', 204, '章節閱讀收益（系統種子彙總）', daysAgo(7)),
    earning('earn_006', 'u_quill', 'w_summer', 'view', 74.5, '章節閱讀收益（系統種子彙總）', daysAgo(7)),
    earning('earn_007', 'u_quill', 'w_lantern', 'tip', 270, '讀者打賞分潤 90%', daysAgo(3)),
  ];

  const withdrawals: Withdrawal[] = [
    {
      id: 'wd_001',
      creatorId: 'u_aurora',
      amount: 300,
      status: 'pending',
      requestedAt: daysAgo(5),
      processedAt: null,
      note: '希望月底前撥款',
    },
    {
      id: 'wd_002',
      creatorId: 'u_quill',
      amount: 200,
      status: 'paid',
      requestedAt: daysAgo(24),
      processedAt: daysAgo(22),
      note: '',
    },
  ];

  const promotions: Promotion[] = [
    promotion('pr_001', 'w_inkcity', 'u_aurora', 'plan', daysAgo(2), daysFromNow(5), 4820, 613),
    promotion('pr_002', 'w_lantern', 'u_quill', 'admin', daysAgo(1), daysFromNow(6), 3160, 402),
    promotion('pr_003', 'w_stars', 'u_aurora', 'plan', daysAgo(30), daysAgo(23), 12000, 900),
  ];

  const comments: Comment[] = [
    {
      id: 'cm_001',
      workId: 'w_inkcity',
      userId: 'u_reader',
      body: '第一章的雨夜描寫太有畫面了，看到「水珠從地面往天上」那段整個起雞皮疙瘩。',
      createdAt: daysAgo(2),
    },
    {
      id: 'cm_002',
      workId: 'w_inkcity',
      userId: 'u_novice',
      body: '追到第三章，請問會日更嗎？好想知道妹妹到底怎麼了。',
      createdAt: daysAgo(1),
    },
    {
      id: 'cm_003',
      workId: 'w_lantern',
      userId: 'u_aurora',
      body: '提燈照的是還沒放下的人——這句好美。',
      createdAt: daysAgo(3),
    },
    {
      id: 'cm_004',
      workId: 'w_catcomic',
      userId: 'u_reader',
      body: '貓咪主廚太可愛了，已收藏。味噌湯看起來很好喝。',
      createdAt: daysAgo(1),
    },
  ];

  const bookmarks: Bookmark[] = [
    { userId: 'u_reader', workId: 'w_inkcity', createdAt: daysAgo(3) },
    { userId: 'u_reader', workId: 'w_lantern', createdAt: daysAgo(2) },
    { userId: 'u_novice', workId: 'w_inkcity', createdAt: daysAgo(2) },
    { userId: 'u_aurora', workId: 'w_summer', createdAt: daysAgo(10) },
    { userId: 'u_inkcat', workId: 'w_inkcity', createdAt: daysAgo(1) },
  ];

  return { users, works, chapters, comments, bookmarks, tips, earnings, withdrawals, promotions };
}

/** 登入頁提示用的示範帳號。 */
export function demoAccounts(): { username: string; role: string }[] {
  return [
    { username: 'aurora', role: '付費創作者 蘇晚晴' },
    { username: 'inkcat', role: '免費創作者 林小墨' },
    { username: 'reader', role: '讀者 陳書宇' },
    { username: 'admin', role: '平台管理員 林墨' },
  ];
}
