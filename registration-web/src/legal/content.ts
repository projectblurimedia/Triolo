import { LEGAL } from './contact';

export type Lang = 'en' | 'te';
export interface LegalSection {
  heading: string;
  /** Paragraphs; a line starting with "• " is shown as a bullet. */
  body: string[];
}
export interface LegalDoc {
  title: string;
  subtitle: string;
  intro: string;
  sections: LegalSection[];
}

const contactLine = {
  en: `Email ${LEGAL.supportEmail}. Grievance Officer: ${LEGAL.grievanceOfficer}, ${LEGAL.grievanceEmail} — we reply within 48 hours and resolve within 30 days.`,
  te: `ఈమెయిల్ ${LEGAL.supportEmail}. ఫిర్యాదుల అధికారి: ${LEGAL.grievanceOfficer}, ${LEGAL.grievanceEmail} — 48 గంటల్లో స్పందించి, 30 రోజుల్లో పరిష్కరిస్తాం.`,
};

export const PRIVACY: Record<Lang, LegalDoc> = {
  en: {
    title: 'Privacy Policy',
    subtitle: `Last updated ${LEGAL.lastUpdated}`,
    intro: `${LEGAL.businessName} ("we") runs the Triolo app, the Triolo Partner app and these websites. This policy says what we collect, why, who sees it, how long we keep it, and your rights under India's Digital Personal Data Protection Act, 2023.`,
    sections: [
      {
        heading: 'What we collect',
        body: [
          '• Your name and mobile number (to sign in with a one-time code). Email is optional.',
          '• Your location — the GPS position or the place you choose — to show workers, shops and jobs near you, and to send requests to the right people.',
          '• Photos you add: profile photo, work or shop photos, photos of a problem, photos of a shopping list or bill.',
          '• Voice messages you record for a shopping list (and a shop\'s voice message with its bill).',
          '• What you do in the app: bookings, orders, problem posts, job posts, ratings and reviews, notifications.',
          '• For partners on a trip: your live location while the trip is running, so the customer can see you coming.',
          '• Payment records (amount, date, Razorpay payment ID). We never see or store your card, UPI PIN or bank details — Razorpay handles them.',
          '• A device notification token, so we can send you notifications.',
        ],
      },
      {
        heading: 'Why we use it',
        body: [
          '• To run the service: find nearby workers and shops, send and track bookings and orders, show bills and PINs.',
          '• To keep it safe: verify partners, stop fraud and misuse, handle complaints.',
          '• To take payments and give refunds.',
          '• To send notifications about your bookings, orders and account.',
          '• To show ads from local businesses (ads never receive your personal details).',
        ],
      },
      {
        heading: 'Who sees your details',
        body: [
          '• The other side of a booking or order sees your name and place. Phone numbers are shared only after a request is accepted.',
          '• Service providers who run the app for us: Supabase (database), Vercel (servers), Cloudinary (photos and voice messages), Google Firebase (notifications), Razorpay (payments) and our SMS provider (sign-in codes). They may only use your data to provide their service to us.',
          '• Government or police, only when the law requires it.',
          '• We do not sell your personal data.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          '• Photos and voice messages of a shop order are deleted automatically 30 days after the order ends. The order itself stays in your history and says the photos were removed.',
          '• When you delete your account: everything under way is cancelled, your worker / shop / job-post profiles and all your photos and voice messages are deleted at once, and you are signed out. Your name, number, email, place and photo are kept for 30 days (for disputes and safety) and then wiped for good. Past orders and jobs other people were part of stay, showing "Deleted user", because they are also their records.',
          '• Payment records are kept as long as tax law requires (usually 8 years), without your personal details once the account is deleted.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          '• See and correct your details (Profile → Edit profile).',
          '• Delete your account at any time: in the app (Profile menu → Delete account) or on our website (/delete-account).',
          '• Withdraw consent — for example, turn off location or notifications in your phone settings (some features then won\'t work).',
          '• Complain to our Grievance Officer, and if not resolved, to the Data Protection Board of India.',
        ],
      },
      {
        heading: 'Safety, children and changes',
        body: [
          '• Data is sent over HTTPS and stored with access controls. No system is perfectly secure; we will tell you if a breach affects you.',
          '• Triolo is for people aged 18 and over.',
          '• If we change this policy we will update the date above and tell you in the app for important changes.',
        ],
      },
      { heading: 'Contact', body: [contactLine.en] },
    ],
  },
  te: {
    title: 'గోప్యతా విధానం',
    subtitle: `చివరి మార్పు ${LEGAL.lastUpdated}`,
    intro: `${LEGAL.businessName} ("మేము") Triolo యాప్, Triolo Partner యాప్ మరియు ఈ వెబ్‌సైట్లను నడుపుతుంది. మేము ఏమి సేకరిస్తాం, ఎందుకు, ఎవరు చూస్తారు, ఎంతకాలం ఉంచుతాం, భారతదేశ డిజిటల్ వ్యక్తిగత డేటా రక్షణ చట్టం, 2023 ప్రకారం మీ హక్కులు ఏమిటో ఈ విధానం చెబుతుంది.`,
    sections: [
      {
        heading: 'మేము ఏమి సేకరిస్తాం',
        body: [
          '• మీ పేరు, మొబైల్ నంబర్ (వన్-టైమ్ కోడ్‌తో లాగిన్ కోసం). ఈమెయిల్ ఐచ్ఛికం.',
          '• మీ లొకేషన్ — GPS లేదా మీరు ఎంచుకున్న ప్రదేశం — దగ్గరలోని వర్కర్లు, షాపులు, పనులు చూపడానికి.',
          '• మీరు జోడించే ఫోటోలు: ప్రొఫైల్, పని లేదా షాప్ ఫోటోలు, సమస్య ఫోటోలు, లిస్ట్ లేదా బిల్ ఫోటోలు.',
          '• షాపింగ్ లిస్ట్ కోసం మీరు రికార్డ్ చేసే వాయిస్ మెసేజ్‌లు (బిల్‌తో షాప్ వాయిస్ మెసేజ్ కూడా).',
          '• యాప్‌లో మీ పనులు: బుకింగ్‌లు, ఆర్డర్‌లు, సమస్యలు, జాబ్ పోస్ట్‌లు, రేటింగ్‌లు, నోటిఫికేషన్‌లు.',
          '• ట్రిప్‌లో ఉన్న పార్ట్‌నర్‌ల లైవ్ లొకేషన్ — ట్రిప్ జరుగుతున్నంత వరకు మాత్రమే, కస్టమర్ చూడడానికి.',
          '• పేమెంట్ రికార్డులు (మొత్తం, తేదీ, Razorpay ID). కార్డ్, UPI PIN, బ్యాంక్ వివరాలు మేము చూడము, దాచము.',
          '• నోటిఫికేషన్‌ల కోసం ఫోన్ టోకెన్.',
        ],
      },
      {
        heading: 'ఎందుకు వాడతాం',
        body: [
          '• సేవ నడపడానికి: దగ్గరలోని వర్కర్లు, షాపులు కనుగొనడం, బుకింగ్‌లు, ఆర్డర్‌లు, బిల్‌లు, PINలు.',
          '• భద్రత కోసం: పార్ట్‌నర్‌ల ధృవీకరణ, మోసాల నివారణ, ఫిర్యాదులు.',
          '• పేమెంట్లు తీసుకోవడానికి, రీఫండ్‌లు ఇవ్వడానికి.',
          '• మీ బుకింగ్‌లు, ఆర్డర్‌ల గురించి నోటిఫికేషన్‌లు పంపడానికి.',
          '• స్థానిక వ్యాపారాల ప్రకటనలు చూపడానికి (ప్రకటనదారులకు మీ వివరాలు ఇవ్వం).',
        ],
      },
      {
        heading: 'మీ వివరాలు ఎవరు చూస్తారు',
        body: [
          '• బుకింగ్ / ఆర్డర్‌లో అవతలి వారు మీ పేరు, ప్రదేశం చూస్తారు. ఫోన్ నంబర్ రిక్వెస్ట్ అంగీకరించిన తర్వాతే.',
          '• యాప్ నడపడానికి సహాయపడే సేవలు: Supabase, Vercel, Cloudinary, Google Firebase, Razorpay, SMS ప్రొవైడర్ — మాకు సేవ ఇవ్వడానికి మాత్రమే వాడాలి.',
          '• చట్టం కోరినప్పుడు మాత్రమే ప్రభుత్వం లేదా పోలీసులు.',
          '• మీ వ్యక్తిగత డేటాను మేము అమ్మము.',
        ],
      },
      {
        heading: 'ఎంతకాలం ఉంచుతాం',
        body: [
          '• షాప్ ఆర్డర్ ఫోటోలు, వాయిస్ మెసేజ్‌లు ఆర్డర్ ముగిసిన 30 రోజుల తర్వాత ఆటోమేటిక్‌గా తొలగిస్తాం. ఆర్డర్ మీ చరిత్రలో ఉంటుంది, ఫోటోలు తొలగించినట్టు చెబుతుంది.',
          '• అకౌంట్ తొలగిస్తే: జరుగుతున్నవి రద్దవుతాయి, మీ వర్కర్ / షాప్ / జాబ్ పోస్ట్ ప్రొఫైల్‌లు, అన్ని ఫోటోలు, వాయిస్ మెసేజ్‌లు వెంటనే తొలగిపోతాయి, మీరు లాగ్ అవుట్ అవుతారు. పేరు, నంబర్, ఈమెయిల్, ప్రదేశం, ఫోటో 30 రోజులు ఉంచి (వివాదాలు, భద్రత కోసం) తర్వాత శాశ్వతంగా తొలగిస్తాం. ఇతరులు భాగమైన పాత ఆర్డర్‌లు "Deleted user" అని ఉంటాయి.',
          '• పేమెంట్ రికార్డులు పన్ను చట్టం కోరినంత కాలం (సాధారణంగా 8 సంవత్సరాలు), మీ వ్యక్తిగత వివరాలు లేకుండా ఉంచుతాం.',
        ],
      },
      {
        heading: 'మీ హక్కులు',
        body: [
          '• మీ వివరాలు చూడడం, సరిచేయడం (Profile → Edit profile).',
          '• ఎప్పుడైనా అకౌంట్ తొలగించడం: యాప్‌లో (Profile మెనూ → Delete account) లేదా వెబ్‌సైట్‌లో (/delete-account).',
          '• అనుమతి ఉపసంహరణ — ఫోన్ సెట్టింగ్స్‌లో లొకేషన్ / నోటిఫికేషన్‌లు ఆపవచ్చు (కొన్ని ఫీచర్లు పనిచేయవు).',
          '• మా ఫిర్యాదుల అధికారికి, పరిష్కారం కాకపోతే డేటా ప్రొటెక్షన్ బోర్డ్ ఆఫ్ ఇండియాకు ఫిర్యాదు.',
        ],
      },
      {
        heading: 'భద్రత, పిల్లలు, మార్పులు',
        body: [
          '• డేటా HTTPS ద్వారా పంపి, నియంత్రిత యాక్సెస్‌తో దాస్తాం. ఏ వ్యవస్థా పూర్తిగా సురక్షితం కాదు; మీపై ప్రభావం ఉంటే చెబుతాం.',
          '• Triolo 18 ఏళ్లు పైబడిన వారికి మాత్రమే.',
          '• విధానం మారితే పై తేదీ మారుస్తాం; ముఖ్యమైన మార్పులు యాప్‌లో చెబుతాం.',
        ],
      },
      { heading: 'సంప్రదించండి', body: [contactLine.te] },
    ],
  },
};

