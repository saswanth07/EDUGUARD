package com.eduguardian.controller;

import com.eduguardian.dto.ApiResponse;
import com.eduguardian.entity.User;
import com.eduguardian.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UserRepository userRepository;
    private final ExamRepository examRepository;
    private final ProctorLogRepository proctorLogRepository;
    private final RiskScoreRepository riskScoreRepository;
    private final SystemAlertRepository systemAlertRepository;
    private final AttendanceRepository attendanceRepository;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDashboardStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", userRepository.count());
        stats.put("totalStudents", userRepository.findByRole(User.Role.STUDENT).size());
        stats.put("totalInvigilators", userRepository.findByRole(User.Role.INVIGILATOR).size());
        stats.put("totalExams", examRepository.count());
        stats.put("totalProctorEvents", proctorLogRepository.count());
        stats.put("totalRiskScores", riskScoreRepository.count());
        return ResponseEntity.ok(ApiResponse.ok(stats));
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<User>>> getAllUsers() {
        return ResponseEntity.ok(ApiResponse.ok(userRepository.findAll()));
    }

    @GetMapping("/users/role/{role}")
    public ResponseEntity<ApiResponse<List<User>>> getUsersByRole(@PathVariable String role) {
        return ResponseEntity.ok(ApiResponse.ok(userRepository.findByRole(User.Role.valueOf(role))));
    }

    @GetMapping("/analytics/events/{examId}")
    public ResponseEntity<ApiResponse<List<Object[]>>> getEventAnalytics(@PathVariable Long examId) {
        return ResponseEntity.ok(ApiResponse.ok(proctorLogRepository.countEventsByTypeForExam(examId)));
    }

    @GetMapping("/analytics/high-risk/{examId}")
    public ResponseEntity<ApiResponse<List<Object[]>>> getHighRiskStudents(@PathVariable Long examId) {
        return ResponseEntity.ok(ApiResponse.ok(proctorLogRepository.findHighRiskStudents(examId)));
    }

    @GetMapping("/analytics/department-scores/{examId}")
    public ResponseEntity<ApiResponse<List<Object[]>>> getDepartmentScores(@PathVariable Long examId) {
        return ResponseEntity.ok(ApiResponse.ok(riskScoreRepository.avgScoreByDepartment(examId)));
    }

    @GetMapping("/alerts/{examId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAlerts(@PathVariable Long examId) {
        Map<String, Object> data = new HashMap<>();
        data.put("alerts", systemAlertRepository.findByExamIdOrderByCreatedAtDesc(examId));
        data.put("unreadCount", systemAlertRepository.countByExamIdAndIsReadFalse(examId));
        return ResponseEntity.ok(ApiResponse.ok(data));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<ApiResponse<String>> deleteUser(@PathVariable Long id) {
        userRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.ok("User deleted", "OK"));
    }
}
