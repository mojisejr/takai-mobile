import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { initializeTakaiLaborPreview } from '../../data';
import { tokens } from '../../theme/tokens';
import { AppShell, FieldCard, PrimaryButton, SectionHeader, StatusChip, TopBar, type BottomTabKey } from '../../ui';
import type { LaborPreviewAdapter } from './preview';

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; adapter: LaborPreviewAdapter; peopleCount: number; payableCount: number; groupCount: number }
  | { status: 'error'; message: string };

const tabTitles: Record<BottomTabKey, string> = {
  today: 'วันนี้', work: 'งาน', record: 'บันทึกงาน', people: 'คน', more: 'เมนู',
};

const tabMessages: Record<BottomTabKey, { title: string; body: string }> = {
  today: { title: 'สมุดงานค่าแรง', body: 'หน้าสรุปวันนี้จะเชื่อมงาน ค่าจ้าง เงินเบิก และยอดค้างจาก Labor ledger ใน phase ถัดไป' },
  work: { title: 'ปฏิทินงาน', body: 'ปฏิทินและประวัติงานจะเป็นมุมมองจากวันที่ทำงานและวันที่การเงินมีผล ไม่ใช่ record แยก' },
  record: { title: 'บันทึกงานใหม่', body: 'แบบฟอร์มงานรายวัน รายชั่วโมง รายชิ้น งานกลุ่ม และงานเหมาจะเปิดใน phase เขียนข้อมูล' },
  people: { title: 'คนทำงาน', body: 'รายชื่อและยอดค่าแรง/เงินเบิกจะแสดงแยกกัน โดยไม่แตกยอดงานกลุ่มเป็นรายคนเอง' },
  more: { title: 'เมนู', body: 'การตั้งค่าและรายการรองจะกลับมาเมื่อ Labor flow หลักพร้อมใช้งาน' },
};

export function LaborMvpApp() {
  const [activeTab, setActiveTab] = useState<BottomTabKey>('today');
  const [preview, setPreview] = useState<PreviewState>({ status: 'loading' });

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const adapter = await initializeTakaiLaborPreview();
        const read = await adapter.getReadModel();
        if (mounted) setPreview({ status: 'ready', adapter, peopleCount: read.people.length, payableCount: read.payables.length, groupCount: read.settlementGroups.length });
      } catch (error) {
        if (mounted) setPreview({ status: 'error', message: error instanceof Error ? error.message : 'เปิดข้อมูล Labor Preview ไม่สำเร็จ' });
      }
    })();
    return () => { mounted = false; };
  }, []);

  const content = useMemo(() => tabMessages[activeTab], [activeTab]);

  return (
    <AppShell activeTab={activeTab} onTabPress={setActiveTab}>
      <TopBar title={tabTitles[activeTab]} actionLabel="Labor MVP" />
      {preview.status === 'loading' ? (
        <View style={styles.loading}><ActivityIndicator color={tokens.color.primary.green} /><Text style={styles.muted}>กำลังเตรียม Labor preview…</Text></View>
      ) : preview.status === 'error' ? (
        <FieldCard variant="alert"><Text style={styles.title}>เปิดข้อมูลไม่สำเร็จ</Text><Text style={styles.muted}>{preview.message}</Text></FieldCard>
      ) : (
        <>
          <StatusChip label={preview.adapter.label} variant="offline" />
          <FieldCard variant="raised">
            <Text style={styles.eyebrow}>LABOR-ONLY FOUNDATION</Text>
            <Text style={styles.title}>{content.title}</Text>
            <Text style={styles.muted}>{content.body}</Text>
          </FieldCard>
          <SectionHeader title="ข้อมูลตัวอย่างที่ตรวจสอบได้" />
          <View style={styles.metrics}>
            <Metric label="คนงาน" value={preview.peopleCount} />
            <Metric label="รายการค้าง/จ่าย" value={preview.payableCount} />
            <Metric label="ชุดรับเงิน" value={preview.groupCount} />
          </View>
          <PrimaryButton label={activeTab === 'record' ? 'แบบฟอร์มกำลังมา' : '+ บันทึกงานใหม่'} disabled />
          <Text style={styles.caption}>Preview นี้ seed ด้วยคำสั่ง Labor repository และอ่านกลับผ่าน read model เดียวกับ native path</Text>
        </>
      )}
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <FieldCard variant="summary" style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.caption}>{label}</Text></FieldCard>;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  eyebrow: { color: tokens.color.primary.green, fontSize: tokens.typography.caption.size, fontWeight: '700' },
  title: { color: tokens.color.text.primary, fontSize: tokens.typography.h2.size, fontWeight: '700', marginTop: 6 },
  muted: { color: tokens.color.text.muted, fontSize: tokens.typography.body.size, lineHeight: 23, marginTop: 8 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minWidth: 0 },
  metricValue: { color: tokens.color.text.primary, fontSize: 24, fontVariant: ['tabular-nums'], fontWeight: '700' },
  caption: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, lineHeight: 18 },
});