export const TERMS: Record<Lang, LegalDoc> = {
  en: {
    title: 'Terms of Use',
    subtitle: `Last updated ${LEGAL.lastUpdated}`,
    intro: `These terms apply when you use the Triolo apps or websites. By signing up you agree to them.`,
    sections: [
      {
        heading: 'What Triolo is',
        body: [
          'Triolo is a marketplace that connects customers with independent workers, shops and people looking for jobs. Triolo does not do the work, sell the goods or employ the workers. The work or sale is an agreement between you and the partner.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          '• You must be 18 or older and give your real name and your own mobile number. One number = one account.',
          '• Keep your phone and sign-in codes private. You are responsible for what happens in your account.',
          '• You can delete your account at any time (see the Privacy Policy for what happens).',
        ],
      },
      {
        heading: 'Partners (workers, shops, job posts)',
        body: [
          '• Give true details about your skills, shop, prices and experience. We may verify them and may reject or remove a profile.',
          '• "Verified" or "Trusted by Triolo" means we checked some details — it is not a guarantee of the quality of the work.',
          '• Accept only jobs and orders you can do, arrive when you said, and use the PIN to start or hand over.',
          '• Partners collect payment for their work or goods directly from the customer. Triolo does not hold that money.',
        ],
      },
      {
        heading: 'Fees, plans and payments',
        body: [
          '• Some actions may need a small fee or a plan (Triolo Plus, partner plans, Trusted badge, Boost, ads). Prices are shown before you pay, through Razorpay.',
          '• Monthly free uses or free accepts may be offered; their number can change.',
          '• Refunds follow our Refund Policy.',
        ],
      },
      {
        heading: 'Rules for everyone',
        body: [
          '• No false bookings, fake reviews, abuse, threats, illegal goods or services, or contacting people to avoid the app\'s rules.',
          '• Ratings and reviews must be honest and about a real job or order.',
          '• Do not copy, break or misuse the apps or websites.',
          '• We may suspend or ban accounts that break these rules, and cancel what they have under way.',
        ],
      },
      {
        heading: 'Cancellations',
        body: [
          '• A customer can cancel a request until it is accepted, and a late worker or stalled order with Cancel & Rate.',
          '• After the arrival PIN is used, or once a shop starts packing, only the partner or Triolo can cancel.',
        ],
      },
      {
        heading: 'Ads',
        body: ['Ads are from local businesses and reviewed by Triolo. The advertiser is responsible for what the ad promises.'],
      },
      {
        heading: 'Liability',
        body: [
          'We work to keep Triolo running, but it is provided "as is". As a marketplace, Triolo is not responsible for the quality, safety or legality of the work or goods, or for losses from dealings between users, to the extent the law allows. If we are found responsible, our liability is limited to the fees you paid Triolo in the last 3 months.',
        ],
      },
      {
        heading: 'Law and disputes',
        body: [`These terms follow the laws of India. Courts in ${LEGAL.city} have jurisdiction. Please contact us first — most problems are solved quickly.`],
      },
      { heading: 'Contact', body: [contactLine.en] },
    ],
  },
  te: {
    title: 'వినియోగ నిబంధనలు',
    subtitle: `చివరి మార్పు ${LEGAL.lastUpdated}`,
    intro: 'Triolo యాప్‌లు లేదా వెబ్‌సైట్లు వాడినప్పుడు ఈ నిబంధనలు వర్తిస్తాయి. సైన్ అప్ చేస్తే మీరు వీటికి అంగీకరించినట్టే.',
    sections: [
      {
        heading: 'Triolo అంటే',
        body: [
          'Triolo కస్టమర్లను స్వతంత్ర వర్కర్లు, షాపులు, ఉద్యోగం కోరేవారితో కలిపే మార్కెట్‌ప్లేస్. Triolo పని చేయదు, వస్తువులు అమ్మదు, వర్కర్లను ఉద్యోగంలో పెట్టుకోదు. పని లేదా అమ్మకం మీకు, పార్ట్‌నర్‌కు మధ్య ఒప్పందం.',
        ],
      },
      {
        heading: 'మీ అకౌంట్',
        body: [
          '• 18 ఏళ్లు పైబడి ఉండాలి, నిజమైన పేరు, మీ సొంత నంబర్ ఇవ్వాలి. ఒక నంబర్ = ఒక అకౌంట్.',
          '• మీ ఫోన్, సైన్-ఇన్ కోడ్‌లు ఎవరికీ చెప్పకండి. మీ అకౌంట్‌లో జరిగేదానికి మీరే బాధ్యులు.',
          '• ఎప్పుడైనా అకౌంట్ తొలగించవచ్చు (గోప్యతా విధానం చూడండి).',
        ],
      },
      {
        heading: 'పార్ట్‌నర్‌లు',
        body: [
          '• మీ నైపుణ్యాలు, షాప్, ధరల గురించి నిజమైన వివరాలు ఇవ్వండి. మేము ధృవీకరించవచ్చు, ప్రొఫైల్ తిరస్కరించవచ్చు లేదా తొలగించవచ్చు.',
          '• "Verified" లేదా "Trusted by Triolo" అంటే కొన్ని వివరాలు చూశాం — పని నాణ్యతకు హామీ కాదు.',
          '• చేయగలిగిన పనులు, ఆర్డర్‌లే అంగీకరించండి, చెప్పిన సమయానికి రండి, PIN వాడండి.',
          '• పని లేదా వస్తువుల డబ్బు పార్ట్‌నర్ నేరుగా కస్టమర్ నుండి తీసుకుంటారు. Triolo ఆ డబ్బు ఉంచుకోదు.',
        ],
      },
      {
        heading: 'ఫీజులు, ప్లాన్‌లు, పేమెంట్లు',
        body: [
          '• కొన్ని పనులకు చిన్న ఫీజు లేదా ప్లాన్ (Triolo Plus, పార్ట్‌నర్ ప్లాన్‌లు, Trusted బ్యాడ్జ్, Boost, ప్రకటనలు) అవసరం కావచ్చు. చెల్లించే ముందు ధర Razorpay ద్వారా చూపిస్తాం.',
          '• నెలకు ఉచిత వాడకాలు ఇవ్వవచ్చు; వాటి సంఖ్య మారవచ్చు.',
          '• రీఫండ్‌లు మా రీఫండ్ విధానం ప్రకారం.',
        ],
      },
      {
        heading: 'అందరికీ నియమాలు',
        body: [
          '• తప్పుడు బుకింగ్‌లు, నకిలీ రివ్యూలు, దుర్భాష, బెదిరింపులు, చట్టవిరుద్ధ వస్తువులు / సేవలు వద్దు.',
          '• రేటింగ్‌లు నిజమైన పని లేదా ఆర్డర్ గురించి నిజాయితీగా ఉండాలి.',
          '• యాప్‌లను, వెబ్‌సైట్లను కాపీ చేయడం, పాడుచేయడం వద్దు.',
          '• నియమాలు ఉల్లంఘించే అకౌంట్‌లను ఆపవచ్చు లేదా నిషేధించవచ్చు.',
        ],
      },
      {
        heading: 'రద్దులు',
        body: [
          '• అంగీకరించే వరకు కస్టమర్ రిక్వెస్ట్ రద్దు చేయవచ్చు; ఆలస్యమైన వర్కర్ లేదా ఆగిన ఆర్డర్‌ను Cancel & Rate తో.',
          '• రాక PIN వాడిన తర్వాత లేదా షాప్ ప్యాకింగ్ మొదలెట్టాక, పార్ట్‌నర్ లేదా Triolo మాత్రమే రద్దు చేయగలరు.',
        ],
      },
      { heading: 'ప్రకటనలు', body: ['ప్రకటనలు స్థానిక వ్యాపారాలవి, Triolo పరిశీలిస్తుంది. ప్రకటనలో హామీలకు ప్రకటనదారే బాధ్యులు.'] },
      {
        heading: 'బాధ్యత',
        body: [
          'Triolo "ఉన్నది ఉన్నట్టు" అందిస్తాం. మార్కెట్‌ప్లేస్‌గా, పని లేదా వస్తువుల నాణ్యత, భద్రతకు, వినియోగదారుల మధ్య లావాదేవీల నష్టాలకు, చట్టం అనుమతించినంత వరకు Triolo బాధ్యత వహించదు. బాధ్యత ఉన్నట్టు తేలితే, గత 3 నెలల్లో మీరు Triolo కు చెల్లించిన ఫీజుల వరకే.',
        ],
      },
      { heading: 'చట్టం, వివాదాలు', body: [`ఈ నిబంధనలు భారత చట్టాల ప్రకారం. ${LEGAL.city} కోర్టులకు అధికార పరిధి. ముందుగా మమ్మల్ని సంప్రదించండి.`] },
      { heading: 'సంప్రదించండి', body: [contactLine.te] },
    ],
  },
};

