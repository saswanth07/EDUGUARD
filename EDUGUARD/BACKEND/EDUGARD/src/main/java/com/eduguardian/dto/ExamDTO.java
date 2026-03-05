package com.eduguardian.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.List;
import java.util.Map;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamDTO {
    private Long id;
    private String title;
    private String description;
    private String examCode;
    private Long createdBy;
    private String creatorName;
    private String department;
    private Integer durationMinutes;
    private Instant startTime;
    private Instant endTime;
    private Integer maxStudents;
    private Boolean isProctored;
    private Boolean allowOffline;
    private String status;
    private Integer riskThreshold;
    private Long totalStudents;
    private Double averageRiskScore;
    private List<Map<String, Object>> questions;
}
