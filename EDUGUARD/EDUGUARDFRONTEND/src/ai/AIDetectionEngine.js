/**
 * EduGuardian 2.0 — AI Detection Engine (MediaPipe Edition)
 *
 * Now uses MediaPipe FaceMesh (via EyeTracker) for:
 *   - Accurate multi-face detection (replaces skin-cluster heuristic)
 *   - Real eye/gaze tracking (replaces brightness-ratio heuristic)
 *   - Head pose estimation
 *
 * Retained from original:
 *   - Frame-diff motion detection (sudden movement)
 *   - Face-not-visible fallback (skin-pixel ratio as backup)
 *   - Attention score calculation
 */

import { EyeTracker } from './EyeTracker.js';
import { ObjectDetector } from './ObjectDetector.js';

export class AIDetectionEngine {
    constructor(videoElement, onDetection) {
        this.video = videoElement;
        this.onDetection = onDetection;

        // Canvas for motion detection (kept)
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        this.isRunning = false;
        this.frameCount = 0;
        this.lastFrameData = null;
        this.canvasInitialized = false;

        // MediaPipe eye tracker
        this.eyeTracker = new EyeTracker();
        this.eyeTrackerReady = false;

        // Object detector (phone detection)
        this.objectDetector = new ObjectDetector();
        this.objectDetectorReady = false;

        // Counters for sustained events
        this.faceNotVisibleFrames = 0;
        this.gazeAwayFrames = 0;       // how many consecutive frames gaze != CENTER
        this.gazeAwayDirection = null;  // which direction
        this.multipleFacesFrames = 0;  // consecutive frames with >1 face
        this.phoneDetectedFrames = 0;  // consecutive detections of a phone
        this.motionHistory = [];
        this.attentionScore = 100;
        this.animationId = null;

        // Thresholds (in analysis cycles, each ~333ms at 3×/sec)
        this.GAZE_AWAY_THRESHOLD = 6;     // ~2 seconds of looking away
        this.MULTI_FACE_THRESHOLD = 3;    // ~1 second sustained multi-face
        this.FACE_MISSING_THRESHOLD = 12; // ~4 seconds face not visible
        this.PHONE_DETECT_THRESHOLD = 1;  // fire immediately if phone detected
    }

    async start() {
        this.isRunning = true;
        this._initCanvas();

        // Initialise MediaPipe EyeTracker
        try {
            await this.eyeTracker.init(this.video);
            this.eyeTrackerReady = this.eyeTracker.ready;
            if (this.eyeTrackerReady) {
                console.log('[AIEngine] MediaPipe EyeTracker active ✓');
            }
        } catch (err) {
            console.warn('[AIEngine] EyeTracker init failed:', err.message);
        }

        // Initialise ObjectDetector (load model from CDN)
        try {
            await this.objectDetector.load();
            this.objectDetectorReady = this.objectDetector.ready;
            if (this.objectDetectorReady) {
                console.log('[AIEngine] COCO-SSD Object Detector active ✓');
            }
        } catch (err) {
            console.warn('[AIEngine] ObjectDetector init failed:', err.message);
        }

        this.detectLoop();
    }

