import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');

let transcriber;
let stream;
let running = false;
const audioQueue = [];

const setStatus = (msg) => {
  statusEl.textContent = `Status: ${msg}`;
};

async function getTranscriber() {
  if (!transcriber) {
    setStatus('carregando modelo Whisper (primeira vez pode demorar)...');
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
  }
  return transcriber;
}

async function blobToWaveform(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  audioContext.close();
  return Float32Array.from(channelData);
}

async function consumeQueue() {
  while (running) {
    if (audioQueue.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }

    try {
      const blob = audioQueue.shift();
      const audio = await blobToWaveform(blob);
      const asr = await getTranscriber();
      setStatus('transcrevendo...');

      const result = await asr(audio, {
        language: 'portuguese',
        task: 'transcribe'
      });

      const text = (result.text || '').trim();
      if (text) {
        transcriptEl.textContent += (transcriptEl.textContent ? ' ' : '') + text;
      }
      setStatus('ouvindo microfone continuamente...');
    } catch (error) {
      console.error(error);
      setStatus('erro ao transcrever; continuando captura...');
    }
  }
}

function startCapture() {
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioQueue.push(event.data);
    }
  };

  recorder.start(2500);

  const stopRecording = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };

  return stopRecording;
}

let stopRecording = null;

startBtn.addEventListener('click', async () => {
  try {
    running = true;
    transcriptEl.textContent = '';
    setStatus('pedindo permissão do microfone...');
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    stopRecording = startCapture();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus('ouvindo microfone continuamente...');
    consumeQueue();
  } catch (error) {
    running = false;
    console.error(error);
    setStatus('não foi possível acessar o microfone');
  }
});

stopBtn.addEventListener('click', () => {
  running = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  if (stopRecording) stopRecording();
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  setStatus('parado');
});
