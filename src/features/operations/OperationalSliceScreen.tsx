import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { initializeTakaiDatabase, type TakaiDatabase } from '../../data';
import { tokens } from '../../theme/tokens';
import {
  AppShell,
  FieldCard,
  PrimaryButton,
  RecordListItem,
  SectionHeader,
  StatusChip,
  TopBar,
  TrackerCard,
} from '../../ui';
import { DesignLabScreen } from '../design-lab/DesignLabScreen';
import {
  createDemoSprayActivity,
  formatThaiShortDate,
  getActivityCaptureOptions,
  getTodayDashboard,
  type ActivityCaptureOption,
  type TakaiView,
  type TodayDashboard,
} from './index';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; db: TakaiDatabase; dashboard: TodayDashboard; options: ActivityCaptureOption; message: string | null }
  | { status: 'error'; message: string };

export function OperationalSliceScreen() {
  const [view, setView] = useState<TakaiView>('today');
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const refresh = useCallback(async (db: TakaiDatabase, message: string | null = null) => {
    const [dashboard, options] = await Promise.all([getTodayDashboard(db), getActivityCaptureOptions(db)]);
    setState({ status: 'ready', db, dashboard, options, message });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const db = await initializeTakaiDatabase();
        const [dashboard, options] = await Promise.all([getTodayDashboard(db), getActivityCaptureOptions(db)]);
        if (!cancelled) {
          setState({ status: 'ready', db, dashboard, options, message: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ status: 'error', message: error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ' });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const createActivity = useCallback(async () => {
    if (state.status !== 'ready') return;
    try {
      await createDemoSprayActivity(state.db);
      await refresh(state.db, 'บันทึกพ่นยาแล้ว');
      setView('today');
    } catch (error) {
      await refresh(state.db, error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ');
    }
  }, [refresh, state]);

  const activeTab = useMemo(() => {
    if (view === 'plot') return 'plots';
    if (view === 'activity') return 'activity';
    if (view === 'designLab') return 'menu';
    return 'today';
  }, [view]);

  if (view === 'designLab') {
    return <DesignLabScreen />;
  }

  if (state.status === 'loading') {
    return (
      <AppShell showTabs={false}>
        <View style={styles.center}>
          <ActivityIndicator color={tokens.color.primary.green} />
          <Text style={styles.muted}>กำลังเปิดสมุดสวนในเครื่อง</Text>
        </View>
      </AppShell>
    );
  }

  if (state.status === 'error') {
    return (
      <AppShell showTabs={false}>
        <TopBar title="ตาไก๊" actionLabel="ออฟไลน์" />
        <FieldCard variant="alert">
          <Text style={styles.cardTitle}>โหลดข้อมูลไม่ได้</Text>
          <Text style={styles.muted}>{state.message}</Text>
        </FieldCard>
      </AppShell>
    );
  }

  const { dashboard, options, message } = state;
  const plot = dashboard.plot;

  return (
    <AppShell activeTab={activeTab} onTabPress={(tab) => {
      if (tab === 'today') setView('today');
      if (tab === 'plots') setView('plot');
      if (tab === 'activity') setView('activity');
      if (tab === 'menu') setView('designLab');
    }}>
      <TopBar title={view === 'plot' ? plot.name : view === 'activity' ? 'บันทึกกิจกรรม' : 'วันนี้'} actionLabel="ออฟไลน์" />

      {message ? <StatusChip label={message} variant={message.includes('ไม่') ? 'overdue' : 'active'} /> : null}

      {view === 'today' ? (
        <>
          <SectionHeader title={dashboard.gardenName} actionLabel="บันทึก" onActionPress={() => setView('activity')} />
          <FieldCard variant="raised">
            <View style={styles.heroRow}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>ภาพรวมวันนี้</Text>
                <Text style={styles.title}>{plot.name}</Text>
                <Text style={styles.muted}>
                  {plot.activeCrop ? `${plot.activeCrop.label} · เปิดมา ${plot.activeCrop.activeDays} วัน` : 'ยังไม่มี crop active'}
                </Text>
              </View>
              <StatusChip label="Local" variant="offline" />
            </View>
            <View style={styles.summaryGrid}>
              <Metric label="พื้นที่" value={`${plot.areaRai} ไร่`} />
              <Metric label="หลุมปลูก" value={`${plot.plantedHoles}/${plot.totalHoles}`} />
              <Metric label="ค้างจ่าย" value={`${dashboard.unpaidLaborTotal.toLocaleString('th-TH')} บาท`} danger={dashboard.unpaidLaborTotal > 0} />
            </View>
          </FieldCard>

          <PrimaryButton label="+ บันทึกพ่นยาตัวอย่าง" onPress={createActivity} />

          <SectionHeader title="รายการล่าสุด" />
          <View style={styles.list}>
            {dashboard.recentItems.map((item) => (
              <RecordListItem
                key={item.id}
                meta={item.meta}
                title={item.title}
                trailing={item.trailing}
                variant={item.variant}
              />
            ))}
          </View>

          <SectionHeader title="Tracker สำคัญ" actionLabel="แปลง" onActionPress={() => setView('plot')} />
          {plot.trackers.map((tracker) => (
            <TrackerCard
              key={tracker.categoryId}
              countLabel={`ครั้งที่ ${tracker.count}`}
              elapsedLabel={tracker.elapsedDays === null ? 'ยังไม่เคยบันทึก' : `ผ่านมา ${tracker.elapsedDays} วัน`}
              nextDueLabel={tracker.nextDueOn ? formatThaiShortDate(tracker.nextDueOn) : undefined}
              progress={tracker.progress}
              title={tracker.title}
              variant={tracker.categoryId === 'cat-spray' ? 'spray' : tracker.categoryId === 'cat-fertilizer' ? 'fertilizer' : 'pruning'}
            />
          ))}
        </>
      ) : null}

      {view === 'plot' ? (
        <>
          <TopBar title={plot.name} variant="plot" actionLabel="วันนี้" onActionPress={() => setView('today')} />
          <FieldCard variant="raised">
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.eyebrow}>{plot.activeCrop?.label ?? 'ไม่มี crop active'}</Text>
                <Text style={styles.title}>{plot.areaRai} ไร่</Text>
              </View>
              <StatusChip label="Active" variant="active" />
            </View>
            <View style={styles.summaryGrid}>
              <Metric label="หลุมทั้งหมด" value={`${plot.totalHoles}`} />
              <Metric label="หลุมปลูก" value={`${plot.plantedHoles}`} />
              <Metric label="หลุมว่าง" value={`${plot.emptyHoles}`} />
            </View>
          </FieldCard>

          <SectionHeader title="Tracker ที่ติดตาม" />
          {plot.trackers.map((tracker) => (
            <TrackerCard
              key={tracker.categoryId}
              countLabel={`ครั้งที่ ${tracker.count}`}
              elapsedLabel={tracker.elapsedDays === null ? 'ยังไม่เริ่ม' : `ผ่านมา ${tracker.elapsedDays} วัน`}
              nextDueLabel={tracker.nextDueOn ? formatThaiShortDate(tracker.nextDueOn) : undefined}
              progress={tracker.progress}
              title={tracker.title}
              variant={tracker.elapsedDays !== null && tracker.elapsedDays > 7 ? 'overdue' : 'custom'}
            />
          ))}

          <SectionHeader title="Active Cases" />
          <View style={styles.list}>
            {plot.activeCases.length ? (
              plot.activeCases.map((caseItem) => (
                <RecordListItem
                  key={caseItem.id}
                  meta={caseItem.targetLabel}
                  title={caseItem.title}
                  trailing={caseItem.statusLabel}
                  variant="case"
                />
              ))
            ) : (
              <RecordListItem title="ยังไม่มีเคสที่ต้องติดตาม" meta="เมื่อเปิดเคส ระบบจะแสดงตรงนี้" trailing="ดี" variant="case" />
            )}
          </View>
        </>
      ) : null}

      {view === 'activity' ? (
        <>
          <SectionHeader title="1. เลือกหมวด" />
          <View style={styles.chipWrap}>
            {options.categories.map((category) => (
              <StatusChip key={category.id} label={category.name} variant={category.id === 'cat-spray' ? 'active' : 'today'} />
            ))}
          </View>

          <SectionHeader title="2. รายละเอียด" />
          <FieldCard>
            <Text style={styles.cardTitle}>พ่นยา {plot.name}</Text>
            <Text style={styles.muted}>เป้าหมาย: {options.defaultHoleId ? 'หลุมแรกในแปลง' : 'ทั้งแปลง'}</Text>
            <Text style={styles.muted}>วัสดุ: {options.materials.slice(0, 2).map((material) => material.name).join(' + ')}</Text>
            <Text style={styles.muted}>ค่าแรง: เจ้าของไม่คิดเงิน + คนงาน 600 บาท</Text>
          </FieldCard>

          <PrimaryButton label="บันทึกกิจกรรมลงเครื่อง" onPress={createActivity} />
          <PrimaryButton label="กลับวันนี้" onPress={() => setView('today')} variant="secondary" />
        </>
      ) : null}
    </AppShell>
  );
}

function Metric({ danger, label, value }: { danger?: boolean; label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={[styles.metricLabel, danger && styles.danger]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: tokens.spacing.row,
    paddingVertical: 48,
  },
  heroRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: tokens.spacing.row,
    justifyContent: 'space-between',
  },
  flex: {
    flex: 1,
    minWidth: 0,
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
    marginTop: 2,
  },
  cardTitle: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.h3.size,
    fontWeight: '700',
  },
  muted: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.metadata.size,
    lineHeight: 21,
    marginTop: 4,
  },
  summaryGrid: {
    borderTopColor: tokens.color.border.soft,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.control,
    marginTop: tokens.spacing.card,
    paddingTop: tokens.spacing.card,
  },
  metric: {
    flex: 1,
  },
  metricValue: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.h3.size,
    fontWeight: '700',
  },
  metricLabel: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.caption.size,
    marginTop: 2,
  },
  danger: {
    color: tokens.color.state.danger,
  },
  list: {
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.control,
  },
});
