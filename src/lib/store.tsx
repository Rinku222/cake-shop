import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AppState } from "react-native";
import {
  BackupAccessNeededError,
  requestBackupAccess,
  saveAutoBackup,
} from "./backup";
import { ContactLog, Customer, FeedbackLog, Order, Settings } from "./types";

const STORAGE_KEY = "cake-shop/v1";

/** v1: original flat wording ("…is coming up on {date}…", includes the year). */
const MESSAGE_TEMPLATE_V1 =
  "Hi {name}! 🎂 {whose} {occasion} is coming up on {date}. Make it extra special with a freshly baked cake from {shop}. Reply here to pre-order your favourite {flavor} cake!";

/** v2: smart "today/tomorrow" wording, before reorder links were added. */
const MESSAGE_TEMPLATE_V2 =
  "Hi {name}! 🎂 {whose} {occasion} {when}. Make it extra special with a freshly baked cake from {shop}. Reply here to pre-order your favourite {flavor} cake!";

/** v3: v2 plus a single-line {reorder} prompt. */
const MESSAGE_TEMPLATE_V3 =
  "Hi {name}! 🎂 {whose} {occasion} {when}. Make it extra special with a freshly baked cake from {shop}. Reply here to pre-order your favourite {flavor} cake! {reorder}";

/**
 * v4 (current default): warm, multi-line message. {reorder} renders the Swiggy,
 * Zomato and shop-location links each on their own line, so the message stays
 * polite and easy to read in WhatsApp.
 */
const MESSAGE_TEMPLATE_V4 =
  "Hi {name}! 🎂\n\n{whose} {occasion} {when}. We’d be truly honoured to make it extra special with a freshly baked cake from {shop}! Your favourite {flavor} is always ready whenever you are. 🍰{reorder}\n\nWarm regards,\n{shop} ❤️";

export const DEFAULT_SETTINGS: Settings = {
  shopName: "Yummie’s Bakery",
  countryCode: "91",
  currency: "₹",
  upcomingWindowDays: 15,
  messageTemplate: MESSAGE_TEMPLATE_V4,
  swiggyUrl: "https://www.swiggy.com/menu/1387782?source=sharing",
  zomatoUrl: "https://zomato.onelink.me/xqzv/txaxxpuy",
  mapsUrl: 'https://maps.app.goo.gl/Q97QZ9YJ1v7G2RNM6',
  reviewUrl: 'https://www.google.com/maps/place//data=!4m3!3m2!1s0x3950b92e00f2aa3f:0x2af7a337230cf0ef!12e1',
};

