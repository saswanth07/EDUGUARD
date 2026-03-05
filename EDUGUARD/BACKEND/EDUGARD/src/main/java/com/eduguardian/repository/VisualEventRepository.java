package com.eduguardian.repository;

import com.eduguardian.entity.VisualEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface VisualEventRepository extends JpaRepository<VisualEvent, Long> {
    List<VisualEvent> findByExamIdAndStudentId(Long examId, Long studentId);
    List<VisualEvent> findByExamId(Long examId);
}
