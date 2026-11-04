import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, TextInput, View } from 'react-native';

import { Avatar, Body, Button, Card, Chip, Field, H2, Icon, Meter, Row, Screen, Sub, Tag, styles } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { useTrip } from '@/lib/store';
import type { Task } from '@/lib/types';
import { uid } from '@/lib/util';

type Tab = 'chat' | 'polls' | 'tasks' | 'people';

export default function Group() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('chat');
  return (
    <View style={{ flex: 1 }}>
      <Row style={{ padding: S.lg, paddingBottom: S.sm }}>
        <Chip label="Chat" icon="chatbubble" active={tab === 'chat'} onPress={() => setTab('chat')} />
        <Chip label="Polls" icon="stats-chart" active={tab === 'polls'} onPress={() => setTab('polls')} />
        <Chip label="To-dos" icon="checkbox" active={tab === 'tasks'} onPress={() => setTab('tasks')} />
        <Chip label="People" icon="people" active={tab === 'people'} onPress={() => setTab('people')} />
      </Row>
      {tab === 'chat' && <Chat id={id} />}
      {tab === 'polls' && <Polls id={id} />}
      {tab === 'tasks' && <Tasks id={id} />}
      {tab === 'people' && <People id={id} />}
    </View>
  );
}

function Chat({ id }: { id: string }) {
  const { t, me, user, post } = useTrip(id);
  const [text, setText] = useState('');
  if (!t) return null;
  const send = () => {
    if (!text.trim()) return;
    post(t.id, text.trim());
    setText('');
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={140}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: S.lg, gap: S.sm }}>
        {t.messages.map((m) => {
          if (m.authorId === 'system')
            return (
              <View key={m.id} style={{ alignSelf: 'center', backgroundColor: C.twinSoft, borderRadius: R.md, padding: S.sm, paddingHorizontal: S.md, maxWidth: '92%' }}>
                <Body size={13} color={C.twin}>{m.text}</Body>
              </View>
            );
          const mine = m.authorId === me.id;
          const u = user(m.authorId);
          return (
            <Row key={m.id} style={{ alignItems: 'flex-end', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              {!mine && <Avatar user={u} size={26} />}
              <View style={{ maxWidth: '75%', backgroundColor: mine ? C.primary : C.card, borderRadius: R.lg, padding: S.md, gap: 2 }}>
                {!mine && <Body size={12} bold color={u?.color}>{u?.name}</Body>}
                <Body size={15} color={mine ? '#fff' : C.text}>{m.text}</Body>
              </View>
            </Row>
          );
        })}
      </ScrollView>
      <Row style={{ padding: S.md, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line }}>
        <TextInput value={text} onChangeText={setText} placeholder={`Message as ${me.name}…`} placeholderTextColor={C.faint} style={[styles.input, { flex: 1 }]} onSubmitEditing={send} returnKeyType="send" />
        <Pressable onPress={send} accessibilityLabel="Send" style={{ backgroundColor: C.primary, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="send" color="#fff" />
        </Pressable>
      </Row>
    </KeyboardAvoidingView>
  );
}

function Polls({ id }: { id: string }) {
  const { t, update, me, user, post } = useTrip(id);
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState('');
  if (!t) return null;

  const vote = (pollId: string, optId: string) =>
    update((x) => ({
      ...x,
      polls: x.polls.map((p) => (p.id !== pollId || p.closed ? p : { ...p, options: p.options.map((o) => ({ ...o, voterIds: o.id === optId ? [...o.voterIds.filter((v) => v !== me.id), me.id] : o.voterIds.filter((v) => v !== me.id) })) })),
    }));

  const create = () => {
    const options = opts.split(',').map((s) => s.trim()).filter(Boolean);
    if (!q.trim() || options.length < 2) return;
    update((x) => ({ ...x, polls: [{ id: uid(), question: q.trim(), authorId: me.id, createdAt: Date.now(), options: options.map((label) => ({ id: uid(), label, voterIds: [] })) }, ...x.polls] }));
    post(t.id, `🗳️ ${me.name} started a poll: "${q.trim()}"`, true);
    setQ('');
    setOpts('');
  };

  return (
    <Screen>
      {t.polls.map((p) => {
        const total = p.options.reduce((s, o) => s + o.voterIds.length, 0);
        const lead = [...p.options].sort((a, b) => b.voterIds.length - a.voterIds.length)[0];
        const waiting = t.memberIds.filter((m) => !p.options.some((o) => o.voterIds.includes(m)));
        return (
          <Card key={p.id}>
            <Row>
              <Body bold>{p.question}</Body>
              <View style={{ flex: 1 }} />
              {p.closed && <Tag label="Decided" color={C.low} bg={C.lowSoft} />}
            </Row>
            <Sub>by {user(p.authorId)?.name} · {total}/{t.memberIds.length} voted</Sub>
            {p.options.map((o) => {
              const picked = o.voterIds.includes(me.id);
              return (
                <Pressable key={o.id} onPress={() => vote(p.id, o.id)} style={{ gap: 4, paddingVertical: 4 }}>
                  <Row>
                    <Icon name={picked ? 'radio-button-on' : 'radio-button-off'} color={C.primary} />
                    <Body size={14} bold={p.closed && o.id === lead.id}>{o.label}</Body>
                    <View style={{ flex: 1 }} />
                    <Sub>{o.voterIds.map((v) => user(v)?.name).join(', ')}</Sub>
                  </Row>
                  <Meter value={total ? o.voterIds.length / total : 0} color={C.primary} height={6} />
                </Pressable>
              );
            })}
            {!p.closed && waiting.length > 0 && <Sub>Waiting on {waiting.map((w) => user(w)?.name).join(', ')}</Sub>}
            {!p.closed && (
              <Button small kind="ghost" title={`Close poll · pick "${lead?.label}"`} onPress={() => { update((x) => ({ ...x, polls: x.polls.map((y) => (y.id === p.id ? { ...y, closed: true } : y)) })); post(t.id, `✅ Group decided: "${lead?.label}" for "${p.question}"`, true); }} />
            )}
          </Card>
        );
      })}
      <Card>
        <H2>New poll</H2>
        <Field label="Question" placeholder="Where should we eat Friday?" value={q} onChangeText={setQ} />
        <Field label="Options (comma separated)" placeholder="Tacos, Sushi, Pizza" value={opts} onChangeText={setOpts} />
        <Button title="Start poll" icon="stats-chart" onPress={create} disabled={!q.trim() || opts.split(',').filter((s) => s.trim()).length < 2} />
      </Card>
    </Screen>
  );
}

function Tasks({ id }: { id: string }) {
  const { t, update, user } = useTrip(id);
  const [title, setTitle] = useState('');
  const [list, setList] = useState<Task['list']>('prep');
  if (!t) return null;

  const patch = (taskId: string, p: Partial<Task>) => update((x) => ({ ...x, tasks: x.tasks.map((k) => (k.id === taskId ? { ...k, ...p } : k)) }));
  const nextAssignee = (k: Task) => {
    const order = [undefined, ...t.memberIds];
    return order[(order.indexOf(k.assigneeId) + 1) % order.length];
  };

  return (
    <Screen>
      {(['prep', 'packing'] as const).map((l) => {
        const tasks = t.tasks.filter((k) => k.list === l);
        return (
          <Card key={l}>
            <H2 right={<Sub>{tasks.filter((k) => k.done).length}/{tasks.length}</Sub>}>{l === 'prep' ? 'Trip prep' : 'Shared packing list'}</H2>
            {tasks.map((k) => (
              <Row key={k.id} style={{ paddingVertical: 4 }}>
                <Pressable onPress={() => patch(k.id, { done: !k.done })}>
                  <Icon name={k.done ? 'checkmark-circle' : 'ellipse-outline'} color={k.done ? C.low : C.primary} size={22} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Body size={14} color={k.done ? C.faint : C.text}>{k.title}</Body>
                </View>
                <Pressable onPress={() => patch(k.id, { assigneeId: nextAssignee(k) })} accessibilityLabel="Change assignee">
                  {k.assigneeId ? <Avatar user={user(k.assigneeId)} size={26} /> : <Icon name="person-add-outline" color={C.faint} />}
                </Pressable>
                <Pressable onPress={() => update((x) => ({ ...x, tasks: x.tasks.filter((y) => y.id !== k.id) }))}>
                  <Icon name="close" color={C.faint} size={16} />
                </Pressable>
              </Row>
            ))}
          </Card>
        );
      })}
      <Card>
        <Field label="Add item" placeholder="Book dinner reservation" value={title} onChangeText={setTitle} />
        <Row>
          <Chip label="Trip prep" active={list === 'prep'} onPress={() => setList('prep')} />
          <Chip label="Packing" active={list === 'packing'} onPress={() => setList('packing')} />
        </Row>
        <Button title="Add" icon="add" disabled={!title.trim()} onPress={() => { update((x) => ({ ...x, tasks: [...x.tasks, { id: uid(), title: title.trim(), done: false, list }] })); setTitle(''); }} />
        <Sub>Tap an avatar to assign the task to someone.</Sub>
      </Card>
    </Screen>
  );
}

function People({ id }: { id: string }) {
  const { t, user } = useTrip(id);
  if (!t) return null;
  return (
    <Screen>
      <Card style={{ alignItems: 'center' }}>
        <Sub>JOIN CODE</Sub>
        <Body bold size={34}>{t.joinCode}</Body>
        <Button title="Invite your group" icon="share-social" onPress={() => Share.share({ message: `Join "${t.name}" on TripTwin with code ${t.joinCode}` }).catch(() => {})} />
      </Card>
      <Card>
        <H2>{t.memberIds.length} travelers</H2>
        {t.memberIds.map((m) => {
          const plans = t.items.filter((i) => i.attendeeIds.includes(m)).length;
          const tasks = t.tasks.filter((k) => k.assigneeId === m && !k.done).length;
          return (
            <Row key={m} style={{ paddingVertical: 6 }}>
              <Avatar user={user(m)} size={36} />
              <View style={{ flex: 1 }}>
                <Body bold>{user(m)?.name}</Body>
                <Sub>In {plans} of {t.items.length} plans · {tasks} open to-do(s)</Sub>
              </View>
              {m === t.ownerId && <Tag label="Organizer" color={C.primary} bg={C.primarySoft} />}
            </Row>
          );
        })}
      </Card>
    </Screen>
  );
}
