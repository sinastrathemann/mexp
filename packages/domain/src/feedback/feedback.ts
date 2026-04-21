export interface EventFeedback {
  id: string;
  eventId: string;
  userId: string | null;
  ratingOverall: number;
  ratingContent: number | null;
  ratingOrganization: number | null;
  comment: string | null;
  submittedAt: Date;
}

export interface EventFeedbackCreateInput {
  eventId: string;
  userId: string | null;
  ratingOverall: number;
  ratingContent: number | null;
  ratingOrganization: number | null;
  comment: string | null;
}

export interface EventFeedbackStats {
  count: number;
  averageOverall: number | null;
  averageContent: number | null;
  averageOrganization: number | null;
}
