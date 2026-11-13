// Audio unlock: browsers keep audio paused until a gesture; the game must resume it then.
import { describe, it, expect, vi, beforeEach } from 'vitest';

class FakeContext {
  static made = 0;
  state: 'suspended' | 'running' = 'suspended';
  sampleRate = 44100;
  destination = {};
  constructor() { FakeContext.made++; }
  resume = vi.fn(async () => { this.state = 'running'; });
  createGain() { return { gain: { value: 0 }, connect() {} }; }
  createBuffer() { return {}; }
  createBufferSource() { return { buffer: null, connect() {}, start() {} }; }
}

describe('audio unlock', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeContext.made = 0;
    const win = new EventTarget() as EventTarget & Record<string, unknown>;
    win.AudioContext = FakeContext;
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    vi.stubGlobal('navigator', { audioSession: { type: 'auto' } });
  });

  it('resumes audio on the first gesture and sets iPhone audio to playback', async () => {
    const { sounds, installAudioUnlock } = await import('./sounds');
    const off = installAudioUnlock();
    sounds.ensureContext(); // created at round start, before any gesture: paused
    expect(sounds.isRunning()).toBe(false);
    window.dispatchEvent(new Event('touchend'));
    await Promise.resolve();
    expect(sounds.isRunning()).toBe(true);
    expect((navigator as unknown as { audioSession: { type: string } }).audioSession.type).toBe('playback');
    expect(FakeContext.made).toBe(1);
    off();
  });

  it('a key press works too, and nothing happens once audio runs', async () => {
    const { sounds, installAudioUnlock } = await import('./sounds');
    const off = installAudioUnlock();
    window.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    expect(sounds.isRunning()).toBe(true);
    const spy = vi.spyOn(sounds, 'unlock');
    window.dispatchEvent(new Event('keydown'));
    expect(spy).not.toHaveBeenCalled();
    off();
  });
});
