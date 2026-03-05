package com.eduguardian.repository;

import com.eduguardian.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    List<Attendance> findByExamId(Long examId);
    Optional<Attendance> findByExamIdAndStudentId(Long examId, Long studentId);
    long countByExamIdAndStatus(Long examId, Attendance.AttendanceStatus status);
}
