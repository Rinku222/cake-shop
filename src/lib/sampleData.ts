import { toISODate } from './dates';
import { uid } from './store';
import { Customer } from './types';

/** Builds demo customers with occasions spread around today so every screen has something to show. */
export function buildSampleCustomers(today = new Date()): Customer[] {
  const shift = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  const dm = (days: number) => {
    const d = shift(days);
    return { day: d.getDate(), month: d.getMonth() + 1 };
  };
  const pastOrder = (daysAgo: number, cake: string, amount: number, occasionId?: string, flavor?: string) => ({
    id: uid(),
    date: toISODate(shift(-daysAgo)),
    cake,
    amount,
    occasionId,
    flavor,
    weightKg: 1,
  });

  const make = (
    name: string,
    phone: string,
    favoriteFlavor: string,
    occasions: Customer['occasions'],
    orders: (occasionIds: string[]) => Customer['orders'],
  ): Customer => ({
    id: uid(),
    name,
    phone,
    favoriteFlavor,
    occasions,
    orders: orders(occasions.map((o) => o.id)),
    contactLog: [],
    createdAt: shift(-365).toISOString(),
  });

  return [
    make('Priya Sharma', '9876543210', 'Chocolate truffle', [{ id: uid(), type: 'birthday', ...dm(0), year: today.getFullYear() - 29 }], ([b]) => [
      pastOrder(365, 'Chocolate truffle', 950, b, 'Chocolate'),
      pastOrder(120, 'Cupcakes x12', 600),
    ]),
    make(
      'Rahul Verma',
      '9811122233',
      'Red velvet',
      [
        { id: uid(), type: 'anniversary', forWhom: 'Rahul & Neha', ...dm(3), year: today.getFullYear() - 5 },
        { id: uid(), type: 'birthday', forWhom: 'Son Aarav', ...dm(90), year: today.getFullYear() - 6 },
      ],
      ([a, b]) => [pastOrder(362, 'Heart red velvet', 1200, a, 'Red velvet'), pastOrder(275, 'Cartoon theme cake', 1800, b)],
    ),
    make('Anita Desai', '9900011122', 'Pineapple', [{ id: uid(), type: 'birthday', ...dm(6) }], ([b]) => [
      pastOrder(359, 'Pineapple cake', 700, b, 'Pineapple'),
    ]),
    make(
      'Vikram Singh',
      '9822233344',
      'Black forest',
      [{ id: uid(), type: 'other', label: 'Shop opening day', ...dm(11), year: today.getFullYear() - 3 }],
      ([o]) => [pastOrder(354, '3 kg Black forest', 2400, o, 'Black forest'), pastOrder(60, 'Black forest', 800)],
    ),
    make('Meera Iyer', '9833344455', 'Butterscotch', [{ id: uid(), type: 'birthday', forWhom: 'Mom', ...dm(-3) }], () => []),
    make('Arjun Mehta', '9844455566', 'Mango', [{ id: uid(), type: 'birthday', ...dm(40) }], ([b]) => [
      pastOrder(325, 'Mango mousse', 900, b, 'Mango'),
    ]),
  ];
}
