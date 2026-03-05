package com.eduguardian.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "proctor_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class ProctorLog {
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

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Severity severity = Severity.LOW;

    @Column(precision = 5)
    private Double confidence = 0.0;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "face_count")
    private Integer faceCount;

    @Column(name = "screenshot_url", length = 500)
    private String screenshotUrl;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(name = "is_synced")
    private Boolean isSynced = true;

    @Column(name = "blockchain_hash", length = 128)
    private String blockchainHash;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) timestamp = Instant.now();
    }

    public enum Severity {
        LOW, MEDIUM, HIGH, CRITICAL
    }
}
