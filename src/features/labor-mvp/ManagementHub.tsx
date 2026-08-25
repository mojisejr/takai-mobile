import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../../theme/tokens';
import { FieldCard, IconDisc, LedgerListCard, LedgerListRow, LedgerRowText, LedgerTrailing, SectionHeader } from '../../ui';

export type ManagementRoute = 'people' | 'plots' | 'chemicals';

export function ManagementHub({ onOpen }: { onOpen: (route: ManagementRoute) => void }) {
  return <View style={styles.screen}>
    <FieldCard variant="raised" style={styles.hero}><IconDisc icon="manage" size={44} tone="sage" /><View style={styles.heroText}><Text style={styles.eyebrow}>ข้อมูลที่ใช้ซ้ำ</Text><Text style={styles.title}>จัดการ</Text><Text style={styles.muted}>เพิ่มและแก้ไขข้อมูลสวน โดยไม่ปนกับการบันทึกงานหรือจ่ายเงิน</Text></View></FieldCard>
    <SectionHeader title="ข้อมูลสวน" />
    <LedgerListCard>
      <Pressable onPress={() => onOpen('people')}><LedgerListRow><IconDisc icon="people" size={36} /><LedgerRowText title="คนทำงาน" detail="รายชื่อ ประวัติงาน และเงินเบิก" /><LedgerTrailing><Text style={styles.route}>ดูข้อมูล</Text></LedgerTrailing></LedgerListRow></Pressable>
      <Pressable onPress={() => onOpen('plots')}><LedgerListRow><IconDisc icon="garden" size={36} tone="sage" /><LedgerRowText title="แปลง" detail="พื้นที่ที่ใช้ระบุในงาน" /><LedgerTrailing><Text style={styles.route}>ดูข้อมูล</Text></LedgerTrailing></LedgerListRow></Pressable>
      <Pressable onPress={() => onOpen('chemicals')}><LedgerListRow><IconDisc icon="chemical" size={36} tone="gold" /><LedgerRowText title="คลังยา / เคมี" detail="รายการที่มีอยู่หรือหมดแล้ว ไม่ตัดจำนวนสต็อก" /><LedgerTrailing><Text style={styles.route}>ดูข้อมูล</Text></LedgerTrailing></LedgerListRow></Pressable>
    </LedgerListCard>
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: 16 }, hero: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 }, heroText: { flex: 1, gap: 3, minWidth: 0 }, title: { color: tokens.color.text.primary, fontSize: tokens.typography.h2.size, fontWeight: '800' }, eyebrow: { color: tokens.color.text.muted, fontSize: tokens.typography.metadata.size, fontWeight: '700' }, muted: { color: tokens.color.text.muted, fontSize: tokens.typography.body.size, lineHeight: 23 }, route: { color: tokens.color.primary.green, fontSize: tokens.typography.metadata.size, fontWeight: '800' },
});
