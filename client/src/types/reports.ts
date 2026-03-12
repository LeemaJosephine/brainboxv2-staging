export interface ReportQuizListItem {
  _id: string;
  name: string;
  timesHosted: number;
  totalPlayersParticipated: number;
  sendReportEnabled: boolean;
  createdAt?: string;
  lastPlayedAt?: string | null;
  lastParticipantCount?: number | null;
}

export interface ReportDayPoint {
  date: string; // YYYY-MM-DD
  plays: number;
  participants: number;
  avgScore: number;
}

export interface ReportPlayPoint {
  finishedAt: string;
  avgScore: number;
  participantCount: number;
}

export interface ReportParticipant {
  name: string;
  email?: string;
  score: number;
  total: number;
}

export interface ReportPlayRow {
  _id: string;
  gameCode: string;
  startedAt: string;
  finishedAt: string;
  participantCount: number;
  avgScore: number;
  sendReportEnabled: boolean;
  participants: ReportParticipant[];
}

export interface QuizReportResponse {
  quiz: {
    _id: string;
    name: string;
    timesHosted: number;
    totalPlayersParticipated: number;
    sendReportEnabled: boolean;
    createdAt?: string;
  };
  last7Days: ReportDayPoint[];
  last7Plays: ReportPlayPoint[];
  plays: ReportPlayRow[];
}

