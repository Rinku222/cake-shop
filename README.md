# Cake Reminders

A React Native (Expo) app for a cake shop to turn one-time customers into repeat customers.
Save each customer's birthdays, anniversaries and other occasions, see who has an occasion
coming up, and send them a pre-filled WhatsApp/SMS reminder to order their cake again.

## Run it

```bash
npm install
npm start          # then scan the QR code with the Expo Go app (Android / iOS)
npm run android    # or open in an Android emulator
npm run ios        # or open in the iOS simulator (macOS)
```

Tip: on first launch tap **Try with demo data** to fill the app with sample customers.

## Features

- **Upcoming tab** – every occasion in the next 7 / 15 / 30 days (15 by default), grouped
  into Today / Next 7 days / Later, with a badge on the tab showing how many still need a reminder.
  One-tap **WhatsApp** reminder (auto-marks as reminded) or **Mark done**; filter to "To remind".
- **Customer detail** – contact buttons (call / WhatsApp / SMS), order count, total spend,
  last order, every occasion with countdown and milestone ("Turns 30", "5th anniversary"),
  per-occasion reminder status, full order history (long-press to delete), edit and delete.
- **Add customer** – name, phone, favourite flavour, notes, any number of occasions
  (birthday / anniversary / custom, optionally for a family member), and the order they placed today.
- **Customers tab** – search by name or phone; sort by next occasion, name or most orders.
- **Add order** – log repeat orders; auto-links to an occasion within ±7 days of the order date.
- **Insights tab** – repeat-customer rate, revenue, reminder → order conversion rate,
  occasions missed in the last 7 days, occasions per month, top customers.
- **Settings** – shop name, country code (for WhatsApp links), currency, editable reminder
  message template with live preview, export/restore backup, demo data, delete all.

Data is stored on the device with AsyncStorage – export a backup regularly.

## Project layout

```
src/app/               Expo Router screens
  (tabs)/index.tsx     Upcoming occasions
  (tabs)/customers.tsx Customer list
  (tabs)/add.tsx       Create customer
  (tabs)/insights.tsx  Stats
  customer/[id].tsx    Customer detail
  customer/edit/[id].tsx
  add-order/[id].tsx   New order (modal)
  settings.tsx
src/components/        Form, cards and small UI kit
src/lib/               Types, date maths, storage (context + AsyncStorage), messaging
```
# cake-shop
