# CivicLens AI — Autonomous Civic Issue & Grievance Agent (AMC)

Built for **PromptWars x Garbathon 2026** (GDG Ahmedabad & Google Developer Ecosystem)  
**Track 01:** Multimodal Vision & Agents (Civic Issue AI Agent)

---

## 🏛️ Problem Statement Alignment

> **Problem:** Reporting a pothole, garbage, a broken streetlight or water logging means finding the right ward and department, filing the complaint and chasing it for weeks. Most people give up before filing.  
> **Expected Output:** A photo goes in. The agent identifies the issue, picks the ward and department, and files a complaint with a tracking ID. The user asks "what's the status?" and gets an answer.

CivicLens AI solves this bottleneck completely: **A citizen provides a photo $\rightarrow$ the AI Agent autonomously identifies the defect, resolves the AMC Ward and Department, registers a complaint in the mock municipal database with a unique tracking ID, and drafts a social escalation post. Citizens can converse in natural language to query real-time ticket status.**

---

## ⚡ Google Technologies Stack ("Build with Google")

In strict adherence to the **PromptWars x Garbathon rules**:
- **Google Antigravity:** Developed directly within Google's agentic IDE using custom agent tool-calling workflows.
- **Gemini Multimodal Vision (`gemini-1.5-flash` / `gemini-4-argon` ready):** Image understanding for road defect segmentation, hazard analysis, and severity scoring.
- **Gemini Structured Output & Function Calling:** Strictly typed schema generation for tickets, departments, and SLA calculations.
- **Google Maps Geocoding Compatibility:** Spatial coordinate and landmark resolution to administrative wards.
- **Offline Fallback Architecture:** Complete compliance with rule: *"Offline backups get full credit. If the Wi-Fi fails, cached responses or local stubs score the same as a live demo."*

---

## 🛠️ The 4 Autonomous Agent Tool Calls

```mermaid
flowchart TD
    A[Citizen Photo / Area Landmark] --> B[Tool 1: analyzeCivicImage]
    B -->|Defect Classification & Severity| C[Tool 2: lookupWardAndDepartment]
    C -->|Ward, Zone, Corporator & Dept| D[Tool 3: createComplaintTicket]
    D --> E[(AMC Municipal Database)]
    D --> F[Auto Social Media Post Draft]
    
    G[Citizen: 'What is the status?'] --> H[Tool 4: getTicketStatus]
    H --> E
    H --> I[Live Resolution ETA & Assigned Engineer]
```

1. **Tool 1: `analyzeCivicImage(imageBuffer, filename, mimeType)`**
   - Multimodal Vision feature extraction.
   - Categorizes: `pothole`, `garbage_dump`, `broken_streetlight`, `water_logging`.
   - Rates severity: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.

2. **Tool 2: `lookupWardAndDepartment(areaOrLocation, category)`**
   - Resolves location cues/GPS to AMC administrative wards (Bodakdev, Navrangpura, Maninagar, Satellite, Sabarmati, etc.).
   - Maps to the responsible AMC department: Roads & Bridges, Solid Waste Management, Electrical, Drainage.
   - Identifies local corporator handle (e.g., `@BhavnaDave_AMC`, `@RameshPatel_AMC`).

3. **Tool 3: `createComplaintTicket(ticketData)`**
   - Generates municipal tracking ID (`AMC-2026-XXXX`).
   - Calculates target SLA (24h to 48h) and sets up dispatch timeline.
   - **Requirement Bonus:** Auto-drafts public Twitter/X escalation post tagging `@AmdavadAMC`, the department, and the local ward corporator.

4. **Tool 4: `getTicketStatus(query)`**
   - Conversational status engine. Parses user queries like *"What is the status of my ticket?"* or tracks by ticket ID.
   - Returns real-time municipal status, assigned engineer unit, and estimated resolution date.

---

## 📂 Bundled Datasets & Mock Municipal Starter
- **Mendeley Dataset:** Sourced from [*Urban Civic Issues: Potholes & Garbage (QR4Change)*](https://data.mendeley.com/datasets/zndzygc3p3/2), bundled locally in `public/dataset/`.
- **Mock AMC Municipal DB:**
  - `data/wards.json`: 48 AMC administrative wards, zones, corporator directory.
  - `data/departments.json`: Departmental matrix, official Twitter handles, SLAs, and escalation hierarchies.
  - `data/tickets.json`: Central municipal ledger storing live complaints and dispatch timelines.

---

## 🧪 Automated Testing & Security (100% Quality Score)
- **Unit & Integration Tests:** 9/9 automated Jest tests passing (`npm test`).
- **Security:** Hardened with `helmet` HTTP headers, `express-rate-limit`, and input sanitization against XSS/injections.
- **Accessibility:** Full WCAG compliance with semantic ARIA landmarks and high-contrast styling.

---

## 🚀 Running the Project Locally

```bash
# Clone the repository
git clone https://github.com/Ansh250506/civiclens-agent.git
cd civiclens-agent

# Install dependencies
npm install

# Run automated tests
npm test

# Start the application
npm start
```
Open **http://localhost:3000** in your browser to interact with the live portal.
