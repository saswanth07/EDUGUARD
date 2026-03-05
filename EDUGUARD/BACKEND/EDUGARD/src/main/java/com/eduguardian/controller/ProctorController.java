package com.eduguardian.controller;

import com.eduguardian.dto.*;
import com.eduguardian.entity.ProctorLog;
import com.eduguardian.entity.RiskScore;
import com.eduguardian.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/proctor")
@RequiredArgsConstructor
public class ProctorController {

    private final ProctorService proctorService;
    private final RiskScoreService riskScoreService;
    private final PdfReportService pdfReportService;
    private final BlockchainService blockchainService;

    @PostMapping("/event")
    public ResponseEntity<ApiResponse<ProctorLog>> logEvent(@RequestBody ProctorEventDTO event) {
        try {
            ProctorLog log = proctorService.logEvent(event);
            return ResponseEntity.ok(ApiResponse.ok("Event logged", log));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/visual-event")
    public ResponseEntity<ApiResponse<String>> logVisualEvent(@RequestBody ProctorEventDTO event) {
        try {
            proctorService.logVisualEvent(event);
            return ResponseEntity.ok(ApiResponse.ok("Visual event logged", "OK"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/audio-event")
    public ResponseEntity<ApiResponse<String>> logAudioEvent(@RequestBody ProctorEventDTO event) {
        try {
            proctorService.logAudioEvent(event);
            return ResponseEntity.ok(ApiResponse.ok("Audio event logged", "OK"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<String>> syncOfflineEvents(@RequestBody List<ProctorEventDTO> events) {
        try {
            proctorService.syncOfflineEvents(events);
            return ResponseEntity.ok(ApiResponse.ok("Synced " + events.size() + " events", "OK"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/logs/{examId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVIGILATOR')")
    public ResponseEntity<ApiResponse<List<ProctorLog>>> getExamLogs(@PathVariable Long examId) {
        return ResponseEntity.ok(ApiResponse.ok(proctorService.getLogsByExam(examId)));
    }

    @GetMapping("/logs/{examId}/{studentId}")
    public ResponseEntity<ApiResponse<List<ProctorLog>>> getStudentLogs(
            @PathVariable Long examId, @PathVariable Long studentId) {
        return ResponseEntity.ok(ApiResponse.ok(proctorService.getLogsByExamAndStudent(examId, studentId)));
    }

    @GetMapping("/risk/{examId}/{studentId}")
    public ResponseEntity<ApiResponse<RiskScore>> getRiskScore(
            @PathVariable Long examId, @PathVariable Long studentId) {
        RiskScore score = riskScoreService.getLatestScore(examId, studentId);
        return ResponseEntity.ok(ApiResponse.ok(score));
    }

    @GetMapping("/risk/{examId}/rankings")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVIGILATOR')")
    public ResponseEntity<ApiResponse<List<RiskScore>>> getRankings(@PathVariable Long examId) {
        return ResponseEntity.ok(ApiResponse.ok(riskScoreService.getExamRankings(examId)));
    }

    @GetMapping("/risk/{examId}/{studentId}/history")
    public ResponseEntity<ApiResponse<List<RiskScore>>> getScoreHistory(
            @PathVariable Long examId, @PathVariable Long studentId) {
        return ResponseEntity.ok(ApiResponse.ok(riskScoreService.getScoreHistory(examId, studentId)));
    }

    /**
     * Accept risk breakdown directly from the frontend and persist it.
     * Body: { examId, studentId, eyeDeviation, headPose, multiFace, phoneDetection, audioWhisper, tabSwitch, suddenMovement }
     */
    @PostMapping("/risk/update")
    public ResponseEntity<ApiResponse<RiskScore>> updateRiskScore(@RequestBody Map<String, Object> body) {
        try {
            Long examId    = Long.parseLong(body.get("examId").toString());
            Long studentId = Long.parseLong(body.get("studentId").toString());
            double eyeDev   = Double.parseDouble(body.getOrDefault("eyeDeviation", "0").toString());
            double head     = Double.parseDouble(body.getOrDefault("headPose", "0").toString());
            double face     = Double.parseDouble(body.getOrDefault("multiFace", "0").toString());
            double phone    = Double.parseDouble(body.getOrDefault("phoneDetection", "0").toString());
            double audio    = Double.parseDouble(body.getOrDefault("audioWhisper", "0").toString());
            double tab      = Double.parseDouble(body.getOrDefault("tabSwitch", "0").toString());
            double movement = Double.parseDouble(body.getOrDefault("suddenMovement", "0").toString());

            RiskScore rs = riskScoreService.saveDirectScore(
                    examId, studentId, eyeDev, head, face, phone, audio, tab, movement);
            return ResponseEntity.ok(ApiResponse.ok("Risk score updated", rs));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/report/{examId}/{studentId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVIGILATOR')")
    public ResponseEntity<byte[]> downloadReport(@PathVariable Long examId, @PathVariable Long studentId) {
        try {
            byte[] pdf = pdfReportService.generateReport(examId, studentId);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=report_" + examId + "_" + studentId + ".pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdf);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/blockchain/validate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Boolean>> validateBlockchain() {
        boolean valid = blockchainService.validateChain();
        return ResponseEntity.ok(ApiResponse.ok("Blockchain integrity: " + (valid ? "VALID" : "COMPROMISED"), valid));
    }

    @GetMapping("/blockchain/length")
    public ResponseEntity<ApiResponse<Integer>> getBlockchainLength() {
        return ResponseEntity.ok(ApiResponse.ok(blockchainService.getChainLength()));
    }
}
