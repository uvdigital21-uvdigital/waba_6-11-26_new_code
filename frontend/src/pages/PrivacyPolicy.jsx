import React, { useEffect } from 'react';

const PrivacyPolicy = () => {
  useEffect(() => {
    document.title = 'Privacy Policy - OfficialWABA';
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
            PRIVACY POLICY
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
          <div style={{ marginBottom: '6px' }}><strong>Contact Email:</strong> <a href="mailto:privacy@officialwaba.in" style={{ color: '#4f46e5' }}>privacy@officialwaba.in</a></div>
          <div><strong>Contact Phone:</strong> +91 90544 46244</div>
        </div>

        {/* Section Content */}
        <div className="policy-content" style={{ fontSize: '15px' }}>
          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>1. Introduction</h2>
            <p style={{ color: '#334155' }}>
              <strong>officialwaba.in</strong> ("we", "us", "our", "the Platform") is a WhatsApp Business Platform Tech Provider solution operated by <strong>UV Digital Solution</strong>. This Privacy Policy explains how we collect, use, store, and protect information when businesses ("Clients") use our platform to connect their WhatsApp Business Account (WABA) and communicate with their own customers.
            </p>
            <p style={{ color: '#334155' }}>
              By using our Platform, you agree to the practices described in this Privacy Policy.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>2. Information We Collect</h2>
            
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#334155', marginTop: '16px', marginBottom: '8px' }}>2.1 Information from Clients (Businesses using our platform)</h3>
            <ul style={{ paddingLeft: '20px', color: '#334155', margin: '0 0 16px 0' }}>
              <li>Business name, contact person name, email address, and phone number</li>
              <li>Business registration/verification details (as required by Meta for WhatsApp Business verification)</li>
              <li>WhatsApp Business Account (WABA) ID and phone number ID (generated via Meta's Embedded Signup)</li>
              <li>Login credentials for platform access</li>
              <li>Billing and payment information (processed via Razorpay / payment gateway)</li>
              <li>Usage data: message templates created, campaign schedules, delivery/read status analytics</li>
            </ul>

            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#334155', marginTop: '16px', marginBottom: '8px' }}>2.2 Information We Do NOT Access</h3>
            <p style={{ color: '#334155' }}>
              We do not access, view, read, store, or process the actual content of conversations between our Clients and their end customers. All WhatsApp message content flows directly between the Client's WABA and their customers through Meta's WhatsApp Business Platform infrastructure. Our Platform only facilitates the technical connection and displays aggregate delivery/read status to the Client for their own account.
            </p>

            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#334155', marginTop: '16px', marginBottom: '8px' }}>2.3 Automatically Collected Information</h3>
            <ul style={{ paddingLeft: '20px', color: '#334155', margin: '0' }}>
              <li>IP address, browser type, device information</li>
              <li>Log data (login timestamps, pages visited within the dashboard)</li>
              <li>Cookies for session management and platform functionality</li>
            </ul>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>3. How We Use Information</h2>
            <p style={{ color: '#334155' }}>We use collected information to:</p>
            <ul style={{ paddingLeft: '20px', color: '#334155' }}>
              <li>Provide, operate, and maintain the Platform</li>
              <li>Facilitate WhatsApp Business Account connection via Meta's Embedded Signup</li>
              <li>Process billing and send service-related communications</li>
              <li>Verify business identity as required by Meta's Tech Provider policies</li>
              <li>Improve platform features and troubleshoot technical issues</li>
              <li>Comply with legal obligations under Indian law and Meta's Platform Terms</li>
            </ul>
            <p style={{ color: '#334155', fontWeight: '600' }}>
              We do NOT sell, rent, or trade any Client or end-customer data to third parties for marketing purposes.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>4. Sharing of Information</h2>
            <p style={{ color: '#334155' }}>We may share information only in the following circumstances:</p>
            <ul style={{ paddingLeft: '20px', color: '#334155' }}>
              <li><strong>With Meta Platforms, Inc.</strong> — as required to provide WhatsApp Business API connectivity (inherent to WhatsApp Business Platform operation)</li>
              <li><strong>With payment processors</strong> — to complete billing transactions</li>
              <li><strong>With law enforcement or regulators</strong> — when required by applicable Indian law or valid legal process</li>
              <li><strong>With service providers</strong> — who assist us in operating the platform (hosting, analytics), under strict confidentiality obligations</li>
            </ul>
            <p style={{ color: '#334155' }}>
              We do not share Client customer data with any third party for advertising purposes.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>5. Data Storage and Security</h2>
            <ul style={{ paddingLeft: '20px', color: '#334155' }}>
              <li>Data is stored on secure servers with industry-standard encryption (in transit via HTTPS/TLS, and at rest where applicable)</li>
              <li>Access to Client account data is restricted to authorized UV Digital Solution personnel only, on a need-to-know basis</li>
              <li>We implement reasonable technical and organizational measures to protect against unauthorized access, alteration, disclosure, or destruction of data</li>
              <li>Access tokens (System User tokens) used to connect to Meta's API are stored in encrypted form</li>
            </ul>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>6. Data Retention</h2>
            <p style={{ color: '#334155' }}>
              We retain Client account information for as long as the account remains active, and for a reasonable period thereafter to comply with legal, accounting, or reporting obligations. Clients may request deletion of their data at any time.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>7. Data Deletion</h2>
            <p style={{ color: '#334155' }}>
              Clients (and, where applicable, their end customers) may request deletion of their personal data associated with our Platform by:
            </p>
            <ul style={{ paddingLeft: '20px', color: '#334155' }}>
              <li>Emailing <a href="mailto:privacy@officialwaba.in" style={{ color: '#4f46e5' }}>privacy@officialwaba.in</a> with the subject line "Data Deletion Request"</li>
              <li>Using the in-platform "Delete My Account" option (if available)</li>
            </ul>
            <p style={{ color: '#334155' }}>
              Upon a verified request, we will delete or anonymize the requester's personal data from our systems within <strong>30 days</strong>, except where retention is required by law. Note: deletion of data from our Platform does not automatically delete data held directly by Meta Platforms, Inc.; such requests should also be directed to Meta via their own data deletion channels.
            </p>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', marginTop: '12px' }}>
              <strong>Data Deletion Callback Endpoint:</strong> <a href="https://www.officialwaba.in/data-deletion" target="_blank" rel="noreferrer" style={{ color: '#4f46e5' }}>https://www.officialwaba.in/data-deletion</a>
            </div>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>8. Client and End-Customer Consent</h2>
            <p style={{ color: '#334155' }}>
              Our Clients are solely responsible for obtaining valid opt-in consent from their own customers before sending them WhatsApp messages through our Platform, in accordance with WhatsApp's Business Messaging Policy and applicable Indian regulations (including TRAI guidelines). End customers may opt out at any time by replying "STOP" or through any opt-out mechanism provided by the Client.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>9. Children's Privacy</h2>
            <p style={{ color: '#334155' }}>
              Our Platform is intended for use by businesses and is not directed at individuals under the age of 18. We do not knowingly collect personal information from minors.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>10. Cookies</h2>
            <p style={{ color: '#334155' }}>
              We use cookies to maintain login sessions and improve platform usability. You may disable cookies through your browser settings, though this may affect Platform functionality.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>11. Your Rights</h2>
            <p style={{ color: '#334155' }}>Subject to applicable Indian law, you have the right to:</p>
            <ul style={{ paddingLeft: '20px', color: '#334155' }}>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Withdraw consent for data processing (where applicable)</li>
            </ul>
            <p style={{ color: '#334155' }}>
              To exercise these rights, contact us at <a href="mailto:privacy@officialwaba.in" style={{ color: '#4f46e5' }}>privacy@officialwaba.in</a>.
            </p>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>12. Grievance Officer</h2>
            <p style={{ color: '#334155' }}>
              In accordance with the Information Technology Act, 2000 and rules made thereunder, the Grievance Officer for this Platform is:
            </p>
            <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
              <div><strong>Name:</strong> Grievance Officer</div>
              <div><strong>Email:</strong> <a href="mailto:grievance@officialwaba.in" style={{ color: '#4f46e5' }}>grievance@officialwaba.in</a></div>
              <div><strong>Address:</strong> 622 Hilltown Landmark, Opp. Das Khaman, Nikol-Naroda Road, Ahmedabad, Gujarat, India</div>
            </div>
          </section>

          <section style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>13. Changes to This Policy</h2>
            <p style={{ color: '#334155' }}>
              We may update this Privacy Policy from time to time. Material changes will be notified via email or a notice on our Platform. Continued use of the Platform after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>14. Contact Us</h2>
            <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px' }}>
              <strong>UV Digital Solution</strong><br />
              Email: <a href="mailto:privacy@officialwaba.in" style={{ color: '#4f46e5' }}>privacy@officialwaba.in</a><br />
              Address: 622 Hilltown Landmark, Opp. Das Khaman, Nikol-Naroda Road, Ahmedabad, Gujarat, India
            </div>
          </section>
        </div>

        {/* Footer Link */}
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
          © {new Date().getFullYear()} officialwaba.in - UV Digital Solution. All rights reserved. | <a href="/terms-and-conditions" style={{ color: '#4f46e5', textDecoration: 'none' }}>Terms & Conditions</a>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
