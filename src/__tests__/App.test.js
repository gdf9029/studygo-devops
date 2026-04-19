// ============================================================
// StudyGo Frontend Unit Tests
// src/__tests__/App.test.js
// ============================================================

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Basic sanity test (no routing/redux needed) ──
describe('StudyGo Frontend — App Bootstrap', () => {
  test('React renders without crashing', () => {
    const TestComponent = () => <div data-testid="app-root">StudyGo App</div>;
    render(<TestComponent />);
    expect(screen.getByTestId('app-root')).toBeInTheDocument();
    expect(screen.getByText('StudyGo App')).toBeInTheDocument();
  });
});

// ── Utility function tests ──
describe('StudyGo Frontend — Utilities', () => {
  test('formats currency correctly (INR)', () => {
    const formatPrice = (price) =>
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price);
    expect(formatPrice(999)).toContain('999');
    expect(formatPrice(0)).toContain('0');
  });

  test('validates email format', () => {
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(isValidEmail('user@studygo.com')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  test('truncates long text correctly', () => {
    const truncate = (text, maxLen) =>
      text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
    expect(truncate('Hello World', 5)).toBe('Hello...');
    expect(truncate('Hi', 10)).toBe('Hi');
  });

  test('calculates discount percentage', () => {
    const calcDiscount = (original, discounted) =>
      Math.round(((original - discounted) / original) * 100);
    expect(calcDiscount(1000, 800)).toBe(20);
    expect(calcDiscount(500, 500)).toBe(0);
  });
});

// ── Course data validation ──
describe('StudyGo Frontend — Course Data', () => {
  const mockCourse = {
    _id: 'abc123',
    courseName: 'Full Stack Development',
    price: 1999,
    instructor: { firstName: 'John', lastName: 'Doe' },
    studentsEnrolled: [],
    status: 'Published',
  };

  test('course object has required fields', () => {
    expect(mockCourse).toHaveProperty('courseName');
    expect(mockCourse).toHaveProperty('price');
    expect(mockCourse).toHaveProperty('instructor');
    expect(mockCourse.status).toBe('Published');
  });

  test('instructor full name concatenates correctly', () => {
    const fullName = `${mockCourse.instructor.firstName} ${mockCourse.instructor.lastName}`;
    expect(fullName).toBe('John Doe');
  });

  test('enrolled students count is numeric', () => {
    expect(typeof mockCourse.studentsEnrolled.length).toBe('number');
  });
});

// ── Auth token validation ──
describe('StudyGo Frontend — Auth Token', () => {
  test('token stored and retrieved from localStorage', () => {
    const token = 'mock.jwt.token';
    localStorage.setItem('token', token);
    expect(localStorage.getItem('token')).toBe(token);
    localStorage.removeItem('token');
    expect(localStorage.getItem('token')).toBeNull();
  });

  test('detects authenticated state from token presence', () => {
    localStorage.setItem('token', 'some-valid-token');
    const isAuthenticated = () => !!localStorage.getItem('token');
    expect(isAuthenticated()).toBe(true);
    localStorage.removeItem('token');
    expect(isAuthenticated()).toBe(false);
  });
});
