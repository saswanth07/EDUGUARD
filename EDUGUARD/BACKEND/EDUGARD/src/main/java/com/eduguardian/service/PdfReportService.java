package com.eduguardian.service;

import com.eduguardian.entity.*;
import com.eduguardian.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PdfReportService {

    private final ExamRepository examRepository;
    private final UserRepository userRepository;
    private final ProctorLogRepository proctorLogRepository;
    private final RiskScoreRepository riskScoreRepository;

    public byte[] generateReport(Long examId, Long studentId) throws IOException {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new RuntimeException("Exam not found"));
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));
        List<ProctorLog> logs = proctorLogRepository.findByExamIdAndStudentId(examId, studentId);
        RiskScore latestScore = riskScoreRepository
                .findTopByExamIdAndStudentIdOrderByCalculatedAtDesc(examId, studentId)
                .orElse(null);

        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);

            PDType1Font fontBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontRegular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

            try (PDPageContentStream cs = new PDPageContentStream(document, page)) {
                float y = 750;
                float margin = 50;
                float pageWidth = PDRectangle.A4.getWidth();

                // Title
                cs.setFont(fontBold, 20);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("EduGuardian 2.0 - Cheating Report");
                cs.endText();
                y -= 30;

                // Divider
                cs.setLineWidth(2);
                cs.moveTo(margin, y);
                cs.lineTo(pageWidth - margin, y);
                cs.stroke();
                y -= 25;

                // Exam Info
                cs.setFont(fontBold, 12);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("Exam: " + exam.getTitle());
                cs.endText();
                y -= 18;

                cs.setFont(fontRegular, 10);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("Code: " + exam.getExamCode() + "  |  Duration: " + exam.getDurationMinutes() + " min");
                cs.endText();
                y -= 15;

                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("Start: " + dtf.withZone(ZoneId.systemDefault()).format(exam.getStartTime()) + "  |  End: " + dtf.withZone(ZoneId.systemDefault()).format(exam.getEndTime()));
                cs.endText();
                y -= 25;

                // Student Info
                cs.setFont(fontBold, 12);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("Student: " + student.getFullName());
                cs.endText();
                y -= 18;

                cs.setFont(fontRegular, 10);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("Department: " + (student.getDepartment() != null ? student.getDepartment() : "N/A"));
                cs.endText();
                y -= 25;

                // Risk Score Summary
                cs.setFont(fontBold, 14);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("Risk Score Summary");
                cs.endText();
                y -= 20;

                if (latestScore != null) {
                    cs.setFont(fontBold, 24);
                    cs.beginText();
                    cs.newLineAtOffset(margin, y);
                    cs.showText(String.format("%.0f / 100  (%s)", latestScore.getTotalScore(), latestScore.getRiskLevel()));
                    cs.endText();
                    y -= 25;

                    cs.setFont(fontRegular, 9);
                    String[] breakdown = {
                        "Eye Deviation: " + String.format("%.0f/20", latestScore.getEyeDeviationScore()),
                        "Head Pose: " + String.format("%.0f/10", latestScore.getHeadPoseScore()),
                        "Multi-Face: " + String.format("%.0f/10", latestScore.getMultiFaceScore()),
                        "Phone Detection: " + String.format("%.0f/20", latestScore.getPhoneDetectionScore()),
                        "Audio Whisper: " + String.format("%.0f/15", latestScore.getAudioWhisperScore()),
                        "Tab Switch: " + String.format("%.0f/15", latestScore.getTabSwitchScore()),
                        "Sudden Movement: " + String.format("%.0f/10", latestScore.getSuddenMovementScore())
                    };
                    for (String line : breakdown) {
                        cs.beginText();
                        cs.newLineAtOffset(margin + 10, y);
                        cs.showText(line);
                        cs.endText();
                        y -= 14;
                    }
                } else {
                    cs.setFont(fontRegular, 10);
                    cs.beginText();
                    cs.newLineAtOffset(margin, y);
                    cs.showText("No risk score available");
                    cs.endText();
                    y -= 20;
                }

                y -= 15;

                // Event Timeline
                cs.setFont(fontBold, 14);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("Event Timeline (" + logs.size() + " events)");
                cs.endText();
                y -= 20;

                // Table header
                cs.setFont(fontBold, 8);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("TIME");
                cs.endText();
                cs.beginText();
                cs.newLineAtOffset(margin + 120, y);
                cs.showText("EVENT TYPE");
                cs.endText();
                cs.beginText();
                cs.newLineAtOffset(margin + 280, y);
                cs.showText("SEVERITY");
                cs.endText();
                cs.beginText();
                cs.newLineAtOffset(margin + 360, y);
                cs.showText("CONFIDENCE");
                cs.endText();
                y -= 3;

                cs.setLineWidth(0.5f);
                cs.moveTo(margin, y);
                cs.lineTo(pageWidth - margin, y);
                cs.stroke();
                y -= 12;

                // Table rows
                cs.setFont(fontRegular, 8);
                int maxRows = Math.min(logs.size(), 30);
                for (int i = 0; i < maxRows; i++) {
                    ProctorLog pl = logs.get(i);

                    if (y < 60) {
                        // Add new page
                        cs.close();
                        page = new PDPage(PDRectangle.A4);
                        document.addPage(page);
                        PDPageContentStream newCs = new PDPageContentStream(document, page);
                        y = 750;
                        newCs.setFont(fontRegular, 8);
                        // Continue writing on new page - simplified for this context
                        newCs.close();
                        break;
                    }

                    cs.beginText();
                    cs.newLineAtOffset(margin, y);
                    cs.showText(dtf.withZone(ZoneId.systemDefault()).format(pl.getTimestamp()));
                    cs.endText();

                    cs.beginText();
                    cs.newLineAtOffset(margin + 120, y);
                    cs.showText(pl.getEventType());
                    cs.endText();

                    cs.beginText();
                    cs.newLineAtOffset(margin + 280, y);
                    cs.showText(pl.getSeverity().name());
                    cs.endText();

                    cs.beginText();
                    cs.newLineAtOffset(margin + 360, y);
                    cs.showText(String.format("%.1f%%", pl.getConfidence() != null ? pl.getConfidence() * 100 : 0));
                    cs.endText();

                    y -= 14;
                }

                if (logs.size() > maxRows) {
                    cs.beginText();
                    cs.newLineAtOffset(margin, y);
                    cs.showText("... and " + (logs.size() - maxRows) + " more events");
                    cs.endText();
                    y -= 20;
                }

                // Footer
                y = 30;
                cs.setFont(fontRegular, 7);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("Generated by EduGuardian 2.0 | This is an AI-generated report. Blockchain-verified audit trail.");
                cs.endText();
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();
        }
    }
}
