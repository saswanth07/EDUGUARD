"""
EduGuardian 2.0 - AI Microservice
FastAPI service for server-side AI inference.
Provides YOLOv8-tiny object detection, Whisper-tiny audio analysis,
OpenCV motion detection, and risk score fusion.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import io
import logging
import time
import os
import json
import re

app = FastAPI(
    title="EduGuardian AI Service",
    description="Server-side AI inference for anti-cheating detection",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("eduguardian-ai")


# ============================================
# Models and DTOs
# ============================================

class DetectionResult(BaseModel):
    label: str
    confidence: float
    bbox: Optional[List[float]] = None

class FrameAnalysis(BaseModel):
    objects: List[DetectionResult] = []
    faces_count: int = 0
    motion_level: float = 0.0
    phone_detected: bool = False
    person_behind: bool = False
    book_detected: bool = False
    risk_contribution: float = 0.0

class AudioAnalysis(BaseModel):
    event_type: str = "SILENCE"
    confidence: float = 0.0
    decibel_level: float = 0.0
    is_speech: bool = False
    is_whisper: bool = False
    is_multiple_voices: bool = False
    transcript: Optional[str] = None
    risk_contribution: float = 0.0

class RiskFusionRequest(BaseModel):
    eye_deviation: float = 0.0
    head_pose: float = 0.0
    multi_face: float = 0.0
    phone_detection: float = 0.0
    audio_whisper: float = 0.0
    tab_switch: float = 0.0
    sudden_movement: float = 0.0
    student_id: Optional[int] = None
    exam_id: Optional[int] = None

class RiskFusionResult(BaseModel):
    total_score: float
    risk_level: str
    breakdown: dict
    ai_summary: str


# ============================================
# YOLO Detector (Stub - downloads model on first use)
# ============================================

class YOLODetector:
    """
    YOLOv8-tiny ONNX object detection.
    In production, load the yolov8n.onnx model.
    This stub provides simulated detection.
    """
    
    CLASSES = {
        0: 'person', 67: 'cell phone', 73: 'book',
        63: 'laptop', 66: 'keyboard', 74: 'clock',
    }
    
    def __init__(self):
        self.loaded = False
        logger.info("YOLO detector initialized (stub mode)")
    
    def detect(self, image_bytes: bytes) -> List[DetectionResult]:
        """
        Run detection on an image frame.
        In production, this uses ONNX Runtime:
        
        import onnxruntime as ort
        session = ort.InferenceSession("yolov8n.onnx")
        input_name = session.get_inputs()[0].name
        results = session.run(None, {input_name: preprocessed_image})
        """
        # Simulated detection for demo
        results = [
            DetectionResult(label="person", confidence=0.95, bbox=[100, 50, 400, 450])
        ]
        
        # Add random detections for testing
        import random
        if random.random() < 0.1:
            results.append(DetectionResult(label="cell phone", confidence=0.82, bbox=[300, 200, 350, 280]))
        if random.random() < 0.05:
            results.append(DetectionResult(label="book", confidence=0.71, bbox=[50, 300, 200, 400]))
        if random.random() < 0.05:
            results.append(DetectionResult(label="person", confidence=0.68, bbox=[450, 100, 600, 400]))
        
        return results


# ============================================
# Whisper Detector
# ============================================

class WhisperDetector:
    """
    Whisper-tiny / Vosk audio analysis.
    In production, use whisper-tiny ONNX model.
    """
    
    def __init__(self):
        self.loaded = False
        logger.info("Whisper detector initialized (stub mode)")
    
    def analyze(self, audio_bytes: bytes) -> AudioAnalysis:
        """
        Analyze audio for speech, whispers, and multiple voices.
        In production:
        
        import whisper
        model = whisper.load_model("tiny")
        result = model.transcribe(audio_file)
        """
        # Simulated analysis
        import random
        
        decibel = random.uniform(20, 60)
        
        if decibel > 50:
            return AudioAnalysis(
                event_type="TALKING",
                confidence=0.8,
                decibel_level=decibel,
                is_speech=True,
                risk_contribution=3.0,
            )
        elif decibel > 35:
            return AudioAnalysis(
                event_type="WHISPER",
                confidence=0.65,
                decibel_level=decibel,
                is_whisper=True,
                risk_contribution=2.0,
            )
        else:
            return AudioAnalysis(
                event_type="SILENCE",
                confidence=0.95,
                decibel_level=decibel,
                risk_contribution=0.0,
            )


# ============================================
# Motion Detector
# ============================================

class MotionDetector:
    """
    OpenCV-based motion detection.
    Detects sudden hand/head movements.
    """
    
    def __init__(self):
        self.prev_frame = None
        logger.info("Motion detector initialized")
    
    def detect_motion(self, image_bytes: bytes) -> float:
        """
        Compare current frame with previous to detect motion.
        In production:
        
        import cv2
        frame = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_GRAYSCALE)
        if self.prev_frame is not None:
            diff = cv2.absdiff(self.prev_frame, frame)
            motion = np.mean(diff) / 255.0
        self.prev_frame = frame
        """
        import random
        return random.uniform(0.01, 0.15)


# ============================================
# Risk Engine
# ============================================

class RiskEngine:
    """
    Combines all AI signals into a final risk score (0-100).
    """
    
    WEIGHTS = {
        'eye_deviation': 20,
        'head_pose': 10,
        'multi_face': 10,
        'phone_detection': 20,
        'audio_whisper': 15,
        'tab_switch': 15,
        'sudden_movement': 10,
    }
    
    @staticmethod
    def calculate(request: RiskFusionRequest) -> RiskFusionResult:
        scores = {
            'eye_deviation': min(20, request.eye_deviation),
            'head_pose': min(10, request.head_pose),
            'multi_face': min(10, request.multi_face),
            'phone_detection': min(20, request.phone_detection),
            'audio_whisper': min(15, request.audio_whisper),
            'tab_switch': min(15, request.tab_switch),
            'sudden_movement': min(10, request.sudden_movement),
        }
        
        total = sum(scores.values())
        
        if total >= 80:
            level = "CRITICAL"
        elif total >= 60:
            level = "HIGH"
        elif total >= 40:
            level = "MEDIUM"
        else:
            level = "LOW"
        
        summary_parts = [f"{k.replace('_', ' ').title()}={v:.0f}/{RiskEngine.WEIGHTS[k]}"
                         for k, v in scores.items() if v > 0]
        summary = f"Total: {total:.0f}/100 ({level}). " + ", ".join(summary_parts) if summary_parts else f"Total: {total:.0f}/100. No significant detections."
        
        return RiskFusionResult(
            total_score=round(total, 1),
            risk_level=level,
            breakdown=scores,
            ai_summary=summary,
        )


# ============================================
# MySQL persistence for risk scores
# ============================================

def get_db_connection():
    """Get a MySQL connection using the same DB as Spring Boot."""
    try:
        import mysql.connector
        return mysql.connector.connect(
            host='localhost',
            port=3306,
            database='eduguardian',
            user='root',
            password='**********',
        )
    except Exception as e:
        logger.warning(f"MySQL connection failed: {e}")
        return None


def save_risk_to_db(student_id: int, exam_id: int, total_score: float,
                    risk_level: str, breakdown: dict, summary: str):
    """Persist risk score to the risk_scores table."""
    conn = get_db_connection()
    if not conn:
        logger.warning("Skipping DB save — no connection")
        return
    try:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO risk_scores
               (exam_id, student_id, eye_deviation_score, head_pose_score,
                multi_face_score, phone_detection_score, audio_whisper_score,
                tab_switch_score, sudden_movement_score, total_score,
                risk_level, ai_summary, calculated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())""",
            (exam_id, student_id,
             breakdown.get('eye_deviation', 0),
             breakdown.get('head_pose', 0),
             breakdown.get('multi_face', 0),
             breakdown.get('phone_detection', 0),
             breakdown.get('audio_whisper', 0),
             breakdown.get('tab_switch', 0),
             breakdown.get('sudden_movement', 0),
             total_score, risk_level, summary))
        conn.commit()
        logger.info(f"Risk score saved to DB: student={student_id}, exam={exam_id}, score={total_score}")
    except Exception as e:
        logger.error(f"Failed to save risk to DB: {e}")
    finally:
        conn.close()


