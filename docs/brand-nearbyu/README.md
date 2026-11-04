# NearbyU brand (final, not yet in the apps)

Approved by the owner on 2026-11-04. Nothing here is wired into `user-app` / `partner-app` yet.

| Piece | Final choice | File |
|---|---|---|
| Logo mark | **B1 final**: white location pin, a slim U-shaped road with equal arms, a simple home on the right arm with the road running into its door | `mark.js` (`nearbyU(fg, cut)`, 120 × 120 SVG) |
| Icon background | **S1**: blue gradient (`#0A3FB8 → #1E6BF5 → #4FA3FF`), two faint rings round the home, three faint helper dots | `brand.html` (`icon()`) |
| Partner icon | Same blue; saffron **PARTNER** pill centred at the bottom, inside the adaptive-icon safe circle (a corner ribbon was rejected: round launcher masks cut it); mark scaled to 0.66 | `brand.html` |
| Opening animation | About 1.3 s, plays once: rings, pin drop, road draws, home pops, helpers swing in and pulse, name rises; partner adds a saffron PARTNER tag | `opening-animation.html`, `brand.html` |
| Loader | The opening animation on a smooth 2.4 s loop with a soft fade; the button size leaves out rings and helpers | `loader.html` |
| Wordmark | **V4**: Nunito Black "Nearby" + the U in a turmeric → saffron gradient, a soft line under "Nearby" warming to saffron at the U | `wordmark-options.html` (classes `v v4`), `brand.html` |
| Notification sound | **U1**: marimba "near · by", then the U on marimba and a soft bell over a warm chord (0.98 s) | `nearbyu_notification.wav` |

`sound-u1-source.js` makes the sound with `sound-engine.js` (it expects that file under its old name, `make2.js`).

Still to decide before building it in: whether the apps are renamed **NearbyU** / **NearbyU Partner** (store listing, launcher names, package names stay). Building it in needs a new APK for each app (icon, splash, notification sound — a new sound also needs new Android notification channel ids, see `.cloud/project-context.md` "Triolo chime").
