import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPublicDir = path.resolve(__dirname, '../dist-public');
const templatePath = path.join(distPublicDir, 'index.html');

if (!fs.existsSync(templatePath)) {
  console.error('Template dist-public/index.html not found! Run build:web:public first.');
  process.exit(1);
}

const templateHtml = fs.readFileSync(templatePath, 'utf8');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function injectIntoTemplate(html, { title, description, canonical, bodyContent, image }) {
  const safeTitle = (title || '').replace(/"/g, '&quot;');
  const safeDesc = (description || '').replace(/"/g, '&quot;');
  const previewImg = image || 'https://udfonline.in/pwa-512x512.png';

  // Title
  html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle}</title>`);
  // Description
  html = html.replace(/<meta name="description"\s+content=".*?">/, `<meta name="description" content="${safeDesc}">`);
  // Remove existing canonical if any
  html = html.replace(/<link rel="canonical"[^>]*\/?>/, '');
  // Inject canonical before </head>
  html = html.replace('</head>', `  <link rel="canonical" href="${canonical}" />\n</head>`);

  // Open Graph
  html = html.replace(/<meta property="og:title"\s+content=".*?">/, `<meta property="og:title" content="${safeTitle}">`);
  html = html.replace(/<meta property="og:description"\s+content=".*?">/, `<meta property="og:description" content="${safeDesc}">`);
  html = html.replace(/<meta property="og:url"\s+content=".*?">/, `<meta property="og:url" content="${canonical}">`);
  html = html.replace(/<meta property="og:image"\s+content=".*?">/, `<meta property="og:image" content="${previewImg}">`);

  // Twitter Card
  html = html.replace(/<meta name="twitter:title"\s+content=".*?">/, `<meta name="twitter:title" content="${safeTitle}">`);
  html = html.replace(/<meta name="twitter:description"\s+content=".*?">/, `<meta name="twitter:description" content="${safeDesc}">`);
  html = html.replace(/<meta name="twitter:image"\s+content=".*?">/, `<meta name="twitter:image" content="${previewImg}">`);

  // Inject body into #root
  const rootPattern = /<div id="root" class="min-h-screen flex flex-col">[\s\S]*?<\/div>/;
  html = html.replace(rootPattern, `<div id="root" class="min-h-screen flex flex-col">\n${bodyContent}\n  </div>`);
  return html;
}

function writePage(route, html) {
  const targetDir = path.join(distPublicDir, route);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');
  console.log(`  Generated ${route}/index.html`);
}

// ─── Fetch blog posts from Firestore REST API ─────────────────────────────────

const FIREBASE_PROJECT_ID = 'hr-portal-unique-delta';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function fetchFirestore(path_) {
  return new Promise((resolve, reject) => {
    const url = `${FIRESTORE_BASE}/${path_}`;
    https.get(url, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function firestoreValue(val) {
  if (!val) return '';
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return String(val.integerValue);
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.timestampValue !== undefined) return val.timestampValue;
  return '';
}

// Convert "July 24, 2026" or "Jun 25, 2026" to "2026-07-24" for sitemap W3C date format
function toISODate(dateStr) {
  if (!dateStr) return today;
  // Already ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Try parsing "Month Day, Year" or "Mon Day, Year"
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) { }
  return today;
}

async function fetchBlogPosts() {
  try {
    console.log('  Fetching blog posts from Firestore...');
    const data = await fetchFirestore('blog_posts?pageSize=100');
    if (!data.documents) return [];
    return data.documents.map(doc => {
      const f = doc.fields || {};
      return {
        slug: firestoreValue(f.slug) || '',
        title: firestoreValue(f.title) || '',
        excerpt: firestoreValue(f.excerpt) || '',
        content: firestoreValue(f.content) || '',
        category: firestoreValue(f.category) || 'Security',
        date: toISODate(firestoreValue(f.date)),
        readTime: firestoreValue(f.readTime) || '5 min read',
        imageUrl: firestoreValue(f.imageUrl) || '',
        isPrivate: firestoreValue(f.isPrivate) || false,
      };
    }).filter(p => !p.isPrivate && p.title && p.title.trim() !== '');
  } catch (err) {
    console.warn('  Could not fetch blog posts from Firestore:', err.message);
    return [];
  }
}

// ─── Static page definitions ──────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0];

const staticPages = [
  {
    route: 'about',
    title: 'About Us | Unique Delta Force Security Pvt Ltd',
    description: 'Learn about Unique Delta Force Pvt Ltd (UDF) — India\'s premier PSARA-licensed security agency offering corporate protection, industrial guard services, and facility management.',
    canonical: 'https://udfonline.in/about',
    lastmod: today,
    priority: '0.8',
    bodyContent: `
      <main style="padding: 40px; max-width: 900px; margin: 0 auto; font-family: sans-serif; line-height: 1.8; color: #333;">
        <header style="border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #1e3a8a; margin: 0 0 10px 0;">About Unique Delta Force (UDF) Security</h1>
          <p style="font-weight: bold; margin: 0;">India's Trusted PSARA Licensed Security &amp; Guarding Agency</p>
        </header>
        <section style="margin-bottom: 30px;">
          <h2>Company Overview</h2>
          <p>Unique Delta Force Pvt Ltd (UDF) is a premier private security provider operating across Telangana, Andhra Pradesh, and major industrial hubs in India. We specialize in corporate security officers, industrial perimeter guarding, commercial facility protection, escort marshalls for IT/ITeS companies, and AI-enabled surveillance integration. With a proven track record spanning over a decade, UDF is trusted by leading corporations, factories, warehouses, banking institutions, and residential complexes.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>Our Core Security Services</h2>
          <ul>
            <li><strong>Corporate Guarding Services:</strong> Certified security personnel trained in access control, front-desk visitor management, and emergency response protocols.</li>
            <li><strong>Industrial &amp; Warehouse Security:</strong> Perimeter patrol officers, gate access inspection, and loss prevention for manufacturing hubs and logistics parks.</li>
            <li><strong>Escort Marshalling:</strong> Safe transit escorts for night-shift employees in corporate fleet transport across Hyderabad and surrounding areas.</li>
            <li><strong>Facility Management &amp; Housekeeping:</strong> Professional manpower solutions for corporate office complexes and multi-tenant commercial buildings.</li>
            <li><strong>CCTV Surveillance Management:</strong> Installation, monitoring, and maintenance of commercial-grade CCTV systems with 24/7 control room support.</li>
            <li><strong>Event Security:</strong> Crowd management, VIP protection, and access control for large-scale corporate events and exhibitions.</li>
          </ul>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>Compliance &amp; Certifications</h2>
          <p>UDF is fully compliant with PSARA (Private Security Agencies Regulation Act) regulations, the Minimum Wages Act, EPFO (UAN generation and PF contributions), ESIC medical insurance, and POSH Act workplace safety mandates. We hold ISO 9001:2015 quality management certifications and conduct regular background verification for all deployed personnel.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>Why Choose Unique Delta Force?</h2>
          <p>Our guards undergo structured pre-deployment training covering fire safety, first-aid, conflict de-escalation, visitor management, and perimeter patrol techniques. We provide transparent monthly billing, statutory compliance reports, and dedicated account managers for corporate clients. We are committed to providing safe, reliable, and cost-effective security solutions tailored to each client's unique requirements.</p>
        </section>
        <nav style="display: flex; flex-wrap: wrap; gap: 15px; background: #f3f4f6; padding: 15px; border-radius: 8px;">
          <a href="/" style="color: #2563eb; font-weight: bold;">Home</a> |
          <a href="/blogs" style="color: #2563eb; font-weight: bold;">Read Blogs</a> |
          <a href="/careers" style="color: #2563eb; font-weight: bold;">Careers</a> |
          <a href="/business" style="color: #2563eb; font-weight: bold;">Business Solutions</a> |
          <a href="/contact" style="color: #2563eb; font-weight: bold;">Contact Us</a> |
          <a href="/privacy-policy" style="color: #2563eb; font-weight: bold;">Privacy Policy</a> |
          <a href="/terms-of-service" style="color: #2563eb; font-weight: bold;">Terms of Service</a>
        </nav>
      </main>
    `
  },
  {
    route: 'contact',
    title: 'Contact Us | Unique Delta Force Security Services',
    description: 'Get in touch with Unique Delta Force Pvt Ltd for security guard deployments, corporate protection inquiries, and career assistance in India.',
    canonical: 'https://udfonline.in/contact',
    lastmod: today,
    priority: '0.7',
    bodyContent: `
      <main style="padding: 40px; max-width: 900px; margin: 0 auto; font-family: sans-serif; line-height: 1.8; color: #333;">
        <header style="border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #1e3a8a; margin: 0 0 10px 0;">Contact Unique Delta Force Pvt Ltd</h1>
          <p style="font-weight: bold; margin: 0;">24/7 Security Assistance &amp; Corporate Inquiries</p>
        </header>
        <section style="margin-bottom: 30px;">
          <h2>Headquarters &amp; Operations Office</h2>
          <p><strong>Company:</strong> Unique Delta Force Pvt Ltd</p>
          <p><strong>Service Areas:</strong> Telangana, Andhra Pradesh, and major industrial hubs across India.</p>
          <p><strong>Email Support:</strong> hr.hyderabad.udf@gmail.com</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>Inquiry Categories</h2>
          <ul>
            <li><strong>Business &amp; Guard Deployment:</strong> Request customized security proposals, staffing quotes, and site assessment for your facility or industrial complex.</li>
            <li><strong>Careers &amp; Recruitment:</strong> Apply for Security Guard, Supervisor, Escort Marshall, and Field Officer vacancies. Submit your resume and Aadhaar for screening.</li>
            <li><strong>PF &amp; ESIC Assistance:</strong> Existing employee support for UAN retrieval, EPF claim status, ESIC medical card activation, and payroll queries.</li>
            <li><strong>General Queries:</strong> Any questions about our services, compliance credentials, or client onboarding process.</li>
          </ul>
        </section>
        <nav style="display: flex; flex-wrap: wrap; gap: 15px; background: #f3f4f6; padding: 15px; border-radius: 8px;">
          <a href="/" style="color: #2563eb; font-weight: bold;">Home</a> |
          <a href="/about" style="color: #2563eb; font-weight: bold;">About Us</a> |
          <a href="/blogs" style="color: #2563eb; font-weight: bold;">Read Blogs</a> |
          <a href="/careers" style="color: #2563eb; font-weight: bold;">Careers</a> |
          <a href="/privacy-policy" style="color: #2563eb; font-weight: bold;">Privacy Policy</a> |
          <a href="/terms-of-service" style="color: #2563eb; font-weight: bold;">Terms of Service</a>
        </nav>
      </main>
    `
  },
  {
    route: 'careers',
    title: 'Security Jobs & Careers | Unique Delta Force Recruitment',
    description: 'Explore active job vacancies for Security Guards, Supervisors, Escort Marshalls, and Field Officers at Unique Delta Force Pvt Ltd in India.',
    canonical: 'https://udfonline.in/careers',
    lastmod: today,
    priority: '0.7',
    bodyContent: `
      <main style="padding: 40px; max-width: 900px; margin: 0 auto; font-family: sans-serif; line-height: 1.8; color: #333;">
        <header style="border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #1e3a8a; margin: 0 0 10px 0;">Security Careers at Unique Delta Force</h1>
          <p style="font-weight: bold; margin: 0;">Join India's Top Professional Guarding Force</p>
        </header>
        <section style="margin-bottom: 30px;">
          <h2>Open Vacancies &amp; Recruitment</h2>
          <p>Unique Delta Force Pvt Ltd offers competitive salaries, statutory EPF &amp; ESIC benefits, free uniforms, and career growth opportunities for security personnel across Telangana and Andhra Pradesh.</p>
          <ul>
            <li><strong>Security Guard (Male &amp; Female):</strong> Site protection, visitor logbook entry, and perimeter patrol. Minimum 10th pass, physical fitness required.</li>
            <li><strong>Security Supervisor:</strong> Shift supervision, guard turn-out inspection, and client coordination. Minimum 12th pass, 2 years field experience.</li>
            <li><strong>Escort Marshall:</strong> Night-shift employee transit escort for IT enterprise cabs. Valid driver license preferred.</li>
            <li><strong>Field Officer / Area Manager:</strong> Site audits, operational compliance, and staff training. Graduate preferred.</li>
          </ul>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>Benefits of Working with UDF</h2>
          <ul>
            <li>Statutory EPF (PF) contribution — UAN generated on Day 1 of joining</li>
            <li>ESIC medical insurance for employee and family members</li>
            <li>Free uniform, boots, and ID card provided</li>
            <li>Timely monthly salary via bank transfer</li>
            <li>Training in first-aid, fire safety, and conflict de-escalation</li>
            <li>Career advancement opportunities to Supervisor and Area Manager roles</li>
          </ul>
        </section>
        <nav style="display: flex; flex-wrap: wrap; gap: 15px; background: #f3f4f6; padding: 15px; border-radius: 8px;">
          <a href="/" style="color: #2563eb; font-weight: bold;">Home</a> |
          <a href="/about" style="color: #2563eb; font-weight: bold;">About Us</a> |
          <a href="/blogs" style="color: #2563eb; font-weight: bold;">Read Blogs</a> |
          <a href="/business" style="color: #2563eb; font-weight: bold;">Business Solutions</a> |
          <a href="/contact" style="color: #2563eb; font-weight: bold;">Contact Us</a>
        </nav>
      </main>
    `
  },
  {
    route: 'business',
    title: 'Business & Enterprise Security Solutions | UDF Security',
    description: 'Tailored security guard services, CCTV surveillance management, and facility protection solutions for corporate enterprises, industrial plants, and residential societies.',
    canonical: 'https://udfonline.in/business',
    lastmod: today,
    priority: '0.8',
    bodyContent: `
      <main style="padding: 40px; max-width: 900px; margin: 0 auto; font-family: sans-serif; line-height: 1.8; color: #333;">
        <header style="border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #1e3a8a; margin: 0 0 10px 0;">Enterprise Security Solutions</h1>
          <p style="font-weight: bold; margin: 0;">Protection for Corporate IT Hubs, Factories &amp; Commercial Facilities</p>
        </header>
        <section style="margin-bottom: 30px;">
          <h2>Why Partner with Unique Delta Force?</h2>
          <p>We provide end-to-end security risk management, trained personnel, biometric access systems, and automated attendance logging for corporate clients across India. Our team works directly with your facilities team to design customized security protocols, guard schedules, and emergency response plans tailored to your property type and threat profile.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>Industries We Serve</h2>
          <ul>
            <li><strong>IT &amp; ITeS Campuses:</strong> Perimeter guarding, cab escort marshalling, server room access control, and visitor management systems for technology parks.</li>
            <li><strong>Manufacturing &amp; Industrial Plants:</strong> Gate inspection, material movement monitoring, and loss prevention for factories and warehouses.</li>
            <li><strong>Banking &amp; Financial Institutions:</strong> Armed and unarmed guard deployments, vault security, and ATM surveillance.</li>
            <li><strong>Residential Societies:</strong> 24/7 gate security, visitor screening, patrol services, and emergency rapid response.</li>
            <li><strong>Retail &amp; Commercial Malls:</strong> Crowd management, anti-shoplifting patrols, and CCTV surveillance integration.</li>
            <li><strong>Hospitals &amp; Healthcare:</strong> Patient safety, visitor access management, and emergency coordination.</li>
          </ul>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>Our Service Guarantees</h2>
          <p>Every deployment comes with a dedicated account manager, monthly compliance audit reports, 24/7 control room support, and guaranteed replacement guards within 4 hours of any absence. We maintain full statutory compliance with PSARA, EPFO, ESIC, and Minimum Wages Act for all deployed personnel.</p>
        </section>
        <nav style="display: flex; flex-wrap: wrap; gap: 15px; background: #f3f4f6; padding: 15px; border-radius: 8px;">
          <a href="/" style="color: #2563eb; font-weight: bold;">Home</a> |
          <a href="/about" style="color: #2563eb; font-weight: bold;">About Us</a> |
          <a href="/blogs" style="color: #2563eb; font-weight: bold;">Read Blogs</a> |
          <a href="/contact" style="color: #2563eb; font-weight: bold;">Contact Us</a>
        </nav>
      </main>
    `
  },
  {
    route: 'blogs',
    title: 'Security Insights, EPF Compliance & Guides | UDF Online Blog',
    description: 'Read published industry articles on PSARA compliance, ESIC benefits, EPFO UAN generation, POSH Act, and commercial site safety guidelines by Unique Delta Force.',
    canonical: 'https://udfonline.in/blogs',
    lastmod: today,
    priority: '0.9',
    bodyContent: `
      <main style="padding: 40px; max-width: 900px; margin: 0 auto; font-family: sans-serif; line-height: 1.8; color: #333;">
        <header style="border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #1e3a8a; margin: 0 0 10px 0;">Security Industry Insights &amp; Compliance Guides</h1>
          <p style="font-weight: bold; margin: 0;">Official Knowledge Base &amp; Publication Portal of Unique Delta Force</p>
        </header>
        <section style="margin-bottom: 30px;">
          <h2>Featured Articles &amp; Knowledge Base</h2>
          <ul>
            <li><strong>PF &amp; ESIC Compliance Guides:</strong> Official tutorials on retrieving existing UAN numbers, generating UAN via UMANG app, and understanding ESIC medical benefits.</li>
            <li><strong>PSARA &amp; Labor Laws:</strong> In-depth breakdown of Private Security Agencies Regulation Act (PSARA) and Minimum Wages Act in India.</li>
            <li><strong>Workplace Safety &amp; Protocol:</strong> POSH Act compliance, fire safety training, heatstroke prevention for outdoor guards, and conflict de-escalation methods.</li>
            <li><strong>Career Growth:</strong> Career opportunities in India's private security industry, guard training standards, and advancement pathways.</li>
          </ul>
        </section>
        <nav style="display: flex; flex-wrap: wrap; gap: 15px; background: #f3f4f6; padding: 15px; border-radius: 8px;">
          <a href="/" style="color: #2563eb; font-weight: bold;">Home</a> |
          <a href="/about" style="color: #2563eb; font-weight: bold;">About Us</a> |
          <a href="/careers" style="color: #2563eb; font-weight: bold;">Careers</a> |
          <a href="/contact" style="color: #2563eb; font-weight: bold;">Contact Us</a>
        </nav>
      </main>
    `
  },
  {
    route: 'privacy-policy',
    title: 'Privacy Policy | Unique Delta Force Pvt Ltd',
    description: 'Official privacy policy of Unique Delta Force Pvt Ltd detailing user data protection, cookie usage, advertising disclosures, and statutory privacy compliance.',
    canonical: 'https://udfonline.in/privacy-policy',
    lastmod: today,
    priority: '0.4',
    bodyContent: `
      <main style="padding: 40px; max-width: 900px; margin: 0 auto; font-family: sans-serif; line-height: 1.8; color: #333;">
        <header style="border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #1e3a8a; margin: 0 0 10px 0;">Privacy Policy &amp; Cookie Disclosure</h1>
          <p style="font-weight: bold; margin: 0;">Effective Date: June 29, 2026 — Unique Delta Force Pvt Ltd</p>
        </header>
        <section style="margin-bottom: 30px;">
          <h2>1. Introduction</h2>
          <p>Unique Delta Force Pvt Ltd ("we", "us", or "our") operates the corporate portal, careers listing, and HR management system at udfonline.in. We are committed to protecting the privacy of our candidates, employees, and portal visitors. This Privacy Policy documents the types of information we collect, how we process it, our cookie practices, and our third-party advertising disclosures.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>2. Information We Collect</h2>
          <p>When you apply for a job or register as an employee on our site, we collect personal identity data (full name, date of birth, gender, passport photo), contact information (phone number, email address, residential address), employment documentation (educational qualifications, experience records, Aadhaar Card, PAN Card), and financial details (bank account number, IFSC code) used exclusively for salary disbursement and statutory PF/ESI registration.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>3. How We Use Your Information</h2>
          <p>We use collected information to verify applicant identity, conduct background checks, facilitate onboarding and EPFO/ESIC enrollment, process monthly salary payments, track attendance, and improve website navigation and administrative efficiency. We do not sell personal data to third parties.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>4. Third-Party Advertising &amp; Cookie Disclosure</h2>
          <p>We work with authorized third-party advertising companies including Google AdSense and Google DoubleClick to serve advertisements when you visit our blog and portal. These advertising partners may use cookies, device identifiers, and web beacons to collect non-personal data (such as IP address, browser type, and general geographic location) to serve relevant advertisements based on your interests.</p>
          <p>Google and other third-party vendors use advertising cookies to serve personalized ads based on your prior visits to our website or other websites on the internet. You may opt out of Google's personalized advertising by visiting Google Ads Settings at settings.google.com/ads. You can also opt out via optout.aboutads.info or the Network Advertising Initiative opt-out page at optout.networkadvertising.org.</p>
          <p>We display a Cookie Consent Banner to allow visitors to accept or decline optional advertising cookies. Choosing "Decline Optional" prevents the deployment of optional tracking cookies from advertising partners. Essential cookies required for site operation (authentication, session management) are always active.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>5. Data Retention &amp; Security</h2>
          <p>All user profiles, documents, and application records are stored securely using Firebase Security Rules with strict transport layer security (TLS). Data is accessible only by authorized HR personnel and Administrators. Personal data is retained only for the duration of the recruitment process or active employment tenure, plus any statutory period required by Indian labor laws.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>6. Consent</h2>
          <p>By using our website, you hereby consent to our Privacy Policy and agree to its terms. If you do not agree, please do not upload personal documents or accept the cookie consent banner. You may withdraw consent at any time by contacting us at compliance@udfonline.in.</p>
        </section>
        <nav style="display: flex; flex-wrap: wrap; gap: 15px; background: #f3f4f6; padding: 15px; border-radius: 8px;">
          <a href="/" style="color: #2563eb; font-weight: bold;">Home</a> |
          <a href="/terms-of-service" style="color: #2563eb; font-weight: bold;">Terms of Service</a> |
          <a href="/contact" style="color: #2563eb; font-weight: bold;">Contact Us</a>
        </nav>
      </main>
    `
  },
  {
    route: 'terms-of-service',
    title: 'Terms of Service | Unique Delta Force Pvt Ltd',
    description: 'Terms of service and portal use conditions for Unique Delta Force Pvt Ltd official website, including user responsibilities and intellectual property rights.',
    canonical: 'https://udfonline.in/terms-of-service',
    lastmod: today,
    priority: '0.4',
    bodyContent: `
      <main style="padding: 40px; max-width: 900px; margin: 0 auto; font-family: sans-serif; line-height: 1.8; color: #333;">
        <header style="border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #1e3a8a; margin: 0 0 10px 0;">Terms of Service</h1>
          <p style="font-weight: bold; margin: 0;">Unique Delta Force Pvt Ltd Website Usage Agreement</p>
        </header>
        <section style="margin-bottom: 30px;">
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using the Unique Delta Force Pvt Ltd portal at udfonline.in, you agree to be bound by these Terms of Service. If you do not agree to these terms, please discontinue use of our website immediately.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>2. User Responsibilities</h2>
          <p>Users agree to provide authentic, accurate details for job applications and corporate service inquiries. Submission of false information, fraudulent documents, or impersonation of another person will result in immediate disqualification and may be reported to relevant law enforcement authorities.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>3. Intellectual Property</h2>
          <p>All brand trademarks, logos, blog articles, training materials, and publication content on this website remain the exclusive property of Unique Delta Force Pvt Ltd. Reproduction, redistribution, or commercial use of any content without written permission is strictly prohibited.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>4. Limitation of Liability</h2>
          <p>Unique Delta Force Pvt Ltd is not liable for any indirect, incidental, or consequential damages arising from use of this website. We make no warranty that the website will be uninterrupted, error-free, or free from viruses or harmful components.</p>
        </section>
        <section style="margin-bottom: 30px;">
          <h2>5. Governing Law</h2>
          <p>These Terms of Service shall be governed by and interpreted in accordance with the laws of India, specifically under the jurisdiction of courts in Hyderabad, Telangana.</p>
        </section>
        <nav style="display: flex; flex-wrap: wrap; gap: 15px; background: #f3f4f6; padding: 15px; border-radius: 8px;">
          <a href="/" style="color: #2563eb; font-weight: bold;">Home</a> |
          <a href="/privacy-policy" style="color: #2563eb; font-weight: bold;">Privacy Policy</a> |
          <a href="/contact" style="color: #2563eb; font-weight: bold;">Contact Us</a>
        </nav>
      </main>
    `
  },
  {
    route: 'ad-demo',
    title: 'Google AdSense Compliance Preview | UDF Online',
    description: 'Google AdSense brand safety and ad unit compliance preview page for Unique Delta Force Pvt Ltd.',
    canonical: 'https://udfonline.in/ad-demo',
    lastmod: today,
    priority: '0.1',
    bodyContent: `
      <main style="padding: 40px; max-width: 900px; margin: 0 auto; font-family: sans-serif; line-height: 1.8; color: #333;">
        <header style="border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #1e3a8a; margin: 0 0 10px 0;">Google AdSense Compliance &amp; Brand Safety</h1>
          <p style="font-weight: bold; margin: 0;">Ad Unit Preview for Unique Delta Force Pvt Ltd</p>
        </header>
        <section style="margin-bottom: 30px;">
          <p>This page demonstrates the Google AdSense ad unit layout and brand safety compliance standards for Unique Delta Force Pvt Ltd (Publisher ID: ca-pub-4069971667046129).</p>
        </section>
      </main>
    `
  }
];

// ─── Blog post static page generator ─────────────────────────────────────────

function slugFromTitle(title) {
  // Match BlogsPage.tsx generateSlug() exactly
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function generateBlogPageContent(post, slug) {
  const plainExcerpt = stripHtml(post.excerpt || '').substring(0, 300);
  const plainContent = stripHtml(post.content || '').substring(0, 2000);
  const safeTitle = (post.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeCategory = (post.category || 'Security').replace(/&/g, '&amp;');
  const coverUrl = post.imageUrl || `/blog-assets/${slug}/cover.png`;

  return `
    <main style="padding: 40px; max-width: 900px; margin: 0 auto; font-family: sans-serif; line-height: 1.8; color: #333;">
      <nav style="margin-bottom: 20px; font-size: 14px;">
        <a href="/" style="color: #2563eb;">Home</a> &rsaquo;
        <a href="/blogs" style="color: #2563eb;">Security Insights</a> &rsaquo;
        <span>${safeCategory}</span>
      </nav>
      <header style="border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
        <span style="background: #dbeafe; color: #1e40af; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;">${safeCategory}</span>
        <h1 style="color: #1e3a8a; margin: 15px 0 10px 0; font-size: 28px;">${safeTitle}</h1>
        <p style="color: #666; font-size: 14px;">${post.date || ''} &bull; ${post.readTime || '5 min read'} &bull; Unique Delta Force Pvt Ltd</p>
      </header>
      ${coverUrl ? `<img src="${coverUrl}" alt="${safeTitle}" style="width:100%; max-height:400px; object-fit:cover; border-radius:8px; margin-bottom:30px;" />` : ''}
      <article style="margin-bottom: 40px;">
        <p style="font-size: 18px; color: #555; margin-bottom: 20px;"><strong>${plainExcerpt}</strong></p>
        <p>${plainContent}${plainContent.length >= 2000 ? '...' : ''}</p>
      </article>
      <aside style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 10px 0; color: #0369a1;">About the Author</h3>
        <p style="margin: 0; font-size: 14px;">Published by <strong>Unique Delta Force Pvt Ltd</strong> — India's trusted PSARA-licensed security agency providing corporate guarding, industrial protection, and workforce compliance training.</p>
      </aside>
      <nav style="display: flex; flex-wrap: wrap; gap: 15px; background: #f3f4f6; padding: 15px; border-radius: 8px;">
        <a href="/" style="color: #2563eb; font-weight: bold;">Home</a> |
        <a href="/blogs" style="color: #2563eb; font-weight: bold;">All Articles</a> |
        <a href="/about" style="color: #2563eb; font-weight: bold;">About UDF</a> |
        <a href="/careers" style="color: #2563eb; font-weight: bold;">Careers</a> |
        <a href="/contact" style="color: #2563eb; font-weight: bold;">Contact Us</a>
      </nav>
    </main>
  `;
}

// ─── Sitemap updater ──────────────────────────────────────────────────────────

function updateSitemap(blogPosts, blogSlugs) {
  const sitemapPath = path.resolve(__dirname, '../public/sitemap.xml');
  const distSitemapPath = path.join(distPublicDir, 'sitemap.xml');

  const staticEntries = [
    { loc: 'https://udfonline.in/', lastmod: today, changefreq: 'daily', priority: '1.0' },
    { loc: 'https://udfonline.in/blogs', lastmod: today, changefreq: 'daily', priority: '0.9' },
    { loc: 'https://udfonline.in/business', lastmod: today, changefreq: 'weekly', priority: '0.8' },
    { loc: 'https://udfonline.in/about', lastmod: today, changefreq: 'weekly', priority: '0.8' },
    { loc: 'https://udfonline.in/careers', lastmod: today, changefreq: 'weekly', priority: '0.7' },
    { loc: 'https://udfonline.in/contact', lastmod: today, changefreq: 'weekly', priority: '0.7' },
    { loc: 'https://udfonline.in/privacy-policy', lastmod: today, changefreq: 'monthly', priority: '0.5' },
    { loc: 'https://udfonline.in/terms-of-service', lastmod: today, changefreq: 'monthly', priority: '0.5' },
  ];

  const blogEntries = blogSlugs.map(({ slug, date }) => ({
    loc: `https://udfonline.in/blogs/${slug}`,
    lastmod: date || today,
    changefreq: 'monthly',
    priority: '0.7'
  }));

  const allEntries = [...staticEntries, ...blogEntries];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries.map(e => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

  fs.writeFileSync(sitemapPath, xml, 'utf8');
  fs.writeFileSync(distSitemapPath, xml, 'utf8');
  console.log(`  Updated sitemap.xml with ${allEntries.length} URLs (${blogEntries.length} blog posts)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nGenerating static HTML files for crawler indexability...');

  // 1. Generate static pages
  for (const p of staticPages) {
    const html = injectIntoTemplate(templateHtml, p);
    writePage(p.route, html);
  }

  // 2. Fetch blog posts and generate individual post pages
  console.log('\nFetching and pre-rendering blog posts...');
  const blogPosts = await fetchBlogPosts();
  console.log(`  Found ${blogPosts.length} blog posts in Firestore`);

  const blogSlugs = [];

  // Also check local blog-assets folders as fallback slug source
  const blogAssetsDir = path.resolve(__dirname, '../public/blog-assets');
  const localSlugs = fs.existsSync(blogAssetsDir)
    ? fs.readdirSync(blogAssetsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
    : [];

  if (blogPosts.length > 0) {
    for (const post of blogPosts) {
      // Derive slug using same logic as BlogsPage.tsx generateSlug()
      const slug = post.slug || slugFromTitle(post.title);
      if (!slug) continue;

      const blogRoute = `blogs/${slug}`;
      const canonical = `https://udfonline.in/blogs/${slug}`;
      const safeTitle = (post.title || '').replace(/"/g, '&quot;');
      const safeExcerpt = (post.excerpt || '').replace(/"/g, '&quot;');
      const blogCover = post.imageUrl || `https://udfonline.in/blog-assets/${slug}/cover.png`;
      const html = injectIntoTemplate(templateHtml, {
        title: `${safeTitle} | UDF Security Blog`,
        description: safeExcerpt || `Read ${safeTitle} on the UDF Security knowledge base.`,
        canonical,
        image: blogCover,
        bodyContent: generateBlogPageContent(post, slug)
      });

      writePage(blogRoute, html);
      blogSlugs.push({ slug, date: post.date || today });
    }
  }

  // Process local slugs only as supplemental fallback for slugs not already covered by Firestore
  // (These won't be added to sitemap - only Firestore posts go in sitemap)
  if (localSlugs.length > 0) {
    const existingSlugs = new Set(blogSlugs.map(b => b.slug));
    console.log(`  Processing ${localSlugs.length} local blog-assets slugs...`);
    for (const slug of localSlugs) {
      if (existingSlugs.has(slug)) continue; // already generated from Firestore
      const blogRoute = `blogs/${slug}`;
      const canonical = `https://udfonline.in/blogs/${slug}`;
      const title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      const html = injectIntoTemplate(templateHtml, {
        title: `${title} | UDF Security Blog`,
        description: `Read ${title} — official security industry article by Unique Delta Force Pvt Ltd.`,
        canonical,
        bodyContent: `
          <main style="padding: 40px; max-width: 900px; margin: 0 auto; font-family: sans-serif; line-height: 1.8; color: #333;">
            <nav style="margin-bottom: 20px; font-size: 14px;">
              <a href="/" style="color: #2563eb;">Home</a> &rsaquo;
              <a href="/blogs" style="color: #2563eb;">Security Insights</a>
            </nav>
            <header style="border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
              <h1 style="color: #1e3a8a; margin: 0 0 10px 0;">${title}</h1>
              <p style="color: #666;">Unique Delta Force Pvt Ltd — Security Industry Knowledge Base</p>
            </header>
            <article>
              <p>This article by Unique Delta Force Pvt Ltd covers important topics in security industry compliance, workforce management, and professional guard training in India. For full content, visit <a href="/blogs" style="color:#2563eb;">our blog</a>.</p>
            </article>
            <nav style="display: flex; flex-wrap: wrap; gap: 15px; background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 30px;">
              <a href="/blogs" style="color: #2563eb; font-weight: bold;">All Articles</a> |
              <a href="/about" style="color: #2563eb; font-weight: bold;">About UDF</a> |
              <a href="/contact" style="color: #2563eb; font-weight: bold;">Contact Us</a>
            </nav>
          </main>
        `
      });

      writePage(blogRoute, html);
      // Note: local slugs are NOT added to blogSlugs so they won't appear in sitemap
    }
  }

  // 3. Update sitemap with Firestore blog post URLs only
  console.log('\nUpdating sitemap.xml...');
  updateSitemap(blogPosts, blogSlugs);

  console.log('\nStatic pre-rendering complete!');
  console.log(`  - ${staticPages.length} static pages`);
  console.log(`  - ${blogSlugs.length} real blog post pages (in sitemap)`);
  console.log(`  - Sitemap total: ${8 + blogSlugs.length} URLs`);
}

main().catch(err => {
  console.error('generateStaticPages failed:', err);
  process.exit(1);
});