# ============================================
# Initialize detectors
# ============================================

yolo = YOLODetector()
whisper = WhisperDetector()
motion = MotionDetector()
risk_engine = RiskEngine()


# ============================================
# API Endpoints
# ============================================

@app.get("/")
def health():
    return {"status": "ok", "service": "EduGuardian AI Service", "version": "2.0.0"}


@app.post("/api/detect/frame", response_model=FrameAnalysis)
async def detect_frame(file: UploadFile = File(...)):
    """Analyze a video frame for objects (phone, book, person)."""
    start = time.time()
    contents = await file.read()
    
    detections = yolo.detect(contents)
    motion_level = motion.detect_motion(contents)
    
    phone = any(d.label == "cell phone" for d in detections)
    persons = sum(1 for d in detections if d.label == "person")
    book = any(d.label == "book" for d in detections)
    
    risk = 0.0
    if phone:
        risk += 10.0
    if persons > 1:
        risk += 5.0
    if book:
        risk += 3.0
    if motion_level > 0.1:
        risk += motion_level * 20
    
    elapsed = time.time() - start
    logger.info(f"Frame analysis completed in {elapsed*1000:.0f}ms: {len(detections)} objects")
    
    return FrameAnalysis(
        objects=detections,
        faces_count=persons,
        motion_level=round(motion_level, 3),
        phone_detected=phone,
        person_behind=persons > 1,
        book_detected=book,
        risk_contribution=round(risk, 1),
    )


