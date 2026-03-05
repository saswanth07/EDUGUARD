import './AlertList.css';

export default function AlertList({ alerts = [] }) {
    const severityIcon = {
        LOW: '🔵',
        MEDIUM: '🟡',
        HIGH: '🟠',
        CRITICAL: '🔴',
    };

    if (alerts.length === 0) {
        return (
            <div className="alert-list-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>No alerts yet</p>
            </div>
        );
    }

    return (
        <div className="alert-list" id="alert-list">
            {alerts.slice(0, 20).map((alert, i) => (
                <div key={i} className={`alert-item risk-bg-${(alert.severity || 'low').toLowerCase()} animate-slide`}>
                    <span className="alert-icon">
                        {severityIcon[alert.severity] || '⚪'}
                    </span>
                    <div className="alert-content">
                        <span className="alert-type">{alert.eventType?.replace(/_/g, ' ')}</span>
                        <span className="alert-desc">{alert.description}</span>
                    </div>
                    <div className="alert-meta">
                        <span className="alert-confidence">
                            {alert.confidence ? `${(alert.confidence * 100).toFixed(0)}%` : ''}
                        </span>
                        <span className="alert-time">
                            {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'Just now'}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}
