import { Audio } from 'expo-av';
import { useStore } from './store';

let spinSound: Audio.Sound | null = null;
let winnerSound: Audio.Sound | null = null;
let clickSound: Audio.Sound | null = null;
let tickSound: Audio.Sound | null = null;

const SOUNDS = {
  spin: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
  winner: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  success: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
  tick: 'https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3',
};

export async function initSounds() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch (error) {
    console.log('[Sound] Failed to set audio mode:', error);
  }
}

async function loadSound(uri: string): Promise<Audio.Sound | null> {
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false, volume: 0.7 }
    );
    return sound;
  } catch (error) {
    console.log('[Sound] Failed to load sound:', error);
    return null;
  }
}

export async function playSpinSound() {
  const settings = useStore.getState().settings;
  if (!settings.soundsEnabled) return;

  try {
    if (spinSound) {
      await spinSound.stopAsync();
      await spinSound.unloadAsync();
    }
    spinSound = await loadSound(SOUNDS.spin);
    if (spinSound) {
      await spinSound.playAsync();
    }
  } catch (error) {
    console.log('[Sound] Error playing spin sound:', error);
  }
}

export async function playWinnerSound() {
  const settings = useStore.getState().settings;
  if (!settings.soundsEnabled) return;

  try {
    if (winnerSound) {
      await winnerSound.stopAsync();
      await winnerSound.unloadAsync();
    }
    winnerSound = await loadSound(SOUNDS.winner);
    if (winnerSound) {
      await winnerSound.playAsync();
    }
  } catch (error) {
    console.log('[Sound] Error playing winner sound:', error);
  }
}

export async function playClickSound() {
  const settings = useStore.getState().settings;
  if (!settings.soundsEnabled) return;

  try {
    if (clickSound) {
      await clickSound.stopAsync();
      await clickSound.unloadAsync();
    }
    clickSound = await loadSound(SOUNDS.click);
    if (clickSound) {
      await clickSound.playAsync();
    }
  } catch (error) {
    console.log('[Sound] Error playing click sound:', error);
  }
}

export async function playSuccessSound() {
  const settings = useStore.getState().settings;
  if (!settings.soundsEnabled) return;

  try {
    const sound = await loadSound(SOUNDS.success);
    if (sound) {
      await sound.playAsync();
    }
  } catch (error) {
    console.log('[Sound] Error playing success sound:', error);
  }
}

export async function playTickSound() {
  const settings = useStore.getState().settings;
  if (!settings.soundsEnabled) return;

  try {
    if (tickSound) {
      await tickSound.stopAsync();
      await tickSound.unloadAsync();
    }
    tickSound = await loadSound(SOUNDS.tick);
    if (tickSound) {
      await tickSound.playAsync();
    }
  } catch (error) {
    console.log('[Sound] Error playing tick sound:', error);
  }
}

export async function stopAllSounds() {
  try {
    if (spinSound) {
      await spinSound.stopAsync();
      await spinSound.unloadAsync();
      spinSound = null;
    }
    if (winnerSound) {
      await winnerSound.stopAsync();
      await winnerSound.unloadAsync();
      winnerSound = null;
    }
    if (clickSound) {
      await clickSound.stopAsync();
      await clickSound.unloadAsync();
      clickSound = null;
    }
    if (tickSound) {
      await tickSound.stopAsync();
      await tickSound.unloadAsync();
      tickSound = null;
    }
  } catch (error) {
    console.log('[Sound] Error stopping sounds:', error);
  }
}