@app.post("/api/detect/audio", response_model=AudioAnalysis)
async def detect_audio(file: UploadFile = File(...)):
    """Analyze an audio clip for speech, whispers, and multiple voices."""
    contents = await file.read()
    result = whisper.analyze(contents)
    return result


@app.post("/api/risk/calculate", response_model=RiskFusionResult)
async def calculate_risk(request: RiskFusionRequest):
    """Calculate fused risk score from all AI + browser signals."""
    result = risk_engine.calculate(request)

    # Persist to MySQL if student_id and exam_id are provided
    if request.student_id and request.exam_id:
        try:
            save_risk_to_db(
                student_id=request.student_id,
                exam_id=request.exam_id,
                total_score=result.total_score,
                risk_level=result.risk_level,
                breakdown=result.breakdown,
                summary=result.ai_summary,
            )
        except Exception as e:
            logger.error(f"Failed to persist risk score: {e}")

    return result


@app.post("/api/detect/motion")
async def detect_motion_endpoint(file: UploadFile = File(...)):
    """Detect sudden movements in a video frame."""
    contents = await file.read()
    level = motion.detect_motion(contents)
    return {
        "motion_level": round(level, 3),
        "is_sudden": level > 0.1,
        "severity": "HIGH" if level > 0.2 else "MEDIUM" if level > 0.1 else "LOW",
    }


# ============================================
# Question Generation (Gemini AI)
# ============================================

class QuestionRequest(BaseModel):
    topic: str
    difficulty: str  # EASY, MEDIUM, HARD
    count: int = 5
    question_type: str = "MCQ"  # MCQ, TRUE_FALSE, SHORT_ANSWER
    subject: Optional[str] = None

class Option(BaseModel):
    label: str
    text: str
    is_correct: bool = False

class QuestionItem(BaseModel):
    question: str
    type: str
    difficulty: str
    options: Optional[List[Option]] = None
    answer: Optional[str] = None
    explanation: Optional[str] = None

class QuestionResponse(BaseModel):
    questions: List[QuestionItem]
    topic: str
    generated_by: str


