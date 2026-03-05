package com.eduguardian.repository;

import com.eduguardian.entity.AudioEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AudioEventRepository extends JpaRepository<AudioEvent, Long> {
    List<AudioEvent> findByExamIdAndStudentId(Long examId, Long studentId);
    List<AudioEvent> findByExamId(Long examId);
    long countByExamIdAndStudentIdAndEventType(Long examId, Long studentId, String eventType);
}
