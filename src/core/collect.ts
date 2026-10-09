/**
 * Collect Payment — waterfall allocation + receipt text.
 * Ported from computeSplit3 / buildReceiptText in js/manager/collect.js.
 *
 * A cash payment is applied in this fixed order:
 *   1. Previous-month due   2. Rent   3. Utility   4. Meal balance
 * Anything left over is "change".
 */
import { round2, fmtTk } from './format';

export type Split = {
  allocPrevDue: number;
  allocRent: number;
  allocUtil: number;
  allocMeal: number;
  change: number;
};

export function computeSplit(
  amount: number,
  mealRem: number,
  utilRem: number,
  rentRem: number,
  prevDue = 0,
): Split {
  amount = Math.max(0, round2(amount || 0));
  const m = Math.max(0, round2(mealRem || 0));
  const u = Math.max(0, round2(utilRem || 0));
  const r = Math.max(0, round2(rentRem || 0));
  const pd = Math.max(0, round2(prevDue || 0));
  const totalRem = round2(m + u + r + pd);

  if (amount <= 0) return { allocMeal: 0, allocUtil: 0, allocRent: 0, allocPrevDue: 0, change: 0 };
  if (totalRem <= 0)
    return { allocMeal: 0, allocUtil: 0, allocRent: 0, allocPrevDue: 0, change: amount };
  if (amount >= totalRem)
    return { allocMeal: m, allocUtil: u, allocRent: r, allocPrevDue: pd, change: round2(amount - totalRem) };

  let rem = amount;
  const allocPrevDue = round2(Math.min(rem, pd));
  rem = round2(rem - allocPrevDue);
  const allocRent = round2(Math.min(rem, r));
  rem = round2(rem - allocRent);
  const allocUtil = round2(Math.min(rem, u));
  rem = round2(rem - allocUtil);
  const allocMeal = round2(Math.min(rem, m));
  return { allocMeal, allocUtil, allocRent, allocPrevDue, change: 0 };
}

export type ReceiptData = {
  messName: string;
  memberName: string;
  monthLabel: string;
  timestamp: Date;
  amountReceived: number;
  newNet: number;
} & Split;

export function buildReceiptText(d: ReceiptData): string {
  const dt = d.timestamp.toLocaleString();
  const lines: string[] = [];
  lines.push('💵 PAYMENT RECEIPT');
  lines.push('─────────────────────');
  lines.push(`Mess:    ${d.messName}`);
  lines.push(`Member:  ${d.memberName}`);
  lines.push(`Month:   ${d.monthLabel}`);
  lines.push(`Date:    ${dt}`);
  lines.push('');
  lines.push(`Amount received:  ${fmtTk(d.amountReceived)}`);
  lines.push('─────────────────────');
  if (d.allocPrevDue > 0) lines.push(`→ Prev. Due: ${fmtTk(d.allocPrevDue)}`);
  if (d.allocMeal > 0) lines.push(`→ Meal:      ${fmtTk(d.allocMeal)}`);
  if (d.allocUtil > 0) lines.push(`→ Utility:   ${fmtTk(d.allocUtil)}`);
  if (d.allocRent > 0) lines.push(`→ Rent:      ${fmtTk(d.allocRent)}`);
  if (d.change > 0) lines.push(`Change returned: ${fmtTk(d.change)}`);
  lines.push('─────────────────────');
  lines.push(
    d.newNet > 0
      ? `Still due:  ${fmtTk(d.newNet)}`
      : d.newNet < 0
      ? `Mess owes you: ${fmtTk(Math.abs(d.newNet))}`
      : `✓ Fully settled for ${d.monthLabel}`,
  );
  lines.push('');
  lines.push(`— sent from ${d.messName} manager`);
  return lines.join('\n');
}

