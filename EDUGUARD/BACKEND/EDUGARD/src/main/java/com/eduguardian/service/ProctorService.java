package com.eduguardian.service;

import com.eduguardian.dto.ProctorEventDTO;
import com.eduguardian.entity.*;
import com.eduguardian.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProctorService {

    private final ProctorLogRepository proctorLogRepository;
    private final VisualEventRepository visualEventRepository;
    private final AudioEventRepository audioEventRepository;
    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final RiskScoreService riskScoreService;
    private final BlockchainService blockchainService;

    public ProctorLog logEvent(ProctorEventDTO dto) {
        ProctorLog proctorLog = logEventInternal(dto);

        // Optimize: Skip expensive risk recalculation for high-frequency eye/head events
        String type = dto.getEventType();
        if (!type.equals("EYE_DEVIATION") && !type.equals("LOOKING_DOWN") && !type.equals("HEAD_TURN")) {
            riskScoreService.calculateAndSave(dto.getExamId(), dto.getStudentId());
        }

        return proctorLog;
    }

    public void logVisualEvent(ProctorEventDTO dto) {
        Exam exam = examRepository.findById(dto.getExamId())
                .orElseThrow(() -> new RuntimeException("Exam not found"));
        User student = userRepository.findById(dto.getStudentId())
                .orElseThrow(() -> new RuntimeException("Student not found"));

        VisualEvent ve = VisualEvent.builder()
                .exam(exam)
                .student(student)
                .eventType(dto.getEventType())
                .faceCount(dto.getFaceCount())
                .eyeDeviationX(dto.getEyeDeviationX())
                .eyeDeviationY(dto.getEyeDeviationY())
                .headPoseYaw(dto.getHeadPoseYaw())
                .headPosePitch(dto.getHeadPosePitch())
                .blinkRate(dto.getBlinkRate())
                .attentionScore(dto.getAttentionScore())
                .confidence(dto.getConfidence())
                .timestamp(Instant.now())
                .build();

        visualEventRepository.save(ve);
    }

    public void logAudioEvent(ProctorEventDTO dto) {
        Exam exam = examRepository.findById(dto.getExamId())
                .orElseThrow(() -> new RuntimeException("Exam not found"));
        User student = userRepository.findById(dto.getStudentId())
                .orElseThrow(() -> new RuntimeException("Student not found"));

        AudioEvent ae = AudioEvent.builder()
                .exam(exam)
                .student(student)
                .eventType(dto.getEventType())
                .decibelLevel(dto.getDecibelLevel())
                .confidence(dto.getConfidence())
                .durationSeconds(dto.getDurationSeconds())
                .transcript(dto.getTranscript())
                .timestamp(Instant.now())
                .build();

        audioEventRepository.save(ae);
    }

    /**
     * Optimized: Limit results to the most recent 100 logs to prevent dashboard hangs
     */
    public List<ProctorLog> getLogsByExam(Long examId) {
        return proctorLogRepository.findTop100ByExamIdOrderByTimestampDesc(examId);
    }

    public List<ProctorLog> getLogsByExamAndStudent(Long examId, Long studentId) {
        return proctorLogRepository.findByExamIdAndStudentId(examId, studentId);
    }

    public void syncOfflineEvents(List<ProctorEventDTO> events) {
        if (events == null || events.isEmpty()) return;
        
        for (ProctorEventDTO event : events) {
            // Simplified log: don't trigger per-event risk calc during batch sync
            logEventInternal(event);
        }
        
        // Calculate and save once after the whole batch is processed
        ProctorEventDTO sample = events.get(0);
        riskScoreService.calculateAndSave(sample.getExamId(), sample.getStudentId());
        
        log.info("Synced {} offline events in batch for student {} in exam {}", 
                events.size(), sample.getStudentId(), sample.getExamId());
    }

    /**
     * Internal logging that skips automatic risk recalculation
     */
    private ProctorLog logEventInternal(ProctorEventDTO dto) {
        Exam exam = examRepository.findById(dto.getExamId())
                .orElseThrow(() -> new RuntimeException("Exam not found"));
        User student = userRepository.findById(dto.getStudentId())
                .orElseThrow(() -> new RuntimeException("Student not found"));

        String blockchainHash = blockchainService.addBlock(dto);

        ProctorLog proctorLog = ProctorLog.builder()
                .exam(exam)
                .student(student)
                .eventType(dto.getEventType())
                .severity(ProctorLog.Severity.valueOf(
                        dto.getSeverity() != null ? dto.getSeverity() : "LOW"))
                .confidence(dto.getConfidence())
                .description(dto.getDescription())
                .faceCount(dto.getFaceCount())
                .screenshotUrl(dto.getScreenshotUrl())
                .timestamp(dto.getTimestamp() != null ? dto.getTimestamp() : Instant.now())
                .isSynced(true)
                .blockchainHash(blockchainHash)
                .build();

        return proctorLogRepository.save(proctorLog);
    }
}
