/* Content of the three guides (see build.js). Screens are drawn, not screenshots. */
const BLUE = ['#0055D3', '#1D76FA'];
const GREEN = ['#0F9D58', '#34C77B'];
const PURPLE = ['#4338CA', '#7C3AED', '#C026D3'];
const PINK = ['#DB2777', '#F472B6'];
const RED = ['#ef4444', '#dc2626'];
const GOLD = ['#A86C0C', '#D29A26', '#F5CC60'];

const customer = {
  file: 'Triolo-Customer-Guide',
  title: 'Triolo — Customer Guide',
  badge: 'Triolo app',
  icon: 'house-chimney-user',
  color: BLUE,
  cover: [
    'Book a worker, order from a shop, post a problem or hire staff — near you, in English or Telugu.',
    'This guide shows every step with a picture of the screen.',
  ],
  help: 'Tip: every screen has a back button at the top left. Location must be on for anything "near you".',
  chapters: [
    {
      title: 'Sign up and sign in',
      steps: [
        {
          title: 'Choose your language and create your account',
          points: ['Open Triolo, pick English or తెలుగు.', 'Tap Create Account, type your name and mobile number, tap Verify.', 'Type the 6-digit code from the SMS. Add a photo, email and your place if you like, then Register.'],
          screen: [{ t: 'header', title: 'Create Account', sub: 'One number, one account', back: true }, { t: 'input', icon: 'user', text: 'Full name' }, { t: 'input', icon: 'phone', text: '98765 43210   ✓' }, { t: 'pin', digits: '482913' }, { t: 'btn', text: 'Register' }],
          tip: 'Already have an account? Tap Log In and use the same number.',
        },
        {
          title: 'Find your way around',
          points: ['Home: search, quick actions (Quick Book, Quick Order, Hire Staff, Post a Problem) and offers.', 'Services: workers near you by kind. Bazaar: shops near you. Prepare List: your shopping lists. Profile: your details and settings.'],
          screen: [{ t: 'header', title: 'Hi, Ravi', sub: 'Eluru' }, { t: 'input', icon: 'magnifying-glass', text: 'Search workers or shops' }, { t: 'grid', items: [{ icon: 'bolt', text: 'Quick Book', g: BLUE }, { icon: 'basket-shopping', text: 'Quick Order', g: GREEN }, { icon: 'user-tie', text: 'Hire Staff', g: PURPLE }, { icon: 'triangle-exclamation', text: 'Post a Problem', g: PINK }] }, { t: 'tabs', items: ['house', 'screwdriver-wrench', 'list-check', 'store', 'user'], active: 0 }],
        },
      ],
    },
    {
      title: 'Quick Book — a worker in minutes',
      intro: 'Your request goes to every matching worker near you. The first one to accept comes to you.',
      steps: [
        {
          title: 'Choose the work and book',
          points: ['Home → Quick Book. Pick one or more kinds of work (electrician, plumber…).', 'Tap Book Nearby. Turn location on if asked.'],
          screen: [{ t: 'header', title: 'Quick Book', back: true }, { t: 'input', icon: 'magnifying-glass', text: 'Electrician' }, { t: 'chips', items: ['Electrician', 'Plumber', 'Painter', 'Carpenter'], multi: [0] }, { t: 'note', icon: 'gift', text: 'Only 1 free booking left this month', c: '#C08A12' }, { t: 'btn', text: 'Book Nearby' }],
          tip: 'Without Triolo Plus you get some free bookings each month, then a small fee per booking. The app tells you before you pay.',
        },
        {
          title: 'Wait for a worker',
          points: ['The screen shows "Finding a worker" and how long it will wait.', 'You can leave the app — you get a notification when someone accepts.'],
          screen: [{ t: 'header', title: 'Finding a worker', back: true }, { t: 'card', icon: 'satellite-dish', title: 'Asking workers near you', text: 'Electrician' }, { t: 'note', icon: 'hourglass-half', text: 'Ends by itself in 14:32 · Change' }],
        },
        {
          title: 'Track the worker and share the PIN',
          points: ['When accepted you see the worker, their phone and live position on the map.', 'When they arrive, give them the 4-digit PIN on your screen. Never share it before they arrive.'],
          screen: [{ t: 'header', title: 'Track Your Worker', back: true }, { t: 'map', text: 'On the way · 1.2 km' }, { t: 'card', icon: 'user', title: 'Suresh', text: 'Electrician', right: 'Call' }, { t: 'pin', digits: '4821' }],
        },
        {
          title: 'Finish and rate',
          points: ['After the worker taps Work Done, tap Problem Solved and give stars and a review.', 'Your rating helps everyone choose good workers.'],
          screen: [{ t: 'header', title: 'Rate the work', back: true }, { t: 'stars', n: 5 }, { t: 'input', text: 'Fast and neat work' }, { t: 'btn', text: 'Submit rating', c: '#16A34A' }],
        },
      ],
    },
    {
      title: 'Book a particular worker',
      steps: [
        {
          title: 'Open their profile and book',
          points: ['Services or search → tap a worker → Book [name].', 'Pick the work, confirm your place, and send. Only that worker gets it.'],
          screen: [{ t: 'header', title: 'Suresh', sub: 'Electrician · 4.8 ★', back: true }, { t: 'card', icon: 'location-dot', title: '1.4 km away', text: 'Kannapuram' }, { t: 'card', icon: 'star', title: '4.8 from 26 ratings', c: '#C08A12' }, { t: 'btn', text: 'Book Suresh' }],
        },
      ],
    },
    {
      title: 'Post a Problem',
      steps: [
        {
          title: 'Describe it and say your price',
          points: ['Home → Post a Problem. Add photos, pick who you need, write a short note and your price (quotation).', 'Choose the location, then Post. Workers nearby see it and one accepts — then it works like a booking with tracking and PIN.'],
          screen: [{ t: 'header', title: 'Post a Problem', back: true }, { t: 'photos', n: 3 }, { t: 'chips', items: ['Plumber', 'Electrician'], active: 0 }, { t: 'input', icon: 'indian-rupee-sign', text: '500' }, { t: 'btn', text: 'Post' }],
        },
      ],
    },
    {
      title: 'Prepare a shopping list',
      intro: 'Make a list one of four ways. Once you choose a way, only that way stays on screen.',
      steps: [
        {
          title: 'Pick how to make the list',
          points: ['Prepare List → New List.', 'Speak & prepare: say "rice 5 kg, oil 1 litre" and items appear.', 'Add items: type them one by one.', 'Photo of list: take a photo of a list written on paper.', 'Record voice: just say what you want — the shop listens to it.'],
          screen: [{ t: 'header', title: 'New List', back: true }, { t: 'input', text: 'List name (optional)' }, { t: 'grid', items: [{ icon: 'microphone-lines', text: 'Speak & prepare', g: BLUE }, { icon: 'keyboard', text: 'Add items', g: GREEN }, { icon: 'camera', text: 'Photo of list', g: PURPLE }, { icon: 'microphone', text: 'Record voice', g: PINK }] }],
        },
        {
          title: 'Record a voice list',
          points: ['Tap Record voice, speak up to 3 minutes, tap the red stop button.', 'Play it back, delete or Record again. Then Save List.'],
          screen: [{ t: 'header', title: 'New List', back: true }, { t: 'grid', items: [{ icon: 'microphone', text: 'Record voice', g: PINK }] }, { t: 'voice', time: '0:24' }, { t: 'btn', text: 'Save List' }],
          tip: 'A list with no name gets one like "Voice list · 2 Nov, 4:35 PM". Deleting everything from a saved list deletes the list.',
        },
      ],
    },
    {
      title: 'Order from shops',
      steps: [
        {
          title: 'Quick Order or a particular shop',
          points: ['Quick Order: choose your list, the kind of shop and Delivery or Pickup — every matching shop near you gets it, the first to accept packs it.', 'Particular shop: Bazaar → tap a shop → Order from this shop.'],
          screen: [{ t: 'header', title: 'Quick Order', back: true }, { t: 'card', icon: 'list-check', title: 'Voice list · 2 Nov', text: 'Voice 0:24' }, { t: 'chips', items: ['Grocery', 'Vegetables', 'Fancy'], active: 0 }, { t: 'chips', items: ['Delivery', 'Pickup'], active: 0 }, { t: 'btn', text: 'Order nearby' }],
        },
        {
          title: 'See the delivery charge, then the bill',
          points: ['As soon as a shop accepts a delivery order you see its delivery charge.', 'The shop packs and sends the bill: items with prices (or one total), what is not available, any photos or voice message from the shop.', 'Your own list (your recording or photos) is shown first, then the bill.'],
          screen: [{ t: 'header', title: 'Your Order', sub: 'Sri Lakshmi Stores', back: true }, { t: 'card', icon: 'truck', title: 'Delivery charge', text: 'Set by the shop', right: '₹30', rc: BLUE[0] }, { t: 'voice', time: '0:24' }, { t: 'row', icon: 'receipt', text: 'Items total', right: '₹450' }, { t: 'row', icon: 'truck', text: 'Delivery', right: '₹30' }, { t: 'row', icon: 'equals', text: 'Total', right: '₹480' }],
        },
        {
          title: 'Collect with your PIN and rate',
          points: ['When it is ready (or out for delivery) you get a 4-digit PIN. Give it when you receive the order and pay the shop directly.', 'Rate the shop at the end.'],
          screen: [{ t: 'header', title: 'Out for delivery', back: true }, { t: 'note', icon: 'circle-info', text: 'Give this PIN when you get your order' }, { t: 'pin', digits: '7305' }],
          tip: 'Photos and voice messages of an order are removed 30 days after it ends, to protect your privacy. The order stays in your history.',
        },
      ],
    },
    {
      title: 'Hire Staff',
      steps: [
        {
          title: 'Find a cook, teacher, driver…',
          points: ['Home → Hire Staff. Filter by work, nearest or lowest pay, Trusted.', 'Open a person to see pay, skills and experience, then Call.'],
          screen: [{ t: 'header', title: 'Hire Staff', back: true }, { t: 'chips', items: ['Cook', 'Teacher', 'Driver'], active: 0 }, { t: 'card', icon: 'user-tie', title: 'Lakshmi — Cook', text: '₹9,000 / month · 2 km', right: 'Call', rc: '#16A34A' }],
        },
      ],
    },
    {
      title: 'Your account',
      steps: [
        {
          title: 'Plans, fees and free uses',
          points: ['Without a plan you get free bookings and orders each month, then a small fee each.', 'Triolo Plus removes the fees and ads. Profile → Triolo Plus.'],
          screen: [{ t: 'header', title: 'Triolo Plus', g: GOLD, back: true }, { t: 'card', icon: 'crown', title: 'No fees, no limits', c: '#C08A12' }, { t: 'chips', items: ['1 month', '3 months', '6 months', '12 months'], active: 1 }, { t: 'btn', text: 'Get Triolo Plus', c: '#C08A12' }],
        },
        {
          title: 'Settings, privacy and deleting your account',
          points: ['Profile menu: Edit profile, Waiting time, Language, Theme, Privacy Policy, Terms, Refund Policy.', 'Delete account: cancels what is under way, deletes your profiles, photos and voice messages at once; your details are wiped after 30 days.'],
          screen: [{ t: 'header', title: 'Menu', back: true }, { t: 'row', icon: 'user-pen', text: 'Edit profile' }, { t: 'row', icon: 'language', text: 'Language' }, { t: 'row', icon: 'shield-halved', text: 'Privacy Policy' }, { t: 'row', icon: 'rotate-left', text: 'Refund Policy' }, { t: 'btn', text: 'Delete account', c: RED[0] }],
        },
      ],
    },
  ],
};

