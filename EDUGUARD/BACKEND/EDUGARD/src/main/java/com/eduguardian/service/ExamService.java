package com.eduguardian.service;

import com.eduguardian.dto.ExamDTO;
import com.eduguardian.entity.*;
import com.eduguardian.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final AttendanceRepository attendanceRepository;
    private final RiskScoreRepository riskScoreRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ExamDTO createExam(ExamDTO dto) {
        User creator = userRepository.findById(dto.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("Creator not found"));

        // Serialize questions list to JSON string
        String questionsJson = null;
        if (dto.getQuestions() != null && !dto.getQuestions().isEmpty()) {
            try {
                questionsJson = objectMapper.writeValueAsString(dto.getQuestions());
            } catch (Exception e) {
                // ignore serialization failure
            }
        }

        Exam exam = Exam.builder()
                .title(dto.getTitle())
                .description(dto.getDescription())
                .examCode(dto.getExamCode() != null ? dto.getExamCode() : generateExamCode())
                .createdBy(creator)
                .department(dto.getDepartment())
                .durationMinutes(dto.getDurationMinutes())
                .startTime(dto.getStartTime())
                .endTime(dto.getEndTime())
                .maxStudents(dto.getMaxStudents())
                .isProctored(dto.getIsProctored() != null ? dto.getIsProctored() : true)
                .allowOffline(dto.getAllowOffline() != null ? dto.getAllowOffline() : false)
                .status(Exam.ExamStatus.SCHEDULED)
                .riskThreshold(dto.getRiskThreshold() != null ? dto.getRiskThreshold() : 70)
                .questionsJson(questionsJson)
                .build();

        exam = examRepository.save(exam);
        return mapToDTO(exam);
    }

    public List<ExamDTO> getAllExams() {
        return examRepository.findAll().stream().map(this::mapToDTO).collect(Collectors.toList());
    }

    public ExamDTO getExamById(Long id) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Exam not found"));
        return mapToDTO(exam);
    }

    public ExamDTO getExamByCode(String code) {
        Exam exam = examRepository.findByExamCode(code)
                .orElseThrow(() -> new RuntimeException("Exam not found"));
        return mapToDTO(exam);
    }

    public ExamDTO updateExamStatus(Long id, String status) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Exam not found"));
        exam.setStatus(Exam.ExamStatus.valueOf(status));
        exam = examRepository.save(exam);
        return mapToDTO(exam);
    }

    public List<ExamDTO> getExamsByCreator(Long userId) {
        return examRepository.findByCreatedById(userId).stream()
                .map(this::mapToDTO).collect(Collectors.toList());
    }

    private ExamDTO mapToDTO(Exam exam) {
        long totalStudents = attendanceRepository.findByExamId(exam.getId()).size();
        Double avgScore = riskScoreRepository.averageScoreForExam(exam.getId());

        // Deserialize questions JSON back to List<Map>
        List<Map<String, Object>> questions = null;
        if (exam.getQuestionsJson() != null && !exam.getQuestionsJson().isEmpty()) {
            try {
                questions = objectMapper.readValue(
                        exam.getQuestionsJson(),
                        new TypeReference<List<Map<String, Object>>>() {});
            } catch (Exception e) {
                // return null if deserialization fails
            }
        }

        return ExamDTO.builder()
                .id(exam.getId())
                .title(exam.getTitle())
                .description(exam.getDescription())
                .examCode(exam.getExamCode())
                .createdBy(exam.getCreatedBy().getId())
                .creatorName(exam.getCreatedBy().getFullName())
                .department(exam.getDepartment())
                .durationMinutes(exam.getDurationMinutes())
                .startTime(exam.getStartTime())
                .endTime(exam.getEndTime())
                .maxStudents(exam.getMaxStudents())
                .isProctored(exam.getIsProctored())
                .allowOffline(exam.getAllowOffline())
                .status(exam.getStatus().name())
                .riskThreshold(exam.getRiskThreshold())
                .totalStudents(totalStudents)
                .averageRiskScore(avgScore)
                .questions(questions)
                .build();
    }

    private String generateExamCode() {
        return "EX-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
