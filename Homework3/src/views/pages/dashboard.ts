import type { Conversation, Database, Job, User } from '../../types.js';
import { conversationList, jobGrid, sectionHeader, statCard } from '../components.js';
import { formatNumber } from '../../util/html.js';

export interface SeekerDashboardOptions {
  db: Database;
  user: User;
  applications: Conversation[];
  recommended: Job[];
  recommendedPromotedIds: Set<string>;
  unread: number;
  invited: number;
}

export function seekerDashboardPage(options: SeekerDashboardOptions): string {
  const { db, user, applications } = options;
  const latest = applications.slice(0, 5);

  return `<section class="card" style="background:linear-gradient(135deg,#ffffff,#eef8f6)">
    <h2>嗨，${user.name}</h2>
    <p class="muted" style="margin:0">這裡可以看到你的應徵進度與企業回覆。所有應徵都透過私訊進行，記得回來查看新訊息。</p>
  </section>

  <div class="grid cols-4" style="margin-bottom:18px">
    ${statCard('應徵職缺', formatNumber(applications.length), '累計送出')}
    ${statCard('邀請面談', formatNumber(options.invited), '企業已回覆', options.invited > 0 ? 'ok' : '')}
    ${statCard('未讀訊息', formatNumber(options.unread), '等你回覆', options.unread > 0 ? 'gold' : '')}
    ${statCard('個人資料', '已建立', '可隨時更新', 'ok')}
  </div>

  ${sectionHeader('我的應徵', '點進對話即可繼續與企業聯繫。', '/messages')}
  ${conversationList(db, latest, user)}

  ${sectionHeader('推薦給你的工作', '依最新刊登與付費曝光排序。', '/jobs')}
  ${jobGrid(db, options.recommended, options.recommendedPromotedIds)}
`;
}
