/**
 * Motion kit — loaders and small animations built on Reanimated.
 *
 * The loaders are ports of the web app's (css/08-motion.css + js/core/motion.js):
 * same timings, easings, geometry and copy, so a screen loads the same way on
 * both. Gradients (the spinner's conic arc, the shimmer sweep, the progress
 * bar, the splash glow) are built from plain Views, so no native gradient
 * module is needed and this ships over the air.
 *
 * Everything honours the OS "reduce motion" setting (Reanimated's default
 * ReduceMotion.System); spinners keep turning, slowly, like the web's.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Platform,
  StyleSheet,
  useWindowDimensions,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  type EasingFunction,
  type EasingFunctionFactory,
  FadeIn,
  Keyframe,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, radius } from '../theme';
import { Icon } from './Icon';

/* web --ease-spring / ease-in-out / ease-out */
const EASE_SPRING = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);
const SPINNER_EASE = Easing.bezier(0.5, 0.2, 0.5, 0.8);

/** True once `on` has been continuously true for `ms` — avoids flashing a loader on fast responses. */
export function useDelayedFlag(on: boolean, ms: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(true), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return shown;
}

/* ── Entrance ───────────────────────────────────────────── */

/**
 * Rise-in on mount (web `riseIn`: 0.55s, translateY 14 + scale .985, ease-spring).
 * `index` staggers siblings like the web's nth-child delays (.06 → .28s, then flat).
 * `variant="up"` is the page header's `fadeUp` (0.45s, translateY 16, no delay).
 */
export function Reveal({
  index = 0,
  variant = 'rise',
  children,
  style,
}: {
  index?: number;
  variant?: 'rise' | 'up';
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const entering = useMemo(() => {
    if (variant === 'up') {
      return new Keyframe({
        0: { opacity: 0, transform: [{ translateY: 16 }] },
        100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_SPRING },
      }).duration(450);
    }
    const delay = index <= 0 ? 0 : Math.min(60 + (index - 1) * 80, 280);
    return new Keyframe({
      0: { opacity: 0, transform: [{ translateY: 14 }, { scale: 0.985 }] },
      100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: EASE_SPRING },
    })
      .delay(delay)
      .duration(550);
  }, [index, variant]);
  return (
    <Animated.View entering={entering} style={style}>
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

/* ── Spinners ───────────────────────────────────────────── */

/**
 * The web's conic-gradient arc: transparent for the first `start` of the turn,
 * then fading up to solid `color` at the head. Drawn as short radial dashes of
 * rising opacity on a rotating ring (a conic gradient needs a native module).
 */
function CometRing({
  size,
  thickness,
  start,
  color,
  duration,
  easing = Easing.linear,
  reverse,
  opacity = 1,
}: {
  size: number;
  thickness: number;
  start: number;
  color: string;
  duration: number;
  easing?: EasingFunction | EasingFunctionFactory;
  reverse?: boolean;
  opacity?: number;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withRepeat(
      withTiming(1, { duration: reduced ? duration * 3.2 : duration, easing, reduceMotion: ReduceMotion.Never }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [p, duration, easing, reduced]);
  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(reverse ? -1 : 1) * p.value * 360}deg` }],
  }));

  const dashes = useMemo(() => {
    const N = 14;
    const span = 1 - start;
    const rMid = (size - thickness) / 2;
    const w = 2 * Math.PI * rMid * (span / N) + 0.8;
    return Array.from({ length: N }, (_, k) => {
      const f = (k + 0.5) / N;
      return { k, w, angle: (start + f * span) * 360, alpha: f };
    });
  }, [size, thickness, start]);

  return (
    <Animated.View style={[{ width: size, height: size, opacity }, spin]} pointerEvents="none">
      {dashes.map((d) => (
        <View
          key={d.k}
          style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, transform: [{ rotate: `${d.angle}deg` }] }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: (size - d.w) / 2,
              width: d.w,
              height: thickness,
              borderRadius: thickness / 2,
              backgroundColor: color,
              opacity: d.alpha,
            }}
          />
        </View>
      ))}
    </Animated.View>
  );
}

/**
 * Web `.spinner` — gradient arc, 16px (or `large`: 30px), 0.75s with the
 * cubic-bezier(.5,.2,.5,.8) turn. Fades in after 120ms like `.loading`.
 */
export function Spinner({ size = 16, large, color }: { size?: number; large?: boolean; color?: string }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn.delay(120).duration(250)}>
      <CometRing
        size={large ? 30 : size}
        thickness={large ? 3 : 2}
        start={0.25}
        color={color ?? colors.accent}
        duration={750}
        easing={SPINNER_EASE}
      />
    </Animated.View>
  );
}

/** Web `.btn.is-loading::before` — a 13px ring with a gap, 0.6s linear. */
export function ButtonSpinner({ color }: { color: string }) {
  const p = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    p.value = withRepeat(
      withTiming(1, { duration: reduced ? 1900 : 600, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [p, reduced]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 360}deg` }] }));
  return (
    <Animated.View
      style={[
        {
          width: 13,
          height: 13,
          borderRadius: 7,
          borderWidth: 2,
          borderColor: color,
          borderRightColor: 'transparent',
          opacity: 0.85,
        },
        a,
      ]}
    />
  );
}

