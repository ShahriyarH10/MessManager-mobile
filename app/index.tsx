import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Loading } from '../src/components/ui';

export default function Index() {
  const { ready, user } = useAuth();
  if (!ready) return <Loading label="Loading…" />;
  return <Redirect href={user ? '/(tabs)' : '/login'} />;
}
