/**
 * EduGuardian 2.0 - Client-Side Risk Calculator
 * Combines all AI + browser signals into a 0-100 risk score.
 */

export class RiskCalculator {
    constructor() {
        this.scores = {
            eyeDeviation: 0,    // max 20
            headPose: 0,         // max 10
            multiFace: 0,        // max 10
            phoneDetection: 0,   // max 20
            audioWhisper: 0,     // max 15
            tabSwitch: 0,        // max 15
            suddenMovement: 0,   // max 10
        };
        this.eventCounts = {};
        this.history = [];
    }

    processEvent(event) {
        const type = event.eventType;
        this.eventCounts[type] = (this.eventCounts[type] || 0) + 1;
        const confidence = event.confidence || 0.5;

        switch (type) {
            case 'EYE_DEVIATION':
            case 'LOOKING_DOWN':
                this.scores.eyeDeviation = Math.min(20, this.scores.eyeDeviation + 2 * confidence);
                break;
            case 'HEAD_TURN':
                this.scores.headPose = Math.min(10, this.scores.headPose + 1.5 * confidence);
                break;
            case 'MULTIPLE_FACES':
            case 'PERSON_BEHIND':
                this.scores.multiFace = Math.min(10, this.scores.multiFace + 5 * confidence);
                break;
            case 'PHONE_DETECTED':
                this.scores.phoneDetection = Math.min(20, this.scores.phoneDetection + 15 * confidence);
                break;
            case 'WHISPER_DETECTED':
            case 'TALKING':
            case 'MULTIPLE_VOICES':
                this.scores.audioWhisper = Math.min(15, this.scores.audioWhisper + 3 * confidence);
                break;
            case 'TAB_SWITCH':
            case 'COPY_PASTE':
            case 'WINDOW_MINIMIZE':
            case 'FULLSCREEN_EXIT':
            case 'EXTENSION_TAB_SWITCH':
            case 'TAB_BACKGROUNDED':
            case 'WINDOW_BLUR':
                const penalty = (type === 'WINDOW_BLUR') ? 1.5 : 3;
                this.scores.tabSwitch = Math.min(15, this.scores.tabSwitch + penalty * confidence);
                break;
            case 'SUDDEN_MOVEMENT':
            case 'PAPER_PASSING':
                this.scores.suddenMovement = Math.min(10, this.scores.suddenMovement + 2 * confidence);
                break;
            case 'FACE_NOT_VISIBLE':
                this.scores.eyeDeviation = Math.min(20, this.scores.eyeDeviation + 4 * confidence);
                break;
            default:
                break;
        }

        // Apply decay (scores slowly decrease over time)
        this.applyDecay();

        const total = this.getTotal();
        this.history.push({ timestamp: Date.now(), total, event: type });
        if (this.history.length > 100) this.history.shift();

        return {
            scores: { ...this.scores },
            total,
            level: this.getLevel(total),
        };
    }

    applyDecay() {
        const decay = 0.05;
        Object.keys(this.scores).forEach((key) => {
            this.scores[key] = Math.max(0, this.scores[key] - decay);
        });
    }

    getTotal() {
        return Math.round(
            Object.values(this.scores).reduce((sum, v) => sum + v, 0)
        );
    }

    getLevel(total) {
        if (total >= 80) return 'CRITICAL';
        if (total >= 60) return 'HIGH';
        if (total >= 40) return 'MEDIUM';
        return 'LOW';
    }

    getScoreBreakdown() {
        return {
            ...this.scores,
            total: this.getTotal(),
            level: this.getLevel(this.getTotal()),
        };
    }

    getHistory() {
        return this.history;
    }

    reset() {
        Object.keys(this.scores).forEach((key) => {
            this.scores[key] = 0;
        });
        this.eventCounts = {};
        this.history = [];
    }
}