/** Web `.dots` — three bouncing dots (1.1s, staggered .14s). */
export function DotsLoader({ color, size = 5 }: { color: string; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} i={i} color={color} size={size} />
      ))}
    </View>
  );
}

function Dot({ i, color, size }: { i: number; color: string; size: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    // dotBounce: rest 0–35%… peak at 35%, back to rest by 70%, hold to 100%
    p.value = withDelay(
      i * 140,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 385, easing: EASE_IN_OUT }),
          withTiming(0, { duration: 385, easing: EASE_IN_OUT }),
          withTiming(0, { duration: 330 }),
        ),
        -1,
        false,
      ),
    );
  }, [i, p]);
  const a = useAnimatedStyle(() => ({
    opacity: 0.35 + p.value * 0.65,
    transform: [{ translateY: -p.value * 4 }],
  }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, a]} />;
}

/* ── Route progress bar ─────────────────────────────────── */

/*
 * Web `#route-bar`: a 3px accent bar that trickles toward 90% while something
 * loads and snaps to 100% when it finishes. begin()/end() are counted, so
 * nested loads (a screen plus its refetch) don't end it early.
 */
type ProgressEvent = 'start' | 'done';
const progressListeners = new Set<(e: ProgressEvent) => void>();
let progressPending = 0;

export const routeProgress = {
  begin() {
    if (progressPending++ === 0) progressListeners.forEach((l) => l('start'));
  },
  end() {
    if (progressPending === 0 || --progressPending > 0) return;
    progressListeners.forEach((l) => l('done'));
  },
};

/** Shows the top progress bar while `active` is true. */
export function useRouteProgress(active: boolean) {
  useEffect(() => {
    if (!active) return;
    routeProgress.begin();
    return () => routeProgress.end();
  }, [active]);
}

const BAR_STOPS = ['#b8914a', '#d4a853', '#f0d28f']; // accent2 → accent → #f0d28f
function lerpHex(a: string, b: string, t: number): string {
  const c = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const m = (i: number) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}
const BAR_STRIPS = Array.from({ length: 24 }, (_, i) => {
  const t = i / 23;
  return t < 0.5 ? lerpHex(BAR_STOPS[0], BAR_STOPS[1], t * 2) : lerpHex(BAR_STOPS[1], BAR_STOPS[2], (t - 0.5) * 2);
});

