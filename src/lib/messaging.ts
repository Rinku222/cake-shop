import { Alert, Linking, Platform } from 'react-native';
import { daysBetween, formatDayMonth, milestoneText, occasionTitle } from './dates';
import { Customer, Occasion, Settings } from './types';

/** Normalises a phone number to international digits (no "+"), adding the default country code if missing. */
export function internationalPhone(phone: string, countryCode: string): string {
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits.slice(1);
  digits = digits.replace(/^0+/, '');
  if (digits.length <= 10) return countryCode + digits;
  return digits;
}

export function buildReminderMessage(c: Customer, o: Occasion, date: Date, settings: Settings): string {
  const firstName = c.name.trim().split(/\s+/)[0];
  const whose = o.forWhom?.trim() ? `${o.forWhom.trim()}'s` : 'your';
  const milestone = milestoneText(o, date);
  const occasion = occasionTitle(o).toLowerCase() + (milestone ? ` (${milestone.toLowerCase()})` : '');

  // "When" phrase that never includes the year, so an unknown birth year
  // (the "Year is accurate" toggle off) never leaks into the message.
  const dayMonth = formatDayMonth(date.getDate(), date.getMonth() + 1); // e.g. "15 Oct"
  const daysUntil = daysBetween(new Date(), date);
  const when =
    daysUntil === 0
      ? `is today (${dayMonth})`
      : daysUntil === 1
        ? `is tomorrow (${dayMonth})`
        : `is coming up on ${dayMonth}`;

  // Ordering & location links — each on its own line so the message stays clean.
  const reorderLinks: string[] = [];
  if (settings.swiggyUrl?.trim()) reorderLinks.push(`🛵 Swiggy: ${settings.swiggyUrl.trim()}`);
  if (settings.zomatoUrl?.trim()) reorderLinks.push(`🥡 Zomato: ${settings.zomatoUrl.trim()}`);
  if (settings.mapsUrl?.trim()) reorderLinks.push(`📍 Visit our shop: ${settings.mapsUrl.trim()}`);
  const reorder = reorderLinks.length ? `\n\nCraving more? Order again:\n${reorderLinks.join('\n')}` : '';

  return settings.messageTemplate
    .replace(/\{name\}/g, firstName)
    .replace(/\{whose\}/g, whose.charAt(0).toUpperCase() + whose.slice(1))
    .replace(/\{occasion\}/g, occasion)
    .replace(/\{when\}/g, when)
    // {date} is kept as a legacy placeholder but also omits the year.
    .replace(/\{date\}/g, dayMonth)
    .replace(/\{reorder\}/g, reorder)
    .replace(/\{shop\}/g, settings.shopName)
    .replace(/\{flavor\}/g, c.favoriteFlavor?.trim() || '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

async function open(url: string, fallbackMessage: string) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert('Could not open app', fallbackMessage);
    return false;
  }
}

export function openWhatsApp(phone: string, message: string, settings: Settings) {
  const number = internationalPhone(phone, settings.countryCode);
  return open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, 'Is WhatsApp installed?');
}

export function openSms(phone: string, message: string) {
  const sep = Platform.OS === 'ios' ? '&' : '?';
  return open(`sms:${phone}${sep}body=${encodeURIComponent(message)}`, 'SMS is not available on this device.');
}

export function callPhone(phone: string) {
  return open(`tel:${phone}`, 'Calling is not available on this device.');
}

const GOOGLE_REVIEW_URL = 'https://www.google.com/maps/place//data=!4m3!3m2!1s0x3950b92e00f2aa3f:0x2af7a337230cf0ef!12e1';

export function buildFeedbackMessage(customerName: string, shopName: string, reviewUrl?: string): string {
  const firstName = customerName.trim().split(/\s+/)[0];
  const link = reviewUrl?.trim() || GOOGLE_REVIEW_URL;
  return `Hi ${firstName}! 😊 Thank you so much for choosing ${shopName}. We hope you loved your cake! 🎂\n\nWe'd be truly grateful if you could spare a moment to share your experience on Google — it means the world to us! 🙏\n\n⭐ Leave a review: ${link}\n\nWarm regards,\n${shopName} ❤️`;
}
