import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GradientHeader } from './GradientHeader';
import { LanguagePickerModal } from './LanguagePickerModal';

interface RegisterHeaderProps {
  title: string;
  subtitle: string;
}

/**
 * The registration screens' header: back, title + subtitle, and a language icon (the language
 * matters before anything is filled in). Before sign-in the choice is saved on the phone and
 * sent with the new account; there is no account to update yet.
 */
export function RegisterHeader({ title, subtitle }: RegisterHeaderProps) {
  const { t } = useTranslation();
  const [languageOpen, setLanguageOpen] = useState(false);

  return (
    <>
      <GradientHeader
        title={title}
        subtitle={subtitle}
        showBack
        actions={[{ icon: 'language', accessibilityLabel: t('settings.language'), onPress: () => setLanguageOpen(true) }]}
      />
      <LanguagePickerModal visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </>
  );
}
