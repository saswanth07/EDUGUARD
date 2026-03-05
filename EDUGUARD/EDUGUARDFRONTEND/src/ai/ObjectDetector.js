/**
 * EduGuardian 2.0 - Object Detector
 * Uses TensorFlow.js COCO-SSD to detect prohibited items (phones) in the camera stream.
 */

export class ObjectDetector {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.isLoading = false;
    }

    /**
     * Load the COCO-SSD model.
     * Expects cocoSsd to be available globally via CDN in index.html
     */
    async load() {
        if (this.isLoaded || this.isLoading) return;
        this.isLoading = true;
        console.log('[ObjectDetector] Loading COCO-SSD model...');

        try {
            // Check if global cocoSsd is available (from CDN)
            if (typeof window.cocoSsd !== 'undefined') {
                this.model = await window.cocoSsd.load();
                this.isLoaded = true;
                console.log('[ObjectDetector] Model loaded successfully ✓');
            } else {
                throw new Error('cocoSsd global not found. Ensure CDN script is loaded in index.html');
            }
        } catch (err) {
            console.error('[ObjectDetector] Failed to load model:', err.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Detect objects in a video frame or canvas.
     * @param {HTMLVideoElement|HTMLCanvasElement} element 
     * @returns {Promise<Array>} List of detections
     */
    async detect(element) {
        if (!this.isLoaded || !this.model) return [];

        try {
            const predictions = await this.model.detect(element);
            // Filter for mobile phones or laptops (if needed)
            // 'cell phone' is the standard COCO-SSD class name
            return predictions.filter(p =>
                (p.class === 'cell phone' || p.class === 'mobile phone') && p.score > 0.6
            );
        } catch (err) {
            console.error('[ObjectDetector] Detection error:', err.message);
            return [];
        }
    }

    get ready() {
        return this.isLoaded;
    }
}
