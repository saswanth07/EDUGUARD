package com.eduguardian.config;

import com.eduguardian.entity.User;
import com.eduguardian.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        // Always ensure these default system accounts exist (upsert by username)
        ensureUser("admin",        "admin@eduguardian.com",   "admin123",    "System Administrator", User.Role.ADMIN,       "IT");
        ensureUser("invigilator1", "invig1@eduguardian.com",  "invig123",    "Dr. Sarah Wilson",     User.Role.INVIGILATOR, "Computer Science");
        ensureUser("invigilator2", "invig2@eduguardian.com",  "invig123",    "Prof. James Lee",      User.Role.INVIGILATOR, "Mathematics");
        ensureUser("student1",     "student1@eduguardian.com","student123",  "Alex Johnson",         User.Role.STUDENT,     "Computer Science");
        ensureUser("student2",     "student2@eduguardian.com","student123",  "Maria Garcia",         User.Role.STUDENT,     "Mathematics");

        log.info("=======================================================");
        log.info("  EduGuardian 2.0 — Default Login Credentials");
        log.info("  ADMIN      : admin       / admin123");
        log.info("  INVIGILATOR: invigilator1 / invig123");
        log.info("  STUDENT    : student1    / student123");
        log.info("=======================================================");
    }

    private void ensureUser(String username, String email, String password,
                             String fullName, User.Role role, String department) {
        if (userRepository.findByUsername(username).isEmpty()) {
            userRepository.save(User.builder()
                    .username(username)
                    .email(email)
                    .passwordHash(passwordEncoder.encode(password))
                    .fullName(fullName)
                    .role(role)
                    .department(department)
                    .isActive(true)
                    .build());
            log.info("Created default user: {} ({})", username, role);
        }
    }
}
