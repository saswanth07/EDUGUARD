package com.eduguardian.repository;

import com.eduguardian.entity.SystemAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SystemAlertRepository extends JpaRepository<SystemAlert, Long> {
    List<SystemAlert> findByExamIdOrderByCreatedAtDesc(Long examId);
    List<SystemAlert> findByExamIdAndIsReadFalse(Long examId);
    List<SystemAlert> findByExamIdAndAlertType(Long examId, String alertType);
    long countByExamIdAndIsReadFalse(Long examId);
}