/** Applies defaults and one-off template migrations to saved settings. */
function migrateSettings(saved: Partial<Settings> | undefined): Settings {
  const settings = { ...DEFAULT_SETTINGS, ...saved };
  // Old default shop name, never customised by the user.
  if (settings.shopName === "My Cake Shop")
    settings.shopName = DEFAULT_SETTINGS.shopName;
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
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * True when two phone numbers refer to the same line, tolerating a leading
 * country code on either side (e.g. "98765 43210" vs "+91 9876543210").
 */
export function phoneMatches(
  input: string,
  stored: string,
  countryCode: string,
): boolean {
  const a = normalizePhone(input);
  const b = normalizePhone(stored);
  if (!a || !b) return false;
  if (a === b) return true;
  const cc = normalizePhone(countryCode);
  const local = (digits: string) =>
    cc && digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  const aLocal = local(a);
  const bLocal = local(b);
  return aLocal.length > 0 && aLocal === bLocal;
}

interface StoreValue extends PersistedState {
  loaded: boolean;
  getCustomer: (id: string) => Customer | undefined;
  /** All customers whose phone matches, optionally excluding one (e.g. the one being edited). */
  findCustomersByPhone: (phone: string, excludeId?: string) => Customer[];
  addCustomer: (
    c: Omit<Customer, "id" | "createdAt" | "contactLog">,
  ) => Customer;
  updateCustomer: (id: string, patch: Partial<Omit<Customer, "id">>) => void;
  deleteCustomer: (id: string) => void;
  addOrder: (customerId: string, order: Omit<Order, "id">) => void;
  deleteOrder: (customerId: string, orderId: string) => void;
  logContact: (customerId: string, log: Omit<ContactLog, "at">) => void;
  undoContact: (customerId: string, occasionId: string, year: number) => void;
  logFeedback: (customerId: string, channel: FeedbackLog['channel']) => void;
  undoFeedback: (customerId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  replaceAll: (state: PersistedState) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

/**
 * Mirrors every change into the backup file (shortly after it happens, and right away when
 * the app goes to the background).
 *
 * An empty state is only written once this session has had customers (i.e. the user deleted
 * them). After "Clear data" the app starts empty, and writing that out would overwrite the very
 * backup the user wants to restore.
 */
function useBackupSync(state: PersistedState, loaded: boolean) {
  const latest = useRef(state);
  const hadData = useRef(false);
  const dirty = useRef(false);
  const askedForAccess = useRef(false);
  const writing = useRef(false);

  const write = useCallback(async () => {
    if (!dirty.current || writing.current) return;
    writing.current = true;
    dirty.current = false;
    try {
      if (!(await saveAutoBackup(latest.current))) dirty.current = true;
    } catch (e) {
      dirty.current = true;
      if (!(e instanceof BackupAccessNeededError) || askedForAccess.current)
        return;
      // The folder holds a backup from an earlier install (or "Clear data" ran): Android needs
      // the user to allow access to that one folder before the app can update it again.
      askedForAccess.current = true;
      Alert.alert(
        "Reconnect your backup folder",
        "To keep your customers backed up in Documents/Cake Customers, allow the app to use that folder.\n\n" +
          "On the next screen, tap “Use this folder”, then “Allow”.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Continue",
            onPress: async () => {
              if (await requestBackupAccess()) {
                dirty.current = false;
                await saveAutoBackup(latest.current).catch(
                  () => (dirty.current = true),
                );
              }
            },
          },
        ],
      );
    } finally {
      writing.current = false;
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    latest.current = state;
    if (state.customers.length > 0) hadData.current = true;
    if (!hadData.current) return;
    dirty.current = true;
    const timer = setTimeout(write, 500);
    return () => clearTimeout(timer);
  }, [state, loaded, write]);

  // Save immediately when leaving the app.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "background") write();
    });
    return () => sub.remove();
  }, [write]);
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>({
    customers: [],
    settings: DEFAULT_SETTINGS,
  });
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
      .catch((e) => console.warn("Failed to load data", e))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch((e) =>
      console.warn("Failed to save data", e),
    );
  }, [state, loaded]);

  // Keep the backup file on the phone in sync with local storage.
  useBackupSync(state, loaded);

  const mapCustomer = useCallback(
    (id: string, fn: (c: Customer) => Customer) => {
      setState((s) => ({
        ...s,
        customers: s.customers.map((c) => (c.id === id ? fn(c) : c)),
      }));
    },
    [],
  );

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      loaded,
      getCustomer: (id) => state.customers.find((c) => c.id === id),
      findCustomersByPhone: (phone, excludeId) =>
        state.customers.filter(
          (c) =>
            (!excludeId || c.id !== excludeId) &&
            phoneMatches(phone, c.phone, state.settings.countryCode),
        ),
      addCustomer: (input) => {
        const customer: Customer = {
          ...input,
          id: uid(),
          createdAt: new Date().toISOString(),
          contactLog: [],
          feedbackLog: [],
        };
        setState((s) => ({ ...s, customers: [...s.customers, customer] }));
        return customer;
      },
      updateCustomer: (id, patch) =>
        mapCustomer(id, (c) => ({ ...c, ...patch })),
      deleteCustomer: (id) =>
        setState((s) => ({
          ...s,
          customers: s.customers.filter((c) => c.id !== id),
        })),
      addOrder: (customerId, order) =>
        mapCustomer(customerId, (c) => ({
          ...c,
          orders: [{ ...order, id: uid() }, ...c.orders],
        })),
      deleteOrder: (customerId, orderId) =>
        mapCustomer(customerId, (c) => ({
          ...c,
          orders: c.orders.filter((o) => o.id !== orderId),
        })),
      logContact: (customerId, log) =>
        mapCustomer(customerId, (c) => ({
          ...c,
          contactLog: [
            ...c.contactLog.filter(
              (l) => !(l.occasionId === log.occasionId && l.year === log.year),
            ),
            { ...log, at: new Date().toISOString() },
          ],
        })),
      undoContact: (customerId, occasionId, year) =>
        mapCustomer(customerId, (c) => ({
          ...c,
          contactLog: c.contactLog.filter(
            (l) => !(l.occasionId === occasionId && l.year === year),
          ),
        })),
      logFeedback: (customerId, channel) =>
        mapCustomer(customerId, (c) => ({
          ...c,
          feedbackLog: [{ channel, at: new Date().toISOString() }, ...(c.feedbackLog ?? [])],
        })),
      undoFeedback: (customerId) =>
        mapCustomer(customerId, (c) => ({ ...c, feedbackLog: [] })),
      updateSettings: (patch) =>
        setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      replaceAll: (next) =>
        setState({
          customers: next.customers ?? [],
          settings: migrateSettings(next.settings),
        }),
    }),
    [state, loaded, mapCustomer],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
