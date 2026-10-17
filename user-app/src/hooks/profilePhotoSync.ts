import i18n from '@/localization/i18n';
import { PickedImage } from '@/components/ImagePickerField';
import { showToast } from '@/state/toastStore';

/**
 * After a worker/shop profile saves: uploads the new profile photo, or removes the saved one
 * (`null`); `undefined` leaves it as it is. A failed photo never undoes the saved profile — the
 * person is told and can add it again from Edit.
 */
export async function syncProfilePhoto(
  photo: PickedImage | null | undefined,
  upload: (image: PickedImage) => Promise<unknown>,
  remove: () => Promise<unknown>,
): Promise<void> {
  if (photo === undefined) return;
  try {
    if (photo) await upload(photo);
    else await remove();
  } catch {
    showToast({ variant: 'error', title: i18n.t('profilePhoto.uploadFailed') });
  }
}
