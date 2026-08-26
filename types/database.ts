export type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  experience_points: number;
  created_at: string;
};

export type Prediction = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  status: "open" | "closed" | "resolved";
  winning_option_id: string | null;
  closes_at: string | null;
  created_at: string;
};

export type PredictionOption = {
  id: string;
  prediction_id: string;
  name: string;
  created_at: string;
};

export type PredictionAnswer = {
  id: string;
  prediction_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
};
