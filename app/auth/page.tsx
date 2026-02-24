'use client';

import { useState, useEffect } from 'react';
import { loginWithEmail, signUpWithEmail } from '../../src/services/auth-service';

const ACCENT_COLOR = '#00ffb4';
const BG_COLOR = '#080808';
const BORDER_COLOR = 'rgba(0,255,180,0.08)';

function GridBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,255,180,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,180,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '800px',
          height: '800px',
          background: 'radial-gradient(circle, rgba(0,255,160,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function Cursor() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setIsVisible((v) => !v), 530);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      style={{
        display: 'inline-block',
        width: '2px',
        height: '1em',
        background: ACCENT_COLOR,
        marginLeft: '4px',
        verticalAlign: 'middle',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.1s',
      }}
    />
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setIsPageLoaded(true), 100);
    const t2 = setTimeout(() => setIsFormVisible(true), 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  async function handleFormSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (isRegisterMode) {
        await signUpWithEmail(email, password);
        setSuccessMessage('Account created. Check your email to confirm, then log in.');
        setIsRegisterMode(false);
      } else {
        await loginWithEmail(email, password);
        window.location.href = '/';
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleToggleMode() {
    setIsRegisterMode((prev) => !prev);
    setErrorMessage('');
    setSuccessMessage('');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG_COLOR,
        color: '#e0e0e0',
        fontFamily: 'monospace',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <GridBackground />

      {/* Top status bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '40px',
          borderBottom: `1px solid ${BORDER_COLOR}`,
          background: 'rgba(8,8,8,0.9)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 32px',
          zIndex: 100,
          opacity: isPageLoaded ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: ACCENT_COLOR,
              boxShadow: `0 0 8px ${ACCENT_COLOR}`,
            }}
          />
          <span
            style={{
              fontSize: '10px',
              letterSpacing: '0.2em',
              color: '#444',
              textTransform: 'uppercase',
            }}
          >
            EVAC-SIM v1.0 — AUTH
          </span>
        </div>
      </div>

      {/* Login card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '400px',
          padding: '0 24px',
          opacity: isFormVisible ? 1 : 0,
          transform: isFormVisible ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}
      >
        {/* System label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div style={{ width: '32px', height: '1px', background: ACCENT_COLOR }} />
          <span
            style={{
              fontSize: '10px',
              letterSpacing: '0.3em',
              color: ACCENT_COLOR,
              textTransform: 'uppercase',
            }}
          >
            Authentication Required
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '32px',
            fontWeight: '800',
            lineHeight: '1.0',
            letterSpacing: '-0.03em',
            color: '#f0f0f0',
            fontFamily: 'monospace',
            marginBottom: '12px',
          }}
        >
          SYSTEM <span style={{ color: ACCENT_COLOR }}>{isRegisterMode ? 'REGISTER' : 'LOGIN'}</span>
          <Cursor />
        </h1>
        <p
          style={{
            fontSize: '12px',
            color: '#444',
            letterSpacing: '0.08em',
            lineHeight: '1.8',
            marginBottom: '40px',
          }}
        >
          {isRegisterMode
            ? 'Create an account to access the evacuation simulation platform.'
            : 'Enter credentials to access the evacuation simulation platform.'}
        </p>

        {/* Form */}
        <form onSubmit={handleFormSubmit}>
          {/* Email field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="EMAIL_INPUT"
              style={{
                display: 'block',
                fontSize: '10px',
                letterSpacing: '0.15em',
                color: '#666',
                textTransform: 'uppercase',
                marginBottom: '8px',
                fontFamily: 'monospace',
              }}
            >
              Email
            </label>
            <input
              id="EMAIL_INPUT"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '2px',
                color: '#e0e0e0',
                fontFamily: 'monospace',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Password field */}
          <div style={{ marginBottom: '32px' }}>
            <label
              htmlFor="PASSWORD_INPUT"
              style={{
                display: 'block',
                fontSize: '10px',
                letterSpacing: '0.15em',
                color: '#666',
                textTransform: 'uppercase',
                marginBottom: '8px',
                fontFamily: 'monospace',
              }}
            >
              Password
            </label>
            <input
              id="PASSWORD_INPUT"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '2px',
                color: '#e0e0e0',
                fontFamily: 'monospace',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Error message */}
          {errorMessage && (
            <div
              style={{
                marginBottom: '20px',
                padding: '12px 16px',
                background: 'rgba(255,60,60,0.06)',
                border: '1px solid rgba(255,60,60,0.2)',
                borderRadius: '2px',
                color: '#ff6b6b',
                fontSize: '11px',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Success message */}
          {successMessage && (
            <div
              style={{
                marginBottom: '20px',
                padding: '12px 16px',
                background: 'rgba(0,255,180,0.06)',
                border: `1px solid ${ACCENT_COLOR}33`,
                borderRadius: '2px',
                color: ACCENT_COLOR,
                fontSize: '11px',
                fontFamily: 'monospace',
                letterSpacing: '0.05em',
              }}
            >
              {successMessage}
            </div>
          )}

          {/* Submit button */}
          <button
            id="SUBMIT_BUTTON"
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px',
              background: isLoading ? 'rgba(0,255,180,0.1)' : 'rgba(0,255,180,0.08)',
              border: `1px solid ${ACCENT_COLOR}33`,
              borderRadius: '2px',
              color: ACCENT_COLOR,
              fontFamily: 'monospace',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            {isLoading
              ? (isRegisterMode ? 'REGISTERING...' : 'AUTHENTICATING...')
              : (isRegisterMode ? 'CREATE ACCOUNT' : 'INITIALIZE SESSION')}
          </button>
        </form>

        {/* Toggle login / register */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleToggleMode}
            style={{
              background: 'none',
              border: 'none',
              color: '#555',
              fontFamily: 'monospace',
              fontSize: '11px',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              transition: 'color 0.2s ease',
            }}
          >
            {isRegisterMode ? '← BACK TO LOGIN' : 'NO ACCOUNT? REGISTER →'}
          </button>
        </div>

        {/* Bottom divider */}
        <div
          style={{
            marginTop: '40px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: '20px',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: '9px',
              color: '#2a2a2a',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            Software Engineering Project © 2025
          </span>
        </div>
      </div>
    </div>
  );
}
