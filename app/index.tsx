import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Loading } from '../src/components/ui';

export default function Index() {
  const { ready, user, area } = useAuth();
  if (!ready) return <Loading brand />;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={area === 'manager' ? '/(manager)' : '/(member)'} />;
}
