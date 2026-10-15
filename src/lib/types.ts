export type OccasionType = 'birthday' | 'anniversary' | 'other';

export interface Occasion {
  id: string;
  type: OccasionType;
  /** Free text label, used when type is 'other' (e.g. "Graduation"). */
  label?: string;
  /** Whose occasion it is, if not the customer themselves (e.g. "Daughter - Riya"). */
  forWhom?: string;
  day: number; // 1-31
  month: number; // 1-12
  /** Optional, lets us show "turning 30" / "10th anniversary". */
  year?: number;
}

export interface Order {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  occasionId?: string;
  cake: string;
  flavor?: string;
  weightKg?: number;
  amount?: number;
  notes?: string;
}

/** Records that the customer was reminded about a specific occurrence of an occasion. */
export interface ContactLog {
  occasionId: string;
  /** The year of the occurrence the reminder was for. */
  year: number;
  at: string; // ISO timestamp
  channel: 'whatsapp' | 'sms' | 'call' | 'manual';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  favoriteFlavor?: string;
  occasions: Occasion[];
  orders: Order[];
  contactLog: ContactLog[];
  createdAt: string;
}

export interface Settings {
  shopName: string;
  countryCode: string; // digits only, e.g. "91"
  currency: string; // symbol, e.g. "₹"
  upcomingWindowDays: number;
  messageTemplate: string;
  /** Link to the shop's Swiggy listing, used for reorder prompts. */
  swiggyUrl?: string;
  /** Link to the shop's Zomato listing, used for reorder prompts. */
  zomatoUrl?: string;
  /** Link to the shop's location on Google Maps, shown as "Visit our shop". */
  mapsUrl?: string;
}

export const OCCASION_TYPES: { value: OccasionType; label: string; emoji: string }[] = [
  { value: 'birthday', label: 'Birthday', emoji: '🎂' },
  { value: 'anniversary', label: 'Anniversary', emoji: '💍' },
  { value: 'other', label: 'Other', emoji: '🎉' },
];
