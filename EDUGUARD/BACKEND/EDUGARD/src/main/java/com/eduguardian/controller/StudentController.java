package com.eduguardian.controller;

import com.eduguardian.dto.ApiResponse;
import com.eduguardian.entity.*;
import com.eduguardian.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/student")
@RequiredArgsConstructor
@Slf4j
public class StudentController {

    private final AttendanceRepository attendanceRepository;
    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final DeviceLogRepository deviceLogRepository;
    private final RiskScoreRepository riskScoreRepository;
    private final ExamSubmissionRepository submissionRepository;

    @PostMapping("/join/{examCode}")
    public ResponseEntity<ApiResponse<Attendance>> joinExam(
            @PathVariable String examCode,
            @RequestParam Long studentId,
            @RequestParam(required = false) String ipAddress,
            @RequestParam(required = false) String browserInfo) {
        try {
            Exam exam = examRepository.findByExamCode(examCode)
                    .orElseThrow(() -> new RuntimeException("Exam not found"));
            User student = userRepository.findById(studentId)
                    .orElseThrow(() -> new RuntimeException("Student not found"));

            // Upsert - only create attendance record if not already present
            Attendance attendance = attendanceRepository
                    .findByExamIdAndStudentId(exam.getId(), studentId)
                    .orElse(Attendance.builder()
                            .exam(exam)
                            .student(student)
                            .status(Attendance.AttendanceStatus.PRESENT)
                            .ipAddress(ipAddress)
                            .browserInfo(browserInfo)
                            .build());
            attendance = attendanceRepository.save(attendance);
            return ResponseEntity.ok(ApiResponse.ok("Joined exam", attendance));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/leave/{examId}/{studentId}")
    public ResponseEntity<ApiResponse<String>> leaveExam(
            @PathVariable Long examId, @PathVariable Long studentId) {
        attendanceRepository.findByExamIdAndStudentId(examId, studentId).ifPresent(att -> {
            att.setLeftAt(Instant.now());
            attendanceRepository.save(att);
        });
        return ResponseEntity.ok(ApiResponse.ok("Left exam", "OK"));
    }

    /**
     * Submit exam answers.
     * Body: { examId, studentId, answersJson, totalQuestions, correctAnswers, scorePercent, submitType }
     */
    @PostMapping("/submit")
    public ResponseEntity<ApiResponse<ExamSubmission>> submitExam(
            @RequestBody Map<String, Object> body) {
        try {
            Long examId    = Long.parseLong(body.get("examId").toString());
            Long studentId = Long.parseLong(body.get("studentId").toString());

            Exam exam    = examRepository.findById(examId)
                    .orElseThrow(() -> new RuntimeException("Exam not found"));
            User student = userRepository.findById(studentId)
                    .orElseThrow(() -> new RuntimeException("Student not found"));

            // --- SERVER-SIDE DEADLINE ENFORCEMENT ---
            // Allow 2 minute grace period for network latency / auto-submit processing
            Instant deadline = exam.getEndTime().plus(Duration.ofMinutes(2));
            if (Instant.now().isAfter(deadline)) {
                log.warn("Late submission attempt by student {} for exam {}. Deadline was {}, current time {}", 
                    studentId, examId, deadline, Instant.now());
                return ResponseEntity.badRequest().body(ApiResponse.error("Submission rejected: The exam deadline has passed."));
            }

            // Upsert — re-submission overwrites previous
            ExamSubmission sub = submissionRepository
                    .findByExamIdAndStudentId(examId, studentId)
                    .orElse(ExamSubmission.builder().exam(exam).student(student).build());

            sub.setAnswersJson(body.getOrDefault("answersJson", "[]").toString());
            sub.setTotalQuestions(Integer.parseInt(body.getOrDefault("totalQuestions", "0").toString()));
            sub.setCorrectAnswers(Integer.parseInt(body.getOrDefault("correctAnswers", "0").toString()));
            sub.setScorePercent(Double.parseDouble(body.getOrDefault("scorePercent", "0").toString()));
            sub.setSubmittedAt(Instant.now());

            String typeStr = body.getOrDefault("submitType", "SUBMITTED").toString();
            try { sub.setStatus(ExamSubmission.SubmitStatus.valueOf(typeStr)); }
            catch (Exception ignored) { sub.setStatus(ExamSubmission.SubmitStatus.SUBMITTED); }

            sub = submissionRepository.save(sub);

            // Mark attendance as left
            attendanceRepository.findByExamIdAndStudentId(examId, studentId).ifPresent(att -> {
                att.setLeftAt(Instant.now());
                attendanceRepository.save(att);
            });

            return ResponseEntity.ok(ApiResponse.ok("Exam submitted successfully", sub));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Get all submissions for an exam — for invigilator/teacher results view */
    @GetMapping("/submissions/{examId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVIGILATOR')")
    public ResponseEntity<ApiResponse<List<ExamSubmission>>> getSubmissions(
            @PathVariable Long examId) {
        return ResponseEntity.ok(ApiResponse.ok(submissionRepository.findByExamId(examId)));
    }

    @PostMapping("/device-log")
    public ResponseEntity<ApiResponse<DeviceLog>> logDevice(@RequestBody DeviceLog deviceLog) {
        deviceLog = deviceLogRepository.save(deviceLog);
        return ResponseEntity.ok(ApiResponse.ok("Device logged", deviceLog));
    }

    @GetMapping("/my-risk/{examId}/{studentId}")
    public ResponseEntity<ApiResponse<RiskScore>> getMyRisk(
            @PathVariable Long examId, @PathVariable Long studentId) {
        RiskScore score = riskScoreRepository
                .findTopByExamIdAndStudentIdOrderByCalculatedAtDesc(examId, studentId)
                .orElse(null);
        return ResponseEntity.ok(ApiResponse.ok(score));
    }

    @GetMapping("/attendance/{examId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVIGILATOR')")
    public ResponseEntity<ApiResponse<List<Attendance>>> getAttendance(@PathVariable Long examId) {
        return ResponseEntity.ok(ApiResponse.ok(attendanceRepository.findByExamId(examId)));
    }
}
