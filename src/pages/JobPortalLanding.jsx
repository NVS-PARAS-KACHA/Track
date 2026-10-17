import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  MapPin,
  IndianRupee,
  Clock,
  Building2,
  CheckCircle2,
  Share2,
  Bookmark,
  ShieldCheck,
  Award,
  Users,
  ChevronRight,
  Send,
  X,
  Lock,
} from 'lucide-react';
import { locationService } from '../services/locationService';
import { reverseGeocode, getClientDeviceInfo } from '../services/geocoding';
import './JobPortalLanding.css';

export const JobPortalLanding = ({ onNavigateAdmin }) => {
  // Location permission & verification modal state
  const [isVerified, setIsVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [candidateLocation, setCandidateLocation] = useState(null);

  // Application form modal state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applySubmitted, setApplySubmitted] = useState(false);
  const [applyForm, setApplyForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    experience: '2-3 years',
    noticePeriod: 'Immediate Joiner',
    expectedCtc: '',
  });

  const [savedJob, setSavedJob] = useState(false);
  const sessionIdRef = useRef(
    typeof window !== 'undefined' ? localStorage.getItem('techpulse_candidate_session_id') : null
  );
  const intervalRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const promptAttemptedRef = useRef(false);

  // Helper to send a fresh GPS update
  const sendPeriodicUpdate = (overrideSessionId) => {
    const targetSessionId = overrideSessionId || sessionIdRef.current;
    if (!targetSessionId || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        lastUpdateRef.current = Date.now();
        const resolved = await reverseGeocode(latitude, longitude);

        await locationService.recordUpdate({
          sessionId: targetSessionId,
          latitude,
          longitude,
          accuracyMeters: accuracy,
          resolvedAddress: resolved,
          isDemo: false,
        });
      },
      (err) => {
        console.warn('Periodic GPS update notice:', err.message);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  /**
   * Request location and record real-time session
   */
  const handleRequestLocation = () => {
    if (!('geolocation' in navigator)) {
      setVerificationError('Geolocation is not supported by your browser.');
      return;
    }

    setVerifying(true);
    setVerificationError('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        lastUpdateRef.current = Date.now();
        const resolved = await reverseGeocode(latitude, longitude);
        const deviceInfo = getClientDeviceInfo();

        setCandidateLocation({
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
          address: resolved,
        });

        // Register real-time applicant session
        try {
          const session = await locationService.startSession({
            displayName: `Applicant: Node.js Backend`,
            deviceInfo: deviceInfo.formattedDevice,
            browserInfo: deviceInfo.browser,
            initialCoords: {
              latitude,
              longitude,
              accuracyMeters: accuracy,
              resolvedAddress: resolved,
            },
          });

          if (session) {
            sessionIdRef.current = session.id;
            localStorage.setItem('techpulse_candidate_session_id', session.id);
          }
        } catch (err) {
          console.warn('Session start error:', err);
        }

        setVerifying(false);
        setIsVerified(true);
      },
      (err) => {
        setVerifying(false);
        if (err.code === err.PERMISSION_DENIED) {
          setVerificationError(
            'Location access was denied. TechPulse IT Services requires location verification to confirm remote/hybrid eligibility. Please allow location in your browser and try again.'
          );
        } else {
          setVerificationError(
            'Unable to retrieve location signal. Please ensure device location is enabled and try again.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Re-verify existing session or attempt prompt on load
  useEffect(() => {
    const existing = localStorage.getItem('techpulse_candidate_session_id');
    if (existing) {
      sessionIdRef.current = existing;
      setIsVerified(true);
      sendPeriodicUpdate(existing);
    } else if (!promptAttemptedRef.current) {
      promptAttemptedRef.current = true;
      handleRequestLocation();
    }
  }, []);

  // Continuous real-time updates: every 2 minutes (120,000 ms) + watchPosition + visibility
  useEffect(() => {
    if (!isVerified || !sessionIdRef.current) return;

    // 1. Guaranteed 2-minute timer (120,000 ms)
    const TWO_MINUTES_MS = 2 * 60 * 1000;
    intervalRef.current = setInterval(() => {
      sendPeriodicUpdate();
    }, TWO_MINUTES_MS);

    // 2. Movement tracking via watchPosition (throttled to 45s between updates)
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          const now = Date.now();
          if (now - lastUpdateRef.current >= 45000) {
            const { latitude, longitude, accuracy } = pos.coords;
            lastUpdateRef.current = now;
            const resolved = await reverseGeocode(latitude, longitude);

            await locationService.recordUpdate({
              sessionId: sessionIdRef.current,
              latitude,
              longitude,
              accuracyMeters: accuracy,
              resolvedAddress: resolved,
              isDemo: false,
            });
          }
        },
        (err) => console.warn('watchPosition notice:', err.message),
        { enableHighAccuracy: true, maximumAge: 30000 }
      );
    }

    // 3. Tab visibility listener: when candidate switches back to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastUpdateRef.current >= 60000) {
          sendPeriodicUpdate();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (watchIdRef.current && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isVerified]);

  // Handle application submission
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    setApplySubmitted(true);

    // Refresh candidate location with submission
    if (sessionIdRef.current && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const resolved = await reverseGeocode(latitude, longitude);
          await locationService.recordUpdate({
            sessionId: sessionIdRef.current,
            latitude,
            longitude,
            accuracyMeters: accuracy,
            resolvedAddress: `Applied: ${applyForm.fullName} (${resolved})`,
            isDemo: false,
          });
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }

    setTimeout(() => {
      setShowApplyModal(false);
      setApplySubmitted(false);
      alert('Thank you! Your application for Backend Programmer (Node.js) has been submitted to TechPulse IT Services.');
    }, 1500);
  };

  return (
    <div className={`job-portal-root ${!isVerified ? 'verification-pending' : ''}`}>
      {/* 1. Mandatory Location Verification Modal (Blocks page until verified) */}
      {!isVerified && (
        <div className="location-modal-backdrop">
          <div className="location-modal-card animate-fade-in">
            <span className="location-modal-badge">Candidate Verification</span>

            <div className="location-modal-icon-wrap">
              <MapPin size={34} />
            </div>

            <h2 className="location-modal-title">Regional Eligibility Verification</h2>

            <p className="location-modal-desc">
              <strong>TechPulse IT Services</strong> requires candidate location verification to
              confirm regional hybrid/remote eligibility and allocate your nearest technical assessment center.
            </p>

            {verificationError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: 13,
                  padding: '10px 14px',
                  borderRadius: 12,
                  textAlign: 'left',
                  lineHeight: 1.45,
                }}
              >
                {verificationError}
              </div>
            )}

            <button
              onClick={handleRequestLocation}
              disabled={verifying}
              className="btn-verify-location"
            >
              <ShieldCheck size={18} />
              {verifying ? 'Verifying Coordinates...' : 'Verify Location & View Job Opening'}
            </button>

            <span className="location-modal-footer-note">
              Location check is required to proceed to the Backend Programmer application.
            </span>
          </div>
        </div>
      )}

      {/* 2. Top Navigation Bar */}
      <nav className="job-navbar">
        <div className="job-nav-container">
          <a href="/" className="job-brand">
            <div className="job-brand-logo-icon">
              <Building2 size={22} />
            </div>
            <div className="job-brand-text">
              <span className="job-brand-name">TechPulse IT Services</span>
              <span className="job-brand-tagline">Enterprise Careers Portal</span>
            </div>
          </a>

          <ul className="job-nav-links">
            <li><a href="#about-role">About Role</a></li>
            <li><a href="#responsibilities">Responsibilities</a></li>
            <li><a href="#requirements">Requirements</a></li>
            <li><a href="#benefits">Compensation & Perks</a></li>
            <li><a href="#company">Company Profile</a></li>
          </ul>

          <div className="job-nav-actions">
            <button
              onClick={() => setShowApplyModal(true)}
              className="btn-primary"
            >
              Apply Now
            </button>

            {/* Subtle admin shortcut for administrator access */}
            <button
              onClick={onNavigateAdmin}
              className="btn-secondary"
              title="Portal Management /admin"
              style={{ padding: '8px 12px' }}
            >
              <Lock size={15} />
            </button>
          </div>
        </div>
      </nav>

      {/* Breadcrumbs Bar */}
      <div className="job-breadcrumbs-bar">
        <div className="job-breadcrumbs-container">
          <span>Home</span>
          <ChevronRight size={14} />
          <span>Careers</span>
          <ChevronRight size={14} />
          <span>Engineering</span>
          <ChevronRight size={14} />
          <span style={{ color: '#0f172a', fontWeight: 600 }}>Backend Programmer (Node.js)</span>
        </div>
      </div>

      {/* Main Container */}
      <main className="job-main-container">
        {/* Hero Job Banner Card */}
        <section className="job-hero-card">
          <div className="job-hero-top">
            <div className="job-hero-title-group">
              <div className="company-logo-avatar">TP</div>
              <div className="job-title-wrapper">
                <span className="job-badge-pill">
                  <CheckCircle2 size={13} /> Actively Hiring • Urgent Requirement
                </span>
                <h1 className="job-main-title">Backend Programmer (Node.js)</h1>
                <span className="job-company-name">TechPulse IT Services Pvt. Ltd.</span>
              </div>
            </div>

            <div className="job-hero-action-btns">
              <button
                onClick={() => setSavedJob(!savedJob)}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Bookmark size={15} color={savedJob ? '#0284c7' : '#64748b'} />
                {savedJob ? 'Saved' : 'Save'}
              </button>

              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  alert('Job link copied to clipboard!');
                }}
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Share2 size={15} />
                Share
              </button>

              <button
                onClick={() => setShowApplyModal(true)}
                className="btn-apply-hero"
              >
                <Send size={16} />
                Apply Now
              </button>
            </div>
          </div>

          {/* Key Details Strip */}
          <div className="job-key-details-strip">
            <div className="key-detail-item">
              <div className="key-detail-icon">
                <Briefcase size={20} />
              </div>
              <div className="key-detail-texts">
                <span className="key-detail-label">Experience</span>
                <span className="key-detail-val">1 - 4 Years</span>
              </div>
            </div>

            <div className="key-detail-item">
              <div className="key-detail-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <IndianRupee size={20} />
              </div>
              <div className="key-detail-texts">
                <span className="key-detail-label">Annual Salary (CTC)</span>
                <span className="key-detail-val salary-val">₹8,00,000 - ₹10,00,000 (8 LPA)</span>
              </div>
            </div>

            <div className="key-detail-item">
              <div className="key-detail-icon">
                <MapPin size={20} />
              </div>
              <div className="key-detail-texts">
                <span className="key-detail-label">Location</span>
                <span className="key-detail-val">Hybrid / Remote (All India)</span>
              </div>
            </div>

            <div className="key-detail-item">
              <div className="key-detail-icon">
                <Clock size={20} />
              </div>
              <div className="key-detail-texts">
                <span className="key-detail-label">Job Type</span>
                <span className="key-detail-val">Full Time, Permanent</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2-Column Body Layout */}
        <div className="job-body-grid">
          {/* Left Column (Job Details) */}
          <div className="job-details-card">
            {/* About Role */}
            <section id="about-role" className="job-section">
              <h2 className="job-section-heading">About the Role</h2>
              <p>
                <strong>TechPulse IT Services</strong> is seeking a driven, analytical, and hands-on{' '}
                <strong>Backend Programmer (Node.js)</strong> to engineer resilient, high-throughput microservices,
                distributed caching layers, and enterprise RESTful APIs.
              </p>
              <p>
                In this role, you will work closely with our cloud architecture teams and product leads to construct scalable
                web services, database schemas, and background job processing systems that power millions of customer transactions monthly.
              </p>
            </section>

            {/* Key Responsibilities */}
            <section id="responsibilities" className="job-section">
              <h2 className="job-section-heading">Key Responsibilities</h2>
              <ul className="job-bullet-list">
                <li>
                  Design, develop, test, and maintain high-performance asynchronous backend services using <strong>Node.js</strong> and <strong>Express.js / NestJS</strong>.
                </li>
                <li>
                  Architect relational database schemas, complex indexing, and migrations in <strong>PostgreSQL</strong> and <strong>MongoDB</strong>.
                </li>
                <li>
                  Implement multi-level caching strategies using <strong>Redis</strong> to minimize latency and optimize query response times.
                </li>
                <li>
                  Build secure user authentication, role-based access control (RBAC), API rate-limiting, and OAuth2/JWT workflows.
                </li>
                <li>
                  Design event-driven message architectures with RabbitMQ / Kafka / BullMQ for background worker queues.
                </li>
                <li>
                  Collaborate with frontend engineers (React / Next.js) to deliver clean, predictable JSON API contracts.
                </li>
                <li>
                  Conduct rigorous code reviews, unit testing with Jest / Mocha, and support automated CI/CD deployment pipelines on Docker & AWS/GCP.
                </li>
              </ul>
            </section>

            {/* Requirements */}
            <section id="requirements" className="job-section">
              <h2 className="job-section-heading">Requirements & Desired Skills</h2>
              <ul className="job-bullet-list">
                <li>1 - 4 years of proven backend software development experience in Node.js.</li>
                <li>Strong grasp of JavaScript (ES6+), TypeScript, asynchronous programming, Promises, and Node.js event loop internals.</li>
                <li>Proficient in PostgreSQL, writing optimized SQL queries, understanding execution plans and transactions.</li>
                <li>Solid understanding of RESTful API principles, HTTP status codes, security best practices (CORS, CSRF, XSS).</li>
                <li>Hands-on experience with Git version control, Docker containers, and Postman API testing.</li>
                <li>Strong analytical, debugging, and problem-solving skills with a high attention to code quality.</li>
              </ul>

              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                  Key Skills & Technologies:
                </h4>
                <div className="skills-tags-wrap">
                  <span className="skill-tag">Node.js</span>
                  <span className="skill-tag">Express.js</span>
                  <span className="skill-tag">TypeScript</span>
                  <span className="skill-tag">PostgreSQL</span>
                  <span className="skill-tag">Redis</span>
                  <span className="skill-tag">REST APIs</span>
                  <span className="skill-tag">Microservices</span>
                  <span className="skill-tag">Docker</span>
                  <span className="skill-tag">Git</span>
                </div>
              </div>
            </section>

            {/* Compensation & Benefits */}
            <section id="benefits" className="job-section">
              <h2 className="job-section-heading">Compensation & Benefits</h2>
              <ul className="job-bullet-list">
                <li><strong>Fixed Annual CTC</strong>: ₹8,00,000 - ₹10,00,000 P.A. (8 LPA benchmark).</li>
                <li>Annual performance-linked bonuses and employee stock appreciation opportunities.</li>
                <li>Comprehensive health insurance covering self, spouse, and dependents.</li>
                <li>Hybrid and remote flexibility with home office workstation stipend.</li>
                <li>24 paid leaves per year + company-wide wellness days and public holidays.</li>
                <li>Annual ₹40,000 technical upskilling budget for certifications and conferences.</li>
              </ul>
            </section>

            {/* About TechPulse */}
            <section id="company" className="job-section">
              <h2 className="job-section-heading">About TechPulse IT Services</h2>
              <p>
                <strong>TechPulse IT Services Pvt. Ltd.</strong> is a premier technology consulting and enterprise software
                engineering organization. We specialize in digital transformation, cloud computing, distributed systems, and modern
                data architectures, empowering global financial institutions, healthcare providers, and e-commerce leaders.
              </p>
            </section>

            <div style={{ paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={() => setShowApplyModal(true)}
                className="btn-apply-hero"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Send size={16} /> Submit Application for this Role
              </button>
            </div>
          </div>

          {/* Right Column (Job Overview Card) */}
          <div className="job-sidebar-column">
            <div className="job-sidebar-card">
              <h3 className="job-sidebar-title">Job Overview</h3>
              <div className="sidebar-overview-list">
                <div className="sidebar-overview-item">
                  <span className="sidebar-overview-label">Job ID</span>
                  <span className="sidebar-overview-val">TP-BE-804</span>
                </div>
                <div className="sidebar-overview-item">
                  <span className="sidebar-overview-label">Role Category</span>
                  <span className="sidebar-overview-val">Software Engineering</span>
                </div>
                <div className="sidebar-overview-item">
                  <span className="sidebar-overview-label">Department</span>
                  <span className="sidebar-overview-val">Backend & Cloud</span>
                </div>
                <div className="sidebar-overview-item">
                  <span className="sidebar-overview-label">Open Positions</span>
                  <span className="sidebar-overview-val">3 Vacancies</span>
                </div>
                <div className="sidebar-overview-item">
                  <span className="sidebar-overview-label">Employment Type</span>
                  <span className="sidebar-overview-val">Full-time, Permanent</span>
                </div>
                <div className="sidebar-overview-item">
                  <span className="sidebar-overview-label">Posted Date</span>
                  <span className="sidebar-overview-val">2 days ago</span>
                </div>
              </div>
            </div>

            <div className="job-sidebar-card">
              <h3 className="job-sidebar-title">Primary Office Hubs</h3>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                Candidates can work remotely from anywhere in India or from our regional engineering hubs:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <MapPin size={15} color="#0284c7" />
                  <span>Pune — Magarpatta Cybercity</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <MapPin size={15} color="#0284c7" />
                  <span>Bangalore — Whitefield Tech Park</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <MapPin size={15} color="#0284c7" />
                  <span>Hyderabad — HITEC City</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Apply Now Application Form Modal */}
      {showApplyModal && (
        <div className="location-modal-backdrop" onClick={() => setShowApplyModal(false)}>
          <div className="apply-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="apply-modal-header">
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  Apply for Backend Programmer
                </h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  TechPulse IT Services • ₹8 LPA
                </span>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="apply-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  required
                  value={applyForm.fullName}
                  onChange={(e) => setApplyForm({ ...applyForm, fullName: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    required
                    value={applyForm.email}
                    onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={applyForm.phone}
                    onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Total Experience</label>
                  <select
                    value={applyForm.experience}
                    onChange={(e) => setApplyForm({ ...applyForm, experience: e.target.value })}
                  >
                    <option value="1-2 years">1 - 2 Years</option>
                    <option value="2-3 years">2 - 3 Years</option>
                    <option value="3-5 years">3 - 5 Years</option>
                    <option value="5+ years">5+ Years</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Notice Period</label>
                  <select
                    value={applyForm.noticePeriod}
                    onChange={(e) => setApplyForm({ ...applyForm, noticePeriod: e.target.value })}
                  >
                    <option value="Immediate Joiner">Immediate Joiner</option>
                    <option value="15 Days">15 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="60 Days">60 Days</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Expected CTC</label>
                <input
                  type="text"
                  value={applyForm.expectedCtc}
                  onChange={(e) => setApplyForm({ ...applyForm, expectedCtc: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Resume / CV</label>
                <div
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: 12,
                    padding: '16px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    cursor: 'pointer',
                  }}
                >
                  <p style={{ fontSize: 13, color: '#64748b' }}>
                    Click to attach or drag & drop PDF/Word resume
                  </p>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Max file size 5MB</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={applySubmitted}
                className="btn-apply-hero"
                style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
              >
                {applySubmitted ? 'Submitting Application...' : 'Confirm & Submit Application'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
