import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ContactLog, Customer, Order, Settings } from './types';

const STORAGE_KEY = 'cake-shop/v1';

export const DEFAULT_SETTINGS: Settings = {
  shopName: 'My Cake Shop',
  countryCode: '91',
  currency: '₹',
  upcomingWindowDays: 15,
  messageTemplate:
    'Hi {name}! 🎂 {whose} {occasion} is coming up on {date}. Make it extra special with a freshly baked cake from {shop}. Reply here to pre-order your favourite {flavor} cake!',
};

interface PersistedState {
  customers: Customer[];
  settings: Settings;
}

interface StoreValue extends PersistedState {
  loaded: boolean;
  getCustomer: (id: string) => Customer | undefined;
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
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        });
      })
      .catch((e) => console.warn('Failed to load data', e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((e) => console.warn('Failed to save data', e));
  }, [state, loaded]);

  const mapCustomer = useCallback((id: string, fn: (c: Customer) => Customer) => {
    setState((s) => ({ ...s, customers: s.customers.map((c) => (c.id === id ? fn(c) : c)) }));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      loaded,
      getCustomer: (id) => state.customers.find((c) => c.id === id),
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
        setState({ customers: next.customers ?? [], settings: { ...DEFAULT_SETTINGS, ...next.settings } }),
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
