import { Customer, Order } from './types';

/** How long after an order is created the customer is asked for feedback about it. */
const FEEDBACK_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** One order that a feedback request can be sent for. */
export interface FeedbackItem {
  customer: Customer;
  order: Order;
  notified: boolean;
}

/** When the order was recorded; older orders without a timestamp use their order date. */
function createdTime(o: Order): number {
  if (o.createdAt) return new Date(o.createdAt).getTime();
  const [y, m, d] = o.date.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/**
 * Whether a feedback request was already sent for this order. Requests from older versions
 * weren't tied to an order, so they count for every order created before they were sent.
 */
function isNotified(c: Customer, o: Order): boolean {
  return (c.feedbackLog ?? []).some((l) =>
    l.orderId ? l.orderId === o.id : new Date(l.at).getTime() >= createdTime(o),
  );
}

/**
 * Every order created in the last 3 days, one item per order — so a customer with two new
 * orders appears twice. Newest orders first.
 */
export function getFeedbackItems(customers: Customer[], now = Date.now()): FeedbackItem[] {
  const items: (FeedbackItem & { createdAt: number })[] = [];
  for (const customer of customers) {
    for (const order of customer.orders) {
      const createdAt = createdTime(order);
      if (now - createdAt > FEEDBACK_WINDOW_MS) continue;
      items.push({ customer, order, notified: isNotified(customer, order), createdAt });
    }
  }
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

/** Number of recent orders still waiting for a feedback request. */
export function countFeedbackPending(customers: Customer[]): number {
  return getFeedbackItems(customers).filter((i) => !i.notified).length;
}
