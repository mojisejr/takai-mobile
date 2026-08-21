import { useState, type ReactNode } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { tokens } from '../theme/tokens';
import { typographyStyle } from '../theme/typography';
import { localDateKey } from '../date';
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

export function DatePickerField({ label, onChange, value }: { label: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  const selectDate = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setVisible(false);
    if (date) onChange(localDateKey(date));
  };
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'web' ? <TextInput keyboardType="numbers-and-punctuation" onChangeText={onChange} placeholder="YYYY-MM-DD" style={styles.dateInput} value={value} /> : <Pressable accessibilityRole="button" onPress={() => setVisible(true)} style={({ pressed }) => [styles.pickerField, pressed && styles.pressed]}><Text style={styles.pickerValue}>{formatThaiDate(value)}</Text><Text style={styles.chevron}>ปฏิทิน</Text></Pressable>}
      {visible ? <DateTimePicker display={Platform.OS === 'ios' ? 'inline' : 'default'} mode="date" onChange={selectDate} value={dateFromDayKey(value)} /> : null}
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
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={visible}>
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

/** Multi-select keeps choices in a searchable sheet; chips remain status-only. */
export function MultiSearchPickerSheet({
  emptyLabel,
  onClose,
  onToggle,
  options,
  query,
  selectedIds,
  setQuery,
  title,
  visible,
}: {
  visible: boolean;
  title: string;
  query: string;
  setQuery: (value: string) => void;
  options: PickerOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: PressHandler;
  emptyLabel: string;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const filtered = filterPickerOptions(options, query);
  const selected = selectedIds.map((id) => options.find((option) => option.id === id)).filter((option): option is PickerOption => Boolean(option));
  const detail = options.find((option) => option.id === detailId) ?? null;
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="overFullScreen" transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View><Text style={styles.sheetTitle}>{title}</Text><Text style={styles.selectionCount}>เลือกแล้ว {selected.length} คน</Text></View>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={onClose}><Text style={styles.close}>เสร็จ</Text></Pressable>
          </View>
          <TextInput autoFocus onChangeText={setQuery} placeholder="พิมพ์ค้นหาชื่อหรือความถนัด" placeholderTextColor={tokens.color.text.muted} style={styles.searchInput} value={query} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.results}>
            {selected.length ? <View style={styles.group}><Text style={styles.groupLabel}>ที่เลือก</Text>{selected.map((option) => <View key={`selected:${option.id}`} style={styles.option}><View style={styles.optionText}><Text style={styles.optionLabel}>{option.label}</Text>{option.meta ? <Text style={styles.optionMeta}>{option.meta}</Text> : null}</View><Pressable accessibilityLabel={`นำ ${option.label} ออก`} onPress={() => onToggle(option.id)}><Text style={styles.optionAction}>นำออก</Text></Pressable></View>)}</View> : null}
            {detail ? <View style={styles.detailCard}><View style={styles.sheetHeader}><Text style={styles.optionLabel}>ข้อมูลคนทำงาน</Text><Pressable accessibilityLabel="ปิดรายละเอียด" onPress={() => setDetailId(null)}><Text style={styles.close}>ปิด</Text></Pressable></View><Text style={styles.optionLabel}>{detail.label}</Text><Text style={styles.optionMeta}>{detail.meta || 'ยังไม่ได้ระบุงานที่ถนัด'}</Text></View> : null}
            <View style={styles.group}><Text style={styles.groupLabel}>{query.trim() ? 'ผลการค้นหา' : 'รายชื่อคนทำงาน'}</Text>{filtered.length ? filtered.map((option) => { const checked = selectedIds.includes(option.id); return <View key={option.id} style={styles.option}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onToggle(option.id)} style={styles.optionText}><Text style={styles.optionLabel}>{option.label}</Text>{option.meta ? <Text style={styles.optionMeta}>{option.meta}</Text> : null}</Pressable><Pressable accessibilityLabel={`ดูข้อมูล ${option.label}`} onPress={() => setDetailId(option.id)}><Text style={styles.optionAction}>ข้อมูล</Text></Pressable><Pressable accessibilityLabel={`${checked ? 'เอา' : 'เลือก'} ${option.label}`} onPress={() => onToggle(option.id)} style={[styles.checkbox, checked && styles.checkboxChecked]}><Text style={styles.checkboxText}>{checked ? '✓' : ''}</Text></Pressable></View>; }) : <Text style={styles.empty}>{emptyLabel}</Text>}</View>
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

