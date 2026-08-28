/**
 * Loads the full working set for a mess (members + meals + bazar + rent +
 * utility) in one shot, with pull-to-refresh support. Screens that need
 * settlement math (profile, monthly log) build on this.
 */
import { useCallback, useEffect, useState } from 'react';
import { dbGetMembers, dbGetMeals, dbGetBazar, dbGetRent, dbGetUtility } from '../lib/db';
import type { Member, MealRow, BazarRow, RentRecord, UtilityRecord } from '../core/types';

export type MessData = {
  members: Member[];
  meals: MealRow[];
  bazar: BazarRow[];
  rent: RentRecord[];
  utility: UtilityRecord[];
};

export function useMessData() {
  const [data, setData] = useState<MessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [members, meals, bazar, rent, utility] = await Promise.all([
        dbGetMembers(),
        dbGetMeals(),
        dbGetBazar(),
        dbGetRent(),
        dbGetUtility(),
      ]);
      setData({ members, meals, bazar, rent, utility });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  return { data, loading, error, refresh };
}