const partner = {
  file: 'Triolo-Partner-Guide',
  title: 'Triolo Partner — Guide',
  badge: 'Triolo Partner app',
  icon: 'handshake',
  color: ['#0F172A', '#0055D3'],
  cover: ['For workers, shops and people looking for a job.', 'Get requests near you, accept, do the work and get paid directly by the customer.'],
  help: 'Keep location and notifications on — requests reach you only when Triolo knows where you are.',
  chapters: [
    {
      title: 'Register',
      steps: [
        {
          title: 'Choose what you are',
          points: ['Open Triolo Partner and pick: Are you a worker? · Do you have a shop? · Looking for a job?', 'Fill the form: photo, name, mobile (verify with the SMS code), your work or shop kind, place on the map, photos.', 'Tap Register. Workers and shops are checked by Triolo first (you see Pending, then Verified).'],
          screen: [{ t: 'header', title: 'Triolo Partner', sub: 'Join and get work' }, { t: 'card', icon: 'screwdriver-wrench', title: 'Are you a worker?', text: 'Get jobs near you' }, { t: 'card', icon: 'store', title: 'Do you have a shop?', text: 'Get orders near you', c: '#16A34A' }, { t: 'card', icon: 'user-tie', title: 'Looking for a job?', text: 'Families and shops hire you', c: '#7C3AED' }],
          tip: 'One account can be a worker, own up to 5 shops and have several job posts.',
        },
        {
          title: 'Allow the pop-up',
          points: ['On Home, allow "Display over other apps" and notifications. New requests then pop up even when you are in another app.'],
          screen: [{ t: 'header', title: 'Home' }, { t: 'popup', title: 'New job · 900 m', text: 'Electrician · Kannapuram' }],
        },
      ],
    },
    {
      title: 'Jobs (workers)',
      steps: [
        {
          title: 'Live Requests and Find Jobs Now',
          points: ['New requests appear as cards on Home — swipe through them, Accept or Decline.', 'Find Jobs Now pulls in every open request near you.', 'Requests booked with you personally say "Booked you".'],
          screen: [{ t: 'header', title: 'Home', sub: 'My Services' }, { t: 'card', icon: 'bolt', title: 'Quick Book · 1.2 km', text: 'Ravi · Electrician' }, { t: 'btns', items: [{ text: 'Decline', outline: '#dc2626' }, { text: 'Accept', c: '#16A34A' }] }, { t: 'note', icon: 'hourglass-half', text: '2 free accepts left this month — 1 of 3 used', c: '#C08A12' }],
          tip: 'You get some free accepts each month. When they are used up, the button becomes "Subscribe to accept" — take the Service plan to keep accepting.',
        },
        {
          title: 'Go, arrive, start with the PIN',
          points: ['Tap Start Trip — the customer sees you coming on the map.', 'At the place tap Arrived, ask the customer for their 4-digit PIN and enter it.', 'Do the work, tap Mark Work Done. The customer pays you directly.'],
          screen: [{ t: 'header', title: 'Job', sub: 'Ravi · Electrician', back: true }, { t: 'map', text: 'To customer · 1.2 km' }, { t: 'pin', digits: '4821' }, { t: 'btn', text: 'Mark Work Done', c: '#16A34A' }],
        },
      ],
    },
    {
      title: 'Orders (shops)',
      steps: [
        {
          title: 'Accept and read the list',
          points: ['A new order shows the customer\'s items, photos of their written list, or their voice message.', 'Accept to start packing.'],
          screen: [{ t: 'header', title: 'New order', sub: 'Delivery · 1.1 km', back: true }, { t: 'voice', time: '0:24' }, { t: 'photos', n: 2 }, { t: 'btns', items: [{ text: 'Decline', outline: '#dc2626' }, { text: 'Accept', c: '#16A34A' }] }],
        },
        {
          title: 'Pack and make the bill',
          points: ['Tick each item packed and type its price; untick what you don\'t have.', 'Add to the bill one way: Add items (type), Record items (say them), Capture items (camera or gallery). Only the way you pick stays.', 'With a photo or recording you can type one Bill total instead of every price.', 'Tap Send Bill.'],
          screen: [{ t: 'header', title: 'Packing', back: true }, { t: 'row', icon: 'square-check', text: 'Rice 5 kg', right: '₹320' }, { t: 'row', icon: 'square', text: 'Ghee 1 kg', right: '—' }, { t: 'grid', items: [{ icon: 'keyboard', text: 'Add items', g: GREEN }, { icon: 'microphone', text: 'Record items', g: PINK }] }, { t: 'card', icon: 'receipt', title: 'Bill total ₹ 450', c: '#16A34A' }, { t: 'btn', text: 'Send Bill' }],
        },
        {
          title: 'Hand over with the PIN',
          points: ['Mark Ready for pickup, or Out for delivery (you or your delivery staff).', 'At handover enter the customer\'s PIN and collect the money.'],
          screen: [{ t: 'header', title: 'Out for delivery', back: true }, { t: 'pin', digits: '7305' }, { t: 'btn', text: 'Verify PIN', c: '#16A34A' }],
        },
      ],
    },
    {
      title: 'Job posts (looking for a job)',
      steps: [
        {
          title: 'Post the work you want',
          points: ['Pick the work (cook, teacher…), your pay per day or month, skills and experience.', 'Switch Live / Hidden any time. Customers near you can call you.', 'See who viewed your post.'],
          screen: [{ t: 'header', title: 'My Job Post', back: true }, { t: 'card', icon: 'user-tie', title: 'Cook', text: '₹9,000 / month', right: 'Live', rc: '#16A34A' }, { t: 'row', icon: 'eye', text: 'Viewed by 12 people' }],
        },
      ],
    },
    {
      title: 'Plans, badge and boost',
      steps: [
        {
          title: 'Grow with a plan',
          points: ['Plans tab: Service, Shop, Job Post or All in One plan — no accept limits and a head start on new requests.', 'Trusted by Triolo badge: customers see a green seal on your profile.', 'Boost: show your profile in the Home slider (reviewed by Triolo; refunded if rejected).'],
          screen: [{ t: 'header', title: 'Plans', g: GOLD }, { t: 'chips', items: ['Service', 'Shop', 'Job Post', 'All in One'], active: 0 }, { t: 'card', icon: 'crown', title: 'Service plan', text: 'Unlimited accepts · head start', c: '#C08A12' }, { t: 'card', icon: 'circle-check', title: 'Trusted by Triolo', c: '#16A34A' }],
        },
        {
          title: 'Your account',
          points: ['Menu: My Profiles (edit services, shops, job posts), Language, Theme, Privacy, Terms, Refunds, Delete account.', 'Delete account removes your profiles, photos and voice messages at once and wipes your details after 30 days.'],
          screen: [{ t: 'header', title: 'Menu', back: true }, { t: 'row', icon: 'id-card', text: 'My Profiles' }, { t: 'row', icon: 'shield-halved', text: 'Privacy Policy' }, { t: 'btn', text: 'Delete account', c: RED[0] }],
        },
      ],
    },
  ],
};