export const REFUNDS: Record<Lang, LegalDoc> = {
  en: {
    title: 'Refund & Cancellation Policy',
    subtitle: `Last updated ${LEGAL.lastUpdated}`,
    intro: 'All payments to Triolo go through Razorpay. Money you pay a worker or shop for their work or goods is paid to them directly and is not covered here — contact them, or us if you need help.',
    sections: [
      {
        heading: 'Fee for one booking, order or problem post',
        body: [
          '• If it does not go ahead through no fault of yours — nobody accepts before your waiting time ends, the worker or shop declines or cancels, Triolo cancels it, or you cancel a late worker or stalled order — the fee is kept as a credit and your next one of the same kind is free. You will see "Using your earlier payment".',
          '• A free monthly use that did not go ahead is simply given back to the month.',
          '• If you cancel a request after a worker or shop has accepted on time, the fee is used.',
        ],
      },
      {
        heading: 'Triolo Plus, partner plans and Trusted badge',
        body: [
          '• They start as soon as the payment succeeds and are not refundable after that, including when you delete your account.',
          '• If money was taken but the plan or badge did not start, write to us — we refund it in full within 5–7 working days.',
        ],
      },
      {
        heading: 'Ads and Boost',
        body: [
          '• Paid online and rejected by Triolo, or withdrawn by you before it is approved: refunded in full, automatically, to the same payment method. Banks usually take 5–7 working days.',
          '• Once approved and running: not refundable.',
          '• Removed by Triolo for breaking the ad rules: not refundable.',
        ],
      },
      {
        heading: 'Failed or double payments',
        body: ['If a payment fails but money left your account, or you were charged twice, Razorpay or we refund it automatically, usually within 5–7 working days. If not, write to us with the payment ID.'],
      },
      { heading: 'Contact', body: [contactLine.en] },
    ],
  },
  te: {
    title: 'రీఫండ్ & రద్దు విధానం',
    subtitle: `చివరి మార్పు ${LEGAL.lastUpdated}`,
    intro: 'Triolo కు చెల్లింపులన్నీ Razorpay ద్వారా. వర్కర్ లేదా షాప్‌కు వారి పని / వస్తువుల కోసం చెల్లించే డబ్బు నేరుగా వారికే — అది ఇక్కడ వర్తించదు.',
    sections: [
      {
        heading: 'ఒక బుకింగ్, ఆర్డర్ లేదా సమస్య పోస్ట్ ఫీజు',
        body: [
          '• మీ తప్పు లేకుండా జరగకపోతే — సమయం ముగిసేలోపు ఎవరూ అంగీకరించకపోతే, వర్కర్ / షాప్ తిరస్కరిస్తే లేదా రద్దు చేస్తే, Triolo రద్దు చేస్తే, లేదా ఆలస్యమైన వర్కర్ / ఆగిన ఆర్డర్‌ను మీరు రద్దు చేస్తే — ఫీజు క్రెడిట్‌గా ఉంటుంది, అదే రకం తదుపరిది ఉచితం.',
          '• జరగని నెలవారీ ఉచిత వాడకం ఆ నెలకే తిరిగి వస్తుంది.',
          '• సమయానికి అంగీకరించిన తర్వాత మీరు రద్దు చేస్తే, ఫీజు వాడినట్టే.',
        ],
      },
      {
        heading: 'Triolo Plus, పార్ట్‌నర్ ప్లాన్‌లు, Trusted బ్యాడ్జ్',
        body: [
          '• పేమెంట్ విజయవంతమైన వెంటనే మొదలవుతాయి; తర్వాత రీఫండ్ ఉండదు, అకౌంట్ తొలగించినా కూడా.',
          '• డబ్బు కట్ అయి ప్లాన్ / బ్యాడ్జ్ మొదలవకపోతే, మాకు రాయండి — 5–7 పని దినాల్లో పూర్తి రీఫండ్.',
        ],
      },
      {
        heading: 'ప్రకటనలు, Boost',
        body: [
          '• ఆన్‌లైన్‌లో చెల్లించి Triolo తిరస్కరిస్తే, లేదా ఆమోదానికి ముందు మీరు ఉపసంహరిస్తే: అదే పేమెంట్ పద్ధతికి ఆటోమేటిక్‌గా పూర్తి రీఫండ్ (సాధారణంగా 5–7 పని దినాలు).',
          '• ఆమోదించి నడుస్తున్న తర్వాత: రీఫండ్ లేదు.',
          '• నియమాలు ఉల్లంఘించినందుకు Triolo తొలగిస్తే: రీఫండ్ లేదు.',
        ],
      },
      { heading: 'విఫలమైన లేదా రెండుసార్లు చెల్లింపులు', body: ['డబ్బు కట్ అయి పేమెంట్ విఫలమైతే లేదా రెండుసార్లు కట్ అయితే, సాధారణంగా 5–7 పని దినాల్లో ఆటోమేటిక్‌గా తిరిగి వస్తుంది. రాకపోతే పేమెంట్ IDతో మాకు రాయండి.'] },
      { heading: 'సంప్రదించండి', body: [contactLine.te] },
    ],
  },
};
