import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { saveAutoBackup } from './backup';
import { ContactLog, Customer, Order, Settings } from './types';

const STORAGE_KEY = 'cake-shop/v1';

/** v1: original flat wording ("…is coming up on {date}…", includes the year). */
const MESSAGE_TEMPLATE_V1 =
  'Hi {name}! 🎂 {whose} {occasion} is coming up on {date}. Make it extra special with a freshly baked cake from {shop}. Reply here to pre-order your favourite {flavor} cake!';

/** v2: smart "today/tomorrow" wording, before reorder links were added. */
const MESSAGE_TEMPLATE_V2 =
  'Hi {name}! 🎂 {whose} {occasion} {when}. Make it extra special with a freshly baked cake from {shop}. Reply here to pre-order your favourite {flavor} cake!';

/** v3: v2 plus a single-line {reorder} prompt. */
const MESSAGE_TEMPLATE_V3 =
  'Hi {name}! 🎂 {whose} {occasion} {when}. Make it extra special with a freshly baked cake from {shop}. Reply here to pre-order your favourite {flavor} cake! {reorder}';

/**
 * v4 (current default): warm, multi-line message. {reorder} renders the Swiggy,
 * Zomato and shop-location links each on their own line, so the message stays
 * polite and easy to read in WhatsApp.
 */
const MESSAGE_TEMPLATE_V4 =
  'Hi {name}! 🎂\n\n{whose} {occasion} {when}. We’d be truly honoured to make it extra special with a freshly baked cake from {shop}! Your favourite {flavor} is always ready whenever you are. 🍰{reorder}\n\nWarm regards,\n{shop} ❤️';

export const DEFAULT_SETTINGS: Settings = {
  shopName: 'My Cake Shop',
  countryCode: '91',
  currency: '₹',
  upcomingWindowDays: 15,
  messageTemplate: MESSAGE_TEMPLATE_V4,
  swiggyUrl: 'https://www.swiggy.com/menu/1387782?source=sharing',
  zomatoUrl: 'https://zomato.onelink.me/xqzv/txaxxpuy',
  mapsUrl: 'https://maps.app.goo.gl/Q97QZ9YJ1v7G2RNM6',
};

/** Applies defaults and one-off template migrations to saved settings. */
function migrateSettings(saved: Partial<Settings> | undefined): Settings {
  const settings = { ...DEFAULT_SETTINGS, ...saved };
  if (
    settings.messageTemplate === MESSAGE_TEMPLATE_V1 ||
    settings.messageTemplate === MESSAGE_TEMPLATE_V2 ||
    settings.messageTemplate === MESSAGE_TEMPLATE_V3
  ) {
    settings.messageTemplate = DEFAULT_SETTINGS.messageTemplate;
  }
  return settings;
}

export interface PersistedState {
  customers: Customer[];
  settings: Settings;
}

/** Strips everything but digits from a phone number. */
export function normalizePhone(phone: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

/**
 * True when two phone numbers refer to the same line, tolerating a leading
 * country code on either side (e.g. "98765 43210" vs "+91 9876543210").
 */
export function phoneMatches(input: string, stored: string, countryCode: string): boolean {
  const a = normalizePhone(input);
  const b = normalizePhone(stored);
  if (!a || !b) return false;
  if (a === b) return true;
  const cc = normalizePhone(countryCode);
  const local = (digits: string) => (cc && digits.startsWith(cc) ? digits.slice(cc.length) : digits);
  const aLocal = local(a);
  const bLocal = local(b);
  return aLocal.length > 0 && aLocal === bLocal;
}

interface StoreValue extends PersistedState {
  loaded: boolean;
  getCustomer: (id: string) => Customer | undefined;
  /** All customers whose phone matches, optionally excluding one (e.g. the one being edited). */
  findCustomersByPhone: (phone: string, excludeId?: string) => Customer[];
  addCustomer: (c: Omit<Customer, 'id' | 'createdAt' | 'contactLog'>) => Customer;
  updateCustomer: (id: string, patch: Partial<Omit<Customer, 'id'>>) => void;
  deleteCustomer: (id: string) => void;
  addOrder: (customerId: string, order: Omit<Order, 'id'>) => void;
  deleteOrder: (customerId: string, orderId: string) => void;
  logContact: (customerId: string, log: Omit<ContactLog, 'at'>) => void;
  undoContact: (customerId: string, occasionId: string, year: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (state: PersistedState) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>({ customers: [], settings: DEFAULT_SETTINGS });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        setState({
          customers: parsed.customers ?? [],
          settings: migrateSettings(parsed.settings),
        });
      })
      .catch((e) => console.warn('Failed to load data', e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((e) => console.warn('Failed to save data', e));
  }, [state, loaded]);

  // Keep the "cake customers" backup file in sync with the latest data (debounced).
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      saveAutoBackup(state).catch((e) => console.warn('Failed to auto-backup', e));
    }, 1500);
    return () => clearTimeout(timer);
  }, [state, loaded]);

  const mapCustomer = useCallback((id: string, fn: (c: Customer) => Customer) => {
    setState((s) => ({ ...s, customers: s.customers.map((c) => (c.id === id ? fn(c) : c)) }));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      loaded,
      getCustomer: (id) => state.customers.find((c) => c.id === id),
      findCustomersByPhone: (phone, excludeId) =>
        state.customers.filter(
          (c) =>
            (!excludeId || c.id !== excludeId) && phoneMatches(phone, c.phone, state.settings.countryCode),
        ),
      addCustomer: (input) => {
        const customer: Customer = { ...input, id: uid(), createdAt: new Date().toISOString(), contactLog: [] };
        setState((s) => ({ ...s, customers: [...s.customers, customer] }));
        return customer;
      },
      updateCustomer: (id, patch) => mapCustomer(id, (c) => ({ ...c, ...patch })),
      deleteCustomer: (id) => setState((s) => ({ ...s, customers: s.customers.filter((c) => c.id !== id) })),
      addOrder: (customerId, order) =>
        mapCustomer(customerId, (c) => ({ ...c, orders: [{ ...order, id: uid() }, ...c.orders] })),
      deleteOrder: (customerId, orderId) =>
        mapCustomer(customerId, (c) => ({ ...c, orders: c.orders.filter((o) => o.id !== orderId) })),
      logContact: (customerId, log) =>
        mapCustomer(customerId, (c) => ({
          ...c,
          contactLog: [
            ...c.contactLog.filter((l) => !(l.occasionId === log.occasionId && l.year === log.year)),
            { ...log, at: new Date().toISOString() },
          ],
        })),
      undoContact: (customerId, occasionId, year) =>
        mapCustomer(customerId, (c) => ({
          ...c,
          contactLog: c.contactLog.filter((l) => !(l.occasionId === occasionId && l.year === year)),
        })),
      updateSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      replaceAll: (next) =>
        setState({ customers: next.customers ?? [], settings: migrateSettings(next.settings) }),
    }),
    [state, loaded, mapCustomer],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
