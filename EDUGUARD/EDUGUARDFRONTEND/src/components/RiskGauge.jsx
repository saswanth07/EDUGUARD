import './RiskGauge.css';

export default function RiskGauge({ score = 0, size = 140, label = 'Risk Score' }) {
    const level = score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (score / 100) * circumference;

    const colors = {
        low: '#10b981',
        medium: '#f59e0b',
        high: '#ef4444',
        critical: '#dc2626',
    };

    return (
        <div className={`risk-gauge risk-gauge-${level}`} style={{ width: size, height: size }} id="risk-gauge">
            <svg viewBox="0 0 120 120" className="gauge-svg">
                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-color)" strokeWidth="8" />
                <circle
                    cx="60" cy="60" r="54"
                    fill="none"
                    stroke={colors[level]}
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    className="gauge-progress"
                    style={{ filter: `drop-shadow(0 0 6px ${colors[level]})` }}
                />
            </svg>
            <div className="gauge-content">
                <span className="gauge-value" style={{ color: colors[level] }}>{Math.round(score)}</span>
                <span className="gauge-label">{label}</span>
                <span className={`gauge-level badge badge-${level === 'low' ? 'success' : level === 'medium' ? 'warning' : 'danger'}`}>
                    {level.toUpperCase()}
                </span>
            </div>
        </div>
    );
}
