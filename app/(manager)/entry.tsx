import React from 'react';
import { useRouter } from 'expo-router';
import { ScreenScroll, Card } from '../../src/components/ui';
import { ListRow } from '../../src/components/form';
import type { IconName } from '../../src/components/Icon';

const ITEMS: { icon: IconName; label: string; desc: string; href: string }[] = [
  { icon: 'meals', label: 'Meal Entry', desc: 'Day/night meals for every member', href: '/manager/meal-entry' },
  { icon: 'bazar', label: 'Bazar Entry', desc: 'Grocery spending per member', href: '/manager/bazar-entry' },
  { icon: 'utility', label: 'Utility Entry', desc: 'Bills + member payment tracking', href: '/manager/utility-entry' },
  { icon: 'rent', label: 'Room Rent', desc: 'Set rent and track collection', href: '/manager/rent-entry' },
  { icon: 'notifications', label: 'Member Updates', desc: 'Activity from member self-service edits', href: '/manager/notifications' },
];

export default function EntryHub() {
  const router = useRouter();
  return (
    <ScreenScroll title="Entry" subtitle="Record meals, bazar, bills and rent">
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {ITEMS.map((it, i) => (
          <ListRow
            key={it.href}
            icon={it.icon}
            label={it.label}
            sublabel={it.desc}
            first={i === 0}
            onPress={() => router.push(it.href as any)}
          />
        ))}
      </Card>
    </ScreenScroll>
  );
}
