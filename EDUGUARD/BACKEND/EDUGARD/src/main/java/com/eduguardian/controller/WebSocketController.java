package com.eduguardian.controller;

import com.eduguardian.dto.ProctorEventDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
@Slf4j
public class WebSocketController {

    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/proctor.event")
    @SendTo("/topic/proctor-events")
    public ProctorEventDTO handleProctorEvent(ProctorEventDTO event) {
        log.info("WebSocket event: {} for student {} in exam {}", 
                event.getEventType(), event.getStudentId(), event.getExamId());
        return event;
    }

    @MessageMapping("/risk.update")
    @SendTo("/topic/risk-updates")
    public ProctorEventDTO handleRiskUpdate(ProctorEventDTO event) {
        return event;
    }

    public void sendAlertToExam(Long examId, ProctorEventDTO event) {
        messagingTemplate.convertAndSend("/topic/exam/" + examId + "/alerts", event);
    }

    public void sendRiskScoreUpdate(Long examId, Long studentId, ProctorEventDTO event) {
        messagingTemplate.convertAndSend(
                "/topic/exam/" + examId + "/student/" + studentId + "/risk", event);
    }

    public void broadcastToExam(Long examId, ProctorEventDTO event) {
        messagingTemplate.convertAndSend("/topic/exam/" + examId, event);
    }
}
