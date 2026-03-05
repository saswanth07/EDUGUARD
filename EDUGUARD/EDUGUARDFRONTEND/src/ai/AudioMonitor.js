/**
 * EduGuardian 2.0 — Real-Time Audio Monitor
 *
 * Uses Web Audio API (AnalyserNode) to monitor microphone audio in real-time.
 * Detects:
 *   - TALKING        — sustained loud speech (>65 dB for 2s)
 *   - WHISPER        — quiet speech (45-65 dB for 3s)
 *   - MULTIPLE_VOICES — rapid volume fluctuations suggesting conversation
 *   - LOUD_NOISE     — sudden spike (>80 dB)
 *
 * Usage:
 *   const monitor = new AudioMonitor(stream, onDetection);
 *   monitor.start();
 *   monitor.stop();
 */

export class AudioMonitor {
    constructor(stream, onDetection) {
        this.stream = stream;
        this.onDetection = onDetection;
        this.isRunning = false;

        // Audio context
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.source = null;

        // Detection state
        this._intervalId = null;
        this._talkingFrames = 0;
        this._whisperFrames = 0;
        this._loudSpikeReported = false;
        this._volumeHistory = [];

        // Thresholds (dB approximations from byte FFT data)
        this.SILENCE_THRESHOLD = 30;
        this.WHISPER_THRESHOLD = 45;
        this.TALKING_THRESHOLD = 65;
        this.LOUD_THRESHOLD = 80;
        this.TALKING_DURATION = 6;    // ~2s at 3 checks/sec
        this.WHISPER_DURATION = 9;    // ~3s at 3 checks/sec
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.8;

            // Connect microphone stream to analyser
            const audioTracks = this.stream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('[AudioMonitor] No audio tracks in stream');
                this.isRunning = false;
                return;
            }

            // Create a new stream with only audio tracks
            const audioStream = new MediaStream(audioTracks);
            this.source = this.audioContext.createMediaStreamSource(audioStream);
            this.source.connect(this.analyser);

            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

            // Analyse audio 3 times per second
            this._intervalId = setInterval(() => this._analyze(), 333);

            console.log('[AudioMonitor] Started — monitoring microphone audio');
        } catch (err) {
            console.error('[AudioMonitor] Failed to start:', err);
            this.isRunning = false;
        }
    }

    _analyze() {
        if (!this.isRunning || !this.analyser) return;

        this.analyser.getByteFrequencyData(this.dataArray);

        // Calculate RMS volume (0-100 scale approximating dB)
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i] * this.dataArray[i];
        }
        const rms = Math.sqrt(sum / this.dataArray.length);
        const volume = Math.round((rms / 255) * 100);

        // Track volume history for pattern analysis
        this._volumeHistory.push(volume);
        if (this._volumeHistory.length > 30) this._volumeHistory.shift(); // keep last 10s

        // === Loud noise spike ===
        if (volume > this.LOUD_THRESHOLD && !this._loudSpikeReported) {
            this._loudSpikeReported = true;
            this.onDetection({
                eventType: 'LOUD_NOISE',
                severity: 'HIGH',
                confidence: 0.85,
                description: `Loud noise detected (volume: ${volume})`,
                decibelLevel: volume,
            });
            // Reset after 5 seconds
            setTimeout(() => { this._loudSpikeReported = false; }, 5000);
        }

        // === Talking (sustained loud audio) ===
        if (volume > this.TALKING_THRESHOLD) {
            this._talkingFrames++;
            this._whisperFrames = 0;
            if (this._talkingFrames === this.TALKING_DURATION) {
                this.onDetection({
                    eventType: 'TALKING',
                    severity: 'HIGH',
                    confidence: 0.8,
                    description: `Talking detected for ~2s (volume: ${volume})`,
                    decibelLevel: volume,
                });
                this._talkingFrames = 0; // reset to allow re-detection
            }
        }
        // === Whisper (sustained quiet speech) ===
        else if (volume > this.WHISPER_THRESHOLD) {
            this._whisperFrames++;
            this._talkingFrames = Math.max(0, this._talkingFrames - 1);
            if (this._whisperFrames === this.WHISPER_DURATION) {
                this.onDetection({
                    eventType: 'WHISPER_DETECTED',
                    severity: 'MEDIUM',
                    confidence: 0.7,
                    description: `Whispering detected for ~3s (volume: ${volume})`,
                    decibelLevel: volume,
                });
                this._whisperFrames = 0;
            }
        }
        // === Silence ===
        else {
            this._talkingFrames = Math.max(0, this._talkingFrames - 1);
            this._whisperFrames = Math.max(0, this._whisperFrames - 1);
        }

        // === Multiple voices pattern ===
        // Detect rapid volume oscillations (talking → silence → talking) suggesting back-and-forth
        if (this._volumeHistory.length >= 15) {
            const recent = this._volumeHistory.slice(-15);
            let crossings = 0;
            const midThreshold = (this.WHISPER_THRESHOLD + this.TALKING_THRESHOLD) / 2;
            for (let i = 1; i < recent.length; i++) {
                if ((recent[i - 1] < midThreshold && recent[i] >= midThreshold) ||
                    (recent[i - 1] >= midThreshold && recent[i] < midThreshold)) {
                    crossings++;
                }
            }
            // 4+ crossings in 5s = conversation-like pattern
            if (crossings >= 4) {
                this.onDetection({
                    eventType: 'MULTIPLE_VOICES',
                    severity: 'CRITICAL',
                    confidence: 0.65,
                    description: `Possible multiple voices (${crossings} volume changes in 5s)`,
                });
                // Clear history to avoid repeat
                this._volumeHistory.length = 0;
            }
        }
    }

    /** Get current audio volume (0-100) */
    getCurrentVolume() {
        if (!this.analyser || !this.dataArray) return 0;
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i] * this.dataArray[i];
        }
        return Math.round((Math.sqrt(sum / this.dataArray.length) / 255) * 100);
    }

    stop() {
        this.isRunning = false;
        if (this._intervalId) clearInterval(this._intervalId);
        if (this.source) {
            try { this.source.disconnect(); } catch { }
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            try { this.audioContext.close(); } catch { }
        }
        console.log('[AudioMonitor] Stopped');
    }
}
