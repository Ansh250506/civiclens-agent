import request from 'supertest';
import app from '../server.js';
import { lookupWardAndDepartment, analyzeCivicImage, getTicketStatus, sanitizeInput } from '../agent.js';

describe('CivicLens AI Agent Automated Test Suite', () => {

  test('Sanitizer protects against XSS and injection attacks', () => {
    const malicious = '<script>alert("xss")</script>Bodakdev & "Drop Table"';
    const clean = sanitizeInput(malicious);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('"');
    expect(clean).not.toContain('&');
  });

  test('Tool 1: analyzeCivicImage classifies pothole and returns severity', async () => {
    const mockBuffer = Buffer.from('fake_image_bytes');
    const result = await analyzeCivicImage(mockBuffer, 'road_pothole_defect.jpg', 'image/jpeg');
    expect(result).toHaveProperty('category', 'pothole');
    expect(result).toHaveProperty('severity', 'CRITICAL');
    expect(result.detectedObjects).toContain('pothole');
  });

  test('Tool 1: analyzeCivicImage classifies garbage dump issue', async () => {
    const mockBuffer = Buffer.from('fake_garbage_bytes');
    const result = await analyzeCivicImage(mockBuffer, 'cg_road_waste_dump.jpg', 'image/jpeg');
    expect(result).toHaveProperty('category', 'garbage_dump');
    expect(result).toHaveProperty('severity', 'HIGH');
  });

  test('Tool 2: lookupWardAndDepartment resolves correct Ward & Corporator', () => {
    const res = lookupWardAndDepartment('Sindhu Bhavan Road', 'pothole');
    expect(res.ward.wardName).toContain('Bodakdev');
    expect(res.ward.corporator).toContain('@BhavnaDave_AMC');
    expect(res.department.id).toBe('DEPT_ROADS');
  });

  test('Tool 4: getTicketStatus returns structured response for existing ticket', () => {
    const statusResult = getTicketStatus('AMC-2026-8941');
    expect(statusResult.success).toBe(true);
    expect(statusResult.ticket.ticketId).toBe('AMC-2026-8941');
  });

  test('API Endpoint: GET /health returns 200 and healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('healthy');
  });

  test('API Endpoint: GET /api/tickets returns mock municipal tickets', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.tickets)).toBe(true);
    expect(res.body.tickets.length).toBeGreaterThan(0);
  });

  test('API Endpoint: POST /api/agent/chat handles user inquiry', async () => {
    const res = await request(app)
      .post('/api/agent/chat')
      .send({ message: 'What is the status of ticket AMC-2026-8941?' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });

  test('API Endpoint: POST /api/agent/file-complaint files complaint successfully', async () => {
    const res = await request(app)
      .post('/api/agent/file-complaint')
      .field('area', 'CG Road, Navrangpura')
      .field('sampleType', 'pothole');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ticket).toHaveProperty('ticketId');
    expect(res.body.ticket.ticketId).toMatch(/^AMC-2026-\d{4}$/);
    expect(res.body.ticket.socialPost).toHaveProperty('text');
  });

});
