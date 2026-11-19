export interface Dimension {
  name: string;
  score: number;
  comment: string;
}

export interface ParagraphNote {
  excerpt: string;
  comment: string;
  suggestion: string;
}

export interface GradingResult {
  overall_score: string;
  dimensions: Dimension[];
  paragraph_notes: ParagraphNote[];
  summary: string;
}

export interface GradingRecord {
  id: string;
  created_at: string;
  subject: string;
  question: string;
  answer: string;
  reference_material: string | null;
  model: string | null;
  overall_score: string | null;
  dimensions: Dimension[] | null;
  paragraph_notes: ParagraphNote[] | null;
  summary: string | null;
}
