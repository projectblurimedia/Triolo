import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, headerGradient, typography, useThemeColors } from '@/theme';

interface SelectFieldProps {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  disabledHint?: string;
  searchPlaceholder: string;
  emptyMessage: string;
}

/**
 * A `TextField`-styled tap target that opens a full-screen searchable list instead of a
 * keyboard — for fields backed by a fixed, sometimes-long option list (State/District, see
 * `constants/indiaLocations.ts`) rather than free text. Same overall chrome as
 * `NearbySearchModal` (gradient header, search bar in its own card below the header, not
 * inside it) so a new full-screen picker doesn't invent a fourth modal style in this app.
 */
export function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled,
  disabledHint,
  searchPlaceholder,
  emptyMessage,
}: SelectFieldProps) {
  const { colors } = useThemeColors();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Pressable
        style={[
          styles.field,
          { borderColor: colors.border, backgroundColor: disabled ? colors.background : undefined },
          disabled ? styles.fieldDisabled : null,
        ]}
        onPress={() => {
          if (!disabled) setVisible(true);
        }}
      >
        <Text style={[styles.fieldText, { color: value ? colors.text : colors.textMuted }]} numberOfLines={1}>
          {value || (disabled ? disabledHint ?? placeholder : placeholder)}
        </Text>
        <FontAwesome6 name="chevron-down" size={13} color={colors.textMuted} solid />
      </Pressable>

      <SelectModal
        visible={visible}
        onClose={() => setVisible(false)}
        title={label}
        options={options}
        value={value}
        onSelect={onChange}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
      />
    </View>
  );
}

interface SelectModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  searchPlaceholder: string;
  emptyMessage: string;
}

function SelectModal({ visible, onClose, title, options, value, onSelect, searchPlaceholder, emptyMessage }: SelectModalProps) {
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return trimmed ? options.filter((option) => option.toLowerCase().includes(trimmed)) : options;
  }, [options, query]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.modalHeader, { paddingTop: insets.top + 14 }]}
        >
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalHeaderTitle} numberOfLines={1}>
              {title}
            </Text>
            <Pressable style={styles.closeButton} onPress={handleClose} hitSlop={8}>
              <FontAwesome6 name="xmark" size={18} color="#FFFFFF" solid />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FontAwesome6 name="magnifying-glass" size={14} color={colors.textMuted} solid />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoFocus
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyMessage}</Text>
          }
          renderItem={({ item }) => {
            const isSelected = item === value;
            return (
              <Pressable
                style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => {
                  onSelect(item);
                  handleClose();
                }}
              >
                <Text style={[styles.rowText, { color: isSelected ? colors.primary : colors.text }]} numberOfLines={1}>
                  {item}
                </Text>
                {isSelected ? <FontAwesome6 name="check" size={14} color={colors.primary} solid /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { ...typography.caption, marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldDisabled: { opacity: 0.6 },
  fieldText: { ...typography.body, flex: 1, marginRight: 8 },
  modalContainer: { flex: 1 },
  modalHeader: { paddingBottom: 20, paddingHorizontal: 20 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalHeaderTitle: { ...typography.subheading, fontFamily: fonts.semiBold, color: '#FFFFFF', flex: 1, marginRight: 10 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
  },
  searchInput: { flex: 1, ...typography.body, padding: 0 },
  listContent: { padding: 20, paddingTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  rowText: { ...typography.body, flex: 1, marginRight: 8 },
  emptyText: { ...typography.body, textAlign: 'center', marginTop: 24 },
});
