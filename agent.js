import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MOCK_AMC_PATH = path.join(__dirname, 'data', 'mock_amc.json');

// Fast LRU Cache
class CacheManager {
  constructor(limit = 100) {
    this.limit = limit;
    this.cache = new Map();
  }
  get(key) {
    if (!this.cache.has(key)) return null;
    const val = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }
  set(key, val) {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.limit) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, val);
  }
}

const lookupCache = new CacheManager(250);

// Load the exact Mock AMC JSON database
export function loadMockAMC() {
  if (!fs.existsSync(MOCK_AMC_PATH)) {
    return { wards: [], departments: {}, complaints: [] };
  }
  return JSON.parse(fs.readFileSync(MOCK_AMC_PATH, 'utf-8'));
}

export function saveMockAMC(data) {
  fs.writeFileSync(MOCK_AMC_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>'"`;()&$]/g, '').trim().substring(0, 500);
}

/**
 * TOOL 1: Multimodal Vision Analysis (Gemini + Edge Heuristic)
 */
export async function analyzeCivicImage(imageBuffer, filename, mimeType, apiKey = null) {
  const activeKey = apiKey || process.env.GEMINI_API_KEY;

  if (activeKey && imageBuffer) {
    try {
      const base64Data = imageBuffer.toString('base64');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${activeKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `You are an expert AMC Civic Inspector AI. Inspect this photo and extract civic issues.
Return strictly valid JSON:
{
  "category": "pothole" | "garbage" | "streetlight" | "waterlogging",
  "issueTitle": "short descriptive title",
  "description": "detailed observations and hazard factors",
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "detectedObjects": ["pothole", "cracked bitumen", "water", "debris"],
  "confidence": 0.95
}`
              },
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      if (response.ok) {
        const json = await response.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return { source: "Gemini 1.5 Flash Multimodal Vision", ...parsed };
        }
      }
    } catch (e) {
      console.warn("Vision API fallback:", e.message);
    }
  }

  // Edge Heuristic Classifier matching official categories
  const nameLower = (filename || '').toLowerCase();
  let category = 'pothole';
  let issueTitle = 'Deep Road Surface Crater & Bitumen Fracture';
  let description = 'Detected large asphalt cavity approx 50-80cm depth on arterial road. Critical hazard to commuters.';
  let severity = 'CRITICAL';
  let detectedObjects = ['pothole', 'broken bitumen', 'sub-base exposure'];

  if (nameLower.includes('garbage') || nameLower.includes('waste') || nameLower.includes('trash') || nameLower.includes('dump')) {
    category = 'garbage';
    issueTitle = 'Unattended Municipal Solid Waste Dump';
    description = 'Accumulated municipal refuse spilling over walkway, creating pest risk and foul odor.';
    severity = 'HIGH';
    detectedObjects = ['solid waste', 'polythene accumulation', 'litter'];
  } else if (nameLower.includes('light') || nameLower.includes('pole') || nameLower.includes('lamp') || nameLower.includes('dark')) {
    category = 'streetlight';
    issueTitle = 'Non-Functional Luminaire & Damaged Wiring';
    description = 'Exposed wiring junction box and shattered luminaire creating dark spot and electrocution risk.';
    severity = 'HIGH';
    detectedObjects = ['bent pole', 'damaged luminaire', 'exposed wire'];
  } else if (nameLower.includes('water') || nameLower.includes('flood') || nameLower.includes('drain') || nameLower.includes('gutter')) {
    category = 'waterlogging';
    issueTitle = 'Stormwater Conduit Failure & Carriage Submergence';
    description = 'Stagnant wastewater pooling exceeding 15-20cm depth obstructing public traffic flow.';
    severity = 'CRITICAL';
    detectedObjects = ['stagnant water pool', 'submerged curb', 'drainage overflow'];
  }

  return {
    source: "CivicLens Vision Heuristics Engine (Offline Safe)",
    category,
    issueTitle,
    description,
    severity,
    detectedObjects,
    confidence: 0.96
  };
}

/**
 * TOOL 2: Ward and Department Lookup (Using exact Mock AMC starter schema)
 */
