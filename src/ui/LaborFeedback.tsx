import type { ReactNode } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { tokens } from '../theme/tokens';
import { typographyStyle } from '../theme/typography';
import { PrimaryButton } from './PrimaryButton';
import type { PressHandler } from './types';

export function FeedbackToast({ message, onDismiss, visible }: { visible: boolean; message: string; onDismiss?: PressHandler }) {
  if (!visible) return null;
  return <Modal animationType="fade" onRequestClose={onDismiss} presentationStyle="overFullScreen" transparent visible><View style={styles.feedbackBackdrop}><View style={styles.feedbackDialog}><Text style={styles.feedbackMark}>✓</Text><Text style={styles.feedbackTitle}>แจ้งผลการทำรายการ</Text><Text style={styles.feedbackText}>{message}</Text><PrimaryButton label="ปิด" onPress={onDismiss ?? (() => undefined)} /></View></View></Modal>;
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
  feedbackBackdrop: { alignItems: 'center', backgroundColor: 'rgba(31,45,31,0.35)', flex: 1, justifyContent: 'center', padding: tokens.spacing.page }, feedbackDialog: { alignItems: 'stretch', backgroundColor: tokens.color.surface.card, borderRadius: tokens.radius.card, gap: 12, maxWidth: 420, padding: tokens.spacing.card, width: '100%', ...tokens.depth.card }, feedbackMark: { alignSelf: 'center', color: tokens.color.primary.green, fontSize: 34, fontWeight: '800' }, feedbackTitle: { color: tokens.color.text.primary, textAlign: 'center', ...typographyStyle('h2') }, feedbackText: { color: tokens.color.text.muted, lineHeight: 23, textAlign: 'center', ...typographyStyle('body') },
  formFeedback: { borderRadius: tokens.radius.row, borderWidth: 1, padding: 12 }, formFeedbackerror: { backgroundColor: '#FFF3F0', borderColor: tokens.color.state.danger }, formFeedbacksuccess: { backgroundColor: tokens.color.surface.sage, borderColor: tokens.color.primary.green }, formFeedbacknotice: { backgroundColor: '#FFF9E8', borderColor: tokens.color.state.warning }, formFeedbackText: { color: tokens.color.text.primary, lineHeight: 22, ...typographyStyle('body') }, errorText: { color: tokens.color.state.danger },
  backdrop: { backgroundColor: 'rgba(31,45,31,0.35)', flex: 1, justifyContent: 'flex-end' }, sheet: { backgroundColor: tokens.color.surface.sand, borderTopLeftRadius: tokens.radius.hero, borderTopRightRadius: tokens.radius.hero, gap: 12, padding: tokens.spacing.card }, sheetHandle: { alignSelf: 'center', backgroundColor: tokens.color.border.soft, borderRadius: 4, height: 4, width: 40 }, sheetTitle: { color: tokens.color.text.primary, marginTop: 4, ...typographyStyle('h2') }, sheetDetail: { color: tokens.color.text.muted, lineHeight: 23, marginBottom: 4, ...typographyStyle('body') },
  skeleton: { gap: 12, paddingVertical: 24 }, skeletonTitle: { backgroundColor: tokens.color.surface.sage, borderRadius: 6, height: 20, width: '56%' }, skeletonRow: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.row, borderWidth: 1, flexDirection: 'row', gap: 10, height: 60, paddingHorizontal: tokens.spacing.row }, skeletonDot: { backgroundColor: tokens.color.surface.sage, borderRadius: 12, height: 24, width: 24 }, skeletonLine: { backgroundColor: tokens.color.surface.sage, borderRadius: 6, flex: 1, height: 14 },
  empty: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.card, borderWidth: 1, gap: 8, padding: tokens.spacing.card }, emptyTitle: { color: tokens.color.text.primary, textAlign: 'center', ...typographyStyle('h3') }, emptyDetail: { color: tokens.color.text.muted, lineHeight: 23, textAlign: 'center', ...typographyStyle('body') },
});
