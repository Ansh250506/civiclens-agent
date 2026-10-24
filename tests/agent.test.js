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
  });

  test('Tool 2: lookupWardAndDepartment resolves exact Mock AMC W12 and Roads & Buildings', () => {
    const res = lookupWardAndDepartment('CG Road', 'pothole');
    expect(res.ward.id).toBe('W12');
    expect(res.ward.name).toBe('Navrangpura');
    expect(res.department).toBe('Roads & Buildings');
  });

  test('Tool 2: lookupWardAndDepartment resolves exact Mock AMC W27 and Solid Waste Management', () => {
    const res = lookupWardAndDepartment('Maninagar', 'garbage');
    expect(res.ward.id).toBe('W27');
    expect(res.ward.name).toBe('Maninagar');
    expect(res.department).toBe('Solid Waste Management');
  });

  test('Tool 4: getTicketStatus returns structured response for starter complaint AMC-2026-000123', () => {
    const statusResult = getTicketStatus('AMC-2026-000123');
    expect(statusResult.success).toBe(true);
    expect(statusResult.ticket.trackingId).toBe('AMC-2026-000123');
    expect(statusResult.ticket.status).toBe('Assigned');
  });

  test('API Endpoint: GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('healthy');
  });

  test('API Endpoint: GET /api/tickets returns mock municipal complaints', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.tickets)).toBe(true);
    expect(res.body.tickets.length).toBeGreaterThan(0);
  });

  test('API Endpoint: POST /api/agent/file-complaint creates complaint in mock AMC JSON', async () => {
    const res = await request(app)
      .post('/api/agent/file-complaint')
      .field('area', 'CG Road, Navrangpura')
      .field('sampleType', 'pothole');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.ticket).toHaveProperty('trackingId');
    expect(res.body.ticket.ward).toBe('W12');
    expect(res.body.ticket.department).toBe('Roads & Buildings');
  });

});
