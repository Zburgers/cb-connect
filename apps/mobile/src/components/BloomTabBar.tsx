import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, I18nManager, Keyboard, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurTargetView, BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { mobileColors, type MobilePalette } from "../theme/tokens";
import { bloomFonts } from "../theme/typography";
import { BloomText } from "./BloomText";
import { canUseBloomBlur, getBloomDockGeometry, isBloomDockRoute } from "./bloomDockModel";
import { BloomDockInsetContext } from "./bloomDockContext";

type NavigatorLayoutProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["layout"]>>[0];
type LayoutProps = NavigatorLayoutProps & {
  children: React.ReactNode;
  dark: boolean;
  showDock: boolean;
};

/** Navigator scenes are the blur target; the dock is its sibling, never its child. */
export function BloomTabLayout({ children, dark, showDock, ...navigationProps }: LayoutProps): React.JSX.Element {
  const blurTarget = useRef<View>(null);
  const palette = dark ? mobileColors.dark : mobileColors.light;
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const count = navigationProps.state.routes.filter((route) => isBloomDockRoute(route.name)).length;
  const geometry = getBloomDockGeometry(width - insets.left - insets.right, fontScale, count);
  const bottomInset = showDock && !keyboardVisible ? geometry.height + insets.bottom + 24 : 0;
  return <BloomDockInsetContext.Provider value={bottomInset}><View style={styles.fill}>
    <BlurTargetView ref={blurTarget} style={styles.fill}>
      <LinearGradient colors={palette.atmosphere} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {children}
    </BlurTargetView>
    {showDock ? <BloomTabBar {...navigationProps} dark={dark} palette={palette} blurTarget={blurTarget} keyboardVisible={keyboardVisible} /> : null}
  </View></BloomDockInsetContext.Provider>;
}

function useMaterialPreferences() {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    const transparency = Platform.OS === "ios" ? AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduceTransparency) : null;
    if (Platform.OS === "ios") void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => { if (mounted) setReduceTransparency(value); }).catch(() => { if (mounted) setReduceTransparency(true); });
    return () => { mounted = false; motion.remove(); transparency?.remove(); };
  }, []);
  return { reduceMotion, reduceTransparency };
}

export function BloomTabBar({ state, descriptors, navigation, dark, palette, blurTarget, keyboardVisible = false }: Omit<LayoutProps, "children" | "showDock"> & {
  palette: MobilePalette;
  blurTarget: React.RefObject<View | null>;
  keyboardVisible?: boolean;
}): React.JSX.Element | null {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { reduceMotion, reduceTransparency } = useMaterialPreferences();
  // The navigator layout's generic helper erases its tab event map.
  const tabNavigation = navigation as BottomTabBarProps["navigation"];
  const routes = state.routes.filter((route) => isBloomDockRoute(route.name));
  const geometry = getBloomDockGeometry(width - insets.left - insets.right, fontScale, routes.length);
  const activeKey = state.routes[state.index]?.key;
  const activeIndex = routes.findIndex((route) => route.key === activeKey);
  const column = activeIndex < 0 ? 0 : activeIndex % geometry.columns;
  const x = (I18nManager.isRTL ? geometry.columns - 1 - column : column) * geometry.itemWidth;
  const y = activeIndex < 0 ? 0 : Math.floor(activeIndex / geometry.columns) * geometry.itemHeight;
  const position = useRef(new Animated.ValueXY({ x, y })).current;
  const blur = canUseBloomBlur(Platform.OS, Platform.Version, reduceTransparency);

  useEffect(() => {
    position.stopAnimation();
    if (reduceMotion) { position.setValue({ x, y }); return; }
    const animation = Animated.spring(position, { toValue: { x, y }, stiffness: 260, damping: 28, mass: 1, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [position, x, y, reduceMotion]);

  if (keyboardVisible || routes.length === 0) return null;

  return <View pointerEvents="box-none" style={[styles.overlay, { bottom: insets.bottom + 12, left: insets.left, right: insets.right }]}>
    <View style={[styles.shadow, { width: geometry.width, borderRadius: geometry.largeText ? 26 : 40, shadowColor: palette.foreground }]}>
      <View testID="bloom-glass-dock" style={[styles.dock, { minHeight: geometry.height, borderRadius: geometry.largeText ? 26 : 40, borderColor: palette.rim, backgroundColor: blur ? palette.dockTint : palette.surface }]}>
        {blur ? <BlurView blurTarget={blurTarget} blurMethod="dimezisBlurViewSdk31Plus" intensity={40} blurReductionFactor={2} tint={dark ? "systemUltraThinMaterialDark" : "systemUltraThinMaterialLight"} pointerEvents="none" style={StyleSheet.absoluteFill} /> : null}
        <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.tint, { backgroundColor: blur ? palette.dockTint : palette.surface }]} />
        <LinearGradient pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" colors={palette.reflection} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reflection} />
        <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.innerRim, { borderColor: palette.rim, borderRadius: geometry.largeText ? 23 : 37 }]} />
        {activeIndex >= 0 ? <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.selection, { width: geometry.itemWidth, height: geometry.itemHeight, borderRadius: geometry.largeText ? 18 : 33, backgroundColor: palette.dockSelection, borderColor: palette.rim, transform: position.getTranslateTransform() }]}>
          <LinearGradient colors={[palette.rim, "transparent"]} pointerEvents="none" style={styles.selectionReflection} />
        </Animated.View> : null}
        <View style={styles.items} accessibilityRole="tablist">
          {routes.map((route) => {
            const options = descriptors[route.key].options;
            const focused = route.key === activeKey;
            const color = focused ? palette.accent : palette.foreground;
            const label = typeof options.tabBarLabel === "string" ? options.tabBarLabel : options.title ?? route.name;
            return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={options.tabBarAccessibilityLabel ?? label} testID={options.tabBarButtonTestID} onPress={() => {
              const event = tabNavigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) tabNavigation.navigate(route.name, route.params);
            }} onLongPress={() => tabNavigation.emit({ type: "tabLongPress", target: route.key })} style={({ pressed }) => [styles.item, { width: geometry.itemWidth, minHeight: geometry.itemHeight, opacity: pressed ? 0.68 : 1 }]}>
              {!geometry.largeText ? <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{options.tabBarIcon?.({ focused, color, size: 22 })}</View> : null}
              <BloomText style={[styles.label, { color, fontFamily: focused ? bloomFonts.semibold : bloomFonts.medium, fontSize: geometry.largeText ? 14 : 12 }]}>{label}</BloomText>
            </Pressable>;
          })}
        </View>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { position: "absolute", alignItems: "center" },
  shadow: { shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 },
  dock: { padding: 6, borderWidth: 1, overflow: "hidden" },
  tint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  reflection: { position: "absolute", left: 0, right: 0, top: 0, height: 19 },
  innerRim: { position: "absolute", top: 2, left: 2, right: 2, bottom: 2, borderWidth: StyleSheet.hairlineWidth },
  items: { flexDirection: "row", flexWrap: "wrap" },
  selection: { position: "absolute", left: 6, top: 6, borderWidth: 1, overflow: "hidden" },
  selectionReflection: { position: "absolute", top: 0, left: 0, right: 0, height: 14 },
  item: { justifyContent: "center", alignItems: "center", paddingHorizontal: 4, paddingVertical: 7, gap: 3 },
  label: { textAlign: "center", lineHeight: 18, flexShrink: 1 },
});
