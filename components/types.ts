export type Option = { id: string; prediction_id: string; name: string; odds: number };

export type MyAnswer = {
  prediction_id: string;
  option_id: string;
  stake: number | null;
  odds: number | null;
};

export type Player = { id: string; label: string; balance: number };
