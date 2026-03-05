import { useState } from 'react';
import { api } from '../services/api';
import './ExamFormModal.css';

const STEPS = ['Exam Details', 'Generate Questions', 'Review & Create'];

export default function ExamFormModal({ isOpen, onClose, onSuccess, user }) {
    const [step, setStep] = useState(0);
    const [formData, setFormData] = useState({
        title: '',
        department: '',
        description: '',
        durationMinutes: 60,
        startTime: '',
        maxStudents: 50,
        isProctored: true,
        allowOffline: true,
        riskThreshold: 70
    });

    // Question generation state
    const [qTopic, setQTopic] = useState('');
    const [qDifficulty, setQDifficulty] = useState('MEDIUM');
    const [qCount, setQCount] = useState(5);
    const [qType, setQType] = useState('MCQ');
    const [generatingQ, setGeneratingQ] = useState(false);
    const [generatedQuestions, setGeneratedQuestions] = useState([]);
    const [selectedQuestions, setSelectedQuestions] = useState(new Set());
    const [generatedBy, setGeneratedBy] = useState('');
    const [genError, setGenError] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleGenerate = async () => {
        if (!qTopic.trim()) { setGenError('Please enter a topic first.'); return; }
        setGeneratingQ(true);
        setGenError('');
        try {
            const res = await api.generateQuestions({
                topic: qTopic,
                difficulty: qDifficulty,
                count: Number(qCount),
                question_type: qType,
                subject: formData.department || undefined,
            });
            const questions = res.questions || [];
            setGeneratedQuestions(questions);
            setSelectedQuestions(new Set(questions.map((_, i) => i)));
            setGeneratedBy(res.generated_by || 'AI');
        } catch (err) {
            setGenError('Failed to generate questions. Check if the AI service is running.');
        } finally {
            setGeneratingQ(false);
        }
    };

    const toggleQuestion = (idx) => {
        setSelectedQuestions(prev => {
            const next = new Set(prev);
            next.has(idx) ? next.delete(idx) : next.add(idx);
            return next;
        });
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError('');
        try {
            const questions = generatedQuestions
                .filter((_, i) => selectedQuestions.has(i))
                .map(q => ({
                    question: q.question, // Standardized to 'question'
                    type: q.type,
                    difficulty: q.difficulty,
                    options: q.options || [],
                    answer: q.answer || '',
                    explanation: q.explanation || '',
                }));

            const payload = {
                ...formData,
                createdBy: user?.userId || user?.id,
                status: 'SCHEDULED',
                startTime: new Date(formData.startTime).toISOString(),
                endTime: new Date(new Date(formData.startTime).getTime() + formData.durationMinutes * 60000).toISOString(),
                questions,
            };
            const res = await api.createExam(payload);
            if (res.success) {
                onSuccess(res.data);
                handleClose();
            } else {
                setError(res.message || 'Failed to create exam');
            }
        } catch (err) {
            setError(err.message || 'Failed to create exam');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setStep(0);
        setGeneratedQuestions([]);
        setSelectedQuestions(new Set());
        setQTopic('');
        setError('');
        setGenError('');
        onClose();
    };

    const canProceed = () => {
        if (step === 0) return formData.title && formData.department && formData.startTime;
        return true;
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container modal-wide animate-slide-up">
                <div className="modal-header">
                    <div>
                        <h3>Schedule New Exam</h3>
                        <div className="step-breadcrumb">
                            {STEPS.map((s, i) => (
                                <span key={i} className={`step-crumb ${i === step ? 'active' : i < step ? 'done' : ''}`}>
                                    {i < step ? '✓' : i + 1}. {s}
                                </span>
                            ))}
                        </div>
                    </div>
                    <button className="btn-close" onClick={handleClose}>&times;</button>
                </div>

                <div className="modal-body">
                    {/* STEP 0: Exam Details */}
                    {step === 0 && (
                        <div className="modal-step">
                            {error && <div className="modal-error">{error}</div>}
                            <div className="form-group">
                                <label>Exam Title *</label>
                                <input name="title" value={formData.title} onChange={handleChange} required placeholder="e.g. Mid-term Data Structures" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Course/Department *</label>
                                    <input name="department" value={formData.department} onChange={handleChange} required placeholder="e.g. Computer Science" />
                                </div>
                                <div className="form-group">
                                    <label>Duration (Minutes)</label>
                                    <input type="number" name="durationMinutes" value={formData.durationMinutes} onChange={handleChange} required min="10" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea name="description" value={formData.description} onChange={handleChange} rows={2} placeholder="Optional exam description..." />
                            </div>
                            <div className="form-group">
                                <label>Start Time *</label>
                                <input type="datetime-local" name="startTime" value={formData.startTime} onChange={handleChange} required />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Max Students</label>
                                    <input type="number" name="maxStudents" value={formData.maxStudents} onChange={handleChange} min="1" />
                                </div>
                                <div className="form-group">
                                    <label>Risk Threshold (%)</label>
                                    <input type="number" name="riskThreshold" value={formData.riskThreshold} onChange={handleChange} min="0" max="100" />
                                </div>
                            </div>
                            <div className="form-checkboxes">
                                <label className="checkbox-label">
                                    <input type="checkbox" name="isProctored" checked={formData.isProctored} onChange={handleChange} />
                                    Enable AI Proctoring
                                </label>
                                <label className="checkbox-label">
                                    <input type="checkbox" name="allowOffline" checked={formData.allowOffline} onChange={handleChange} />
                                    Allow Offline Mode
                                </label>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Generate Questions */}
                    {step === 1 && (
                        <div className="modal-step">
                            <div className="ai-gen-header">
                                <span className="ai-badge">🤖 AI Question Generator</span>
                                <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                                    Powered by Google Gemini — generates questions by topic &amp; level
                                </p>
                            </div>

                            <div className="form-row">
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label>Topic / Chapter *</label>
                                    <input
                                        value={qTopic}
                                        onChange={e => setQTopic(e.target.value)}
                                        placeholder={`e.g. Binary Search Trees, ${formData.department || 'Physics'}`}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Question Type</label>
                                    <select value={qType} onChange={e => setQType(e.target.value)}>
                                        <option value="MCQ">Multiple Choice (MCQ)</option>
                                        <option value="TRUE_FALSE">True / False</option>
                                        <option value="SHORT_ANSWER">Short Answer</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Difficulty Level</label>
                                    <div className="difficulty-pills">
                                        {['EASY', 'MEDIUM', 'HARD'].map(d => (
                                            <button
                                                key={d}
                                                type="button"
                                                className={`pill ${qDifficulty === d ? `pill-active pill-${d.toLowerCase()}` : ''}`}
                                                onClick={() => setQDifficulty(d)}
                                            >
                                                {d === 'EASY' ? '🟢' : d === 'MEDIUM' ? '🟡' : '🔴'} {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Number of Questions</label>
                                    <input type="number" value={qCount} onChange={e => setQCount(e.target.value)} min="1" max="20" />
                                </div>
                            </div>

                            {genError && <div className="modal-error">{genError}</div>}

                            <button
                                type="button"
                                className="btn btn-ai"
                                onClick={handleGenerate}
                                disabled={generatingQ}
                            >
                                {generatingQ ? (
                                    <><span className="spinner-sm"></span> Generating...</>
                                ) : (
                                    <>✨ Generate Questions with AI</>
                                )}
                            </button>

                            {generatedQuestions.length > 0 && (
                                <div className="questions-preview">
                                    <div className="qp-header">
                                        <span>Generated by <strong>{generatedBy}</strong> • {generatedQuestions.length} questions</span>
                                        <span className="text-muted">{selectedQuestions.size} selected</span>
                                    </div>
                                    <div className="questions-list">
                                        {generatedQuestions.map((q, i) => (
                                            <div
                                                key={i}
                                                className={`question-item ${selectedQuestions.has(i) ? 'q-selected' : 'q-unselected'}`}
                                                onClick={() => toggleQuestion(i)}
                                            >
                                                <div className="q-check">{selectedQuestions.has(i) ? '✅' : '⬜'}</div>
                                                <div className="q-content">
                                                    <div className="q-text">{i + 1}. {q.question}</div>
                                                    {q.options && (
                                                        <div className="q-options">
                                                            {q.options.map((opt, j) => (
                                                                <span key={j} className={`q-opt ${opt.is_correct ? 'q-opt-correct' : ''}`}>
                                                                    {opt.label}. {opt.text}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {q.explanation && (
                                                        <div className="q-explain">💡 {q.explanation}</div>
                                                    )}
                                                </div>
                                                <div className="q-meta">
                                                    <span className={`badge badge-${q.difficulty === 'EASY' ? 'success' : q.difficulty === 'MEDIUM' ? 'warning' : 'danger'}`}>
                                                        {q.difficulty}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 2: Review & Create */}
                    {step === 2 && (
                        <div className="modal-step">
                            <div className="review-section">
                                <h5>📝 Exam Details</h5>
                                <div className="review-grid">
                                    <div><span className="rv-label">Title</span><span className="rv-value">{formData.title}</span></div>
                                    <div><span className="rv-label">Department</span><span className="rv-value">{formData.department}</span></div>
                                    <div><span className="rv-label">Start</span><span className="rv-value">{formData.startTime ? new Date(formData.startTime).toLocaleString() : '—'}</span></div>
                                    <div><span className="rv-label">Duration</span><span className="rv-value">{formData.durationMinutes} min</span></div>
                                    <div><span className="rv-label">Max Students</span><span className="rv-value">{formData.maxStudents}</span></div>
                                    <div><span className="rv-label">Risk Threshold</span><span className="rv-value">{formData.riskThreshold}%</span></div>
                                    <div><span className="rv-label">AI Proctoring</span><span className="rv-value">{formData.isProctored ? '✅ Enabled' : '❌ Disabled'}</span></div>
                                    <div><span className="rv-label">Offline Mode</span><span className="rv-value">{formData.allowOffline ? '✅ Allowed' : '❌ Not Allowed'}</span></div>
                                </div>
                            </div>

                            {selectedQuestions.size > 0 && (
                                <div className="review-section">
                                    <h5>❓ Questions ({selectedQuestions.size} selected)</h5>
                                    <div className="review-q-list">
                                        {generatedQuestions
                                            .filter((_, i) => selectedQuestions.has(i))
                                            .map((q, i) => (
                                                <div key={i} className="review-q-item">
                                                    <span className="review-q-num">{i + 1}</span>
                                                    <span className="review-q-text">{q.question}</span>
                                                    <span className={`badge badge-${q.difficulty === 'EASY' ? 'success' : q.difficulty === 'MEDIUM' ? 'warning' : 'danger'}`}>
                                                        {q.difficulty}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {error && <div className="modal-error">{error}</div>}
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="modal-actions">
                    <button type="button" className="btn btn-ghost" onClick={step === 0 ? handleClose : () => setStep(s => s - 1)}>
                        {step === 0 ? 'Cancel' : '← Back'}
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {step < 2 && (
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setStep(s => s + 1)}
                                disabled={!canProceed()}
                            >
                                {step === 1 && generatedQuestions.length === 0 ? 'Skip Questions →' : 'Next →'}
                            </button>
                        )}
                        {step === 2 && (
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleSubmit}
                                disabled={submitting}
                            >
                                {submitting ? 'Creating...' : '🚀 Create Exam'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