/** Mount once near the root, inside the SafeAreaProvider. */
export function RouteProgress() {
  const insets = useSafeAreaInsets();
  const x = useSharedValue(0);
  const op = useSharedValue(0);

  useEffect(() => {
    let cur = 0;
    let trickle: ReturnType<typeof setInterval> | null = null;
    let hide: ReturnType<typeof setTimeout> | null = null;
    const set = (v: number) => {
      cur = v;
      x.value = withTiming(v, { duration: 250, easing: EASE_OUT });
    };
    const on = (e: ProgressEvent) => {
      if (e === 'start') {
        if (hide) clearTimeout(hide);
        x.value = 0; // reset without a transition
        cur = 0;
        op.value = withDelay(50, withTiming(1, { duration: 300 }));
        set(0.08);
        trickle = setInterval(() => set(cur + (0.9 - cur) * 0.12), 220);
      } else {
        if (trickle) clearInterval(trickle);
        trickle = null;
        set(1);
        hide = setTimeout(() => {
          op.value = withDelay(50, withTiming(0, { duration: 300 }));
        }, 220);
      }
    };
    progressListeners.add(on);
    if (progressPending > 0) on('start');
    return () => {
      progressListeners.delete(on);
      if (trickle) clearInterval(trickle);
      if (hide) clearTimeout(hide);
    };
  }, [x, op]);

  const bar = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scaleX: x.value }] }));
  return (
    <View pointerEvents="none" style={[styles.routeBar, { top: insets.top }]}>
      <Animated.View
        style={[
          { flex: 1, flexDirection: 'row', transformOrigin: 'left center' },
          Platform.OS === 'ios' ? { shadowColor: '#d4a853', shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } } : null,
          bar,
        ]}
      >
        {BAR_STRIPS.map((c, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: c }} />
        ))}
      </Animated.View>
    </View>
  );
}

/* ── Boot splash ────────────────────────────────────── */

const SPLASH_MESSAGES = ['Loading your workspace…', 'Syncing meals and expenses…', 'Preparing your dashboard…'];
const SPLASH_DELAY = 160; // don't flash the splash on fast loads
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const SPLASH_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 1.04 }], easing: EASE_SPRING },
}).duration(380);

/** Soft radial glow behind the splash: nested translucent ellipses (web `radial-gradient(ellipse 60% 50% at 50% 42%)`). */
function SplashGlow() {
  const { colors } = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const K = 10;
  const rx = 0.6 * W * 0.7; // fades to transparent at 70% of the radius
  const ry = 0.5 * H * 0.7;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: K }, (_, i) => {
        const d = (2 * rx * (i + 1)) / K;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: W / 2 - d / 2,
              top: 0.42 * H - d / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: colors.accent,
              opacity: 0.14 / K,
              transform: [{ scaleY: ry / rx }],
            }}
          />
        );
      })}
    </View>
  );
}

function SplashMark() {
  const { colors } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    // markPulse: 2s ease-in-out, 0 → 50% → 0
    p.value = withRepeat(withTiming(1, { duration: 1000, easing: EASE_IN_OUT }), -1, true);
  }, [p]);
  const logo = useAnimatedStyle(() => ({ transform: [{ scale: 1 + p.value * 0.06 }] }));
  const ripple = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - p.value),
    transform: [{ scale: 1 + p.value * (28 / 48) }],
  }));
  return (
    <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
      <View style={styles.centerAbs}>
        <CometRing size={90} thickness={2} start={0.3} color={colors.accent} duration={1900} reverse opacity={0.35} />
      </View>
      <View style={styles.centerAbs}>
        <CometRing size={72} thickness={2} start={0.3} color={colors.accent} duration={1100} />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: 48, height: 48, borderRadius: 13, backgroundColor: colors.accent }, ripple]}
      />
      <Animated.View
        style={[
          {
            width: 48,
            height: 48,
            borderRadius: 13,
            backgroundColor: '#161616',
            borderWidth: 1,
            borderColor: colors.border2,
            shadowColor: '#000',
            shadowOpacity: 0.5,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          },
          logo,
        ]}
      >
        <Image source={require('../../assets/icon.png')} style={{ width: 46, height: 46, borderRadius: 12 }} />
      </Animated.View>
    </View>
  );
}

/** Web `.splash-track`: a 140×3 track with a soft highlight sliding across. */
function SplashTrack() {
  const { colors } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1200, easing: EASE_IN_OUT }), -1, false);
  }, [p]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(p.value, [0, 1], [-56, 196]) }] }));
  const prof = [0.15, 0.5, 0.85, 1, 0.85, 0.5, 0.15];
  return (
    <View style={{ width: 140, height: 3, borderRadius: 99, backgroundColor: colors.bg4, overflow: 'hidden' }}>
      <Animated.View style={[{ width: 56, height: 3, flexDirection: 'row' }, a]}>
        {prof.map((o, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: colors.accent, opacity: o }} />
        ))}
      </Animated.View>
    </View>
  );
}

