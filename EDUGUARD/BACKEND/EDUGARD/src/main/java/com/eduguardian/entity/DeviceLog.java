package com.eduguardian.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "device_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeviceLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(name = "device_type", length = 50)
    private String deviceType;

    @Column(name = "os_info", length = 100)
    private String osInfo;

    @Column(name = "browser_info", length = 200)
    private String browserInfo;

    @Column(name = "screen_resolution", length = 20)
    private String screenResolution;

    @Column(name = "camera_available")
    private Boolean cameraAvailable = false;

    @Column(name = "microphone_available")
    private Boolean microphoneAvailable = false;

    @Column(name = "network_type", length = 50)
    private String networkType;

    @Column(name = "battery_level")
    private Integer batteryLevel;

    @Column(name = "is_offline")
    private Boolean isOffline = false;

    @Column(name = "logged_at")
    private Instant loggedAt;

    @PrePersist
    protected void onCreate() {
        if (loggedAt == null) loggedAt = Instant.now();
    }
}
