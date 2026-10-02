// Il microfono della casella: una registrazione per volta, dal clic che la apre al clic che la chiude.
// MediaRecorder sceglie il contenitore che il browser sa scrivere (WebM/Opus in Chrome, Edge e Firefox, MP4 in Safari):
// l'API li accetta tutti. A fine registrazione il microfono si chiude sempre e la spia del browser si spegne.

import type { MessageKey } from '@moonbrand/shared/i18n/translate';

const CONTAINERS = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];

// key: il testo da mostrare, nella lingua dell'interfaccia (chat.microphone).
export class MicrophoneError extends Error {
  constructor(readonly key: MessageKey) {
    super(key);
  }
}

export class Recorder {
  private recorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  get recording(): boolean {
    return this.recorder?.state === 'recording';
  }

  async start(): Promise<void> {
    // Fuori da HTTPS e localhost il browser non dà il microfono a nessuna pagina.
    if (!window.isSecureContext) throw new MicrophoneError('chat.microphone.insecure');
    if (!Recorder.supported()) throw new MicrophoneError('chat.microphone.unsupported');
    if (this.recording) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (error) {
      const name = (error as { name?: string }).name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new MicrophoneError('chat.microphone.denied');
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new MicrophoneError('chat.microphone.notFound');
      }
      throw new MicrophoneError('chat.microphone.busy');
    }
    const type = CONTAINERS.find((container) => MediaRecorder.isTypeSupported(container));
    this.stream = stream;
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data);
    };
    this.recorder.start();
  }

  // Chiude la registrazione e il microfono: l'audio raccolto, vuoto se non c'era niente.
  stop(): Promise<Blob> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') {
      this.close();
      return Promise.resolve(new Blob([], { type: 'audio/webm' }));
    }
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const audio = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
        this.chunks = [];
        this.recorder = undefined;
        this.close();
        resolve(audio);
      };
      recorder.stop();
    });
  }

  // Se si chiude la casella mentre registra: via tutto, senza trascrivere.
  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.recorder = undefined;
    this.chunks = [];
    this.close();
  }

  private close(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = undefined;
  }
}