def generate_with_gemini(request: QuestionRequest) -> List[QuestionItem]:
    """Generate questions using Google Gemini API."""
    try:
        import google.generativeai as genai
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError("No GEMINI_API_KEY set")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        type_instruction = {
            "MCQ": "multiple-choice questions with 4 options (A, B, C, D). Mark exactly one as correct.",
            "TRUE_FALSE": "true/false questions.",
            "SHORT_ANSWER": "short answer questions (1-2 sentences expected).",
        }.get(request.question_type, "multiple-choice questions with 4 options.")
        
        prompt = f"""Generate {request.count} {request.difficulty.lower()}-level {type_instruction}

Topic: {request.topic}
{f'Subject: {request.subject}' if request.subject else ''}

Return ONLY a valid JSON array with this exact structure (no markdown, no extra text):
[
  {{
    "question": "...",
    "type": "{request.question_type}",
    "difficulty": "{request.difficulty}",
    "options": [
      {{"label": "A", "text": "...", "is_correct": false}},
      {{"label": "B", "text": "...", "is_correct": true}},
      {{"label": "C", "text": "...", "is_correct": false}},
      {{"label": "D", "text": "...", "is_correct": false}}
    ],
    "answer": "B",
    "explanation": "Short explanation of the correct answer"
  }}
]

For TRUE_FALSE, only include 2 options: True and False.
For SHORT_ANSWER, omit the options array and set answer to a sample answer string."""
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        # Strip markdown code fences if present
        text = re.sub(r'^```[a-z]*\n?', '', text)
        text = re.sub(r'\n?```$', '', text).strip()
        
        data = json.loads(text)
        return [QuestionItem(**q) for q in data]
    except Exception as e:
        logger.error(f"Gemini generation failed: {e}")
        raise