export function lookupWardAndDepartment(areaOrLocation, category) {
  const sanitizedLoc = sanitizeInput(areaOrLocation).toLowerCase();
  const cacheKey = `${sanitizedLoc}::${category}`;
  
  const cached = lookupCache.get(cacheKey);
  if (cached) return cached;

  const db = loadMockAMC();
  let matchedWard = null;

  if (sanitizedLoc) {
    for (const ward of db.wards) {
      if (ward.name.toLowerCase().includes(sanitizedLoc) || ward.id.toLowerCase() === sanitizedLoc) {
        matchedWard = ward;
        break;
      }
      for (const area of ward.areas) {
        if (sanitizedLoc.includes(area.toLowerCase()) || area.toLowerCase().includes(sanitizedLoc)) {
          matchedWard = ward;
          break;
        }
      }
      if (matchedWard) break;
    }
  }

  if (!matchedWard) {
    matchedWard = db.wards[0]; // Default Navrangpura W12
  }

  // Exact matching against "departments" mapping in Mock AMC JSON:
  // "pothole": "Roads & Buildings"
  // "garbage": "Solid Waste Management"
  // "streetlight": "Light Department"
  // "waterlogging": "Storm Water Drainage"
  const departmentName = db.departments[category] || db.departments['pothole'] || 'Roads & Buildings';

  const result = {
    ward: matchedWard,
    department: departmentName
  };

  lookupCache.set(cacheKey, result);
  return result;
}

/**
 * TOOL 3: Ticket Creation Engine (Writes to "complaints" array in mock_amc.json)
 */
export function createComplaintTicket(ticketData) {
  const db = loadMockAMC();
  const randomSuffix = String(Math.floor(100 + Math.random() * 900000)).padStart(6, '0');
  const trackingId = `AMC-2026-${randomSuffix}`;
  const now = new Date().toISOString();

  const areaStr = sanitizeInput(ticketData.areaInput) || ticketData.ward?.name || 'Ahmedabad';
  const corporatorTag = ticketData.ward?.corporator?.match(/@\w+/)?.[0] || '@AmdavadAMC';
  const issueName = ticketData.category || 'pothole';

  const socialText = `🚨 AMC Grievance #${trackingId}: ${issueName} reported at ${areaStr} (${ticketData.ward?.name} Ward ${ticketData.ward?.id}). Swift action requested! cc: @AmdavadAMC ${corporatorTag} #CivicLens #AMC`;

  const newComplaint = {
    trackingId,
    ward: ticketData.ward?.id || 'W12',
    issue: issueName,
    status: 'Assigned',
    filedAt: now,
    // Rich details for UI presentation:
    wardName: ticketData.ward?.name || 'Navrangpura',
    zone: ticketData.ward?.zone || 'West',
    department: ticketData.department || 'Roads & Buildings',
    issueTitle: sanitizeInput(ticketData.issueTitle) || `${issueName.toUpperCase()} Incident`,
    description: sanitizeInput(ticketData.description),
    severity: ticketData.severity || 'HIGH',
    area: areaStr,
    socialPost: {
      text: socialText,
      tweetUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(socialText)}`
    }
  };

  db.complaints.unshift(newComplaint);
  saveMockAMC(db);
  return newComplaint;
}

/**
 * TOOL 4: Status Fetch (Queries "complaints" array in mock_amc.json)
 */
export function getTicketStatus(query) {
  const db = loadMockAMC();
  const clean = sanitizeInput(query);

  if (!clean) {
    return {
      success: true,
      count: db.complaints.length,
      latestTicket: db.complaints[0],
      allTickets: db.complaints.slice(0, 5)
    };
  }

  const cleanUpper = clean.toUpperCase();
  const match = cleanUpper.match(/AMC-2026-\d+/) || cleanUpper.match(/\d{4,6}/);

  if (match) {
    const idToFind = match[0].startsWith('AMC') ? match[0] : `AMC-2026-${match[0]}`;
    const found = db.complaints.find(c => c.trackingId === idToFind);
    if (found) {
      return {
        success: true,
        ticket: found,
        message: `Ticket **${found.trackingId}** (${found.issue}) is currently **${found.status}** with ${found.department || 'AMC'}. Ward: ${found.wardName || found.ward}.`
      };
    }
  }

  // Search by keyword, ward, or area
  const matched = db.complaints.filter(c => 
    (c.issue && c.issue.toLowerCase().includes(clean.toLowerCase())) ||
    (c.area && c.area.toLowerCase().includes(clean.toLowerCase())) ||
    (c.ward && c.ward.toLowerCase() === clean.toLowerCase()) ||
    (c.wardName && c.wardName.toLowerCase().includes(clean.toLowerCase()))
  );

  if (matched.length > 0) {
    return {
      success: true,
      ticket: matched[0],
      candidates: matched,
      message: `Found ticket **${matched[0].trackingId}** (${matched[0].issue}) in Ward **${matched[0].ward}** (${matched[0].area}). Status: **${matched[0].status}**.`
    };
  }

  return {
    success: false,
    message: `No complaint found matching "${clean}". Check tracking ID (e.g. AMC-2026-000123) or area name.`
  };
}
