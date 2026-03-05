package com.eduguardian.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "visual_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VisualEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "face_count")
    private Integer faceCount = 1;

    @Column(name = "eye_deviation_x")
    private Double eyeDeviationX = 0.0;

    @Column(name = "eye_deviation_y")
    private Double eyeDeviationY = 0.0;

    @Column(name = "head_pose_yaw")
    private Double headPoseYaw = 0.0;

    @Column(name = "head_pose_pitch")
    private Double headPosePitch = 0.0;

    @Column(name = "head_pose_roll")
    private Double headPoseRoll = 0.0;

    @Column(name = "blink_rate")
    private Double blinkRate = 0.0;

    @Column(name = "attention_score")
    private Double attentionScore = 100.0;

    private Double confidence = 0.0;

    @Column(name = "objects_detected", columnDefinition = "TEXT")
    private String objectsDetected;

    @Column(nullable = false)
    private Instant timestamp;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) timestamp = Instant.now();
    }
}