def generate_fallback(request: QuestionRequest) -> List[QuestionItem]:
    """Fallback template-based question generation with unique varied questions."""
    t = request.topic
    d = request.difficulty
    qt = request.question_type

    MCQ_TEMPLATES = [
        {
            "question": f"Which of the following BEST describes the core concept of {t}?",
            "options": [
                {"label": "A", "text": f"The foundational principle that defines {t}", "is_correct": True},
                {"label": "B", "text": f"A peripheral concept unrelated to {t}", "is_correct": False},
                {"label": "C", "text": f"A deprecated version of {t}", "is_correct": False},
                {"label": "D", "text": f"An alternative name for a different subject", "is_correct": False},
            ],
            "answer": "A",
            "explanation": f"The core concept of {t} is best described by option A."
        },
        {
            "question": f"What is the PRIMARY advantage of using {t} in real-world applications?",
            "options": [
                {"label": "A", "text": f"It is the oldest known method", "is_correct": False},
                {"label": "B", "text": f"It improves efficiency and solves specific domain problems", "is_correct": True},
                {"label": "C", "text": f"It has no disadvantages", "is_correct": False},
                {"label": "D", "text": f"It replaces all other concepts entirely", "is_correct": False},
            ],
            "answer": "B",
            "explanation": f"The primary advantage of {t} is its ability to improve efficiency in domain-specific applications."
        },
        {
            "question": f"Which scenario is the MOST appropriate use case for {t}?",
            "options": [
                {"label": "A", "text": f"When performance and accuracy are not required", "is_correct": False},
                {"label": "B", "text": f"When solving simple unrelated problems", "is_correct": False},
                {"label": "C", "text": f"When the problem domain directly aligns with {t}'s strengths", "is_correct": True},
                {"label": "D", "text": f"Only in theoretical research, never in practice", "is_correct": False},
            ],
            "answer": "C",
            "explanation": f"{t} is most appropriate when the problem domain matches its designed strengths."
        },
        {
            "question": f"What common misconception exists about {t}?",
            "options": [
                {"label": "A", "text": f"That {t} is universally applicable without limitations", "is_correct": True},
                {"label": "B", "text": f"That {t} requires domain understanding", "is_correct": False},
                {"label": "C", "text": f"That {t} has practical applications", "is_correct": False},
                {"label": "D", "text": f"That {t} is a modern concept", "is_correct": False},
            ],
            "answer": "A",
            "explanation": f"A common misconception is that {t} can be applied universally without considering its limitations."
        },
        {
            "question": f"How does {t} DIFFER from related concepts in its field?",
            "options": [
                {"label": "A", "text": f"It does not differ at all", "is_correct": False},
                {"label": "B", "text": f"It focuses on a unique subset of the problem domain with distinct methods", "is_correct": True},
                {"label": "C", "text": f"It is identical to all related concepts", "is_correct": False},
                {"label": "D", "text": f"It was developed after all related concepts became obsolete", "is_correct": False},
            ],
            "answer": "B",
            "explanation": f"{t} distinguishes itself through its unique methodology and targeted problem domain."
        },
        {
            "question": f"Which of the following is a LIMITATION of {t}?",
            "options": [
                {"label": "A", "text": f"It has no limitations whatsoever", "is_correct": False},
                {"label": "B", "text": f"It works equally well for all types of problems", "is_correct": False},
                {"label": "C", "text": f"It may not perform optimally outside its intended domain", "is_correct": True},
                {"label": "D", "text": f"It is too simple to have known limitations", "is_correct": False},
            ],
            "answer": "C",
            "explanation": f"Like any concept, {t} has limitations when applied outside its intended scope."
        },
        {
            "question": f"In the context of {t}, what does the term 'optimization' typically refer to?",
            "options": [
                {"label": "A", "text": f"Making {t} slower but more accurate", "is_correct": False},
                {"label": "B", "text": f"Improving the efficiency or correctness of methods related to {t}", "is_correct": True},
                {"label": "C", "text": f"Removing {t} from the workflow entirely", "is_correct": False},
                {"label": "D", "text": f"Only applies to hardware, never software", "is_correct": False},
            ],
            "answer": "B",
            "explanation": f"Optimization in {t} refers to improving its efficiency or accuracy of output."
        },
        {
            "question": f"Which professional field makes the MOST use of {t}?",
            "options": [
                {"label": "A", "text": f"Fields where the core problems align with {t}'s domain", "is_correct": True},
                {"label": "B", "text": f"Fields completely unrelated to technology or science", "is_correct": False},
                {"label": "C", "text": f"Only food and agriculture industries", "is_correct": False},
                {"label": "D", "text": f"No professional field actively uses it", "is_correct": False},
            ],
            "answer": "A",
            "explanation": f"Fields whose core challenges map directly to {t}'s strengths make the most use of it."
        },
        {
            "question": f"What foundational knowledge is most important before learning {t}?",
            "options": [
                {"label": "A", "text": f"No prior knowledge is needed", "is_correct": False},
                {"label": "B", "text": f"Knowledge of unrelated historical events", "is_correct": False},
                {"label": "C", "text": f"Understanding the prerequisites and domain context of {t}", "is_correct": True},
                {"label": "D", "text": f"Mastery of unrelated advanced topics exclusively", "is_correct": False},
            ],
            "answer": "C",
            "explanation": f"Domain context and prerequisites are crucial for understanding {t} effectively."
        },
        {
            "question": f"Which statement about the history and evolution of {t} is MOST accurate?",
            "options": [
                {"label": "A", "text": f"{t} has remained completely unchanged since its origin", "is_correct": False},
                {"label": "B", "text": f"{t} has evolved over time in response to new challenges and discoveries", "is_correct": True},
                {"label": "C", "text": f"{t} was invented last year with no historical background", "is_correct": False},
                {"label": "D", "text": f"{t} is purely theoretical with no development history", "is_correct": False},
            ],
            "answer": "B",
            "explanation": f"Like most fields, {t} has evolved continuously in response to new challenges."
        },
    ]

    TF_TEMPLATES = [
        {"question": f"{t} is widely used in modern applications across multiple industries.", "answer": "True",
         "explanation": f"{t} has broad applications across several industries today."},
        {"question": f"The study of {t} requires no understanding of related foundational concepts.", "answer": "False",
         "explanation": f"Understanding foundational concepts is essential to learning {t}."},
        {"question": f"Optimizing a system that uses {t} can significantly improve its performance.", "answer": "True",
         "explanation": f"Optimization directly improves performance in {t}-based systems."},
        {"question": f"{t} has no known limitations or failure cases.", "answer": "False",
         "explanation": f"Every concept including {t} has limitations and edge cases."},
        {"question": f"Practical experience is important when learning and applying {t}.", "answer": "True",
         "explanation": f"Hands-on practice is key to mastering {t}."},
        {"question": f"{t} can be applied identically in every situation without modification.", "answer": "False",
         "explanation": f"{t} must be adapted to fit the specific context of each problem."},
    ]

    SA_TEMPLATES = [
        {"question": f"Explain the core principles of {t} in your own words.",
         "answer": f"A comprehensive explanation of {t} covering its main principles, purpose, and key characteristics."},
        {"question": f"Describe a real-world application where {t} would be most effective.",
         "answer": f"An example where {t}'s strengths align with a real-world problem, demonstrating its practical value."},
        {"question": f"What are the key advantages and disadvantages of using {t}?",
         "answer": f"Advantages: efficiency, domain-specific accuracy. Disadvantages: limitations outside its domain, potential complexity."},
        {"question": f"How has {t} evolved over time and what drove those changes?",
         "answer": f"{t} has evolved due to new research, technological advances, and emerging problem domains."},
        {"question": f"Compare {t} with an alternative approach and explain when each is preferred.",
         "answer": f"{t} is preferred when its specific strengths are needed; alternatives may be better for simpler or different problem types."},
        {"question": f"What prerequisites should a student have before studying {t}?",
         "answer": f"Students should understand foundational concepts of the related domain before deeply studying {t}."},
    ]

    tf_opts = [
        {"label": "True", "text": "True", "is_correct": True},
        {"label": "False", "text": "False", "is_correct": False},
    ]

    items = []
    if qt == "MCQ":
        pool = MCQ_TEMPLATES
        for i in range(request.count):
            tmpl = pool[i % len(pool)]
            items.append(QuestionItem(
                question=tmpl["question"],
                type="MCQ",
                difficulty=d,
                options=[Option(**o) for o in tmpl["options"]],
                answer=tmpl["answer"],
                explanation=tmpl["explanation"],
            ))
    elif qt == "TRUE_FALSE":
        pool = TF_TEMPLATES
        for i in range(request.count):
            tmpl = pool[i % len(pool)]
            correct = tmpl["answer"] == "True"
            opts = [
                Option(label="True", text="True", is_correct=correct),
                Option(label="False", text="False", is_correct=not correct),
            ]
            items.append(QuestionItem(
                question=tmpl["question"],
                type="TRUE_FALSE",
                difficulty=d,
                options=opts,
                answer=tmpl["answer"],
                explanation=tmpl["explanation"],
            ))
    else:  # SHORT_ANSWER
        pool = SA_TEMPLATES
        for i in range(request.count):
            tmpl = pool[i % len(pool)]
            items.append(QuestionItem(
                question=tmpl["question"],
                type="SHORT_ANSWER",
                difficulty=d,
                options=None,
                answer=tmpl["answer"],
                explanation="",
            ))

    return items



@app.post("/api/questions/generate", response_model=QuestionResponse)
async def generate_questions(request: QuestionRequest):
    """Generate exam questions using AI based on topic and difficulty."""
    try:
        questions = generate_with_gemini(request)
        generated_by = "Gemini AI"
    except Exception:
        logger.warning("Falling back to template-based question generation")
        questions = generate_fallback(request)
        generated_by = "Template Engine"
    
    return QuestionResponse(
        questions=questions,
        topic=request.topic,
        generated_by=generated_by,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
