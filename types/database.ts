export type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  is_admin: boolean;
  experience_points: number;
  created_at: string;
};

export type Prediction = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  stake: number;
  status: "open" | "closed" | "resolved";
  winning_option_id: string | null;
  closes_at: string | null;
  created_at: string;
};

export type PredictionOption = {
  id: string;
  prediction_id: string;
  name: string;
  odds: number;
  created_at: string;
};

export type PredictionAnswer = {
  id: string;
  prediction_id: string;
  option_id: string;
  user_id: string;
  stake: number | null;
  odds: number | null;
  settled: boolean;
  created_at: string;
};

export type PointTransaction = {
  id: number;
  user_id: string;
  amount: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};