/** Rotating status line; cross-fades every 1.4s like the web. */
function SplashMessage() {
  const { colors } = useTheme();
  const [i, setI] = useState(0);
  const op = useSharedValue(1);
  useEffect(() => {
    const id = setInterval(() => {
      op.value = withTiming(0, { duration: 250 });
      setTimeout(() => {
        setI((n) => (n + 1) % SPLASH_MESSAGES.length);
        op.value = withTiming(1, { duration: 250 });
      }, 230);
    }, 1400);
    return () => clearInterval(id);
  }, [op]);
  const a = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <Animated.Text style={[{ color: colors.text3, fontSize: 12.5, minHeight: 18 }, a]}>{SPLASH_MESSAGES[i]}</Animated.Text>
  );
}

/** Full-screen branded loader — the web's boot splash (rings, pulsing mark, sliding track, rotating copy). */
export function BrandLoader(_props: { label?: string }) {
  const { colors } = useTheme();
  useRouteProgress(true);
  const show = useDelayedFlag(true, SPLASH_DELAY);
  if (!show) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={SPLASH_OUT}
      style={[styles.fill, { backgroundColor: colors.bg, gap: 22 }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading MessManager"
    >
      <SplashGlow />
      <SplashMark />
      <Text style={{ color: colors.text, fontFamily: SERIF, fontSize: 22, letterSpacing: -0.4 }}>MessManager</Text>
      <SplashTrack />
      <SplashMessage />
    </Animated.View>
  );
}

/* ── Skeletons ──────────────────────────────────────────── */

const SHIMMER_PROFILE = [0.1, 0.3, 0.55, 0.8, 1, 0.8, 0.55, 0.3, 0.1]; // transparent → peak → transparent

/** Web `.sk`: a bg4 block with a light band sweeping across every 1.5s. */
export function Skeleton({ width = '100%', height = 14, r = 6, style }: { width?: number | string; height?: number; r?: number; style?: ViewStyle }) {
  const { colors, scheme } = useTheme();
  const [w, setW] = useState(0);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1500, easing: EASE_IN_OUT }), -1, false);
  }, [p]);
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: -w + 2 * w * p.value }] }));
  const peak = scheme === 'light' ? 0.7 : 0.07;
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ width: width as any, height, borderRadius: r, backgroundColor: colors.bg4, overflow: 'hidden' }, style]}
    >
      {w > 0 ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: w, flexDirection: 'row' }, band]}>
          {SHIMMER_PROFILE.map((o, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: `rgba(255,255,255,${(o * peak).toFixed(3)})` }} />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

function SkeletonCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.bg2,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius,
        padding: 16,
      }}
    >
      {children}
    </View>
  );
}

function SkeletonRow({ last }: { last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <Skeleton width={34} height={34} r={17} />
      <View style={{ flex: 1 }}>
        <Skeleton height={10} />
      </View>
      <Skeleton width={70} height={10} />
    </View>
  );
}

/**
 * Web `pageSkeleton()`: a title + subtitle, four stat tiles and two list cards,
 * on the same geometry as the real page so nothing jumps when data lands.
 * Fades in after 100ms so quick loads never show it.
 */
export function ScreenSkeleton({ label }: { label?: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useRouteProgress(true);
  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(200)}
      style={{ flex: 1, backgroundColor: colors.bg, padding: 16, paddingTop: insets.top + 14, gap: 14 }}
      accessibilityLabel={label ?? 'Loading page'}
      accessibilityState={{ busy: true }}
    >
      <View>
        <Skeleton width="60%" height={22} style={{ maxWidth: 200, marginBottom: 8 }} />
        <Skeleton width="80%" height={11} style={{ maxWidth: 280 }} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: '47.8%' }}>
            <SkeletonCard>
              <Skeleton width="45%" height={9} />
              <Skeleton width="55%" height={24} style={{ marginTop: 10 }} />
            </SkeletonCard>
          </View>
        ))}
      </View>
      {[0, 1].map((c) => (
        <SkeletonCard key={c}>
          <Skeleton width="30%" height={12} style={{ marginBottom: 16 }} />
          {[0, 1, 2, 3].map((r) => (
            <SkeletonRow key={r} last={r === 3} />
          ))}
        </SkeletonCard>
      ))}
    </Animated.View>
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
  centerAbs: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  routeBar: { position: 'absolute', left: 0, right: 0, height: 3, zIndex: 2000 },
});
