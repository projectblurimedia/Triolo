import { PreferredLanguage } from '@/modules/auth/interfaces';

/** Every order step that notifies someone (the customer, or for 'placed'/'cancelled_by_customer' the shop). */
export type OrderEvent =
  | 'placed'
  | 'accepted'
  | 'declined'
  | 'packed'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled_by_shop'
  | 'cancelled_by_customer';

export interface OrderTemplateValues {
  shop: string;
  count?: number;
  packed?: number;
  total?: string;
}

type Template = (values: OrderTemplateValues) => { title: string; body: string };

const TEMPLATES: Record<PreferredLanguage, Record<OrderEvent, Template>> = {
  en: {
    placed: ({ count }) => ({ title: 'New Order', body: `A customer sent a list of ${count} item(s). Accept it to start packing.` }),
    accepted: ({ shop }) => ({ title: 'Order Accepted', body: `${shop} is checking and packing your list.` }),
    declined: ({ shop }) => ({ title: 'Order Declined', body: `${shop} can't take your list right now. Try another shop.` }),
    packed: ({ shop, packed, count, total }) => ({
      title: 'Your Bill Is Ready',
      body: `${shop} packed ${packed} of ${count} item(s). Total ₹${total}. Open the order to see the bill.`,
    }),
    ready: ({ shop }) => ({ title: 'Ready for Pickup', body: `Your order is ready at ${shop}. Show your PIN when you collect it.` }),
    out_for_delivery: ({ shop }) => ({ title: 'Out for Delivery', body: `${shop} is bringing your order. Keep your PIN ready.` }),
    completed: ({ shop }) => ({ title: 'Order Completed', body: `Thanks for ordering from ${shop}. Rate your experience.` }),
    cancelled_by_shop: ({ shop }) => ({ title: 'Order Cancelled', body: `${shop} cancelled your order.` }),
    cancelled_by_customer: () => ({ title: 'Order Cancelled', body: 'The customer cancelled their order.' }),
  },
  te: {
    placed: ({ count }) => ({ title: 'కొత్త ఆర్డర్', body: `ఒక కస్టమర్ ${count} వస్తువుల జాబితా పంపారు. ప్యాక్ చేయడం ప్రారంభించడానికి అంగీకరించండి.` }),
    accepted: ({ shop }) => ({ title: 'ఆర్డర్ అంగీకరించబడింది', body: `${shop} మీ జాబితాను చూసి ప్యాక్ చేస్తోంది.` }),
    declined: ({ shop }) => ({ title: 'ఆర్డర్ తిరస్కరించబడింది', body: `${shop} ప్రస్తుతం మీ జాబితాను తీసుకోలేదు. వేరే షాప్‌ను ప్రయత్నించండి.` }),
    packed: ({ shop, packed, count, total }) => ({
      title: 'మీ బిల్ సిద్ధంగా ఉంది',
      body: `${shop} ${count} లో ${packed} వస్తువులు ప్యాక్ చేసింది. మొత్తం ₹${total}. బిల్ చూడటానికి ఆర్డర్ తెరవండి.`,
    }),
    ready: ({ shop }) => ({ title: 'తీసుకెళ్లడానికి సిద్ధం', body: `మీ ఆర్డర్ ${shop} వద్ద సిద్ధంగా ఉంది. తీసుకునేటప్పుడు మీ PIN చూపించండి.` }),
    out_for_delivery: ({ shop }) => ({ title: 'డెలివరీకి బయలుదేరింది', body: `${shop} మీ ఆర్డర్ తీసుకొస్తోంది. మీ PIN సిద్ధంగా ఉంచుకోండి.` }),
    completed: ({ shop }) => ({ title: 'ఆర్డర్ పూర్తయింది', body: `${shop} నుండి ఆర్డర్ చేసినందుకు ధన్యవాదాలు. మీ అనుభవానికి రేటింగ్ ఇవ్వండి.` }),
    cancelled_by_shop: ({ shop }) => ({ title: 'ఆర్డర్ రద్దు చేయబడింది', body: `${shop} మీ ఆర్డర్‌ను రద్దు చేసింది.` }),
    cancelled_by_customer: () => ({ title: 'ఆర్డర్ రద్దు చేయబడింది', body: 'కస్టమర్ తమ ఆర్డర్‌ను రద్దు చేశారు.' }),
  },
};

export function orderTemplate(event: OrderEvent, language: PreferredLanguage, values: OrderTemplateValues) {
  return (TEMPLATES[language] ?? TEMPLATES.en)[event](values);
}
