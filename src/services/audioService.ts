import { Audio, AVPlaybackSource, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { MixerState, SoundAsset, TrackType } from "../types/audio";

type ActiveLoop = {
  sound: Audio.Sound;
  asset: SoundAsset;
  baseVolume: number;
  track: TrackType;
};

const fadeMs = 900;
const fadeSteps = 12;

class AudioService {
  private activeLoops = new Map<string, ActiveLoop>();
  private activeOneShots = new Set<Audio.Sound>();
  private globalVolume = 0.85;
  private mixer: MixerState = {
    ambient: 0.8,
    music: 0.65,
    sfx: 0.9,
    special: 0.75
  };

  async configure() {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false
    });
  }

  setMixer(mixer: MixerState) {
    this.mixer = mixer;
    this.activeLoops.forEach((loop) => {
      loop.sound.setVolumeAsync(this.effectiveVolume(loop.baseVolume, loop.track));
    });
  }

  setGlobalVolume(volume: number) {
    this.globalVolume = volume;
    this.activeLoops.forEach((loop) => {
      loop.sound.setVolumeAsync(this.effectiveVolume(loop.baseVolume, loop.track));
    });
  }

  async playLoop(asset: SoundAsset, volume = 1) {
    await this.configure();
    const existing = this.activeLoops.get(asset.id);
    if (existing) {
      await existing.sound.playAsync();
      await this.fadeTo(existing.sound, this.effectiveVolume(volume, asset.track));
      return;
    }

    const sound = new Audio.Sound();
    await sound.loadAsync({ uri: asset.localUri } as AVPlaybackSource, {
      isLooping: true,
      volume: 0,
      shouldPlay: true
    });

    this.activeLoops.set(asset.id, {
      sound,
      asset,
      baseVolume: volume,
      track: asset.track
    });

    await this.fadeTo(sound, this.effectiveVolume(volume, asset.track));
  }

  async stopLoop(assetId: string) {
    const loop = this.activeLoops.get(assetId);
    if (!loop) return;

    await this.fadeTo(loop.sound, 0);
    await loop.sound.stopAsync();
    await loop.sound.unloadAsync();
    this.activeLoops.delete(assetId);
  }

  async stopAllLoops() {
    await Promise.all(Array.from(this.activeLoops.keys()).map((id) => this.stopLoop(id)));
    await Promise.all(
      Array.from(this.activeOneShots).map(async (sound) => {
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
        } finally {
          this.activeOneShots.delete(sound);
        }
      })
    );
  }

  async playOneShot(asset: SoundAsset, volume = 1) {
    await this.configure();
    const { sound } = await Audio.Sound.createAsync(
      { uri: asset.localUri },
      { shouldPlay: true, volume: this.effectiveVolume(volume, asset.track), isLooping: false }
    );

    this.activeOneShots.add(sound);
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().finally(() => this.activeOneShots.delete(sound));
      }
    });
  }

  isLooping(assetId: string) {
    return this.activeLoops.has(assetId);
  }

  private effectiveVolume(baseVolume: number, track: TrackType) {
    return Math.max(0, Math.min(1, baseVolume * this.globalVolume * this.mixer[track]));
  }

  private async fadeTo(sound: Audio.Sound, targetVolume: number) {
    const status = await sound.getStatusAsync();
    const startVolume = status.isLoaded ? status.volume ?? 0 : 0;
    const delta = targetVolume - startVolume;

    for (let step = 1; step <= fadeSteps; step += 1) {
      const nextVolume = startVolume + (delta * step) / fadeSteps;
      await sound.setVolumeAsync(Math.max(0, Math.min(1, nextVolume)));
      await new Promise((resolve) => setTimeout(resolve, fadeMs / fadeSteps));
    }
  }
}

export const audioService = new AudioService();
