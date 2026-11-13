import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = "gemini-4-hydrogen";

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function mapGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("GEMINI_API_KEY is not configured")) {
    return { status: 503, message: msg };
  }
  if (msg.includes("403") || msg.includes("PERMISSION_DENIED") || msg.includes("API_KEY_INVALID")) {
    return {
      status: 403,
      message: "Gemini API key was rejected. Please verify GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "Gemini API rate limit reached. Please wait a moment and try again.",
    };
  }
  return { status: 500, message: msg || "Failed to generate AI study response." };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // 1. Smart Study Planner
  app.post("/api/ai/study-planner", async (req, res) => {
    try {
      const ai = getAiClient();
      const { subjects, exams, tasks, assignments, availableHoursPerDay, focusPreference, today } = req.body;

      const prompt = `Create a realistic, balanced 5-day study schedule starting ${today || "today"}.
Student Context:
- Available study time per day: ${availableHoursPerDay || 3} hours
- Preferred study style: ${focusPreference || "Balanced mix of difficult and review topics"}
- Enrolled Subjects: ${JSON.stringify(subjects || [])}
- Upcoming Examinations: ${JSON.stringify(exams || [])}
- Pending Assignments: ${JSON.stringify(assignments || [])}
- Pending Tasks: ${JSON.stringify(tasks || [])}

Prioritize subjects with imminent exams or overdue/urgent assignments. Keep blocks realistic (45-90 minutes each) with short breaks.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are an academic study coach for college students. Return practical, specific, actionable study schedules strictly grounded in the student's provided subjects, exams, assignments, and tasks.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              weeklyFocus: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayLabel: { type: Type.STRING },
                    blocks: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          timeSlot: { type: Type.STRING },
                          subject: { type: Type.STRING },
                          topic: { type: Type.STRING },
                          durationMinutes: { type: Type.INTEGER },
                          goal: { type: Type.STRING },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // 2. Study Suggestions
  app.post("/api/ai/study-suggestions", async (req, res) => {
    try {
      const ai = getAiClient();
      const { subjects, exams, assignments, studySessions, today } = req.body;

      const prompt = `Analyze the student's current academic workload as of ${today || "today"} and recommend what to study next.
Data:
- Subjects (with weekly targets & progress): ${JSON.stringify(subjects || [])}
- Recent Study Sessions: ${JSON.stringify(studySessions || [])}
- Upcoming Assignments: ${JSON.stringify(assignments || [])}
- Upcoming Examinations: ${JSON.stringify(exams || [])}

Identify gaps between study targets and logged hours, imminent deadlines, and exams needing attention.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are an academic advisor. Give concise, high-impact recommendations grounded strictly in the provided data.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    subject: { type: Type.STRING },
                    recommendedTopic: { type: Type.STRING },
                    suggestedMinutes: { type: Type.INTEGER },
                    urgency: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // 3. Task Prioritization
  app.post("/api/ai/prioritize-tasks", async (req, res) => {
    try {
      const ai = getAiClient();
      const { tasks, exams, assignments, today } = req.body;

      const prompt = `Evaluate and prioritize these pending student tasks as of ${today || "today"}.
Pending Tasks: ${JSON.stringify(tasks || [])}
Context (Exams & Assignments): ${JSON.stringify({ exams: exams || [], assignments: assignments || [] })}

For each task ID provided, assign recommendedPriority ("High", "Medium", or "Low"), rank (1 = do first), and a brief reason.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are an academic productivity strategist. Only reference task IDs that exist in the input list.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strategyNote: { type: Type.STRING },
              prioritizedTasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    rank: { type: Type.INTEGER },
                    recommendedPriority: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // 4. Study Summarization
  app.post("/api/ai/summarize-notes", async (req, res) => {
    try {
      const ai = getAiClient();
      const { title, subjectName, content } = req.body;

      if (!content || String(content).trim().length < 15) {
        return res.status(400).json({ error: "Please provide at least a short paragraph of study notes to summarize." });
      }

      const prompt = `Summarize the following study notes clearly for exam revision.
Subject: ${subjectName || "General"}
Title: ${title || "Study Notes"}
Notes:
${String(content).slice(0, 20000)}`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are an academic study assistant. Distill student notes into crisp revision takeaways, key terms, and active-recall self-test questions.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tldr: { type: Type.STRING },
              keyTakeaways: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              keyTerms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    definition: { type: Type.STRING },
                  },
                },
              },
              practiceQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // 5. Exam Preparation
  app.post("/api/ai/exam-prep", async (req, res) => {
    try {
      const ai = getAiClient();
      const { exam, today, dailyHours } = req.body;

      if (!exam) {
        return res.status(400).json({ error: "Examination details are required." });
      }

      const prompt = `Build a focused exam revision plan as of ${today || "today"}.
Examination Details:
- Subject: ${exam.subjectName}
- Exam Type: ${exam.examType}
- Date & Time: ${exam.examDate} at ${exam.examTime}
- Current Preparation Status: ${exam.prepStatus}
- Daily Study Availability: ${dailyHours || 2.5} hours
- Syllabus / Topics: ${exam.syllabus || "No syllabus details provided; structure around core conceptual mastery, problem solving, and timed mock practice."}

Break the remaining days into structured revision phases with concrete daily goals and an exam-readiness checklist.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are an exam preparation mentor. Create realistic, paced revision plans tailored to the exam date, syllabus topics, and preparation status.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overview: { type: Type.STRING },
              phases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    phaseTitle: { type: Type.STRING },
                    timeframe: { type: Type.STRING },
                    focusTopics: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    studyMethod: { type: Type.STRING },
                  },
                },
              },
              readinessChecklist: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (err) {
      const mapped = mapGeminiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true",
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Student Life Manager server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
