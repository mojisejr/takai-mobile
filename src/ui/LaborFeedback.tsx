import type { ReactNode } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../theme/tokens';
import { PrimaryButton } from './PrimaryButton';
import type { PressHandler } from './types';

export function FeedbackToast({ message, onDismiss, visible }: { visible: boolean; message: string; onDismiss?: PressHandler }) {
  if (!visible) return null;
  return <Pressable accessibilityLabel="ปิดข้อความยืนยัน" onPress={onDismiss} style={styles.toast}><Text style={styles.toastMark}>✓</Text><Text style={styles.toastText}>{message}</Text></Pressable>;
}

export function FormFeedback({ children, kind = 'error' }: { children: ReactNode; kind?: 'error' | 'success' | 'notice' }) {
  return <View accessibilityLiveRegion="polite" style={[styles.formFeedback, styles[`formFeedback${kind}`]]}><Text style={[styles.formFeedbackText, kind === 'error' && styles.errorText]}>{children}</Text></View>;
}

/** Consequential actions may use this sheet in a later command phase. Cancel never performs a write. */
export function ConfirmActionSheet({ cancelLabel = 'กลับไปแก้ไข', confirmDisabled = false, confirmLabel, detail, onCancel, onConfirm, title, visible }: { visible: boolean; title: string; detail: string; confirmLabel: string; cancelLabel?: string; confirmDisabled?: boolean; onCancel: PressHandler; onConfirm: PressHandler }) {
  return <Modal animationType="slide" onRequestClose={onCancel} presentationStyle="overFullScreen" transparent visible={visible}><View style={styles.backdrop}><View style={styles.sheet}><View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>{title}</Text><Text style={styles.sheetDetail}>{detail}</Text><PrimaryButton disabled={confirmDisabled} label={confirmLabel} onPress={onConfirm} /><PrimaryButton disabled={confirmDisabled} label={cancelLabel} onPress={onCancel} variant="secondary" /></View></View></Modal>;
}

export function ScreenSkeleton({ lines = 3 }: { lines?: number }) {
  return <View accessibilityLabel="กำลังโหลด" style={styles.skeleton}><View style={styles.skeletonTitle} />{Array.from({ length: lines }, (_, index) => <View key={index} style={styles.skeletonRow}><View style={styles.skeletonDot} /><View style={styles.skeletonLine} /></View>)}</View>;
}

export function TakaiMascot({ size = 80 }: { size?: number }) {
  return <Image accessible={false} resizeMode="contain" source={require('../../assets/brand/takai-mascot-bust.png')} style={{ height: size, width: size }} />;
}

export function ActionEmptyState({ actionLabel, detail, onAction, title, withMascot = false }: { title: string; detail: string; actionLabel?: string; onAction?: PressHandler; withMascot?: boolean }) {
  return <View style={styles.empty}>{withMascot ? <TakaiMascot /> : null}<Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text>{actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}</View>;
}

const styles = StyleSheet.create({
  toast: { alignItems: 'center', backgroundColor: tokens.color.primary.green, borderRadius: tokens.radius.card, bottom: 82, flexDirection: 'row', gap: 8, left: tokens.spacing.page, paddingHorizontal: 14, paddingVertical: 12, position: 'absolute', right: tokens.spacing.page, zIndex: 10 },
  toastMark: { color: tokens.color.text.inverse, fontSize: 18, fontWeight: '700' }, toastText: { color: tokens.color.text.inverse, flex: 1, fontSize: tokens.typography.metadata.size, fontWeight: '700' },
  formFeedback: { borderRadius: tokens.radius.button, borderWidth: 1, padding: 12 }, formFeedbackerror: { backgroundColor: '#FFF3F0', borderColor: tokens.color.state.danger }, formFeedbacksuccess: { backgroundColor: '#EAF4EA', borderColor: tokens.color.primary.green }, formFeedbacknotice: { backgroundColor: '#FFF9E8', borderColor: tokens.color.state.warning }, formFeedbackText: { color: tokens.color.text.primary, fontSize: tokens.typography.body.size, lineHeight: 22 }, errorText: { color: tokens.color.state.danger },
  backdrop: { backgroundColor: 'rgba(31,45,31,0.35)', flex: 1, justifyContent: 'flex-end' }, sheet: { backgroundColor: tokens.color.surface.sand, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 12, padding: tokens.spacing.page }, sheetHandle: { alignSelf: 'center', backgroundColor: tokens.color.border.soft, borderRadius: 4, height: 4, width: 40 }, sheetTitle: { color: tokens.color.text.primary, fontSize: tokens.typography.h2.size, fontWeight: '700', marginTop: 4 }, sheetDetail: { color: tokens.color.text.muted, fontSize: tokens.typography.body.size, lineHeight: 23, marginBottom: 4 },
  skeleton: { gap: 12, paddingVertical: 24 }, skeletonTitle: { backgroundColor: '#EAF4EA', borderRadius: 6, height: 20, width: '56%' }, skeletonRow: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.card, borderWidth: 1, flexDirection: 'row', gap: 10, height: 60, paddingHorizontal: tokens.spacing.row }, skeletonDot: { backgroundColor: '#EAF4EA', borderRadius: 12, height: 24, width: 24 }, skeletonLine: { backgroundColor: '#EAF4EA', borderRadius: 6, flex: 1, height: 14 },
  empty: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.card, borderWidth: 1, gap: 8, padding: 20 }, emptyTitle: { color: tokens.color.text.primary, fontSize: tokens.typography.h3.size, fontWeight: '700', textAlign: 'center' }, emptyDetail: { color: tokens.color.text.muted, fontSize: tokens.typography.body.size, lineHeight: 23, textAlign: 'center' },
});
