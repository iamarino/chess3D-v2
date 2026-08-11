export type SfxName = 'select' | 'move' | 'capture' | 'check' | 'checkmate' | 'button';

interface ToneOptions {
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

/**
 * Synthesizes short sound effects with the Web Audio API instead of loading
 * sample files — there are no audio assets yet. `play()` takes the same
 * semantic names the spec's AudioManager expects, so swapping in real
 * recordings later only touches this file.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private masterVolume = 0.8;
  private effectsVolume = 0.6;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return null;

      this.ctx = new AudioContextCtor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      this.effectsGain = this.ctx.createGain();
      this.effectsGain.gain.value = this.effectsVolume;
      this.effectsGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = volume;
    if (this.masterGain) this.masterGain.gain.value = volume;
  }

  setEffectsVolume(volume: number): void {
    this.effectsVolume = volume;
    if (this.effectsGain) this.effectsGain.gain.value = volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private playTone(frequency: number, duration: number, options: ToneOptions = {}): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.effectsGain || this.muted) return;

    const { type = 'sine', gain = 0.5, delay = 0, slideTo } = options;
    const startTime = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, startTime + duration);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.effectsGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  play(name: SfxName): void {
    switch (name) {
      case 'select':
        this.playTone(660, 0.08, { type: 'sine', gain: 0.35 });
        break;
      case 'move':
        this.playTone(420, 0.09, { type: 'triangle', gain: 0.3, slideTo: 340 });
        break;
      case 'capture':
        this.playTone(180, 0.22, { type: 'sawtooth', gain: 0.45, slideTo: 90 });
        this.playTone(90, 0.18, { type: 'square', gain: 0.25, delay: 0.03 });
        break;
      case 'check':
        this.playTone(880, 0.16, { type: 'square', gain: 0.3 });
        this.playTone(660, 0.2, { type: 'square', gain: 0.25, delay: 0.1 });
        break;
      case 'checkmate':
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          this.playTone(freq, 0.5, { type: 'triangle', gain: 0.3, delay: i * 0.14 });
        });
        break;
      case 'button':
        this.playTone(500, 0.06, { type: 'sine', gain: 0.25 });
        break;
    }
  }
}

export const audioManager = new AudioManager();
