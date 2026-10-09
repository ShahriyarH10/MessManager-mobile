/**
 * Motion kit — loaders and small animations built on Reanimated.
 *
 * Everything here honours the OS "reduce motion" setting (Reanimated's default
 * ReduceMotion.System), so animations switch off for users who ask for that.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme, radius, radiusSm } from '../theme';
import { Icon } from './Icon';

/* ── Entrance ───────────────────────────────────────────── */

/** Fade + rise on mount. `index` staggers siblings (capped so long lists stay snappy). */
export function Reveal({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const delay = Math.min(index, 8) * 55;
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420).easing(Easing.out(Easing.cubic))} style={style}>
      {children}
    </Animated.View>
  );
}

/* ── Press feedback ─────────────────────────────────────── */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that gently shrinks while held and springs back. */
export function PressableScale({
  scaleTo = 0.97,
  style,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableProps & { scaleTo?: number; style?: any }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        s.value = withTiming(scaleTo, { duration: 90 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, { damping: 14, stiffness: 220 });
        onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}

/* ── Loaders ────────────────────────────────────────────── */

/** Three bouncing dots — for inline "busy" states such as buttons. */
export function DotsLoader({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.8, height: size * 2.4 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} i={i} color={color} size={size} />
      ))}
    </View>
  );
}

function Dot({ i, color, size }: { i: number; color: string; size: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      i * 140,
      withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 })), -1, false),
    );
  }, [i, p]);
  const a = useAnimatedStyle(() => ({
    opacity: 0.35 + p.value * 0.65,
    transform: [{ translateY: -p.value * size * 0.7 }, { scale: 0.85 + p.value * 0.25 }],
  }));
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, a]} />
  );
}

/** Full-screen branded loader: spinning arc around a pulsing "M" mark. */
export function BrandLoader({ label }: { label?: string }) {
  const { colors } = useTheme();
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [spin, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const mark = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.94, 1.06]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.8, 1]),
  }));
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: 42, borderWidth: 3, borderColor: colors.border2, borderTopColor: colors.accent },
            ring,
          ]}
        />
        <Animated.View
          style={[
            {
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: colors.accentBg,
              alignItems: 'center',
              justifyContent: 'center',
            },
            mark,
          ]}
        >
          <Text style={{ color: colors.accent, fontSize: 26, fontWeight: '900' }}>M</Text>
        </Animated.View>
      </View>
      {label ? <Text style={{ color: colors.text3, fontSize: 13, marginTop: 18 }}>{label}</Text> : null}
    </View>
  );
}

/* ── Skeletons ──────────────────────────────────────────── */

/** A shimmering placeholder block. */
export function Skeleton({ width = '100%', height = 14, r = 6, style }: { width?: number | string; height?: number; r?: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [p]);
  const a = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0.45, 1]) }));
  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius: r, backgroundColor: colors.bg4 }, a, style]}
    />
  );
}

function SkeletonCard({ lines = 3, hero }: { lines?: number; hero?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.bg2,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton width="38%" height={16} />
        {hero ? <Skeleton width={74} height={22} r={radiusSm} /> : null}
      </View>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '62%' : '100%'} height={12} />
      ))}
    </View>
  );
}

/** Page-shaped placeholder shown while a screen's first load is in flight. */
export function ScreenSkeleton({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, paddingTop: 64, gap: 14 }}>
      <View style={{ gap: 8, marginBottom: 2 }}>
        <Skeleton width="52%" height={28} r={8} />
        <Skeleton width="34%" height={12} />
      </View>
      <SkeletonCard hero lines={3} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><SkeletonCard lines={2} /></View>
        <View style={{ flex: 1 }}><SkeletonCard lines={2} /></View>
      </View>
      <SkeletonCard lines={4} />
      {label ? (
        <Text style={{ color: colors.text3, fontSize: 12, textAlign: 'center', marginTop: 4 }}>{label}</Text>
      ) : null}
    </View>
  );
}

/* ── Success ────────────────────────────────────────────── */

/** Circle that pops in, draws a ripple, and shows a check. */
export function SuccessCheck({ size = 56, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const c = color ?? colors.green;
  const pop = useSharedValue(0);
  const ripple = useSharedValue(0);
  useEffect(() => {
    pop.value = withSpring(1, { damping: 9, stiffness: 150 });
    ripple.value = withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
  }, [pop, ripple]);
  const circle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }], opacity: pop.value }));
  const wave = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 1], [0.5, 0]),
    transform: [{ scale: interpolate(ripple.value, [0, 1], [1, 1.9]) }],
  }));
  return (
    <View style={{ width: size * 1.9, height: size * 1.9, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: c }, wave]}
      />
      <Animated.View
        style={[
          { width: size, height: size, borderRadius: size / 2, backgroundColor: c, alignItems: 'center', justifyContent: 'center' },
          circle,
        ]}
      >
        <Icon name="check" size={size * 0.52} color="#fff" />
      </Animated.View>
    </View>
  );
}

/* ── Numbers ────────────────────────────────────────────── */

/** Counts smoothly from the previous value to the new one. */
export function AnimatedNumber({
  value,
  format,
  style,
  duration = 650,
}: {
  value: number;
  format: (n: number) => string;
  style?: any;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(start + (value - start) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration]);
  return <Text style={style}>{format(shown)}</Text>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
