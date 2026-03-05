package com.eduguardian.controller;

import com.eduguardian.dto.*;
import com.eduguardian.service.ExamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamController {

    private final ExamService examService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'INVIGILATOR')")
    public ResponseEntity<ApiResponse<ExamDTO>> createExam(@RequestBody ExamDTO examDTO) {
        try {
            ExamDTO created = examService.createExam(examDTO);
            return ResponseEntity.ok(ApiResponse.ok("Exam created", created));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ExamDTO>>> getAllExams() {
        return ResponseEntity.ok(ApiResponse.ok(examService.getAllExams()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ExamDTO>> getExam(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(examService.getExamById(id)));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/code/{code}")
    public ResponseEntity<ApiResponse<ExamDTO>> getExamByCode(@PathVariable String code) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(examService.getExamByCode(code)));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVIGILATOR')")
    public ResponseEntity<ApiResponse<ExamDTO>> updateStatus(@PathVariable Long id, @RequestParam String status) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(examService.updateExamStatus(id, status)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/creator/{userId}")
    public ResponseEntity<ApiResponse<List<ExamDTO>>> getByCreator(@PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.ok(examService.getExamsByCreator(userId)));
    }
}
