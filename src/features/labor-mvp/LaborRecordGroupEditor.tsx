import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DatePickerField, FieldCard, FormFeedback, MultiSearchPickerSheet, PickerField, PrimaryButton, SectionHeader, StickySaveBar } from '../../ui';
import { tokens } from '../../theme/tokens';
import type { LaborWorker } from './types';
import type { Ready } from './LaborMvpApp';
import { selectLaborWebProofScenario } from './webProofVisual';

type WageMethod = 'daily' | 'hourly' | 'contract';
type Job = { id: string; title: string; hours: string; minutes: string };
type WorkGroup = { id: string; method: WageMethod; personId: string | null; memberIds: string[]; jobs: Job[]; dayPart: 'full' | 'half'; rateBaht: string; contractTitle: string };
type Props = { ready: Ready; refresh: () => Promise<void>; notify: (text: string) => void; onPayment: () => void };

const createJob = (): Job => ({ id: `job-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: '', hours: '', minutes: '' });
const durationMinutes = (job: Job) => Number(job.hours || 0) * 60 + Number(job.minutes || 0);
const createGroup = (method: WageMethod = 'daily'): WorkGroup => ({ id: `group-${Date.now()}-${Math.random().toString(36).slice(2)}`, method, personId: null, memberIds: [], jobs: [createJob()], dayPart: 'full', rateBaht: '', contractTitle: '' });
const nameFor = (workers: LaborWorker[], id: string | null) => workers.find((worker) => worker.id === id)?.displayName ?? '';
const bahtToSatang = (value: string) => Math.round(Number(value) * 100);

/**
 * The recording surface intentionally starts with the worker or work team.
 * Work facts and payment facts remain separate V2 command calls.
 */
export function LaborRecordGroupEditor({ ready, refresh, notify, onPayment }: Props) {
  const scenario = selectLaborWebProofScenario();
  const su = 'labor-v2-preview-su'; const phuang = 'labor-v2-preview-phuang';
  const [workDate, setWorkDate] = useState(scenario ? '2026-08-21' : ready.date);
  const [groups, setGroups] = useState<WorkGroup[]>(() => {
    if (scenario === 'daily-three-task') return [{ ...createGroup('daily'), id: 'proof-daily', personId: su, rateBaht: '350', jobs: [{ id: 'proof-cut', title: 'ตัดหญ้า', hours: '', minutes: '' }, { id: 'proof-fertilize', title: 'ใส่ปุ๋ย', hours: '', minutes: '' }, { id: 'proof-spray', title: 'พ่นยา', hours: '', minutes: '' }] }];
    if (scenario === 'open-contract') return [{ ...createGroup('contract'), id: 'proof-contract', memberIds: [su, phuang], contractTitle: 'กรอกถุงเพาะชำ', jobs: [{ id: 'proof-bags', title: 'กรอกถุงเพาะชำ', hours: '', minutes: '' }] }];
    return [createGroup()];
  });
  const [picker, setPicker] = useState<{ groupId: string; kind: 'person' | 'team' } | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const workers = ready.workers.filter((worker) => !worker.archivedAt);
  const options = workers.map((worker) => ({ id: worker.id, label: worker.displayName, meta: worker.specialty }));
  const update = (groupId: string, patch: Partial<WorkGroup>) => setGroups((items) => items.map((group) => group.id === groupId ? { ...group, ...patch } : group));
  const updateJob = (groupId: string, jobId: string, patch: Partial<Job>) => setGroups((items) => items.map((group) => group.id === groupId ? { ...group, jobs: group.jobs.map((job) => job.id === jobId ? { ...job, ...patch } : job) } : group));
  const addJob = (groupId: string) => update(groupId, { jobs: [...(groups.find((group) => group.id === groupId)?.jobs ?? []), createJob()] });
  const removeJob = (groupId: string, jobId: string) => update(groupId, { jobs: (groups.find((group) => group.id === groupId)?.jobs ?? []).length === 1 ? groups.find((group) => group.id === groupId)!.jobs : groups.find((group) => group.id === groupId)!.jobs.filter((job) => job.id !== jobId) });
  const chooseMethod = (groupId: string, method: WageMethod) => update(groupId, { method, ...(method === 'contract' ? { personId: null } : { memberIds: [] }) });

  const save = async () => {
    const invalid = groups.find((group) => !group.jobs.some((job) => job.title.trim()) || (group.method === 'contract' ? !group.memberIds.length || !group.contractTitle.trim() : !group.personId));
    if (invalid) return notify('เลือกคนหรือชุดที่มาทำงาน และกรอกงานที่ทำวันนี้ให้ครบ');
    const dailyGroups = groups.filter((group) => group.method === 'daily');
    const duplicateDaily = dailyGroups.some((group, index) => dailyGroups.slice(index + 1).some((next) => next.personId === group.personId));
    if (duplicateDaily) return notify('คนเดียวกันในวันเดียว บันทึกค่าแรงรายวันเป็นชุดเดียว');
    for (const group of groups) {
      if (group.method === 'daily' && (!Number.isSafeInteger(bahtToSatang(group.rateBaht)) || bahtToSatang(group.rateBaht) <= 0)) return notify('กรอกค่าแรงรายวันเป็นบาท');
      if (group.method === 'hourly' && (!Number.isSafeInteger(bahtToSatang(group.rateBaht)) || bahtToSatang(group.rateBaht) <= 0 || group.jobs.some((job) => !Number.isInteger(Number(job.hours || 0)) || Number(job.hours || 0) < 0 || !Number.isInteger(Number(job.minutes || 0)) || Number(job.minutes || 0) < 0 || Number(job.minutes || 0) >= 60 || durationMinutes(job) <= 0))) return notify('กรอกค่าแรงรายชั่วโมง และเวลาเป็นชั่วโมงกับนาทีของแต่ละงานให้ครบ');
    }
    const taskFacts = groups.flatMap((group) => group.jobs.filter((job) => job.title.trim()).map((job) => ({ id: `${group.id}:${job.id}`, title: job.title.trim(), assigneePersonIds: group.method === 'contract' ? group.memberIds : [group.personId!] })));
    const daily = groups.filter((group) => group.method === 'daily').map((group) => ({ personId: group.personId!, rateSatang: bahtToSatang(group.rateBaht), quantityMilli: group.dayPart === 'full' ? 1000 as const : 500 as const, taskIds: group.jobs.filter((job) => job.title.trim()).map((job) => `${group.id}:${job.id}`) }));
    const hourly = groups.filter((group) => group.method === 'hourly').flatMap((group) => group.jobs.filter((job) => job.title.trim()).map((job) => ({ id: `${group.id}:${job.id}`, taskId: `${group.id}:${job.id}`, personId: group.personId!, rateSatang: bahtToSatang(group.rateBaht), shiftKey: group.id, durationMinutes: durationMinutes(job) })));
    setSaving(true);
    try {
      await ready.adapter.commands.recordDay({ workDate, tasks: taskFacts, daily, hourly });
      for (const group of groups.filter((item) => item.method === 'contract')) await ready.adapter.commands.startContract({ title: group.contractTitle.trim(), startsOn: workDate, memberPersonIds: group.memberIds, taskIds: group.jobs.filter((job) => job.title.trim()).map((job) => `${group.id}:${job.id}`) });
      await refresh(); setGroups([createGroup()]); notify('บันทึกงานและค่าแรงแล้ว');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'บันทึกงานไม่สำเร็จ');
    } finally { setSaving(false); }
  };

  return <View style={styles.screen}>
    <DatePickerField label="วันที่ทำงาน" value={workDate} onChange={setWorkDate} />
    <Text style={styles.intro}>เลือกก่อนว่าใครหรือชุดไหนมาทำงาน แล้วค่อยเติมงานและวิธีคิดค่าแรง</Text>
    {groups.map((group, index) => <FieldCard key={group.id} style={styles.groupCard} variant="raised">
      <View style={styles.header}><Text style={styles.title}>ชุดงานที่ {index + 1}</Text>{groups.length > 1 ? <Pressable onPress={() => setGroups((items) => items.filter((item) => item.id !== group.id))}><Text style={styles.remove}>ลบชุดนี้</Text></Pressable> : null}</View>
      {group.method === 'contract' ? <PickerField label="ชุดคนที่มาทำงาน" value={group.memberIds.map((id) => nameFor(workers, id)).filter(Boolean).join(', ')} placeholder="เลือกคนทำงานอย่างน้อย 1 คน" onPress={() => setPicker({ groupId: group.id, kind: 'team' })} /> : <PickerField label="คนที่มาทำงาน" value={nameFor(workers, group.personId)} placeholder="เลือกคนทำงาน" onPress={() => setPicker({ groupId: group.id, kind: 'person' })} />}
      <SectionHeader title="งานที่ทำวันนี้" />
      {group.jobs.map((job, jobIndex) => <View key={job.id} style={styles.jobRow}><TextInput accessibilityLabel={`งานที่ทำวันนี้ ${jobIndex + 1}`} onChangeText={(title) => updateJob(group.id, job.id, { title })} placeholder={`งานที่ ${jobIndex + 1}`} style={styles.input} value={job.title} />{group.method === 'hourly' ? <View style={styles.duration}><TextInput accessibilityLabel={`ชั่วโมงงาน ${jobIndex + 1}`} keyboardType="number-pad" onChangeText={(hours) => updateJob(group.id, job.id, { hours })} placeholder="ชม." style={[styles.input, styles.durationInput]} value={job.hours} /><TextInput accessibilityLabel={`นาทีงาน ${jobIndex + 1}`} keyboardType="number-pad" onChangeText={(minutes) => updateJob(group.id, job.id, { minutes })} placeholder="นาที" style={[styles.input, styles.durationInput]} value={job.minutes} /></View> : null}<Pressable accessibilityLabel={`ลบงานที่ ${jobIndex + 1}`} onPress={() => removeJob(group.id, job.id)}><Text style={styles.remove}>ลบ</Text></Pressable></View>)}
      <PrimaryButton label="+ เพิ่มงาน" onPress={() => addJob(group.id)} variant="secondary" />
      <SectionHeader title="คิดค่าแรงแบบ" />
      <View style={styles.methodRow}>{([['daily', 'ค่าแรงรายวัน'], ['hourly', 'ค่าแรงรายชั่วโมง'], ['contract', 'งานเหมา']] as const).map(([method, label]) => <Pressable key={method} onPress={() => chooseMethod(group.id, method)} style={[styles.method, group.method === method && styles.methodSelected]}><Text style={group.method === method ? styles.methodTextSelected : styles.methodText}>{label}</Text></Pressable>)}</View>
      {group.method === 'daily' ? <View style={styles.detail}><TextInput keyboardType="number-pad" onChangeText={(rateBaht) => update(group.id, { rateBaht })} placeholder="ค่าแรงต่อวัน (บาท)" style={styles.input} value={group.rateBaht} /><View style={styles.methodRow}>{([['full', 'เต็มวัน'], ['half', 'ครึ่งวัน']] as const).map(([part, label]) => <Pressable key={part} onPress={() => update(group.id, { dayPart: part })} style={[styles.method, group.dayPart === part && styles.methodSelected]}><Text style={group.dayPart === part ? styles.methodTextSelected : styles.methodText}>{label}</Text></Pressable>)}</View><Text style={styles.caption}>งานทั้งหมดของคนนี้ในวันนี้รวมเป็นค่าแรงก้อนเดียว</Text></View> : null}
      {group.method === 'hourly' ? <View style={styles.detail}><TextInput keyboardType="number-pad" onChangeText={(rateBaht) => update(group.id, { rateBaht })} placeholder="ค่าแรงต่อชั่วโมง (บาท)" style={styles.input} value={group.rateBaht} /><Text style={styles.caption}>ใส่เวลาของแต่ละงานเป็นนาที เพื่อรวมเป็นกะเดียวอย่างถูกต้อง</Text></View> : null}
      {group.method === 'contract' ? <View style={styles.detail}><TextInput onChangeText={(contractTitle) => update(group.id, { contractTitle })} placeholder="ชื่องานเหมา" style={styles.input} value={group.contractTitle} /><Text style={styles.caption}>เปิดงานไว้ก่อนได้ ยังไม่ต้องใส่จำนวนหรือราคา และยังไม่มีค่าแรงค้างจ่าย</Text></View> : null}
    </FieldCard>)}
    <PrimaryButton label="+ เพิ่มชุดงาน" onPress={() => setGroups((items) => [...items, createGroup()])} variant="secondary" />
    <FormFeedback kind="notice">บันทึกงานก่อน การจ่ายเงินอยู่ในหน้า “จ่ายเงิน” แยกต่างหาก</FormFeedback>
    <StickySaveBar disabled={saving} label={saving ? 'กำลังบันทึก…' : 'บันทึกงาน'} onPress={save} />
    <PrimaryButton label="ไปที่จ่ายเงิน" onPress={onPayment} variant="secondary" />
    <MultiSearchPickerSheet visible={picker?.kind === 'team'} title="เลือกคนในชุดงานเหมา" query={query} setQuery={setQuery} options={options} selectedIds={picker?.kind === 'team' ? groups.find((group) => group.id === picker.groupId)?.memberIds ?? [] : []} onToggle={(id) => { if (!picker || picker.kind !== 'team') return; const selected = groups.find((group) => group.id === picker.groupId)?.memberIds ?? []; update(picker.groupId, { memberIds: selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id] }); }} onClose={() => setPicker(null)} emptyLabel="ยังไม่มีคนทำงาน" />
    <MultiSearchPickerSheet visible={picker?.kind === 'person'} title="เลือกคนทำงาน" query={query} setQuery={setQuery} options={options} selectedIds={picker?.kind === 'person' && groups.find((group) => group.id === picker.groupId)?.personId ? [groups.find((group) => group.id === picker.groupId)!.personId!] : []} onToggle={(id) => { if (!picker || picker.kind !== 'person') return; update(picker.groupId, { personId: id }); setPicker(null); }} onClose={() => setPicker(null)} emptyLabel="ยังไม่มีคนทำงาน" />
  </View>;
}

const styles = StyleSheet.create({
  screen: { gap: 12 }, groupCard: { gap: 14 }, header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, title: { color: tokens.color.text.primary, fontSize: tokens.typography.h2.size, fontWeight: '800' }, intro: { color: tokens.color.text.muted, fontSize: tokens.typography.body.size, lineHeight: 22 }, input: { backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.button, borderWidth: 1, color: tokens.color.text.primary, flex: 1, fontSize: tokens.typography.body.size, minHeight: 48, paddingHorizontal: 12 }, jobRow: { alignItems: 'center', flexDirection: 'row', gap: 8 }, duration: { flexDirection: 'row', gap: 6, width: 144 }, durationInput: { flex: 1, minWidth: 0, paddingHorizontal: 8 }, remove: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size }, methodRow: { flexDirection: 'row', gap: 6 }, method: { alignItems: 'center', borderColor: tokens.color.border.soft, borderRadius: tokens.radius.button, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 4 }, methodSelected: { backgroundColor: tokens.color.primary.green, borderColor: tokens.color.primary.green }, methodText: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, fontWeight: '700', textAlign: 'center' }, methodTextSelected: { color: tokens.color.text.inverse, fontSize: tokens.typography.caption.size, fontWeight: '800', textAlign: 'center' }, detail: { gap: 8 }, caption: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, lineHeight: 18 },
});
