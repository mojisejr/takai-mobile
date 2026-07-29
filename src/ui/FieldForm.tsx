import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { tokens } from '../theme/tokens';
import { PrimaryButton } from './PrimaryButton';
import { filterPickerOptions, recentPickerOptions, type PickerOption } from './pickerOptions';
import { SectionHeader } from './SectionHeader';
import type { PressHandler } from './types';

export function PickerField({ label, onPress, placeholder, value }: {
  label: string;
  value?: string | null;
  placeholder: string;
  onPress: PressHandler;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.pickerField, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={[styles.pickerValue, !value && styles.placeholder]}>{value || placeholder}</Text>
        <Text style={styles.chevron}>เลือก</Text>
      </Pressable>
    </View>
  );
}

export function FormSection({ children, title }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function SearchPickerSheet({
  emptyLabel,
  onClose,
  onPick,
  options,
  query,
  quickAdd,
  recentIds,
  setQuery,
  title,
  visible,
}: {
  visible: boolean;
  title: string;
  query: string;
  setQuery: (value: string) => void;
  options: PickerOption[];
  recentIds: string[];
  onPick: (id: string) => void;
  onClose: PressHandler;
  emptyLabel: string;
  quickAdd?: ReactNode;
}) {
  const filtered = filterPickerOptions(options, query);
  const recents = recentPickerOptions(options, recentIds);
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={onClose}><Text style={styles.close}>ปิด</Text></Pressable>
          </View>
          <TextInput
            autoFocus
            onChangeText={setQuery}
            placeholder="พิมพ์เพื่อค้นหา"
            placeholderTextColor={tokens.color.text.muted}
            style={styles.searchInput}
            value={query}
          />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.results}>
            {!query.trim() && recents.length ? <PickerGroup label="ใช้ล่าสุด" onPick={onPick} options={recents} /> : null}
            <PickerGroup label={query.trim() ? 'ผลการค้นหา' : 'ทั้งหมด'} onPick={onPick} options={filtered} emptyLabel={emptyLabel} />
            {quickAdd ? <View style={styles.quickAdd}>{quickAdd}</View> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PickerGroup({ emptyLabel, label, onPick, options }: { label: string; options: PickerOption[]; onPick: (id: string) => void; emptyLabel?: string }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      {options.length ? options.map((option) => (
        <Pressable accessibilityRole="button" key={option.id} onPress={() => onPick(option.id)} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
          <View style={styles.optionText}><Text style={styles.optionLabel}>{option.label}</Text>{option.meta ? <Text style={styles.optionMeta}>{option.meta}</Text> : null}</View>
          <Text style={styles.optionAction}>เลือก</Text>
        </Pressable>
      )) : <Text style={styles.empty}>{emptyLabel ?? 'ยังไม่มีรายการ'}</Text>}
    </View>
  );
}

export function StickySaveBar({ label, onPress }: { label: string; onPress: PressHandler }) {
  return <View style={styles.sticky}><PrimaryButton label={label} onPress={onPress} /></View>;
}

export type { PickerOption } from './pickerOptions';

const styles = StyleSheet.create({
  fieldGroup: { gap: 6 },
  label: { color: tokens.color.text.primary, fontSize: tokens.typography.metadata.size, fontWeight: '700' },
  pickerField: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.button, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 12 },
  pickerValue: { color: tokens.color.text.primary, flex: 1, fontSize: tokens.typography.body.size },
  placeholder: { color: tokens.color.text.muted },
  chevron: { color: tokens.color.primary.green, fontSize: tokens.typography.metadata.size, fontWeight: '700', marginLeft: 12 },
  section: { gap: 8 },
  sectionBody: { gap: 12 },
  backdrop: { backgroundColor: 'rgba(31,45,31,0.35)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: tokens.color.surface.sand, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%', padding: tokens.spacing.page },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: tokens.color.text.primary, fontSize: tokens.typography.h2.size, fontWeight: '700' },
  close: { color: tokens.color.primary.green, fontSize: tokens.typography.body.size, fontWeight: '700' },
  searchInput: { backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.button, borderWidth: 1, color: tokens.color.text.primary, fontSize: tokens.typography.body.size, minHeight: 48, paddingHorizontal: 12 },
  results: { marginTop: 12 },
  group: { gap: 2, marginBottom: 16 },
  groupLabel: { color: tokens.color.text.muted, fontSize: tokens.typography.metadata.size, fontWeight: '700', marginBottom: 4 },
  option: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderBottomColor: tokens.color.border.soft, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 12 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { color: tokens.color.text.primary, fontSize: tokens.typography.body.size },
  optionMeta: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size },
  optionAction: { color: tokens.color.primary.green, fontSize: tokens.typography.metadata.size, fontWeight: '700', marginLeft: 12 },
  empty: { color: tokens.color.text.muted, fontSize: tokens.typography.body.size, padding: 12 },
  quickAdd: { borderTopColor: tokens.color.border.soft, borderTopWidth: 1, gap: 10, paddingTop: 16 },
  sticky: { backgroundColor: tokens.color.surface.sand, borderTopColor: tokens.color.border.soft, borderTopWidth: 1, marginHorizontal: -tokens.spacing.page, padding: tokens.spacing.page },
  pressed: { opacity: 0.7 },
});
