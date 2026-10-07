import { ReportIncidentScreen } from './ReportIncidentScreen';
import { MyReportDetailScreen, MyReportsScreen } from './ReportViews';
import { ReviewDetailScreen, ReviewHistoryScreen, ReviewQueueScreen } from './ReviewScreens';

/** UC02 Submit & Verify Hazard Report. */
export const reportScreens = {
  ReportIncident: ReportIncidentScreen,
  MyReports: MyReportsScreen,
  MyReportDetail: MyReportDetailScreen,
  ReviewQueue: ReviewQueueScreen,
  ReviewHistory: ReviewHistoryScreen,
  ReviewDetail: ReviewDetailScreen,
};
