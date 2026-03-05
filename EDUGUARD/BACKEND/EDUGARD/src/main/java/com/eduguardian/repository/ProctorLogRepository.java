package com.eduguardian.repository;

import com.eduguardian.entity.ProctorLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;

@Repository
public interface ProctorLogRepository extends JpaRepository<ProctorLog, Long> {
    List<ProctorLog> findByExamIdAndStudentId(Long examId, Long studentId);
    List<ProctorLog> findByExamId(Long examId);
    List<ProctorLog> findTop100ByExamIdOrderByTimestampDesc(Long examId);
    List<ProctorLog> findByStudentId(Long studentId);
    List<ProctorLog> findByExamIdAndSeverity(Long examId, ProctorLog.Severity severity);
    List<ProctorLog> findByExamIdAndStudentIdAndTimestampBetween(
        Long examId, Long studentId, Instant start, Instant end);
    long countByExamIdAndStudentIdAndEventType(Long examId, Long studentId, String eventType);

    @Query("SELECT p.eventType, COUNT(p) FROM ProctorLog p WHERE p.exam.id = :examId GROUP BY p.eventType ORDER BY COUNT(p) DESC")
    List<Object[]> countEventsByTypeForExam(Long examId);

    @Query("SELECT p.student.id, COUNT(p) FROM ProctorLog p WHERE p.exam.id = :examId AND p.severity IN ('HIGH', 'CRITICAL') GROUP BY p.student.id ORDER BY COUNT(p) DESC")
    List<Object[]> findHighRiskStudents(Long examId);
}
