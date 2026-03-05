package com.eduguardian.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "risk_scores")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class RiskScore {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "exam_id", nullable = false)
    @JsonIgnoreProperties({"questions", "hibernateLazyInitializer", "handler"})
    private Exam exam;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "student_id", nullable = false)
    @JsonIgnoreProperties({"passwordHash", "hibernateLazyInitializer", "handler"})
    private User student;

    @Column(name = "eye_deviation_score")
    private Double eyeDeviationScore = 0.0;

    @Column(name = "head_pose_score")
    private Double headPoseScore = 0.0;

    @Column(name = "multi_face_score")
    private Double multiFaceScore = 0.0;

    @Column(name = "phone_detection_score")
    private Double phoneDetectionScore = 0.0;

    @Column(name = "audio_whisper_score")
    private Double audioWhisperScore = 0.0;

    @Column(name = "tab_switch_score")
    private Double tabSwitchScore = 0.0;

    @Column(name = "sudden_movement_score")
    private Double suddenMovementScore = 0.0;

    @Column(name = "total_score")
    private Double totalScore = 0.0;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_level", length = 10)
    private RiskLevel riskLevel = RiskLevel.LOW;

    @Column(name = "ai_summary", columnDefinition = "TEXT")
    private String aiSummary;

    @Column(name = "calculated_at")
    private Instant calculatedAt;

    @PrePersist
    protected void onCreate() {
        if (calculatedAt == null) calculatedAt = Instant.now();
    }

    public enum RiskLevel {
        LOW, MEDIUM, HIGH, CRITICAL
    }
}
