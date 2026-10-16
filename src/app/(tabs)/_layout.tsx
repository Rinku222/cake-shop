import { Ionicons } from '@expo/vector-icons';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { getUpcoming } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
  const { customers, settings } = useStore();
  const pending = getUpcoming(customers, settings.upcomingWindowDays).filter((i) => !i.reminded).length;
  const feedbackPending = customers.filter(
    (c) => Date.now() - new Date(c.createdAt).getTime() <= 3 * 24 * 60 * 60 * 1000 && (c.feedbackLog ?? []).length === 0
  ).length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.background },
        headerRight: () => (
          <Link href="/settings" asChild>
            <Pressable hitSlop={10} style={{ marginRight: 16 }} accessibilityLabel="Settings">
              <Ionicons name="settings-outline" size={22} color={colors.primary} />
            </Pressable>
          </Link>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Upcoming',
          tabBarBadge: pending > 0 ? pending : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add Customer',
          tabBarLabel: 'Add',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-add" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: 'Feedback',
          tabBarBadge: feedbackPending > 0 ? feedbackPending : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary },
          tabBarIcon: ({ color, size }) => <Ionicons name="star-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