export function buildReceiptHtml(d: ReceiptData): string {
  const row = (label: string, value: string, color = '#1a1816') =>
    `<tr><td style="padding:6px 0;color:#6b6560">${label}</td><td style="padding:6px 0;text-align:right;font-weight:700;color:${color}">${value}</td></tr>`;
  const allocRows = [
    d.allocPrevDue > 0 ? row('Previous due', fmtTk(d.allocPrevDue), '#e05252') : '',
    d.allocRent > 0 ? row('Room rent', fmtTk(d.allocRent), '#b8914a') : '',
    d.allocUtil > 0 ? row('Utility', fmtTk(d.allocUtil), '#5b9bd5') : '',
    d.allocMeal > 0 ? row('Meal balance', fmtTk(d.allocMeal), '#9b7fd4') : '',
    d.change > 0 ? row('Change returned', fmtTk(d.change), '#4caf82') : '',
  ].join('');
  const net =
    d.newNet > 0
      ? `Still due: ${fmtTk(d.newNet)}`
      : d.newNet < 0
      ? `Mess owes ${fmtTk(Math.abs(d.newNet))}`
      : `Fully settled`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>body{font-family:-apple-system,Roboto,sans-serif;color:#1a1816;padding:28px;max-width:420px;margin:0 auto}
  h1{font-size:20px;margin:0 0 2px}.sub{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9a9690;margin-bottom:18px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  .hero{background:#f0ede8;border-radius:10px;padding:14px 16px;margin:14px 0;display:flex;justify-content:space-between;align-items:center}
  .hero b{font-size:22px}.hr{border-top:2px dashed #ddd;margin:14px 0}.foot{font-size:10px;color:#9a9690;text-align:center;margin-top:18px}</style></head>
  <body>
    <h1>${d.messName}</h1><div class="sub">Payment Receipt</div>
    <table>
      ${row('Member', d.memberName)}
      ${row('Month', d.monthLabel)}
      ${row('Date', d.timestamp.toLocaleString())}
    </table>
    <div class="hero"><span>Amount received</span><b>${fmtTk(d.amountReceived)}</b></div>
    <div class="sub">Allocation</div>
    <table>${allocRows || row('—', '৳0')}</table>
    <div class="hr"></div>
    <div class="hero"><span>Balance</span><b>${net}</b></div>
    <div class="foot">Generated by MessManager</div>
  </body></html>`;
}

/* ── Member "Give Payment" receipt ───────────────────────── */

export type PaymentReceipt = {
  messName: string;
  memberName: string;
  monthLabel: string;
  receiptNo: number;
  amount: number;
  status: 'pending' | 'confirmed' | 'rejected';
  submittedAt: Date;
  confirmedBy?: string | null;
  confirmedAt?: Date | null;
  split?: Split | null;
  stillDue?: number | null;
};

export function receiptNumber(n: number): string {
  return `#${String(n).padStart(6, '0')}`;
}

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function balanceLine(stillDue: number, monthLabel: string): string {
  return stillDue > 0.005
    ? `Still due: ${fmtTk(stillDue)}`
    : stillDue < -0.005
    ? `Mess owes you ${fmtTk(Math.abs(stillDue))}`
    : `Fully settled for ${monthLabel}`;
}

export function buildPaymentReceiptText(d: PaymentReceipt): string {
  const L: string[] = [];
  L.push(d.status === 'confirmed' ? '💵 PAYMENT RECEIPT' : d.status === 'rejected' ? '✖ PAYMENT REJECTED' : '🕓 PAYMENT REQUEST');
  L.push('─────────────────────');
  L.push(`Receipt: ${receiptNumber(d.receiptNo)}`);
  L.push(`Mess:    ${d.messName}`);
  L.push(`Member:  ${d.memberName}`);
  L.push(`Month:   ${d.monthLabel}`);
  L.push(`Date:    ${d.submittedAt.toLocaleString()}`);
  L.push('');
  L.push(`Amount ${d.status === 'confirmed' ? 'received' : 'offered'}:  ${fmtTk(d.amount)}`);
  L.push('─────────────────────');
  if (d.status === 'confirmed') {
    const sp = d.split;
    if (sp) {
      if (sp.allocPrevDue > 0) L.push(`→ Prev. Due: ${fmtTk(sp.allocPrevDue)}`);
      if (sp.allocMeal > 0) L.push(`→ Meal:      ${fmtTk(sp.allocMeal)}`);
      if (sp.allocUtil > 0) L.push(`→ Utility:   ${fmtTk(sp.allocUtil)}`);
      if (sp.allocRent > 0) L.push(`→ Rent:      ${fmtTk(sp.allocRent)}`);
      if (sp.change > 0) L.push(`Change returned: ${fmtTk(sp.change)}`);
      L.push('─────────────────────');
    }
    if (d.stillDue != null) L.push(balanceLine(d.stillDue, d.monthLabel));
    L.push(`Confirmed by ${d.confirmedBy ?? 'manager'}${d.confirmedAt ? ` · ${d.confirmedAt.toLocaleString()}` : ''}`);
  } else if (d.status === 'rejected') {
    L.push(`Rejected by ${d.confirmedBy ?? 'manager'} — not counted.`);
  } else {
    L.push('⚠ Not yet confirmed by the manager.');
    L.push('This is NOT proof of payment received.');
  }
  return L.join('\n');
}

export function buildPaymentReceiptHtml(d: PaymentReceipt): string {
  const row = (label: string, value: string, color = '#1a1816') =>
    `<tr><td style="padding:6px 0;color:#6b6560">${label}</td><td style="padding:6px 0;text-align:right;font-weight:700;color:${color}">${value}</td></tr>`;
  const title = d.status === 'confirmed' ? 'Payment Receipt' : d.status === 'rejected' ? 'Payment Rejected' : 'Payment Request';
  const sp = d.split;
  const allocRows = sp
    ? [
        sp.allocPrevDue > 0 ? row('Previous due', fmtTk(sp.allocPrevDue), '#e05252') : '',
        sp.allocRent > 0 ? row('Room rent', fmtTk(sp.allocRent), '#b8914a') : '',
        sp.allocUtil > 0 ? row('Utility', fmtTk(sp.allocUtil), '#5b9bd5') : '',
        sp.allocMeal > 0 ? row('Meal balance', fmtTk(sp.allocMeal), '#9b7fd4') : '',
        sp.change > 0 ? row('Change returned', fmtTk(sp.change), '#4caf82') : '',
      ].join('')
    : '';
  const banner =
    d.status === 'pending'
      ? `<div class="warn">Not yet confirmed by the manager.<br/>This is not proof that the payment was received.</div>`
      : d.status === 'rejected'
      ? `<div class="warn">Rejected by ${esc(d.confirmedBy ?? 'manager')} — this payment was not counted.</div>`
      : `<div class="ok">Confirmed by ${esc(d.confirmedBy ?? 'manager')}${d.confirmedAt ? `<br/>${esc(d.confirmedAt.toLocaleString())}` : ''}</div>`;
  const balance =
    d.status === 'confirmed' && d.stillDue != null
      ? `<div class="hr"></div><div class="hero"><span>Balance</span><b>${esc(balanceLine(d.stillDue, d.monthLabel))}</b></div>`
      : '';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>body{font-family:-apple-system,Roboto,sans-serif;color:#1a1816;padding:28px;max-width:420px;margin:0 auto}
  h1{font-size:20px;margin:0 0 2px}.sub{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9a9690;margin-bottom:18px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  .hero{background:#f0ede8;border-radius:10px;padding:14px 16px;margin:14px 0;display:flex;justify-content:space-between;align-items:center}
  .hero b{font-size:20px}.hr{border-top:2px dashed #ddd;margin:14px 0}.foot{font-size:10px;color:#9a9690;text-align:center;margin-top:18px}
  .warn{background:#fdf3e1;color:#8a5a00;border-radius:8px;padding:10px 12px;font-size:12px;margin-top:14px}
  .ok{background:#e6f5ee;color:#1d7a4f;border-radius:8px;padding:10px 12px;font-size:12px;margin-top:14px}</style></head>
  <body>
    <h1>${esc(d.messName)}</h1><div class="sub">${title}</div>
    <table>
      ${row('Receipt no.', receiptNumber(d.receiptNo))}
      ${row('Member', esc(d.memberName))}
      ${row('Month', esc(d.monthLabel))}
      ${row('Date', esc(d.submittedAt.toLocaleString()))}
    </table>
    <div class="hero"><span>Amount ${d.status === 'confirmed' ? 'received' : 'offered'}</span><b>${fmtTk(d.amount)}</b></div>
    ${allocRows ? `<div class="sub">Allocation</div><table>${allocRows}</table>` : ''}
    ${balance}
    ${banner}
    <div class="foot">Generated by MessManager</div>
  </body></html>`;
}
