import React, { useEffect } from 'react';

const TermsAndConditions = () => {
  useEffect(() => {
    document.title = 'Terms and Conditions - OfficialWABA';
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: '#1e293b',
      padding: '40px 20px',
      lineHeight: '1.7'
    }}>
      <div style={{
        maxWidth: '920px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
        padding: '48px 40px',
        border: '1px solid #e2e8f0'
      }}>
        {/* Page Header */}
        <div style={{ borderBottom: '2px solid #f1f5f9', pb: '24px', marginBottom: '32px' }}>
          <span style={{
            background: '#e0e7ff',
            color: '#4338ca',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '13px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Legal Document
          </span>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '800',
            color: '#0f172a',
            marginTop: '16px',
            marginBottom: '8px'
          }}>
            TERMS AND CONDITIONS
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0' }}>
            <strong>Last Updated:</strong> July 31, 2026
          </p>
        </div>

        {/* Business Context Box */}
        <div style={{
          backgroundColor: '#f1f5f9',
          borderRadius: '10px',
          padding: '20px 24px',
          marginBottom: '32px',
          borderLeft: '4px solid #4f46e5',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '6px' }}><strong>Website:</strong> <a href="https://www.officialwaba.in" target="_blank" rel="noreferrer" style={{ color: '#4f46e5', textDecoration: 'none' }}>www.officialwaba.in</a></div>
          <div style={{ marginBottom: '6px' }}><strong>Operated by:</strong> UV Digital Solution</div>
          <div style={{ marginBottom: '6px' }}><strong>Registered Office:</strong> 622 Hilltown Landmark, Opp. Das Khaman, Nikol-Naroda Road, Ahmedabad, Gujarat, India</div>
          <div><strong>Support Email:</strong> <a href="mailto:support@officialwaba.in" style={{ color: '#4f46e5' }}>support@officialwaba.in</a></div>
        </div>

        {/* Section Content */}
        <div className="terms-content" style={{ fontSize: '15px' }}>
          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>1. Acceptance of Terms</h2>
            <p style={{ color: '#334155' }}>
              By registering for or using the <strong>officialwaba.in</strong> Platform ("Platform", "Service"), you ("Client", "you") agree to be bound by these Terms and Conditions. If you do not agree, do not use the Platform.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>2. Description of Service</h2>
            <p style={{ color: '#334155' }}>
              <strong>officialwaba.in</strong> is a WhatsApp Business Platform Tech Provider solution that enables businesses to connect their own WhatsApp Business Account (WABA), via Meta's official Embedded Signup process, and to send/receive WhatsApp messages, manage templates, and view delivery analytics through our dashboard.
            </p>
            <p style={{ color: '#334155' }}>
              We act solely as a technology facilitator. We are not a party to, and do not control, the content of messages exchanged between Clients and their end customers.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>3. Eligibility and Account Registration</h2>
            <ul style={{ paddingLeft: '20px', color: '#334155' }}>
              <li>You must be a legally registered business or authorized representative thereof to use this Platform</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials</li>
              <li>You must provide accurate business information during onboarding, as required by Meta's Business Verification process</li>
            </ul>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>4. Client Responsibilities</h2>
            <p style={{ color: '#334155' }}>By using the Platform, you agree that you will:</p>
            <ul style={{ paddingLeft: '20px', color: '#334155' }}>
              <li>Only message end customers who have provided valid, verifiable opt-in consent</li>
              <li>Comply with WhatsApp's Business Messaging Policy, Commerce Policy, and all applicable Meta Platform Terms</li>
              <li>Comply with Indian laws including the Information Technology Act, 2000, TRAI regulations, and Consumer Protection Act, 2019 (for promotional/marketing messages)</li>
              <li>Not use the Platform to send spam, unsolicited bulk messages, misleading content, or content that violates Meta's policies</li>
              <li>Not use the Platform for any unlawful, fraudulent, or harmful purpose</li>
              <li>Immediately notify us of any unauthorized use of your account</li>
            </ul>
            <p style={{ color: '#991b1b', background: '#fee2e2', padding: '12px 16px', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '14px', marginTop: '12px' }}>
              ⚠️ Violation of these responsibilities may result in suspension or termination of your account, and may also result in Meta restricting or banning your WhatsApp Business Account, for which UV Digital Solution shall not be held liable.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>5. Fees and Payment</h2>
            <ul style={{ paddingLeft: '20px', color: '#334155' }}>
              <li>Platform access is provided on a subscription and/or per-message billing basis, as agreed at the time of onboarding</li>
              <li>All fees are exclusive of applicable taxes (GST) unless stated otherwise</li>
              <li>Fees are payable in advance/as per the agreed billing cycle; non-payment may result in suspension of service</li>
              <li>Message-level charges billed by Meta (WhatsApp conversation-based pricing) are separate from, and in addition to, our platform fees, and are the Client's responsibility</li>
            </ul>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>6. Data Ownership</h2>
            <p style={{ color: '#334155' }}>
              WhatsApp Business Accounts (WABAs) created through Embedded Signup belong to the Client, not to UV Digital Solution. Clients retain full ownership of their WABA and associated customer data, and may access it directly through Meta's WhatsApp Manager at any time.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>7. Intellectual Property</h2>
            <p style={{ color: '#334155' }}>
              All software, design, branding, and content of the Platform (excluding Client-uploaded content and Meta's own trademarks/technology) are the property of UV Digital Solution and may not be copied, reproduced, or distributed without written permission.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>8. Third-Party Services</h2>
            <p style={{ color: '#334155' }}>
              The Platform relies on Meta's WhatsApp Business Platform and API. We are not responsible for outages, policy changes, rate limit changes, or account restrictions imposed directly by Meta Platforms, Inc. Continued availability of certain features is subject to Meta's ongoing approval and policies.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>9. Limitation of Liability</h2>
            <p style={{ color: '#334155' }}>To the maximum extent permitted by applicable law, UV Digital Solution shall not be liable for:</p>
            <ul style={{ paddingLeft: '20px', color: '#334155' }}>
              <li>Any indirect, incidental, or consequential damages arising from use of the Platform</li>
              <li>Loss of business, revenue, or data resulting from WhatsApp/Meta service interruptions, account suspensions, or policy enforcement actions</li>
              <li>Actions taken by Meta Platforms, Inc. against a Client's WABA due to the Client's non-compliance with WhatsApp policies</li>
            </ul>
            <p style={{ color: '#334155' }}>
              Our total liability, in any circumstance, shall not exceed the fees paid by the Client to us in the <strong>3 months</strong> preceding the claim.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>10. Indemnification</h2>
            <p style={{ color: '#334155' }}>
              You agree to indemnify and hold harmless UV Digital Solution, its owners, and employees from any claims, damages, or liabilities arising from your use of the Platform, your violation of these Terms, or your violation of any third-party rights (including end-customer consent violations).
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>11. Termination</h2>
            <p style={{ color: '#334155' }}>
              We reserve the right to suspend or terminate your access to the Platform, with or without notice, for violation of these Terms, non-payment, or misuse that risks the Platform's standing with Meta. You may terminate your account at any time by providing written notice.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>12. Governing Law and Jurisdiction</h2>
            <p style={{ color: '#334155' }}>
              These Terms shall be governed by the laws of India. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of <strong>Ahmedabad, Gujarat</strong>.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>13. Changes to Terms</h2>
            <p style={{ color: '#334155' }}>
              We may revise these Terms from time to time. Continued use of the Platform after changes are posted constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>14. Contact Information</h2>
            <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
              <strong>UV Digital Solution</strong><br />
              622 Hilltown Landmark, Opp. Das Khaman, Nikol-Naroda Road, Ahmedabad, Gujarat, India<br />
              Email: <a href="mailto:support@officialwaba.in" style={{ color: '#4f46e5' }}>support@officialwaba.in</a><br />
              Websites: <a href="https://www.uvdigitalsolution.com" target="_blank" rel="noreferrer" style={{ color: '#4f46e5' }}>www.uvdigitalsolution.com</a> | <a href="https://www.officialwaba.in" target="_blank" rel="noreferrer" style={{ color: '#4f46e5' }}>www.officialwaba.in</a>
            </div>
          </section>
        </div>

        {/* Footer Link */}
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
          © {new Date().getFullYear()} officialwaba.in - UV Digital Solution. All rights reserved. | <a href="/privacy-policy" style={{ color: '#4f46e5', textDecoration: 'none' }}>Privacy Policy</a>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
