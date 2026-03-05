/**
 * EduGuardian 2.0 — Real Eye & Face Tracker (MediaPipe FaceMesh)
 *
 * Uses @mediapipe/face_mesh loaded from CDN (see index.html).
 * Provides:
 *   - Accurate face count (replaces skin-cluster heuristic)
 *   - Gaze direction from iris landmarks: LEFT / RIGHT / DOWN / CENTER
 *   - Head pose estimation from nose + forehead landmarks
 *
 * Usage:
 *   const tracker = new EyeTracker();
 *   await tracker.init(videoElement);
 *   const result = tracker.getLatestResult();   // { faceCount, gazeDirection, confidence, headPose }
 *   tracker.destroy();
 */

export class EyeTracker {
    constructor() {
        this.faceMesh = null;
        this.latestResult = {
            faceCount: 0,
            gazeDirection: 'CENTER',
            confidence: 0,
            headPose: 'FRONT',       // FRONT / LEFT / RIGHT / DOWN
        };
        this.ready = false;
        this._destroyed = false;
    }

    /**
     * Initialise MediaPipe FaceMesh and start processing the video feed.
     * @param {HTMLVideoElement} video
     */
    async init(video) {
        if (this._destroyed) return;
        this.video = video;

        // MediaPipe globals are loaded via CDN (window.FaceMesh, window.Camera)
        if (typeof window.FaceMesh === 'undefined') {
            console.error('[EyeTracker] MediaPipe FaceMesh NOT found in window. Ensure script is loaded in index.html');
            this.ready = false;
            return;
        }

        try {
            this.faceMesh = new window.FaceMesh({
                locateFile: (file) =>
                    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
            });

            this.faceMesh.setOptions({
                maxNumFaces: 3,          // detect up to 3 faces
                refineLandmarks: true,   // includes iris landmarks
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            this.faceMesh.onResults((results) => this._onResults(results));

            // Use MediaPipe Camera utility if available, else manual send
            if (typeof window.Camera !== 'undefined') {
                this.camera = new window.Camera(video, {
                    onFrame: async () => {
                        if (this._destroyed || !this.faceMesh) return;
                        await this.faceMesh.send({ image: video });
                    },
                    width: video.videoWidth || 1280,
                    height: video.videoHeight || 720,
                });
                await this.camera.start();
            } else {
                // Fallback: manual frame sending via rAF
                this._manualLoop(video);
            }

            this.ready = true;
            console.log('[EyeTracker] MediaPipe FaceMesh initialised successfully');
        } catch (err) {
            console.error('[EyeTracker] Initialisation failed:', err);
            this.ready = false;
        }
    }

    /** Fallback: send frames manually when Camera util is not available */
    _manualLoop(video) {
        if (this._destroyed || !this.faceMesh) return;
        if (video.readyState >= 2) {
            this.faceMesh.send({ image: video }).then(() => {
                if (!this._destroyed) requestAnimationFrame(() => this._manualLoop(video));
            }).catch(() => {
                if (!this._destroyed) requestAnimationFrame(() => this._manualLoop(video));
            });
        } else {
            requestAnimationFrame(() => this._manualLoop(video));
        }
    }

    /** Process MediaPipe results */
    _onResults(results) {
        if (this._destroyed) return;

        const faces = results.multiFaceLandmarks || [];
        const faceCount = faces.length;

        if (faceCount === 0) {
            this.latestResult = {
                faceCount: 0,
                gazeDirection: 'NONE',
                confidence: 1.0,
                headPose: 'NONE',
            };
            return;
        }

        // Analyse the primary face (index 0)
        const lm = faces[0];
        const gazeDirection = this._calculateGaze(lm);
        const headPose = this._calculateHeadPose(lm);

        this.latestResult = {
            faceCount,
            gazeDirection,
            confidence: 0.9,
            headPose,
        };
    }

    /**
     * Calculate gaze direction from iris landmarks.
     *
     * MediaPipe iris landmarks (refineLandmarks = true):
     *   Left eye iris center:  #468
     *   Right eye iris center: #473
     *   Left eye corners:  #33 (outer), #133 (inner)
     *   Right eye corners: #362 (outer), #263 (inner)
     */
    _calculateGaze(landmarks) {
        try {
            // Left eye
            const leftIris = landmarks[468];
            const leftOuter = landmarks[33];
            const leftInner = landmarks[133];

            // Right eye
            const rightIris = landmarks[473];
            const rightOuter = landmarks[362];
            const rightInner = landmarks[263];

            // Calculate horizontal ratio for each eye (0 = looking right, 1 = looking left)
            const leftEyeWidth = Math.abs(leftInner.x - leftOuter.x);
            const rightEyeWidth = Math.abs(rightInner.x - rightOuter.x);

            if (leftEyeWidth < 0.001 || rightEyeWidth < 0.001) return 'CENTER';

            const leftRatio = (leftIris.x - leftOuter.x) / leftEyeWidth;
            const rightRatio = (rightIris.x - rightOuter.x) / rightEyeWidth;
            const avgRatio = (leftRatio + rightRatio) / 2;

            // Vertical: check if looking down
            const leftEyeTop = landmarks[159]; // upper eyelid
            const leftEyeBottom = landmarks[145]; // lower eyelid
            const eyeHeight = Math.abs(leftEyeTop.y - leftEyeBottom.y);
            const irisVerticalPos = (leftIris.y - leftEyeTop.y) / (eyeHeight || 0.01);

            // Thresholds
            if (irisVerticalPos > 0.7) return 'DOWN';
            if (avgRatio < 0.35) return 'RIGHT';  // camera-mirrored
            if (avgRatio > 0.65) return 'LEFT';    // camera-mirrored

            return 'CENTER';
        } catch {
            return 'CENTER';
        }
    }

    /**
     * Estimate head pose from nose tip (#1) and forehead (#10).
     */
    _calculateHeadPose(landmarks) {
        try {
            const noseTip = landmarks[1];
            const forehead = landmarks[10];
            const chin = landmarks[152];
            const leftCheek = landmarks[234];
            const rightCheek = landmarks[454];

            // Horizontal head turn: compare nose position relative to cheeks
            const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
            if (faceWidth < 0.01) return 'FRONT';

            const noseRelative = (noseTip.x - leftCheek.x) / faceWidth;

            if (noseRelative < 0.35) return 'RIGHT';
            if (noseRelative > 0.65) return 'LEFT';

            // Vertical: check if head is tilted down
            const faceHeight = Math.abs(forehead.y - chin.y);
            const noseVertical = (noseTip.y - forehead.y) / (faceHeight || 0.01);
            if (noseVertical > 0.7) return 'DOWN';

            return 'FRONT';
        } catch {
            return 'FRONT';
        }
    }

    /**
     * Get the latest detection result.
     * @returns {{ faceCount: number, gazeDirection: string, confidence: number, headPose: string }}
     */
    getLatestResult() {
        return { ...this.latestResult };
    }

    /** Clean up resources */
    destroy() {
        this._destroyed = true;
        if (this.camera) {
            try { this.camera.stop(); } catch { }
        }
        if (this.faceMesh) {
            try { this.faceMesh.close(); } catch { }
            this.faceMesh = null;
        }
        this.ready = false;
    }
}
