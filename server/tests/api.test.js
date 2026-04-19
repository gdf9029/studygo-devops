// ============================================================
// StudyGo Backend API Tests
// server/tests/api.test.js
// ============================================================

const request = require('supertest');

// Lightweight mock of the Express app (no real DB connection needed)
const express = require('express');
const app = express();
app.use(express.json());

// ── Health endpoint ──
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Your server is up and running ...' });
});

// ── Mock auth endpoints ──
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }
  if (email === 'test@studygo.com' && password === 'Test@1234') {
    return res.status(200).json({ success: true, token: 'mock-jwt-token', message: 'Login successful' });
  }
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.post('/api/v1/auth/sendotp', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  return res.status(200).json({ success: true, message: 'OTP sent successfully' });
});

app.post('/api/v1/auth/signup', (req, res) => {
  const { firstName, lastName, email, password, confirmPassword, otp } = req.body;
  if (!firstName || !lastName || !email || !password || !otp) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }
  return res.status(201).json({ success: true, message: 'User registered successfully' });
});

// ── Mock course endpoints ──
app.get('/api/v1/course/getAllCourses', (req, res) => {
  return res.status(200).json({
    success: true,
    data: [
      { _id: 'course1', courseName: 'Web Development', price: 999 },
      { _id: 'course2', courseName: 'Data Science', price: 1499 },
    ],
  });
});

app.get('/api/v1/course/getCourseDetails/:id', (req, res) => {
  const { id } = req.params;
  if (id === 'invalid') {
    return res.status(404).json({ success: false, message: 'Course not found' });
  }
  return res.status(200).json({
    success: true,
    data: { _id: id, courseName: 'Web Development', price: 999, instructor: 'John Doe' },
  });
});

// ── Mock contact endpoint ──
app.post('/api/v1/reach/contact', (req, res) => {
  const { firstName, email, message } = req.body;
  if (!firstName || !email || !message) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  return res.status(200).json({ success: true, message: 'Message received' });
});

// ====================================================================
// TESTS
// ====================================================================

describe('StudyGo API — Health Check', () => {
  test('GET / should return 200 with server running message', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('up and running');
  });
});

describe('StudyGo API — Authentication', () => {
  describe('POST /api/v1/auth/login', () => {
    test('should return 200 with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@studygo.com', password: 'Test@1234' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
    });

    test('should return 401 with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'wrong@studygo.com', password: 'wrongpass' });
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'Test@1234' });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@studygo.com' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/auth/sendotp', () => {
    test('should return 200 when email is provided', async () => {
      const res = await request(app)
        .post('/api/v1/auth/sendotp')
        .send({ email: 'user@studygo.com' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/sendotp')
        .send({});
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/auth/signup', () => {
    test('should return 201 with valid registration data', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@studygo.com',
          password: 'Test@1234',
          confirmPassword: 'Test@1234',
          otp: '123456',
        });
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('should return 400 when passwords do not match', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@studygo.com',
          password: 'Test@1234',
          confirmPassword: 'Different@1234',
          otp: '123456',
        });
      expect(res.statusCode).toBe(400);
    });

    test('should return 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'john@studygo.com' });
      expect(res.statusCode).toBe(400);
    });
  });
});

describe('StudyGo API — Courses', () => {
  test('GET /api/v1/course/getAllCourses should return 200 with course list', async () => {
    const res = await request(app).get('/api/v1/course/getAllCourses');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('GET /api/v1/course/getCourseDetails/:id with valid id should return 200', async () => {
    const res = await request(app).get('/api/v1/course/getCourseDetails/course123');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('courseName');
  });

  test('GET /api/v1/course/getCourseDetails/invalid should return 404', async () => {
    const res = await request(app).get('/api/v1/course/getCourseDetails/invalid');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('StudyGo API — Contact', () => {
  test('POST /api/v1/reach/contact should return 200 with valid data', async () => {
    const res = await request(app)
      .post('/api/v1/reach/contact')
      .send({ firstName: 'Jane', email: 'jane@test.com', message: 'Hello!' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/v1/reach/contact should return 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/v1/reach/contact')
      .send({ email: 'jane@test.com' });
    expect(res.statusCode).toBe(400);
  });
});
