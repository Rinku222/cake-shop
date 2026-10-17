import { Customer, Order } from './types';

/** How long after an order the customer is asked for feedback. */
const FEEDBACK_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** When an order was recorded; older orders without a timestamp fall back to their order date. */
function orderTime(o: Order): number {
  if (o.createdAt) return new Date(o.createdAt).getTime();
  const [y, m, d] = o.date.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** The customer's most recently created order, if any. */
export function latestOrder(c: Customer): Order | undefined {
  let latest: Order | undefined;
  for (const o of c.orders) if (!latest || orderTime(o) > orderTime(latest)) latest = o;
  return latest;
}

/** When the latest order was created (or the customer, if they have no orders). */
function lastOrderAt(c: Customer): number {
  const o = latestOrder(c);
  return o ? orderTime(o) : new Date(c.createdAt).getTime();
}

/**
 * Feedback status for the customer's latest order:
 * - 'pending': ordered in the last 3 days and no feedback request sent since that order
 * - 'notified': ordered in the last 3 days and a request was sent after that order
 * - null: no order in the last 3 days
 * A new order for the same customer makes them 'pending' again.
 */
export function feedbackStatus(c: Customer, now = Date.now()): 'pending' | 'notified' | null {
  const orderedAt = lastOrderAt(c);
  if (now - orderedAt > FEEDBACK_WINDOW_MS) return null;
  const lastSent = c.feedbackLog?.[0];
  return lastSent && new Date(lastSent.at).getTime() >= orderedAt ? 'notified' : 'pending';
}

/** Number of customers whose latest order still needs a feedback request. */
export function countFeedbackPending(customers: Customer[]): number {
  return customers.filter((c) => feedbackStatus(c) === 'pending').length;
}
