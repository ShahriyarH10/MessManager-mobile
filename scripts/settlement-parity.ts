/**
 * Parity check for the ported settlement math. Pure Node — run with:
 *   node --experimental-strip-types scripts/settlement-parity.ts
 * (Node 23+ runs `node scripts/settlement-parity.ts` directly.)
 *
 * Builds a small synthetic mess and asserts calcMemberSettlement /
 * calcPrevDueForMember against values computed by hand from the documented
 * formula (README "Settlement Model").
 */
import { calcMemberSettlement, calcPrevDueForMember } from '../src/core/settlement';
import type { Member, MealRow, BazarRow, RentRecord, UtilityRecord } from '../src/core/types';

let failures = 0;
function eq(label: string, got: number, want: number) {
  const ok = Math.abs(got - want) < 0.005;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  got=${got} want=${want}`);
  if (!ok) failures++;
}

const members: Member[] = [
  { id: 'a', name: 'Ana', username: 'ana', role: 'member' },
  { id: 'b', name: 'Ben', username: 'ben', role: 'member' },
];

// Source month = 2025-06 (meals + bazar basis for the 2025-07 settlement)
const meals: MealRow[] = [
  { id: 'm1', date: '2025-06-01', meals: { Ana_day: 1, Ana_night: 1, Ben_day: 1, Ben_night: 0 } },
  { id: 'm2', date: '2025-06-02', meals: { Ana_day: 0, Ana_night: 1, Ben_day: 1, Ben_night: 1 } },
];
// Ana meals = 3, Ben meals = 3, total = 6
const bazar: BazarRow[] = [
  { id: 'z1', date: '2025-06-05', bazar: { Ana: 600 } },
  { id: 'z2', date: '2025-06-10', bazar: { Ben: 0 } },
];
// total bazar = 600, mealRate = 600 / 6 = 100

const rentJul: RentRecord = {
  id: 'r1',
  month_key: '2025-07',
  month: 6,
  year: 2025,
  entries: [
    { name: 'Ana', rent: 2000, paid: 2000, status: 'paid' },
    { name: 'Ben', rent: 2000, paid: 0, status: 'unpaid' },
  ],
};
const utilJul: UtilityRecord = {
  id: 'u1',
  month_key: '2025-07',
  month: 6,
  year: 2025,
  bills: { elec: 400, gas: 200, wifi: 200 }, // prepaid total 800 -> share 400
  payments: { Ana: { paid: 400, status: 'paid' } },
};
const utilJun: UtilityRecord = {
  id: 'u0',
  month_key: '2025-06',
  month: 5,
  year: 2025,
  bills: { khala: 1000, other: 200 }, // postpaid -> khala share 500, other share 100
  payments: {},
};

const ana = calcMemberSettlement(members[0], meals, bazar, rentJul, utilJul, utilJun, '2025-07', members);
const ben = calcMemberSettlement(members[1], meals, bazar, rentJul, utilJul, utilJun, '2025-07', members);

// Ana: mealCost 3*100=300, khala 500, other 100, rent 2000, util 400
//   gross = 3300; credits: bazar 600, rentPaid 2000, utilPaid 400 -> net = 300
eq('Ana mealRate', ana.mealRate, 100);
eq('Ana mealCost', ana.mealCost, 300);
eq('Ana khalaShare', ana.khalaShare, 500);
eq('Ana prepaidUtility', ana.prepaidUtility, 400);
eq('Ana netPayable', ana.netPayable, 300);

// Ben: mealCost 300, khala 500, other 100, rent 2000, util 400 = 3300
//   credits: bazar 0, rentPaid 0, utilPaid 0 -> net = 3300
eq('Ben netPayable', ben.netPayable, 3300);

// Prev due for August settlement: July net still unpaid (no prev_due_paid in Aug record)
const prevDueAna = calcPrevDueForMember(members[0], meals, bazar, [rentJul], [utilJul, utilJun], '2025-08', members);
eq('Ana prevDue (Aug)', prevDueAna, 300);

if (failures) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll settlement parity checks passed.');
