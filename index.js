import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';
import ShakeSOSHeadlessTask from './services/ShakeSOSHeadlessTask';

// Register Android Headless JS task for background shake SOS
AppRegistry.registerHeadlessTask(
  'ShakeSOSHeadlessTask',
  () => ShakeSOSHeadlessTask
);

// Expo root registration
registerRootComponent(App);