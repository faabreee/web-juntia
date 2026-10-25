/** Aviso sonoro y de vibración al validar: el personal mira al público, no a la pantalla. */
let audio: AudioContext | null = null;

function tone(frequency: number, durationMs: number) {
  try {
    audio ??= new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.15;
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + durationMs / 1000);
  } catch {
    // sin audio disponible: solo queda el aviso visual
  }
}

export function feedback(accepted: boolean) {
  if (accepted) {
    tone(880, 120);
    navigator.vibrate?.(80);
  } else {
    tone(220, 380);
    navigator.vibrate?.([200, 100, 200]);
  }
}
