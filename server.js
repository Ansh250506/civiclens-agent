import express from 'express';
import multer from 'multer';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  analyzeCivicImage, 
  lookupWardAndDepartment, 
  createComplaintTicket, 
  getTicketStatus, 
  loadMockAMC,
  sanitizeInput 
} from './agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '5mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are permitted.'));
  }
});

// Autonomous Grievance Agent Pipeline Endpoint
app.post('/api/agent/file-complaint', upload.single('photo'), async (req, res) => {
  try {
    const area = sanitizeInput(req.body.area || '');
    const customTitle = sanitizeInput(req.body.customTitle || '');
    const userApiKey = req.body.userApiKey ? req.body.userApiKey.trim() : null;
    const sampleType = req.body.sampleType;

    let fileBuffer = req.file?.buffer;
    let filename = req.file?.originalname || '';
    let mimeType = req.file?.mimetype || 'image/jpeg';

    if (!fileBuffer && sampleType) {
      filename = `${sampleType}.jpg`;
      fileBuffer = Buffer.from('sample_civic_data');
    }

    if (!fileBuffer && !sampleType) {
      return res.status(400).json({ error: 'Please upload an inspection photo or select a sample issue.' });
    }

    // Step 1: Tool 1 - Multimodal Vision Analysis
    const visionAnalysis = await analyzeCivicImage(fileBuffer, filename, mimeType, userApiKey);

    // Step 2: Tool 2 - Ward & Department Lookup
    const routing = lookupWardAndDepartment(area, visionAnalysis.category);

    // Step 3: Tool 3 - Ticket Creation in Mock AMC System
    const createdTicket = createComplaintTicket({
      category: visionAnalysis.category,
      issueTitle: customTitle || visionAnalysis.issueTitle,
      description: visionAnalysis.description,
      severity: visionAnalysis.severity,
      areaInput: area,
      ward: routing.ward,
      department: routing.department
    });

    return res.json({
      success: true,
      message: `Complaint ticket ${createdTicket.trackingId} successfully registered in AMC database.`,
      pipelineSteps: [
        { step: 1, name: "Multimodal Vision Analysis", tool: "analyzeCivicImage()", result: visionAnalysis },
        { step: 2, name: "Ward & Department Resolver", tool: "lookupWardAndDepartment()", result: routing },
        { step: 3, name: "AMC DB Complaint Creation", tool: "createComplaintTicket()", result: { trackingId: createdTicket.trackingId, status: createdTicket.status } }
      ],
      ticket: {
        ticketId: createdTicket.trackingId,
        trackingId: createdTicket.trackingId,
        issue: createdTicket.issue,
        status: createdTicket.status,
        ward: createdTicket.ward,
        wardName: createdTicket.wardName,
        zone: createdTicket.zone,
        department: createdTicket.department,
        issueTitle: createdTicket.issueTitle,
        description: createdTicket.description,
        severity: createdTicket.severity,
        socialPost: createdTicket.socialPost
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Conversational Status Agent Endpoint
app.post('/api/agent/chat', (req, res) => {
  try {
    const message = sanitizeInput(req.body.message || '');
    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }
    const result = getTicketStatus(message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Query Mock AMC Complaints
app.get('/api/tickets', (req, res) => {
  try {
    const db = loadMockAMC();
    const formatted = db.complaints.map(c => ({
      ticketId: c.trackingId,
      trackingId: c.trackingId,
      category: c.issue,
      issue: c.issue,
      issueTitle: c.issueTitle || `${c.issue.toUpperCase()} at ${c.area || c.ward}`,
      location: {
        wardName: c.wardName || c.ward,
        area: c.area || c.ward
      },
      ward: c.ward,
      department: c.department || 'Roads & Buildings',
      status: c.status,
      filedAt: c.filedAt
    }));
    res.json({ tickets: formatted, rawDB: db });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'AMC Civic Agent Enterprise API' });
});

export default app;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`CivicLens AMC Agent Server running on port ${PORT}`);
  });
}
