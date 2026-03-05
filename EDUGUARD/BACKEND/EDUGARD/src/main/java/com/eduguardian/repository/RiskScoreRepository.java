package com.eduguardian.repository;

import com.eduguardian.entity.RiskScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RiskScoreRepository extends JpaRepository<RiskScore, Long> {
    List<RiskScore> findByExamIdAndStudentIdOrderByCalculatedAtDesc(Long examId, Long studentId);
    List<RiskScore> findByExamIdOrderByTotalScoreDesc(Long examId);
    Optional<RiskScore> findTopByExamIdAndStudentIdOrderByCalculatedAtDesc(Long examId, Long studentId);
    List<RiskScore> findByExamIdAndRiskLevel(Long examId, RiskScore.RiskLevel level);

    @Query("SELECT r.student.department, AVG(r.totalScore) FROM RiskScore r WHERE r.exam.id = :examId GROUP BY r.student.department")
    List<Object[]> avgScoreByDepartment(Long examId);

    @Query("SELECT AVG(r.totalScore) FROM RiskScore r WHERE r.exam.id = :examId")
    Double averageScoreForExam(Long examId);
}
