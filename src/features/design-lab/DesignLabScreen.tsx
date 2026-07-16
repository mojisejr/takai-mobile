import { Image, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../../theme/tokens';
import {
  AppShell,
  BottomTabBar,
  EvidenceTimeline,
  FieldCard,
  PrimaryButton,
  RecordListItem,
  SectionHeader,
  StatusChip,
  TopBar,
  TrackerCard,
} from '../../ui';

const palette = [
  ['เขียวหลัก', tokens.color.primary.green],
  ['ใบอ่อน', tokens.color.primary.leaf],
  ['พื้นทราย', tokens.color.surface.sand],
  ['ดิน', tokens.color.soil.brown],
  ['เตือน', tokens.color.state.warning],
  ['เกินกำหนด', tokens.color.state.danger],
] as const;

const timelineItems = [
  {
    id: 'case-0',
    dateLabel: '16 ก.ค. 2026',
    dayLabel: 'Day 0',
    title: 'เจอเชื้อราที่โคนต้น',
    note: 'ขูดแผลแล้วทายา เก็บรูปแผลเริ่มต้นไว้เทียบผล',
  },
  {
    id: 'case-7',
    dateLabel: '23 ก.ค. 2026',
    dayLabel: 'Day 7',
    title: 'แผลเริ่มแห้ง',
    note: 'ใบยังปกติ นัดติดตามอีก 7 วัน',
  },
  {
    id: 'case-14',
    dateLabel: '30 ก.ค. 2026',
    dayLabel: 'Day 14',
    title: 'ปิดเคสได้',
    note: 'แผลไม่ลาม เก็บเป็น case study',
  },
];

export function DesignLabScreen() {
  return (
    <AppShell>
      <TopBar title="วันนี้" actionLabel="ออฟไลน์" />

      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.eyebrow}>TAKAI DESIGN LAB</Text>
          <Text style={styles.title}>ตาไก๊ - เพื่อนชาวสวน</Text>
          <Text style={styles.body}>จด จำ ติดตาม เห็นผล สำหรับงานสวนรายแปลงและรายหลุม</Text>
        </View>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={require('../../../assets/brand/takai-mascot.png')}
          style={styles.mascot}
        />
      </View>

      <SectionHeader title="สีและตัวอักษร" actionLabel="ตรวจ" />
      <View style={styles.paletteGrid}>
        {palette.map(([label, color]) => (
          <View key={label} style={styles.swatchRow}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <View style={styles.swatchText}>
              <Text style={styles.swatchLabel}>{label}</Text>
              <Text style={styles.caption}>{color}</Text>
            </View>
          </View>
        ))}
      </View>

      <SectionHeader title="สถานะที่ต้องเจอจริง" />
      <View style={styles.chipWrap}>
        <StatusChip label="วันนี้" variant="today" />
        <StatusChip label="ใกล้ครบกำหนด" variant="dueSoon" />
        <StatusChip label="เกินกำหนด" variant="overdue" />
        <StatusChip label="ติดตามอยู่" variant="active" />
        <StatusChip label="ปิดเคส" variant="closed" />
        <StatusChip label="เก็บเข้าแฟ้ม" variant="archived" />
        <StatusChip label="จ่ายแล้ว" variant="paid" />
        <StatusChip label="ค้างจ่าย" variant="unpaid" />
        <StatusChip label="ออฟไลน์" variant="offline" />
      </View>

      <SectionHeader title="แถบนำทาง" />
      <BottomTabBar activeTab="activity" />

      <SectionHeader title="Tracker รายแปลง" actionLabel="ทั้งหมด" />
      <TrackerCard title="พ่นยา" countLabel="ครั้งที่ 5" elapsedLabel="ผ่านมา 4 วัน" nextDueLabel="20 ก.ค." progress={0.62} variant="spray" />
      <TrackerCard title="ใส่ปุ๋ย" countLabel="ครั้งที่ 3" elapsedLabel="ผ่านมา 15 วัน" nextDueLabel="25 ก.ค." progress={0.38} variant="fertilizer" />
      <TrackerCard title="แต่งกิ่ง" countLabel="ครั้งที่ 2" elapsedLabel="เกินมา 2 วัน" nextDueLabel="28 ก.ค." progress={1} variant="overdue" />

      <SectionHeader title="รายการวันนี้" />
      <View style={styles.list}>
        <RecordListItem title="พ่นยา แปลง A" meta="ครั้งที่ 5 · ยา A 20 cc / น้ำ 20 L" trailing="วันนี้" variant="activity" />
        <RecordListItem title="A-014 เชื้อราโคนต้น" meta="ติดตามอยู่ · มีรูป 3 ใบ" trailing="Day 7" variant="case" />
        <RecordListItem title="สมชาย" meta="ค่าตัดหญ้า แปลง B" trailing="ค้าง 800" variant="labor" />
        <RecordListItem title="สารจับใบ" meta="10 cc / น้ำ 20 L · ใช้ล่าสุด 16 ก.ค." trailing="วัสดุ" variant="material" />
        <RecordListItem title="หลุม A-014" meta="ทุเรียนหมอนทอง · อายุ 2 ปี 6 เดือน" trailing="ดู" variant="hole" />
      </View>

      <SectionHeader title="ไทม์ไลน์เคส" actionLabel="A-014" />
      <EvidenceTimeline items={timelineItems} variant="case" />

      <SectionHeader title="แบบฟอร์มและปุ่ม" />
      <FieldCard variant="raised">
        <Text style={styles.cardTitle}>บันทึกกิจกรรม</Text>
        <Text style={styles.body}>พ่นยาแปลง A เป้าหมายทั้งแปลง ใช้วัสดุ 2 รายการ และตั้งติดตามอีก 4 วัน</Text>
        <View style={styles.buttonStack}>
          <PrimaryButton label="+ บันทึกวันนี้" />
          <PrimaryButton label="เพิ่มรูปถ่าย" variant="secondary" />
          <PrimaryButton label="ปิดเคสนี้" variant="tertiary" />
          <PrimaryButton disabled label="รอข้อมูลครบ" variant="secondary" />
        </View>
      </FieldCard>

      <FieldCard variant="summary">
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>□</Text>
          <Text style={styles.cardTitle}>ยังไม่มีรายการค้างจ่าย</Text>
          <Text style={styles.caption}>เมื่อจดค่าแรง ระบบจะแสดงยอดที่ยังไม่จ่ายไว้ตรงนี้</Text>
        </View>
      </FieldCard>

      <TopBar title="แปลง A" variant="plot" actionLabel="แก้ไข" />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.row,
    padding: tokens.spacing.card,
  },
  heroText: {
    flex: 1,
  },
  eyebrow: {
    color: tokens.color.primary.green,
    fontSize: tokens.typography.caption.size,
    fontWeight: '700',
  },
  title: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.h1.size,
    fontWeight: '700',
    lineHeight: 34,
    marginTop: 4,
  },
  body: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.body.size,
    lineHeight: 23,
    marginTop: 8,
  },
  mascot: {
    borderRadius: 40,
    height: 78,
    width: 78,
  },
  paletteGrid: {
    gap: tokens.spacing.control,
  },
  swatchRow: {
    alignItems: 'center',
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.button,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: tokens.spacing.row,
  },
  swatch: {
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.button,
    borderWidth: 1,
    height: 30,
    width: 44,
  },
  swatchText: {
    flex: 1,
    marginLeft: tokens.spacing.row,
  },
  swatchLabel: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.metadata.size,
    fontWeight: '700',
  },
  caption: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.caption.size,
    lineHeight: 19,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.control,
  },
  list: {
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardTitle: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.h3.size,
    fontWeight: '700',
  },
  buttonStack: {
    gap: tokens.spacing.control,
    marginTop: tokens.spacing.row,
  },
  emptyState: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  emptyIcon: {
    color: tokens.color.text.muted,
    fontSize: 32,
    lineHeight: 36,
  },
});
