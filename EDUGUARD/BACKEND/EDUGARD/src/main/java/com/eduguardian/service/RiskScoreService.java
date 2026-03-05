package com.eduguardian.service;

import com.eduguardian.entity.*;
import com.eduguardian.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.Duration;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RiskScoreService {

    private final ProctorLogRepository proctorLogRepository;
    private final RiskScoreRepository riskScoreRepository;
    private final ExamRepository examRepository;
    private final UserRepository userRepository;

    /**
     * Calculate risk score based on the 7-category model (total = 100)
     * - Eye deviation:     0-20
     * - Head pose:         0-10
     * - Multi-face:        0-10
     * - Phone detection:   0-20
     * - Audio whisper:     0-15
     * - Tab switching:     0-15
     * - Sudden movement:   0-10
     */
    public RiskScore calculateAndSave(Long examId, Long studentId) {
        Instant windowStart = Instant.now().minus(Duration.ofMinutes(10));
        List<ProctorLog> recentLogs = proctorLogRepository
                .findByExamIdAndStudentIdAndTimestampBetween(examId, studentId, windowStart, Instant.now());

        double eyeScore = 0, headScore = 0, faceScore = 0, phoneScore = 0;
        double audioScore = 0, tabScore = 0, movementScore = 0;

        for (ProctorLog log : recentLogs) {
            switch (log.getEventType()) {
                case "EYE_DEVIATION":
                case "LOOKING_DOWN":
                    eyeScore = Math.min(20, eyeScore + 2);
                    break;
                case "HEAD_TURN":
                    headScore = Math.min(10, headScore + 1.5);
                    break;
                case "MULTIPLE_FACES":
                case "PERSON_BEHIND":
                    faceScore = Math.min(10, faceScore + 5);
                    break;
                case "PHONE_DETECTED":
                    phoneScore = Math.min(20, phoneScore + 10);
                    break;
                case "WHISPER_DETECTED":
                case "TALKING":
                case "MULTIPLE_VOICES":
                    audioScore = Math.min(15, audioScore + 3);
                    break;
                case "TAB_SWITCH":
                case "COPY_PASTE":
                case "WINDOW_MINIMIZE":
                case "FULLSCREEN_EXIT":
                    tabScore = Math.min(15, tabScore + 3);
                    break;
                case "SUDDEN_MOVEMENT":
                case "PAPER_PASSING":
                    movementScore = Math.min(10, movementScore + 2);
                    break;
                default:
                    break;
            }
        }

        double total = eyeScore + headScore + faceScore + phoneScore + audioScore + tabScore + movementScore;
        RiskScore.RiskLevel level;
        if (total >= 80) level = RiskScore.RiskLevel.CRITICAL;
        else if (total >= 60) level = RiskScore.RiskLevel.HIGH;
        else if (total >= 40) level = RiskScore.RiskLevel.MEDIUM;
        else level = RiskScore.RiskLevel.LOW;

        String summary = String.format(
                "Eye=%.0f/20, Head=%.0f/10, Face=%.0f/10, Phone=%.0f/20, Audio=%.0f/15, Tab=%.0f/15, Movement=%.0f/10",
                eyeScore, headScore, faceScore, phoneScore, audioScore, tabScore, movementScore
        );

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new RuntimeException("Exam not found"));
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        RiskScore rs = RiskScore.builder()
                .exam(exam)
                .student(student)
                .eyeDeviationScore(eyeScore)
                .headPoseScore(headScore)
                .multiFaceScore(faceScore)
                .phoneDetectionScore(phoneScore)
                .audioWhisperScore(audioScore)
                .tabSwitchScore(tabScore)
                .suddenMovementScore(movementScore)
                .totalScore(total)
                .riskLevel(level)
                .aiSummary(summary)
                .build();

        rs = riskScoreRepository.save(rs);
        log.info("Risk score calculated for student {} in exam {}: {}/100 ({})", studentId, examId, total, level);
        return rs;
    }

    public RiskScore getLatestScore(Long examId, Long studentId) {
        return riskScoreRepository.findTopByExamIdAndStudentIdOrderByCalculatedAtDesc(examId, studentId)
                .orElse(null);
    }

    public List<RiskScore> getExamRankings(Long examId) {
        return riskScoreRepository.findByExamIdOrderByTotalScoreDesc(examId);
    }

    public List<RiskScore> getScoreHistory(Long examId, Long studentId) {
        return riskScoreRepository.findByExamIdAndStudentIdOrderByCalculatedAtDesc(examId, studentId);
    }

    /**
     * Save risk scores directly from frontend-calculated values.
     * This is called periodically (~every 30s) from the client.
     */
    public RiskScore saveDirectScore(Long examId, Long studentId,
                                      double eyeDev, double headPose, double multiFace,
                                      double phone, double audio, double tab, double movement) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new RuntimeException("Exam not found"));
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        // Clamp to max values
        eyeDev    = Math.min(20, eyeDev);
        headPose  = Math.min(10, headPose);
        multiFace = Math.min(10, multiFace);
        phone     = Math.min(20, phone);
        audio     = Math.min(15, audio);
        tab       = Math.min(15, tab);
        movement  = Math.min(10, movement);

        double total = eyeDev + headPose + multiFace + phone + audio + tab + movement;
        RiskScore.RiskLevel level;
        if (total >= 80) level = RiskScore.RiskLevel.CRITICAL;
        else if (total >= 60) level = RiskScore.RiskLevel.HIGH;
        else if (total >= 40) level = RiskScore.RiskLevel.MEDIUM;
        else level = RiskScore.RiskLevel.LOW;

        String summary = String.format(
                "Eye=%.0f/20, Head=%.0f/10, Face=%.0f/10, Phone=%.0f/20, Audio=%.0f/15, Tab=%.0f/15, Movement=%.0f/10",
                eyeDev, headPose, multiFace, phone, audio, tab, movement);

        RiskScore rs = RiskScore.builder()
                .exam(exam)
                .student(student)
                .eyeDeviationScore(eyeDev)
                .headPoseScore(headPose)
                .multiFaceScore(multiFace)
                .phoneDetectionScore(phone)
                .audioWhisperScore(audio)
                .tabSwitchScore(tab)
                .suddenMovementScore(movement)
                .totalScore(total)
                .riskLevel(level)
                .aiSummary(summary)
                .build();

        rs = riskScoreRepository.save(rs);
        log.info("Direct risk score saved for student {} in exam {}: {}/100 ({})", studentId, examId, total, level);
        return rs;
    }
}
