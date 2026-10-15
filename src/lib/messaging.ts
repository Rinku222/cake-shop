import { Alert, Linking, Platform } from 'react-native';
import { formatDate, milestoneText, occasionTitle } from './dates';
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
  return settings.messageTemplate
    .replace(/\{name\}/g, firstName)
    .replace(/\{whose\}/g, whose.charAt(0).toUpperCase() + whose.slice(1))
    .replace(/\{occasion\}/g, occasion)
    .replace(/\{date\}/g, formatDate(date))
    .replace(/\{shop\}/g, settings.shopName)
    .replace(/\{flavor\}/g, c.favoriteFlavor?.trim() || '')
    .replace(/ {2,}/g, ' ');
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
