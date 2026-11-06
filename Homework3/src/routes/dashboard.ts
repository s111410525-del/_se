import type { Router } from '../core/router.js';
import { filterJobs, publishedJobs } from '../services/jobs.js';
import { applicationsOfSeeker, totalUnread } from '../services/messaging.js';
import { activePromotionMap } from '../services/promotion.js';
import { seekerDashboardPage } from '../views/pages/dashboard.js';
import { page } from './shared.js';

export function registerDashboard(router: Router): void {
  router.get('/dashboard', (ctx) => {
    const user = ctx.requireUser();
    const db = ctx.services.store.data;
    const applications = applicationsOfSeeker(db, user.id);
    const appliedJobIds = new Set(applications.map((conversation) => conversation.jobId));
    const candidates = publishedJobs(db).filter((job) => !appliedJobIds.has(job.id));
    const recommended = filterJobs(
      db,
      candidates,
      {
        q: '',
        category: '',
        employmentType: '',
        location: '',
        salaryMin: 0,
        sort: 'recommend',
      },
    ).slice(0, 3);
    const promotedIds = activePromotionMap(db, recommended.map((job) => job.id));

    page(
      ctx,
      '我的儀表板',
      seekerDashboardPage({
        db,
        user,
        applications,
        recommended,
        recommendedPromotedIds: new Set(promotedIds.keys()),
        unread: totalUnread(db, user),
        invited: applications.filter((conversation) => conversation.status === 'invited').length,
      }),
      '追蹤應徵進度與企業回覆。',
    );
  }, ['seeker']);
}
