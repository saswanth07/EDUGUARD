package com.eduguardian.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "audio_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AudioEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(name = "event_type", nullable = false, length = 30)
    private String eventType;

    @Column(name = "decibel_level")
    private Double decibelLevel = 0.0;

    @Column(name = "frequency_profile", columnDefinition = "TEXT")
    private String frequencyProfile;

    private Double confidence = 0.0;

    @Column(name = "duration_seconds")
    private Double durationSeconds = 0.0;

    @Column(columnDefinition = "TEXT")
    private String transcript;

    @Column(nullable = false)
    private Instant timestamp;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) timestamp = Instant.now();
    }
}