const ads = {
  file: 'Triolo-Ads-Guide',
  title: 'Triolo Ads — Guide',
  badge: 'triolo-ads.vercel.app',
  icon: 'rectangle-ad',
  color: ['#7C2D12', '#EA580C'],
  cover: ['Show your business to people near you on the Triolo apps\' Home screen.', 'Book online, pay with UPI or card, and see your views and taps.'],
  help: 'Ads appear in the Home slider of both apps for people without a plan. Only wide (16:9) pictures and videos are accepted.',
  chapters: [
    {
      title: 'How Triolo ads work',
      steps: [
        {
          title: 'Where your ad shows',
          points: ['A wide card at the top of the Home screen that slides between ads.', 'Every running ad gets a fair share of views each day.', 'An ad with "Directions" is shown only within 5 km of your place; others are shown everywhere.'],
          screen: [{ t: 'header', title: 'Hi, Ravi', sub: 'Eluru' }, { t: 'input', icon: 'magnifying-glass', text: 'Search workers or shops' }, { t: 'slider', text: 'Sponsored · Your shop here' }, { t: 'grid', items: [{ icon: 'bolt', text: 'Quick Book', g: BLUE }, { icon: 'basket-shopping', text: 'Quick Order', g: GREEN }] }],
        },
      ],
    },
    {
      title: 'Book an ad',
      steps: [
        {
          title: 'Sign in',
          points: ['Open triolo-ads.vercel.app on a phone or computer.', 'Sign in with your mobile number and the SMS code.'],
          screen: [{ t: 'header', title: 'Triolo Ads', sub: 'For local businesses' }, { t: 'input', icon: 'phone', text: 'Mobile number' }, { t: 'btn', text: 'Send code' }],
        },
        {
          title: 'Create the ad',
          points: ['Business name, a short title and text.', 'One wide picture (16:9) or one wide video (up to about 30 seconds).', 'When people tap: nothing, open a link, directions to your place, or open your Triolo profile.'],
          screen: [{ t: 'header', title: 'New ad', back: true }, { t: 'input', text: 'Business name' }, { t: 'slider', text: 'Upload 16:9 picture or video' }, { t: 'chips', items: ['Link', 'Directions', 'My profile'], active: 1 }],
        },
        {
          title: 'Choose days or views, and pay',
          points: ['By days (1, 3, 7, 30) or by views (500 to 10,000).', 'Pay with UPI or card through Razorpay. The ad then waits for Triolo\'s review.'],
          screen: [{ t: 'header', title: 'Plan', back: true }, { t: 'chips', items: ['Days', 'Views'], active: 0 }, { t: 'chips', items: ['1 day', '3 days', '7 days', '30 days'], active: 2 }, { t: 'btn', text: 'Pay & submit', c: '#EA580C' }],
        },
      ],
    },
    {
      title: 'Review, results and refunds',
      steps: [
        {
          title: 'Review',
          points: ['Triolo checks every ad. Approved: it starts on its date. Rejected: you see the reason and your money is refunded automatically to the same UPI / card (5–7 working days).', 'You can withdraw an ad before it is approved — refunded the same way.'],
          screen: [{ t: 'header', title: 'My ads' }, { t: 'card', icon: 'clock', title: 'Diwali Sale', text: 'Waiting for review', c: '#C08A12' }, { t: 'card', icon: 'circle-check', title: 'New Arrivals', text: 'Running · 1,240 views', c: '#16A34A' }, { t: 'card', icon: 'rotate-left', title: 'Old Offer', text: 'Rejected · refunded', c: '#dc2626' }],
        },
        {
          title: 'Results',
          points: ['Open an ad to see views and taps per day, and download its bill.', 'Approved and running ads are not refunded. Ads removed for breaking the rules are not refunded.'],
          screen: [{ t: 'header', title: 'New Arrivals', back: true }, { t: 'row', icon: 'eye', text: 'Views', right: '1,240' }, { t: 'row', icon: 'hand-pointer', text: 'Taps', right: '86' }, { t: 'btn', text: 'Download bill' }],
        },
      ],
    },
    {
      title: 'Rules',
      steps: [
        {
          title: 'What is not allowed',
          points: ['Nothing false, illegal, adult, political, alcohol, tobacco, gambling or betting.', 'No other people\'s photos or logos without permission.', 'Your ad must match what you sell. Triolo may reject or remove ads that break these rules.'],
        },
      ],
    },
  ],
};

module.exports = { GUIDES: [customer, partner, ads] };
