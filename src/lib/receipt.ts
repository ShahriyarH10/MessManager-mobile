/**
 * Print / share helpers for member-payment receipts, shared by the member's
 * Give Payment screen and the manager's Collect screen.
 */
import { Alert, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  buildPaymentReceiptHtml,
  buildPaymentReceiptText,
  type PaymentReceipt,
} from '../core/collect';
import { monthLabelFromKey } from '../core/format';
import type { MemberPayment } from '../core/types';

export function toReceipt(p: MemberPayment, messName: string): PaymentReceipt {
  return {
    messName,
    memberName: p.member_name,
    monthLabel: monthLabelFromKey(p.month_key),
    receiptNo: p.receipt_no,
    amount: Number(p.amount),
    status: p.status,
    submittedAt: new Date(p.created_at),
    confirmedBy: p.confirmed_by,
    confirmedAt: p.confirmed_at ? new Date(p.confirmed_at) : null,
    split: p.split,
    stillDue: p.still_due != null ? Number(p.still_due) : null,
  };
}

export async function printReceipt(r: PaymentReceipt): Promise<void> {
  try {
    await Print.printAsync({ html: buildPaymentReceiptHtml(r) });
  } catch (e: any) {
    Alert.alert('Error', e?.message ?? 'Could not print.');
  }
}

export async function shareReceiptPdf(r: PaymentReceipt): Promise<void> {
  try {
    const { uri } = await Print.printToFileAsync({ html: buildPaymentReceiptHtml(r) });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  } catch (e: any) {
    Alert.alert('Error', e?.message ?? 'Could not create PDF.');
  }
}

export function shareReceiptText(r: PaymentReceipt): void {
  Share.share({ message: buildPaymentReceiptText(r) }).catch(() => {});
}

/** Alert with the receipt text and Print / PDF / text actions (manager side). */
export function showReceiptAlert(title: string, r: PaymentReceipt): void {
  Alert.alert(title, buildPaymentReceiptText(r), [
    { text: 'Done', style: 'cancel' },
    { text: 'Share text', onPress: () => shareReceiptText(r) },
    { text: 'Share PDF', onPress: () => shareReceiptPdf(r) },
    { text: 'Print', onPress: () => printReceipt(r) },
  ]);
}
