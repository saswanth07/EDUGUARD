package com.eduguardian.repository;

import com.eduguardian.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface ExamRepository extends JpaRepository<Exam, Long> {
    Optional<Exam> findByExamCode(String examCode);
    List<Exam> findByCreatedById(Long userId);
    List<Exam> findByStatus(Exam.ExamStatus status);
    List<Exam> findByDepartment(String department);
    List<Exam> findByStartTimeBetween(Instant start, Instant end);
    List<Exam> findByStatusAndStartTimeBefore(Exam.ExamStatus status, Instant time);
}