export function StickySaveBar({ disabled, label, onPress }: { label: string; onPress: PressHandler; disabled?: boolean }) {
  return <View style={styles.sticky}><PrimaryButton disabled={disabled} label={label} onPress={onPress} /></View>;
}

export type { PickerOption } from './pickerOptions';

const styles = StyleSheet.create({
  fieldGroup: { gap: 6 },
  label: { color: tokens.color.text.primary, ...typographyStyle('metadata') },
  pickerField: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.row, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 14 },
  pickerValue: { color: tokens.color.text.primary, flex: 1, minWidth: 0, ...typographyStyle('body') },
  dateInput: { backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.row, borderWidth: 1, color: tokens.color.text.primary, minHeight: 48, paddingHorizontal: 14, ...typographyStyle('body') },
  placeholder: { color: tokens.color.text.muted },
  chevron: { color: tokens.color.primary.green, marginLeft: 12, ...typographyStyle('metadata') },
  section: { gap: 8 },
  sectionBody: { gap: 12 },
  backdrop: { backgroundColor: 'rgba(31,45,31,0.35)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: tokens.color.surface.sand, borderTopLeftRadius: tokens.radius.hero, borderTopRightRadius: tokens.radius.hero, maxHeight: '88%', padding: tokens.spacing.card },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: tokens.color.text.primary, ...typographyStyle('h2') },
  selectionCount: { color: tokens.color.text.muted, marginTop: 2, ...typographyStyle('caption') },
  close: { color: tokens.color.primary.green, ...typographyStyle('metadata') },
  searchInput: { backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.row, borderWidth: 1, color: tokens.color.text.primary, minHeight: 48, paddingHorizontal: 14, ...typographyStyle('body') },
  results: { marginTop: 12 },
  group: { gap: 2, marginBottom: 16 },
  groupLabel: { color: tokens.color.text.muted, marginBottom: 4, ...typographyStyle('metadata') },
  option: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderBottomColor: tokens.color.border.soft, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 12 },
  optionText: { flex: 1, gap: 2, minWidth: 0 },
  optionLabel: { color: tokens.color.text.primary, ...typographyStyle('body') },
  optionMeta: { color: tokens.color.text.muted, ...typographyStyle('caption') },
  optionAction: { color: tokens.color.primary.green, marginLeft: 12, ...typographyStyle('metadata') },
  checkbox: { alignItems: 'center', borderColor: tokens.color.border.soft, borderRadius: 10, borderWidth: 1, height: 28, justifyContent: 'center', marginLeft: 10, width: 28 },
  checkboxChecked: { backgroundColor: tokens.color.primary.green, borderColor: tokens.color.primary.green },
  checkboxText: { color: tokens.color.text.inverse, fontSize: tokens.typography.metadata.size, fontWeight: '800' },
  detailCard: { backgroundColor: '#EAF4EA', borderColor: tokens.color.primary.green, borderRadius: tokens.radius.button, borderWidth: 1, gap: 4, marginBottom: 16, padding: 12 },
  empty: { color: tokens.color.text.muted, padding: 12, ...typographyStyle('body') },
  quickAdd: { borderTopColor: tokens.color.border.soft, borderTopWidth: 1, gap: 10, paddingTop: 16 },
  sticky: { backgroundColor: tokens.color.surface.sand, borderTopColor: tokens.color.border.soft, borderTopWidth: 1, marginHorizontal: -tokens.spacing.page, padding: tokens.spacing.page },
  pressed: { opacity: 0.7 },
});

function dateFromDayKey(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day, 12) : new Date();
}

function formatThaiDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return 'เลือกวัน';
  return new Date(year, month - 1, day, 12).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
}
