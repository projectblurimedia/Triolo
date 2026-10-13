// Must be imported before anything else — Android can invoke this task headlessly (no App
// component mounted at all) for a Quick Book push or Accept/Reject action tap while the app
// is fully closed. See backgroundNotificationTask.ts's own doc comment.
import './backgroundNotificationTask';
// Same reason: delivers the worker's live location while a Quick Book trip is on the way, even
// when the app is minimised. See src/services/tripTracking.ts.
import '@/services/tripTracking';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
