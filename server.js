import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { analyzeCivicImage, lookupWardAndDepartment, createComplaintTicket, getTicketStatus } from './agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// Serve static sample mock assets if present
const sampleDir = path.join(__dirname, 'public', 'samples');
if (!fs.existsSync(sampleDir)) {
  fs.mkdirSync(sampleDir, { recursive: true });
}

/**
 * API: Autonomous Full Grievance Agent Pipeline
 * Step 1: Tool 1 - Multimodal Vision Analysis
 * Step 2: Tool 2 - Ward & Department Resolver
 * Step 3: Tool 3 - Auto Filing in AMC DB & Social Post Draft
 */
app.post('/api/agent/file-complaint', upload.single('photo'), async (req, res) => {
  try {
    const { area, customTitle, userApiKey, sampleType } = req.body;
    let fileBuffer = req.file?.buffer;
    let filename = req.file?.originalname || '';
    let mimeType = req.file?.mimetype || 'image/jpeg';

    // If using preloaded sample image
    if (!fileBuffer && sampleType) {
      filename = `${sampleType}.jpg`;
      fileBuffer = Buffer.from('sample_civic_image_content');
    }

    if (!fileBuffer && !sampleType) {
      return res.status(400).json({ error: 'Please upload an inspection photo or select a sample issue.' });
    }

    // Step 1: Agent calls Tool 1 (Image Analysis)
    const visionAnalysis = await analyzeCivicImage(fileBuffer, filename, mimeType, userApiKey);

    // Step 2: Agent calls Tool 2 (Ward & Department Lookup)
    const routing = lookupWardAndDepartment(area, visionAnalysis.category);

    // Step 3: Agent calls Tool 3 (Create Municipal Ticket & Draft Social Post)
    const createdTicket = createComplaintTicket({
      category: visionAnalysis.category,
      issueTitle: customTitle || visionAnalysis.issueTitle,
      description: visionAnalysis.description,
      severity: visionAnalysis.severity,
      hazardFactor: visionAnalysis.hazardFactor,
      detectedObjects: visionAnalysis.detectedObjects,
      areaInput: area,
      ward: routing.ward,
      department: routing.department
    });

    return res.json({
      success: true,
      message: `Grievance ticket ${createdTicket.ticketId} successfully registered.`,
      pipelineSteps: [
        {
          step: 1,
          name: "Multimodal Vision Analysis",
          tool: "analyzeCivicImage()",
          result: visionAnalysis
        },
        {
          step: 2,
          name: "Ward & Department Resolver",
          tool: "lookupWardAndDepartment()",
          result: {
            ward: routing.ward.wardName,
            zone: routing.ward.zone,
            corporator: routing.ward.corporator,
            department: routing.department.name,
            officer: routing.department.officer
          }
        },
        {
          step: 3,
          name: "AMC Database Registration & Social Draft",
          tool: "createComplaintTicket()",
          result: {
            ticketId: createdTicket.ticketId,
            status: createdTicket.status,
            slaHours: createdTicket.slaHours,
            eta: createdTicket.eta
          }
        }
      ],
      ticket: createdTicket
    });
  } catch (error) {
    console.error('Error processing agent pipeline:', error);
    res.status(500).json({ error: error.message || 'Internal Agent Pipeline Error' });
  }
});

/**
 * API: Conversational Agent for Status & Follow-up
 * e.g., "What's the status of my ticket AMC-2026-8941?"
 */
app.post('/api/agent/chat', (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const result = getTicketStatus(message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Get All Mock AMC Tickets for Live Dashboard
 */
app.get('/api/tickets', (req, res) => {
  try {
    const p = path.join(__dirname, 'data', 'tickets.json');
    const tickets = JSON.parse(fs.readFileSync(p, 'utf-8'));
    res.json({ tickets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * API: Get Ward & Department Directory
 */
app.get('/api/directory', (req, res) => {
  try {
    const wards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'wards.json'), 'utf-8'));
    const departments = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'departments.json'), 'utf-8'));
    res.json({ wards, departments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 CivicLens Autonomous Agent running at: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
