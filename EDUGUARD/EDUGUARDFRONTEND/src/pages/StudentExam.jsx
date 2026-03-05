import { useState, useEffect, useRef, useCallback } from 'react';
import RiskGauge from '../components/RiskGauge';
import AlertList from '../components/AlertList';
import { AIDetectionEngine } from '../ai/AIDetectionEngine';
import { AudioMonitor } from '../ai/AudioMonitor';
import { RiskCalculator } from '../ai/RiskCalculator';
import { BrowserMonitor } from '../services/browserMonitor';
import { offlineSync } from '../services/offlineSync';
import './StudentExam.css';

export default function StudentExam({ user }) {
    const videoRef = useRef(null);
    const aiEngineRef = useRef(null);
    const audioMonitorRef = useRef(null);
    const riskCalcRef = useRef(new RiskCalculator());
    const browserMonitorRef = useRef(null);
    const streamRef = useRef(null);

    const [examActive, setExamActive] = useState(false);
    const [examCode, setExamCode] = useState('');
    const [examData, setExamData] = useState(null);       // Loaded exam info + questions
    const [currentQ, setCurrentQ] = useState(0);          // Current question index
    const [answers, setAnswers] = useState({});            // { qIndex: selectedOption }
    const [joinError, setJoinError] = useState('');
    const [joining, setJoining] = useState(false);
    const [submitted, setSubmitted] = useState(false);       // true once exam is submitted
    const [submitResult, setSubmitResult] = useState(null);  // { score, correct, total }
    const [riskScore, setRiskScore] = useState(0);
    const [riskLevel, setRiskLevel] = useState('LOW');
    const [alerts, setAlerts] = useState([]);
    const [attentionScore, setAttentionScore] = useState(100);
    const [timeLeft, setTimeLeft] = useState(null);  // null = not set yet, prevents premature auto-submit

    // ... (rest of state declarations remain the same)
    const [cameraReady, setCameraReady] = useState(false);
    const [micReady, setMicReady] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingSync, setPendingSync] = useState(0);
    const [scoreBreakdown, setScoreBreakdown] = useState({});

    // ---- Compute score from answers (defined early so timer useEffect can reference submitExam) ----
    const computeScore = useCallback(() => {
        const questions = examData?.questions || [];
        let correct = 0;
        const annotated = questions.map((q, i) => {
            const selected = answers[i];
            const correctAns = q.answer || q.correctAnswer;
            const isCorrect = selected && correctAns &&
                selected.toString().toUpperCase() === correctAns.toString().toUpperCase();
            if (isCorrect) correct++;
            return {
                questionIndex: i,
                questionText: q.question || q.text || '',
                selectedOption: selected || null,
                correctAnswer: correctAns || null,
                isCorrect: !!isCorrect,
            };
        });
        return { correct, total: questions.length, annotated };
    }, [answers, examData]);

    const submitExam = useCallback(async (submitType = 'SUBMITTED') => {
        if (submitted) return;
        setSubmitted(true);
        if (aiEngineRef.current) aiEngineRef.current.stop();
        if (audioMonitorRef.current) audioMonitorRef.current.stop();
        if (browserMonitorRef.current) browserMonitorRef.current.stop();
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
        const { correct, total, annotated } = computeScore();
        const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
        setSubmitResult({ correct, total, scorePercent });
        try {
            const { api } = await import('../services/api');
            await api.submitExam({
                examId: examData?.id,
                studentId: user?.userId || user?.id,
                answersJson: JSON.stringify(annotated),
                totalQuestions: total,
                correctAnswers: correct,
                scorePercent,
                submitType,
            });
        } catch (err) {
            console.error('Failed to submit exam to server:', err.message);
        }
    }, [submitted, computeScore, examData, user]);

    // Online/offline detection
    useEffect(() => {
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    // Timer — only runs when timeLeft is a positive number (not null, not 0)
    useEffect(() => {
        // Don't do anything if exam hasn't started or timer hasn't been initialized
        if (!examActive || timeLeft === null) return;

        // Time's up → auto-submit
        if (timeLeft <= 0 && !submitted) {
            console.log('[Timer] Time is up — auto-submitting exam');
            submitExam('AUTO_SUBMITTED');
            return;
        }

        const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
        return () => clearInterval(interval);
    }, [examActive, timeLeft, submitted, submitExam]);

    // Pending sync count
    useEffect(() => {
        const interval = setInterval(async () => {
            const count = await offlineSync.getPendingCount();
            setPendingSync(count);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Throttled risk sync: send risk to backend every 10s (heartbeat)
    useEffect(() => {
        if (!examActive || !examData?.id || submitted) return;

        const interval = setInterval(() => {
            const result = riskCalcRef.current.getScoreBreakdown();
            import('../services/api').then(({ api }) => {
                api.updateRiskScore({
                    examId: examData.id,
                    studentId: user?.userId || user?.id,
                    ...result.scores,
                }).catch(err => console.warn('[RiskSync] Failed:', err.message));
            });
        }, 10000); // 10 seconds heartbeat

        return () => clearInterval(interval);
    }, [examActive, examData, user, submitted]);

    const handleDetection = useCallback((event) => {
        const result = riskCalcRef.current.processEvent(event);
        setRiskScore(result.total);
        setRiskLevel(result.level);
        setScoreBreakdown(result.scores);
        if (event.attentionScore !== undefined) setAttentionScore(event.attentionScore);

        const alertEntry = { ...event, timestamp: new Date().toISOString() };
        setAlerts((prev) => [alertEntry, ...prev].slice(0, 50));

        // Ensure we have an ID for sync (fallback to 0 or something non-default if null)
        const currentExamId = examData?.id;
        if (currentExamId) {
            offlineSync.storeEvent({
                examId: currentExamId,
                studentId: user?.userId || user?.id,
                ...event,
            });
        }
    }, [user, examData]);

    const startExam = async () => {
        if (!examCode.trim()) { setJoinError('Please enter your exam code.'); return; }
        setJoining(true);
        setJoinError('');
        try {
            // 1. Validate exam code + fetch exam data (with questions)
            const { api } = await import('../services/api');
            const examRes = await api.getExamByCode(examCode.trim());
            if (!examRes.success || !examRes.data) {
                setJoinError('Invalid exam code. Please check and try again.');
                setJoining(false);
                return;
            }
            const exam = examRes.data;

            // --- TIME ENFORCEMENT ---
            const now = new Date();
            const examEnd = new Date(exam.endTime);
            const examStart = new Date(exam.startTime);

            if (now > examEnd) {
                setJoinError(`This exam has already ended at ${examEnd.toLocaleTimeString()}.`);
                setJoining(false);
                return;
            }

            if (now < examStart) {
                setJoinError(`This exam has not started yet. It starts at ${examStart.toLocaleTimeString()}.`);
                setJoining(false);
                return;
            }

            setExamData(exam);

            // Calculate time left based on actual endTime
            const remainingSec = Math.floor((examEnd.getTime() - now.getTime()) / 1000);
            // Cap it by durationMinutes if durationMinutes exists (whichever is smaller)
            const durationSec = (exam.durationMinutes || 60) * 60;
            const finalTimeLeft = Math.min(remainingSec, durationSec);

            console.log('[Exam] EndTime:', exam.endTime, 'Remaining:', remainingSec, 'sec');
            setTimeLeft(finalTimeLeft > 0 ? finalTimeLeft : 1);

            // 1b. Register attendance so invigilator can see us
            try {
                await api.joinExam(examCode.trim(), user?.userId || user?.id);
            } catch (joinErr) {
                console.warn('Join exam registration failed (non-blocking):', joinErr.message);
            }

            // 2. Request camera + microphone
            let stream = null;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: true,
                });
                streamRef.current = stream;
                setCameraReady(true);
                setMicReady(true);
            } catch (camErr) {
                console.warn('Camera unavailable:', camErr.message);
            }

            // 3. Mount exam UI
            setExamActive(true);

            // 4. Wait for React to render the video element
            await new Promise(resolve => requestAnimationFrame(resolve));
            await new Promise(resolve => setTimeout(resolve, 100));

            // 5. Attach stream and start AI detection
            if (stream && videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play().catch(() => { });
                    // Start AI AFTER video is ready (async — MediaPipe init)
                    aiEngineRef.current = new AIDetectionEngine(videoRef.current, handleDetection);
                    aiEngineRef.current.start().catch(err =>
                        console.warn('AI engine start error:', err.message)
                    );
                };
            }

            // 6. Browser behaviour monitoring (always active)
            // Use local exam object for immediate ID if examData state isn't flushed yet
            const browserOnEvent = (event) => {
                const eventWithContext = {
                    ...event,
                    examId: exam.id,
                    studentId: user?.userId || user?.id
                };
                handleDetection(eventWithContext);
            };
            browserMonitorRef.current = new BrowserMonitor(browserOnEvent);
            browserMonitorRef.current.start();

            // 7. Audio monitoring (analyse mic input for talking/whisper)
            if (stream) {
                audioMonitorRef.current = new AudioMonitor(stream, handleDetection);
                audioMonitorRef.current.start();
            }

            // 7. Offline sync
            await offlineSync.init();

            // 8. Fullscreen (non-blocking)
            document.documentElement.requestFullscreen().catch(() => { });

        } catch (err) {
            console.error('Failed to start exam:', err);
            setJoinError('Failed to start exam: ' + err.message);
        } finally {
            setJoining(false);
        }
    };

    const endExam = () => {
        if (aiEngineRef.current) aiEngineRef.current.stop();
        if (audioMonitorRef.current) audioMonitorRef.current.stop();
        if (browserMonitorRef.current) browserMonitorRef.current.stop();
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
        setExamActive(false);
    };

    const formatTime = (s) => {
        if (s === null || s === undefined) return '--:--:--';
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    if (!examActive) {
        return (
            <div className="student-page">
                <div className="exam-join-container animate-fade">
                    <div className="join-card card">
                        <div className="join-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5">
                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                <path d="M8 21h8M12 17v4" />
                            </svg>
                        </div>
                        <h2>Ready to Begin</h2>
                        <p className="join-desc">Enter your exam code to start the proctored session.<br />Camera and microphone access will be required.</p>
                        {joinError && <div className="join-error">{joinError}</div>}
                        <div className="input-group">
                            <label htmlFor="exam-code">Exam Code</label>
                            <input
                                id="exam-code"
                                className="input"
                                type="text"
                                placeholder="Enter exam code (e.g., EX-ABC12345)"
                                value={examCode}
                                onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && startExam()}
                            />
                        </div>
                        <button className="btn btn-primary btn-lg w-full" onClick={startExam} disabled={joining} id="start-exam-btn">
                            {joining ? '🔄 Joining exam...' : '🎓 Start Exam Session'}
                        </button>
                        <div className="join-requirements">
                            <div className="req-item">✅ Webcam required</div>
                            <div className="req-item">✅ Microphone required</div>
                            <div className="req-item">✅ Fullscreen mode</div>
                            <div className="req-item">✅ AI monitoring active</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const questions = examData?.questions || [];
    const totalQ = questions.length;
    const qObj = questions[currentQ];

    return (
        <div className="student-page exam-active">
            <div className="exam-layout">
                {/* LEFT - Webcam + Status */}
                <div className="exam-left">
                    <div className="webcam-container card">
                        <div className="webcam-header">
                            <span className="recording-indicator"><span className="rec-dot"></span>LIVE</span>
                            <div className="device-indicators">
                                <span className={`device-indicator ${cameraReady ? 'active' : ''}`}>📷</span>
                                <span className={`device-indicator ${micReady ? 'active' : ''}`}>🎤</span>
                            </div>
                        </div>
                        <video ref={videoRef} className="webcam-video" muted playsInline autoPlay id="webcam-video" />
                        <div className="webcam-overlay"><div className="face-guide"></div></div>
                    </div>

                    {/* Timer */}
                    <div className="timer-card card">
                        <div className="timer-label">TIME REMAINING</div>
                        <div className={`timer-value ${timeLeft < 300 ? 'timer-danger' : ''}`}>
                            {formatTime(timeLeft)}
                        </div>
                        <div className="timer-progress">
                            <div className="timer-bar" style={{ width: `${(timeLeft / 3600) * 100}%` }}></div>
                        </div>
                    </div>

                    {/* Connection status */}
                    <div className="status-card card">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-sm">
                                <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                                <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
                            </div>
                            {pendingSync > 0 && (
                                <span className="badge badge-warning">{pendingSync} pending sync</span>
                            )}
                        </div>
                    </div>

                    {/* Submit / End buttons */}
                    {!submitted ? (
                        <button
                            className="btn w-full"
                            style={{ background: 'var(--accent-success)', color: 'white', fontWeight: 700 }}
                            onClick={() => {
                                if (window.confirm(`Submit exam now?\n${Object.keys(answers).length} of ${examData?.questions?.length || 0} questions answered.`)) {
                                    submitExam('SUBMITTED');
                                }
                            }}
                            id="submit-exam-btn"
                        >
                            ✅ Submit Exam
                        </button>
                    ) : (
                        <div className="submitted-badge">✅ Exam Submitted</div>
                    )}
                    <button className="btn btn-ghost w-full" style={{ marginTop: 6, fontSize: '0.78rem' }} onClick={endExam} id="end-exam-btn">
                        Leave Session
                    </button>
                </div>

                {/* CENTRE - Question Panel or Result Screen */}
                <div className="exam-centre">
                    {submitted && submitResult ? (
                        /* ---- RESULT SCREEN ---- */
                        <div className="card exam-result-card">
                            <div className="result-header">
                                <div className={`result-score-circle ${submitResult.scorePercent >= 50 ? 'pass' : 'fail'}`}>
                                    <span className="result-pct">{submitResult.scorePercent}%</span>
                                    <span className="result-lbl">{submitResult.scorePercent >= 50 ? 'PASS' : 'FAIL'}</span>
                                </div>
                                <div className="result-stats">
                                    <h3 style={{ margin: '0 0 6px' }}>Exam Submitted!</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                                        {examData?.title}
                                    </p>
                                    <div className="result-counts">
                                        <span className="rc-correct">✅ {submitResult.correct} Correct</span>
                                        <span className="rc-wrong">❌ {submitResult.total - submitResult.correct} Wrong</span>
                                        <span className="rc-total">📋 {submitResult.total} Total</span>
                                    </div>
                                </div>
                            </div>

                            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', margin: '8px 0 16px' }}>
                                Your results have been sent to the teacher. You may now close this session.
                            </p>

                            {/* Per-question breakdown */}
                            <div className="result-breakdown">
                                {(examData?.questions || []).map((q, i) => {
                                    const sel = answers[i];
                                    const correct = q.answer || q.correctAnswer;
                                    const ok = sel && correct && sel.toString().toUpperCase() === correct.toString().toUpperCase();
                                    return (
                                        <div key={i} className={`result-q ${ok ? 'result-q-ok' : 'result-q-fail'}`}>
                                            <span className="rq-num">{i + 1}</span>
                                            <div className="rq-body">
                                                <p className="rq-text">{q.question || q.text}</p>
                                                <p className="rq-ans">
                                                    Your answer: <b>{sel || 'Not answered'}</b>
                                                    {!ok && <> &nbsp;·&nbsp; Correct: <b style={{ color: 'var(--accent-success)' }}>{correct}</b></>}
                                                </p>
                                            </div>
                                            <span>{ok ? '✅' : '❌'}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <button className="btn btn-primary w-full" style={{ marginTop: 16 }} onClick={endExam}>
                                Return to Dashboard
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Exam Header */}
                            <div className="exam-q-header card">
                                <div>
                                    <h4 style={{ margin: 0 }}>{examData?.title || 'Exam Session'}</h4>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                        {examData?.department} • {examData?.durationMinutes} min
                                    </p>
                                </div>
                                <div className="q-progress-info">
                                    <span className="q-count">{totalQ > 0 ? `Q ${currentQ + 1} / ${totalQ}` : '0 Questions'}</span>
                                    <div className="q-progress-bar">
                                        <div className="q-progress-fill" style={{ width: totalQ > 0 ? `${((currentQ + 1) / totalQ) * 100}%` : '0%' }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Question Body */}
                            {totalQ === 0 ? (
                                <div className="card exam-no-questions">
                                    <p>📋 No questions were added to this exam.</p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>The invigilator may add questions from the Admin Dashboard.</p>
                                </div>
                            ) : (
                                <div className="card exam-question-card">
                                    {/* Question navigation dots */}
                                    <div className="q-dots">
                                        {questions.map((_, i) => (
                                            <button
                                                key={i}
                                                className={`q-dot ${i === currentQ ? 'q-dot-active' : answers[i] ? 'q-dot-done' : ''}`}
                                                onClick={() => setCurrentQ(i)}
                                                title={`Question ${i + 1}`}
                                            >{i + 1}</button>
                                        ))}
                                    </div>

                                    {/* Difficulty badge */}
                                    <div style={{ marginBottom: 10 }}>
                                        <span className={`badge badge-${qObj?.difficulty === 'EASY' ? 'success' : qObj?.difficulty === 'HARD' ? 'danger' : 'warning'}`}>
                                            {qObj?.difficulty || 'MEDIUM'}
                                        </span>
                                        <span className="badge" style={{ marginLeft: 6, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                            {qObj?.type || 'MCQ'}
                                        </span>
                                    </div>

                                    {/* Question text */}
                                    <div className="q-text-main">
                                        {qObj?.question || qObj?.text}
                                    </div>

                                    {/* MCQ / True-False options */}
                                    {qObj?.options && qObj.options.length > 0 && (
                                        <div className="q-options-list">
                                            {qObj.options.map((opt, oi) => (
                                                <button
                                                    key={oi}
                                                    className={`q-option-btn ${answers[currentQ] === opt.label ? 'q-option-selected' : ''}`}
                                                    onClick={() => setAnswers(prev => ({ ...prev, [currentQ]: opt.label }))}
                                                >
                                                    <span className="q-option-label">{opt.label}</span>
                                                    <span className="q-option-text">{opt.text}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Short answer text area */}
                                    {(!qObj?.options || qObj.options.length === 0) && (
                                        <textarea
                                            className="q-short-answer"
                                            rows={5}
                                            placeholder="Type your answer here..."
                                            value={answers[currentQ] || ''}
                                            onChange={e => setAnswers(prev => ({ ...prev, [currentQ]: e.target.value }))}
                                        />
                                    )}

                                    {/* Navigation */}
                                    <div className="q-nav">
                                        <button
                                            className="btn btn-ghost"
                                            disabled={currentQ === 0}
                                            onClick={() => setCurrentQ(q => q - 1)}
                                        >← Previous</button>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            {Object.keys(answers).length} / {totalQ} answered
                                        </span>
                                        <button
                                            className="btn btn-primary"
                                            disabled={currentQ === totalQ - 1}
                                            onClick={() => setCurrentQ(q => q + 1)}
                                        >Next →</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* RIGHT - Risk Score + Alerts */}
                <div className="exam-right">
                    <div className="risk-panel card">
                        <h5 className="card-title">Your Integrity Score</h5>
                        <div className="risk-center">
                            <RiskGauge score={riskScore} size={160} />
                        </div>
                        <div className="attention-bar">
                            <span className="attention-label">Attention</span>
                            <div className="attention-track">
                                <div
                                    className="attention-fill"
                                    style={{
                                        width: `${attentionScore}%`,
                                        background: attentionScore > 70 ? 'var(--accent-success)' : attentionScore > 40 ? 'var(--accent-warning)' : 'var(--accent-danger)'
                                    }}
                                ></div>
                            </div>
                            <span className="attention-value">{attentionScore}%</span>
                        </div>
                        <div className="score-breakdown">
                            <div className="breakdown-item">
                                <span>👁️ Eye</span>
                                <div className="breakdown-bar"><div style={{ width: `${(scoreBreakdown.eyeDeviation || 0) / 20 * 100}%` }}></div></div>
                                <span>{Math.round(scoreBreakdown.eyeDeviation || 0)}/20</span>
                            </div>
                            <div className="breakdown-item">
                                <span>🔄 Head</span>
                                <div className="breakdown-bar"><div style={{ width: `${(scoreBreakdown.headPose || 0) / 10 * 100}%` }}></div></div>
                                <span>{Math.round(scoreBreakdown.headPose || 0)}/10</span>
                            </div>
                            <div className="breakdown-item">
                                <span>👥 Face</span>
                                <div className="breakdown-bar"><div style={{ width: `${(scoreBreakdown.multiFace || 0) / 10 * 100}%` }}></div></div>
                                <span>{Math.round(scoreBreakdown.multiFace || 0)}/10</span>
                            </div>
                            <div className="breakdown-item">
                                <span>📱 Phone</span>
                                <div className="breakdown-bar"><div style={{ width: `${(scoreBreakdown.phoneDetection || 0) / 20 * 100}%` }}></div></div>
                                <span>{Math.round(scoreBreakdown.phoneDetection || 0)}/20</span>
                            </div>
                            <div className="breakdown-item">
                                <span>🔊 Audio</span>
                                <div className="breakdown-bar"><div style={{ width: `${(scoreBreakdown.audioWhisper || 0) / 15 * 100}%` }}></div></div>
                                <span>{Math.round(scoreBreakdown.audioWhisper || 0)}/15</span>
                            </div>
                            <div className="breakdown-item">
                                <span>🔀 Tab</span>
                                <div className="breakdown-bar"><div style={{ width: `${(scoreBreakdown.tabSwitch || 0) / 15 * 100}%` }}></div></div>
                                <span>{Math.round(scoreBreakdown.tabSwitch || 0)}/15</span>
                            </div>
                            <div className="breakdown-item">
                                <span>💨 Move</span>
                                <div className="breakdown-bar"><div style={{ width: `${(scoreBreakdown.suddenMovement || 0) / 10 * 100}%` }}></div></div>
                                <span>{Math.round(scoreBreakdown.suddenMovement || 0)}/10</span>
                            </div>
                        </div>
                    </div>

                    <div className="alerts-panel card">
                        <div className="card-header">
                            <h5 className="card-title">Activity Log</h5>
                            <span className="badge badge-info">{alerts.length}</span>
                        </div>
                        <AlertList alerts={alerts} />
                    </div>
                </div>
            </div>
        </div >
    );
}
