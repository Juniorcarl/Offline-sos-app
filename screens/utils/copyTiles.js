import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { unzip } from 'react-native-zip-archive';

export async function ensureTilesCopied() {
  const dest = FileSystem.documentDirectory + 'maps/';
  
  // Check if already copied before — if yes, skip
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) {
    console.log('Tiles already exist, skipping copy');
    return;
  }

  console.log('First launch — copying tiles...');

  // Load the zip from assets
  const asset = Asset.fromModule(require('../assets/maps.zip'));
  await asset.downloadAsync();

  // Copy zip to a writable location
  const zipDest = FileSystem.documentDirectory + 'maps.zip';
  await FileSystem.copyAsync({
    from: asset.localUri,
    to: zipDest,
  });

  // Unzip into document directory
  await unzip(zipDest, FileSystem.documentDirectory);

  // Clean up the zip file after extracting
  await FileSystem.deleteAsync(zipDest);

  console.log('Tiles copied successfully to:', dest);
}