const { withAndroidManifest } = require('expo/config-plugins');

/*
 * (Copied between user-app and partner-app — keep in sync.)
 *
 * Lets Razorpay's in-app checkout see the UPI apps on the phone (PhonePe, Google Pay, Paytm…).
 * From Android 11 an app can't see which other apps are installed unless it says what it looks
 * for; without this Razorpay finds no UPI app and shows no UPI option at all (UPI by typing an
 * ID is being retired, so the apps are the only way).
 */
const UPI_PACKAGES = [
  'com.google.android.apps.nbu.paisa.user', // Google Pay
  'com.phonepe.app', // PhonePe
  'net.one97.paytm', // Paytm
  'in.org.npci.upiapp', // BHIM
  'in.amazon.mShop.android.shopping', // Amazon Pay
  'com.dreamplug.androidapp', // CRED
  'com.mobikwik_new', // MobiKwik
  'com.whatsapp', // WhatsApp Pay
];

module.exports = function withUpiApps(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const queries = manifest.queries?.[0] ?? {};
    // Any app that can take a "upi://pay" link.
    const intents = queries.intent ?? [];
    const hasUpiIntent = intents.some((intent) => intent.data?.some((data) => data.$?.['android:scheme'] === 'upi'));
    if (!hasUpiIntent) {
      intents.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'upi', 'android:host': 'pay' } }],
      });
    }
    const packages = queries.package ?? [];
    for (const name of UPI_PACKAGES) {
      if (!packages.some((entry) => entry.$?.['android:name'] === name)) packages.push({ $: { 'android:name': name } });
    }
    manifest.queries = [{ ...queries, intent: intents, package: packages }];
    return mod;
  });
};