    _initCanvas() {
        const w = this.video.videoWidth || 640;
        const h = this.video.videoHeight || 480;
        if (w > 0 && h > 0) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.canvasInitialized = true;
        }
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.eyeTracker) this.eyeTracker.destroy();
    }

    detectLoop() {
        if (!this.isRunning) return;
        this.frameCount++;

        if (!this.canvasInitialized) this._initCanvas();

        // Run analysis every 10 frames (~3×/sec at 30 fps)
        if (this.frameCount % 10 === 0 && this.canvasInitialized) {
            this.analyzeFrame();
        }

        // Run object detection every 60 frames (~once every 2 seconds)
        if (this.frameCount % 60 === 0 && this.objectDetectorReady) {
            this.analyzeObjects();
        }

        this.animationId = requestAnimationFrame(() => this.detectLoop());
    }

    analyzeFrame() {
        if (!this.video || this.video.readyState < 2) return;
        if (this.canvas.width === 0 || this.canvas.height === 0) return;

        // Resize canvas if video changed dimensions
        if (this.video.videoWidth > 0 && this.canvas.width !== this.video.videoWidth) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
        }

        // Draw frame for motion detection
        try {
            this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        } catch { return; }

        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        if (!imageData || imageData.data.length === 0) return;
        const data = imageData.data;

        // --- 1. Motion detection (kept from original) ---
        const motion = this.detectMotion(data);
        if (motion.motionLevel > 0.12) {
            this.onDetection({
                eventType: 'SUDDEN_MOVEMENT',
                severity: motion.motionLevel > 0.25 ? 'HIGH' : 'MEDIUM',
                confidence: Math.min(0.95, motion.motionLevel * 3),
                description: `Sudden movement (${(motion.motionLevel * 100).toFixed(1)}%)`,
            });
        }

        // --- 2. MediaPipe-based face + eye analysis ---
        if (this.eyeTrackerReady) {
            const result = this.eyeTracker.getLatestResult();
            this._processFaceResult(result);
        } else {
            // Fallback: basic skin-ratio face-not-visible check only
            this._fallbackFaceCheck(data);
        }

        // --- 3. Update attention score ---
        this.attentionScore = this._calculateAttention();

        // Store frame for motion comparison
        this.lastFrameData = new Uint8ClampedArray(data);
    }

    async analyzeObjects() {
        if (!this.video || this.video.readyState < 2) return;
        if (!this.objectDetectorReady) return;

        const detections = await this.objectDetector.detect(this.video);
        if (detections && detections.length > 0) {
            console.warn('[AIEngine] Phone detected!', detections);
            this.onDetection({
                eventType: 'PHONE_DETECTED',
                severity: 'CRITICAL',
                confidence: detections[0].score,
                description: `Mobile phone detected in frame (${Math.round(detections[0].score * 100)}% confidence)`,
            });
        }
    }

    // =========================================================
    // MediaPipe result processing
    // =========================================================

    _processFaceResult(result) {
        const { faceCount, gazeDirection, headPose } = result;

        // -- Face not visible --
        if (faceCount === 0) {
            this.faceNotVisibleFrames++;
            if (this.faceNotVisibleFrames === this.FACE_MISSING_THRESHOLD) {
                this.onDetection({
                    eventType: 'FACE_NOT_VISIBLE',
                    severity: 'HIGH',
                    confidence: 0.92,
                    description: `Face not visible for ~${Math.round(this.faceNotVisibleFrames / 3)}s (MediaPipe)`,
                    attentionScore: Math.max(0, this.attentionScore - 15),
                });
            }
            // Reset gaze/multiface counters when no face
            this.gazeAwayFrames = 0;
            this.multipleFacesFrames = 0;
            return;
        }

        // -- Face returned after being missing --
        if (this.faceNotVisibleFrames >= this.FACE_MISSING_THRESHOLD) {
            this.onDetection({
                eventType: 'FACE_RETURNED',
                severity: 'LOW',
                confidence: 0.9,
                description: 'Face visible again',
            });
        }
        this.faceNotVisibleFrames = 0;

        // -- Multiple faces (real detection, not heuristic) --
        if (faceCount > 1) {
            this.multipleFacesFrames++;
            if (this.multipleFacesFrames === this.MULTI_FACE_THRESHOLD) {
                this.onDetection({
                    eventType: 'MULTIPLE_FACES',
                    severity: 'CRITICAL',
                    confidence: 0.95,
                    faceCount: faceCount, // Explicitly pass faceCount
                    description: `Prohibited: ${faceCount} persons detected in frame`,
                });
            }
        } else {
            this.multipleFacesFrames = 0;
        }

        // -- Eye/Gaze deviation --
        if (gazeDirection !== 'CENTER' && gazeDirection !== 'NONE') {
            if (this.gazeAwayDirection === gazeDirection) {
                this.gazeAwayFrames++;
            } else {
                this.gazeAwayDirection = gazeDirection;
                this.gazeAwayFrames = 1;
            }

            if (this.gazeAwayFrames === this.GAZE_AWAY_THRESHOLD) {
                this.onDetection({
                    eventType: 'EYE_DEVIATION',
                    severity: 'HIGH',
                    confidence: 0.85,
                    description: `Looking ${gazeDirection} for ~2s (iris tracking)`,
                    gazeDirection,
                });
            }
        } else {
            this.gazeAwayFrames = 0;
            this.gazeAwayDirection = null;
        }

        // -- Head pose deviation --
        if (headPose !== 'FRONT' && headPose !== 'NONE') {
            // Head turn fires immediately (single event, less spam than gaze)
            if (headPose === 'DOWN') {
                this.onDetection({
                    eventType: 'LOOKING_DOWN',
                    severity: 'MEDIUM',
                    confidence: 0.8,
                    description: `Head looking ${headPose} (MediaPipe head pose)`,
                });
            } else {
                this.onDetection({
                    eventType: 'HEAD_TURN',
                    severity: 'MEDIUM',
                    confidence: 0.8,
                    description: `Head turned ${headPose} (MediaPipe)`,
                });
            }
        }
    }

    // =========================================================
    // Fallback: basic skin-ratio face check (no MediaPipe)
    // =========================================================

    _fallbackFaceCheck(data) {
        let skinPixels = 0;
        const step = 16;
        for (let i = 0; i < data.length; i += step) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            if (r > 80 && g > 30 && b > 15 && r > g && r > b &&
                Math.abs(r - g) > 10 && (r - b) > 10 && r < 250) {
                skinPixels++;
            }
        }
        const ratio = skinPixels / (data.length / step);

        if (ratio < 0.015) {
            this.faceNotVisibleFrames++;
            if (this.faceNotVisibleFrames === this.FACE_MISSING_THRESHOLD) {
                this.onDetection({
                    eventType: 'FACE_NOT_VISIBLE',
                    severity: 'HIGH',
                    confidence: 0.7,
                    description: `Face not visible (skin-ratio fallback)`,
                    attentionScore: Math.max(0, this.attentionScore - 10),
                });
            }
        } else {
            if (this.faceNotVisibleFrames >= this.FACE_MISSING_THRESHOLD) {
                this.onDetection({ eventType: 'FACE_RETURNED', severity: 'LOW', confidence: 0.8, description: 'Face visible again' });
            }
            this.faceNotVisibleFrames = 0;
        }
    }

    // =========================================================
    // Motion detection (kept from original)
    // =========================================================

    detectMotion(currentData) {
        if (!this.lastFrameData || this.lastFrameData.length !== currentData.length) {
            return { motionLevel: 0 };
        }
        let diffSum = 0;
        const len = currentData.length;
        const step = 16;
        for (let i = 0; i < len; i += step) {
            diffSum +=
                Math.abs(currentData[i] - this.lastFrameData[i]) +
                Math.abs(currentData[i + 1] - this.lastFrameData[i + 1]) +
                Math.abs(currentData[i + 2] - this.lastFrameData[i + 2]);
        }
        const motionLevel = diffSum / ((len / step) * 765);
        this.motionHistory.push(motionLevel);
        if (this.motionHistory.length > 30) this.motionHistory.shift();
        return { motionLevel };
    }

    // =========================================================
    // Attention score
    // =========================================================

    _calculateAttention() {
        let score = 100;

        if (this.faceNotVisibleFrames >= this.FACE_MISSING_THRESHOLD) score -= 35;
        if (this.multipleFacesFrames >= this.MULTI_FACE_THRESHOLD) score -= 20;
        if (this.gazeAwayFrames >= this.GAZE_AWAY_THRESHOLD) score -= 25;

        const avgMotion = this.motionHistory.length > 0
            ? this.motionHistory.reduce((a, b) => a + b, 0) / this.motionHistory.length : 0;
        if (avgMotion > 0.1) score -= Math.min(20, avgMotion * 40);

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    getStats() {
        return {
            frameCount: this.frameCount,
            attentionScore: this.attentionScore,
            eyeTrackerActive: this.eyeTrackerReady,
            avgMotion: this.motionHistory.length > 0
                ? this.motionHistory.reduce((a, b) => a + b, 0) / this.motionHistory.length : 0,
        };
    }
}
