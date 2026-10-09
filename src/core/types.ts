/** Shared data shapes, matching the Supabase schema in database.sql. */

export type Member = {
  id: string;
  mess_id?: string;
  name: string;
  username: string;
  role: 'manager' | 'sub_manager' | 'member' | string;
  room?: string;
  rent?: number;
  phone?: string;
  joined?: string | null;
  created_at?: string;
  meal_default_day?: number;
  meal_default_night?: number;
};

/** meals JSONB: { "Name_day": 1, "Name_night": 1 } or legacy { "Name": 2 } */
export type MealRow = {
  id: string;
  date: string;
  meals: Record<string, number>;
};

/** bazar JSONB: { "Name": 250 } */
export type BazarRow = {
  id: string;
  date: string;
  bazar: Record<string, number>;
  utility?: Record<string, number>;
};

export type RentEntry = {
  name: string;
  rent?: number;
  paid?: number;
  status?: 'paid' | 'partial' | 'unpaid' | string;
  notes?: string;
};

export type RentRecord = {
  id: string;
  month_key: string;
  month: number;
  year: number;
  month_name?: string;
  entries: RentEntry[];
};

export type UtilityPayment = {
  paid?: number;
  status?: 'paid' | 'partial' | 'unpaid' | string;
  meal_paid?: number;
  credit_paid?: number;
  prev_due_paid?: number;
  notes?: string;
};

export type UtilityRecord = {
  id: string;
  month_key: string;
  month: number;
  year: number;
  month_name?: string;
  bills: Record<string, unknown>;
  payments: Record<string, UtilityPayment>;
};

export type MemberPaymentStatus = 'pending' | 'confirmed' | 'rejected';

/** A member's "Give Payment" request, confirmed or rejected by a manager. */
export type MemberPayment = {
  id: string;
  receipt_no: number;
  member_id: string;
  member_name: string;
  month_key: string;
  month: number;
  year: number;
  amount: number;
  due_at_submit: number | null;
  status: MemberPaymentStatus;
  split: {
    allocPrevDue: number;
    allocRent: number;
    allocUtil: number;
    allocMeal: number;
    change: number;
  } | null;
  still_due: number | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
};
