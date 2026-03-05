package com.eduguardian.repository;

import com.eduguardian.entity.ExamSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ExamSubmissionRepository extends JpaRepository<ExamSubmission, Long> {
    List<ExamSubmission> findByExamId(Long examId);
    Optional<ExamSubmission> findByExamIdAndStudentId(Long examId, Long studentId);
    List<ExamSubmission> findByStudentId(Long studentId);
}
