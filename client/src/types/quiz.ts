export interface QuizQuestion {
  questionText: string;
  imageUrl?: string;
  options: string[];
  correctAnswerIndex: number;
}

export interface QuizCategory {
  _id: string;
  name: string;
}

export interface Quiz {
  _id: string;
  name: string;
  category?: QuizCategory | null;
  durationPerQuestion: number;
  sendReportEnabled?: boolean;
  questions: QuizQuestion[];
  createdBy: string;
  timesHosted?: number;
  totalPlayersParticipated?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateQuizRequest {
  name: string;
  category?: string | null;
  durationPerQuestion?: number;
  sendReportEnabled?: boolean;
  questions: QuizQuestion[];
}

export interface UpdateQuizRequest extends CreateQuizRequest {
  _id: string;
}
