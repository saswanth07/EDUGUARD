package com.eduguardian.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProctorEventDTO {
    private Long examId;
    private Long studentId;
    private String eventType;
    private String severity;
    private Double confidence;
    private String description;
    private String screenshotUrl;
    private Instant timestamp;

    // Visual-specific fields
    private Integer faceCount;
    private Double eyeDeviationX;
    private Double eyeDeviationY;
    private Double headPoseYaw;
    private Double headPosePitch;
    private Double blinkRate;
    private Double attentionScore;

    // Audio-specific fields
    private Double decibelLevel;
    private Double durationSeconds;
    private String transcript;

    // Risk scores
    private Double eyeDeviationScore;
    private Double headPoseScoreVal;
    private Double multiFaceScoreVal;
    private Double phoneDetectionScoreVal;
    private Double audioWhisperScoreVal;
    private Double tabSwitchScoreVal;
    private Double suddenMovementScoreVal;
    private Double totalScore;
    private String riskLevel;

    // Blockchain
    private String blockchainHash;
    private String previousHash;
}
