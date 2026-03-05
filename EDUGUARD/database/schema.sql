-- ============================================================
-- EduGuardian 2.0 - Database Schema
-- AI-Powered Anti-Cheating Proctoring System
-- ============================================================

CREATE DATABASE IF NOT EXISTS eduguardian;
USE eduguardian;

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('STUDENT', 'INVIGILATOR', 'ADMIN') NOT NULL DEFAULT 'STUDENT',
    department VARCHAR(100),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_role (role),
    INDEX idx_users_department (department),
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. EXAMS TABLE
-- ============================================================
CREATE TABLE exams (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    exam_code VARCHAR(20) NOT NULL UNIQUE,
    created_by BIGINT NOT NULL,
    department VARCHAR(100),
    duration_minutes INT NOT NULL DEFAULT 60,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    max_students INT DEFAULT 100,
    is_proctored BOOLEAN DEFAULT TRUE,
    allow_offline BOOLEAN DEFAULT FALSE,
    status ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'DRAFT',
    risk_threshold INT DEFAULT 70,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_exams_status (status),
    INDEX idx_exams_start (start_time),
    INDEX idx_exams_code (exam_code),
    INDEX idx_exams_department (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. ATTENDANCE TABLE
-- ============================================================
CREATE TABLE attendance (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    status ENUM('PRESENT', 'ABSENT', 'LATE', 'DISCONNECTED', 'EXPELLED') DEFAULT 'PRESENT',
    ip_address VARCHAR(45),
    browser_info VARCHAR(500),
    is_offline_mode BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_attendance (exam_id, student_id),
    INDEX idx_attendance_status (status),
    INDEX idx_attendance_exam (exam_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. PROCTOR LOGS TABLE
-- ============================================================
CREATE TABLE proctor_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    event_type ENUM(
        'FACE_NOT_VISIBLE', 'MULTIPLE_FACES', 'EYE_DEVIATION',
        'HEAD_TURN', 'PHONE_DETECTED', 'PERSON_BEHIND',
        'SUDDEN_MOVEMENT', 'PAPER_PASSING', 'WHISPER_DETECTED',
        'TALKING', 'MULTIPLE_VOICES', 'PAPER_SHUFFLE',
        'PHONE_VIBRATION', 'KEYBOARD_ABNORMAL', 'TAB_SWITCH',
        'COPY_PASTE', 'WINDOW_MINIMIZE', 'FULLSCREEN_EXIT',
        'DISCONNECT', 'RECONNECT', 'LOOKING_DOWN',
        'BLINK_ANOMALY', 'ATTENTION_LOSS', 'UNKNOWN'
    ) NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'LOW',
    confidence DECIMAL(5,2) DEFAULT 0.00,
    description TEXT,
    screenshot_url VARCHAR(500),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_synced BOOLEAN DEFAULT TRUE,
    blockchain_hash VARCHAR(128),
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_proctor_exam_student (exam_id, student_id),
    INDEX idx_proctor_event_type (event_type),
    INDEX idx_proctor_severity (severity),
    INDEX idx_proctor_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. VISUAL EVENTS TABLE
-- ============================================================
CREATE TABLE visual_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    face_count INT DEFAULT 1,
    eye_deviation_x DECIMAL(6,3) DEFAULT 0.000,
    eye_deviation_y DECIMAL(6,3) DEFAULT 0.000,
    head_pose_yaw DECIMAL(6,3) DEFAULT 0.000,
    head_pose_pitch DECIMAL(6,3) DEFAULT 0.000,
    head_pose_roll DECIMAL(6,3) DEFAULT 0.000,
    blink_rate DECIMAL(5,2) DEFAULT 0.00,
    attention_score DECIMAL(5,2) DEFAULT 100.00,
    confidence DECIMAL(5,2) DEFAULT 0.00,
    objects_detected JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_visual_exam_student (exam_id, student_id),
    INDEX idx_visual_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. AUDIO EVENTS TABLE
-- ============================================================
CREATE TABLE audio_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    event_type ENUM(
        'WHISPER', 'TALKING', 'MULTIPLE_VOICES',
        'PAPER_SHUFFLE', 'PHONE_VIBRATION', 'KEYBOARD_ABNORMAL',
        'BACKGROUND_NOISE', 'SILENCE', 'UNKNOWN'
    ) NOT NULL,
    decibel_level DECIMAL(5,2) DEFAULT 0.00,
    frequency_profile JSON,
    confidence DECIMAL(5,2) DEFAULT 0.00,
    duration_seconds DECIMAL(6,2) DEFAULT 0.00,
    transcript TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_audio_exam_student (exam_id, student_id),
    INDEX idx_audio_event_type (event_type),
    INDEX idx_audio_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. RISK SCORES TABLE
-- ============================================================
CREATE TABLE risk_scores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    eye_deviation_score DECIMAL(5,2) DEFAULT 0.00,
    head_pose_score DECIMAL(5,2) DEFAULT 0.00,
    multi_face_score DECIMAL(5,2) DEFAULT 0.00,
    phone_detection_score DECIMAL(5,2) DEFAULT 0.00,
    audio_whisper_score DECIMAL(5,2) DEFAULT 0.00,
    tab_switch_score DECIMAL(5,2) DEFAULT 0.00,
    sudden_movement_score DECIMAL(5,2) DEFAULT 0.00,
    total_score DECIMAL(5,2) DEFAULT 0.00,
    risk_level ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'LOW',
    ai_summary TEXT,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_risk_exam_student (exam_id, student_id),
    INDEX idx_risk_total (total_score),
    INDEX idx_risk_level (risk_level),
    INDEX idx_risk_calculated (calculated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. SYSTEM ALERTS TABLE
-- ============================================================
CREATE TABLE system_alerts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_id BIGINT NOT NULL,
    student_id BIGINT,
    alert_type ENUM('INFO', 'WARNING', 'DANGER', 'CRITICAL') DEFAULT 'INFO',
    title VARCHAR(200) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    triggered_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_alerts_exam (exam_id),
    INDEX idx_alerts_type (alert_type),
    INDEX idx_alerts_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. DEVICE LOGS TABLE
-- ============================================================
CREATE TABLE device_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    device_type VARCHAR(50),
    os_info VARCHAR(100),
    browser_info VARCHAR(200),
    screen_resolution VARCHAR(20),
    camera_available BOOLEAN DEFAULT FALSE,
    microphone_available BOOLEAN DEFAULT FALSE,
    network_type VARCHAR(50),
    battery_level INT,
    is_offline BOOLEAN DEFAULT FALSE,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_device_exam_student (exam_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create system alert when risk score exceeds threshold
DELIMITER //
CREATE TRIGGER trg_risk_alert
AFTER INSERT ON risk_scores
FOR EACH ROW
BEGIN
    DECLARE exam_threshold INT DEFAULT 70;
    SELECT risk_threshold INTO exam_threshold FROM exams WHERE id = NEW.exam_id;
    
    IF NEW.total_score >= exam_threshold THEN
        INSERT INTO system_alerts (exam_id, student_id, alert_type, title, message, triggered_by)
        VALUES (
            NEW.exam_id,
            NEW.student_id,
            CASE
                WHEN NEW.total_score >= 90 THEN 'CRITICAL'
                WHEN NEW.total_score >= 80 THEN 'DANGER'
                WHEN NEW.total_score >= 70 THEN 'WARNING'
                ELSE 'INFO'
            END,
            CONCAT('High Risk Score: ', NEW.total_score),
            CONCAT('Student risk score has reached ', NEW.total_score, '/100. ', IFNULL(NEW.ai_summary, '')),
            'RISK_ENGINE'
        );
    END IF;
END//
DELIMITER ;

-- Auto-create proctor log when critical audio event detected
DELIMITER //
CREATE TRIGGER trg_audio_proctor_log
AFTER INSERT ON audio_events
FOR EACH ROW
BEGIN
    IF NEW.confidence >= 0.75 AND NEW.event_type IN ('WHISPER', 'TALKING', 'MULTIPLE_VOICES') THEN
        INSERT INTO proctor_logs (exam_id, student_id, event_type, severity, confidence, description)
        VALUES (
            NEW.exam_id,
            NEW.student_id,
            CASE NEW.event_type
                WHEN 'WHISPER' THEN 'WHISPER_DETECTED'
                WHEN 'TALKING' THEN 'TALKING'
                WHEN 'MULTIPLE_VOICES' THEN 'MULTIPLE_VOICES'
                ELSE 'UNKNOWN'
            END,
            CASE
                WHEN NEW.confidence >= 0.9 THEN 'CRITICAL'
                WHEN NEW.confidence >= 0.8 THEN 'HIGH'
                ELSE 'MEDIUM'
            END,
            NEW.confidence,
            CONCAT('Audio event detected: ', NEW.event_type, ' (confidence: ', NEW.confidence, ')')
        );
    END IF;
END//
DELIMITER ;

-- ============================================================
-- STORED PROCEDURE: Risk Score Aggregation
-- ============================================================
DELIMITER //
CREATE PROCEDURE sp_calculate_risk_score(
    IN p_exam_id BIGINT,
    IN p_student_id BIGINT
)
BEGIN
    DECLARE v_eye_score DECIMAL(5,2) DEFAULT 0;
    DECLARE v_head_score DECIMAL(5,2) DEFAULT 0;
    DECLARE v_face_score DECIMAL(5,2) DEFAULT 0;
    DECLARE v_phone_score DECIMAL(5,2) DEFAULT 0;
    DECLARE v_audio_score DECIMAL(5,2) DEFAULT 0;
    DECLARE v_tab_score DECIMAL(5,2) DEFAULT 0;
    DECLARE v_movement_score DECIMAL(5,2) DEFAULT 0;
    DECLARE v_total DECIMAL(5,2) DEFAULT 0;
    DECLARE v_level VARCHAR(10);
    
    -- Eye deviation (max 20)
    SELECT LEAST(20, COUNT(*) * 2) INTO v_eye_score
    FROM proctor_logs
    WHERE exam_id = p_exam_id AND student_id = p_student_id
      AND event_type = 'EYE_DEVIATION'
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE);
    
    -- Head pose (max 10)
    SELECT LEAST(10, COUNT(*) * 1.5) INTO v_head_score
    FROM proctor_logs
    WHERE exam_id = p_exam_id AND student_id = p_student_id
      AND event_type = 'HEAD_TURN'
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE);
    
    -- Multi-face (max 10)
    SELECT LEAST(10, COUNT(*) * 5) INTO v_face_score
    FROM proctor_logs
    WHERE exam_id = p_exam_id AND student_id = p_student_id
      AND event_type = 'MULTIPLE_FACES'
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE);
    
    -- Phone detection (max 20)
    SELECT LEAST(20, COUNT(*) * 10) INTO v_phone_score
    FROM proctor_logs
    WHERE exam_id = p_exam_id AND student_id = p_student_id
      AND event_type = 'PHONE_DETECTED'
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE);
    
    -- Audio whisper (max 15)
    SELECT LEAST(15, COUNT(*) * 3) INTO v_audio_score
    FROM proctor_logs
    WHERE exam_id = p_exam_id AND student_id = p_student_id
      AND event_type IN ('WHISPER_DETECTED', 'TALKING', 'MULTIPLE_VOICES')
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE);
    
    -- Tab switching (max 15)
    SELECT LEAST(15, COUNT(*) * 3) INTO v_tab_score
    FROM proctor_logs
    WHERE exam_id = p_exam_id AND student_id = p_student_id
      AND event_type IN ('TAB_SWITCH', 'COPY_PASTE', 'WINDOW_MINIMIZE', 'FULLSCREEN_EXIT')
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE);
    
    -- Sudden movement (max 10)
    SELECT LEAST(10, COUNT(*) * 2) INTO v_movement_score
    FROM proctor_logs
    WHERE exam_id = p_exam_id AND student_id = p_student_id
      AND event_type = 'SUDDEN_MOVEMENT'
      AND timestamp >= DATE_SUB(NOW(), INTERVAL 10 MINUTE);
    
    SET v_total = v_eye_score + v_head_score + v_face_score + v_phone_score
                  + v_audio_score + v_tab_score + v_movement_score;
    
    SET v_level = CASE
        WHEN v_total >= 80 THEN 'CRITICAL'
        WHEN v_total >= 60 THEN 'HIGH'
        WHEN v_total >= 40 THEN 'MEDIUM'
        ELSE 'LOW'
    END;
    
    INSERT INTO risk_scores (
        exam_id, student_id, eye_deviation_score, head_pose_score,
        multi_face_score, phone_detection_score, audio_whisper_score,
        tab_switch_score, sudden_movement_score, total_score, risk_level,
        ai_summary
    ) VALUES (
        p_exam_id, p_student_id, v_eye_score, v_head_score,
        v_face_score, v_phone_score, v_audio_score,
        v_tab_score, v_movement_score, v_total, v_level,
        CONCAT('Risk Breakdown: Eye=', v_eye_score, '/20, Head=', v_head_score,
               '/10, Face=', v_face_score, '/10, Phone=', v_phone_score,
               '/20, Audio=', v_audio_score, '/15, Tab=', v_tab_score,
               '/15, Movement=', v_movement_score, '/10')
    );
    
    SELECT v_total AS total_score, v_level AS risk_level;
END//
DELIMITER ;

-- ============================================================
-- SEED DATA (Demo)
-- ============================================================
INSERT INTO users (username, email, password_hash, full_name, role, department) VALUES
('admin', 'admin@eduguardian.com', '$2a$10$placeholder_hash_admin', 'System Administrator', 'ADMIN', 'IT'),
('invigilator1', 'invig1@eduguardian.com', '$2a$10$placeholder_hash_invig', 'Dr. Sarah Wilson', 'INVIGILATOR', 'Computer Science'),
('student1', 'student1@eduguardian.com', '$2a$10$placeholder_hash_student', 'Alex Johnson', 'STUDENT', 'Computer Science');
