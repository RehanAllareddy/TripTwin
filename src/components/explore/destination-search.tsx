import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Icon, Segmented } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { searchDestinations, type FeaturedDestination } from '@/lib/explore/featured';

export type TypeFilter = 'all' | 'city' | 'town';

/** Search with autocomplete + All / Cities / Towns filter. Keyboard: ↑ ↓ Enter Escape. */
export function DestinationSearch({ list, filter, onFilter, onSelect }: { list: FeaturedDestination[]; filter: TypeFilter; onFilter: (f: TypeFilter) => void; onSelect: (d: FeaturedDestination) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = query.trim() ? searchDestinations(list, query, filter, 6) : [];
  const show = open && query.trim().length > 0;

  const choose = (d: FeaturedDestination | undefined) => {
    if (!d) return;
    onSelect(d);
    setQuery('');
    setOpen(false);
  };

  return (
    <View style={{ gap: S.sm, zIndex: 10 }}>
      {/* zIndex keeps the suggestions above the filter row below it */}
      <View style={{ zIndex: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: R.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: 12, gap: 8 }}>
          <Icon name="search" color={C.sub} />
          <TextInput
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search cities and towns"
            placeholderTextColor={C.faint}
            accessibilityLabel="Search destinations"
            role="combobox"
            aria-expanded={show}
            aria-controls="explore-search-results"
            aria-activedescendant={show && results[active] ? `explore-opt-${results[active].id}` : undefined}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => choose(results[active] ?? results[0])}
            onKeyPress={(e) => {
              const k = e.nativeEvent.key;
              if (k === 'ArrowDown') setActive((i) => Math.min(results.length - 1, i + 1));
              else if (k === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
              else if (k === 'Escape') setOpen(false);
            }}
            style={{ flex: 1, paddingVertical: 12, fontSize: 16, color: C.text }}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
              <Icon name="close-circle" color={C.faint} />
            </Pressable>
          )}
        </View>

        {show && (
          <View
            nativeID="explore-search-results"
            role={'listbox' as 'list'} // RN's Role type lacks listbox; react-native-web passes it through
            accessibilityLabel="Matching destinations"
            style={{ position: 'absolute', top: 52, left: 0, right: 0, backgroundColor: '#fff', borderRadius: R.md, borderWidth: 1, borderColor: C.line, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 }}>
            {results.length === 0 ? (
              <View style={{ padding: S.md, gap: 4 }}>
                <Text style={{ color: C.text, fontWeight: '600' }}>No featured place matches “{query.trim()}”{filter !== 'all' ? ` in ${filter === 'city' ? 'cities' : 'towns'}` : ''}.</Text>
                <Text style={{ color: C.sub }}>Tip: tap anywhere on the globe to look around there in 360°.</Text>
              </View>
            ) : (
              results.map((d, i) => (
                <Pressable
                  key={d.id}
                  nativeID={`explore-opt-${d.id}`}
                  role="option"
                  aria-selected={i === active}
                  onPress={() => choose(d)}
                  onHoverIn={() => setActive(i)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: S.md, paddingVertical: 10, backgroundColor: i === active ? C.primarySoft : '#fff' }}>
                  <Icon name={d.type === 'city' ? 'business' : 'home'} size={16} color={d.type === 'city' ? C.primary : C.twin} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }}>{d.name}</Text>
                    <Text style={{ fontSize: 13, color: C.sub }}>{d.country} · {d.type === 'city' ? 'City' : 'Town'}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>

      <Segmented
        options={[
          { value: 'all', label: 'All' },
          { value: 'city', label: 'Cities' },
          { value: 'town', label: 'Towns' },
        ]}
        value={filter}
        onChange={onFilter}
        color={C.twin}
      />
    </View>
  );
}
