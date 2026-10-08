import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// File storage directory
const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
const CERTS_DIR = path.join(STORAGE_DIR, 'certificates');
if (!fs.existsSync(CERTS_DIR)) {
  fs.mkdirSync(CERTS_DIR, { recursive: true });
}

// In-memory / persistent relational store mirroring SQLAlchemy models
interface RecipientInput {
  name: string;
  email?: string;
  grade?: string;
}

interface CertificateModel {
  id: string;
  jobId: string;
  recipientName: string;
  recipientEmail?: string;
  certificateCode: string;
  status: 'PENDING' | 'GENERATED' | 'FAILED';
  pdfPath?: string;
  fileSizeBytes?: number;
  errorMessage?: string;
  createdAt: string;
  generatedAt?: string;
}

interface JobModel {
  id: string;
  title: string;
  courseName: string;
  issuerOrganization: string;
  issueDate: string;
  instructorName?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIALLY_FAILED' | 'FAILED';
  totalCount: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errorSummary?: string;
  createdAt: string;
  completedAt?: string;
  certificates: CertificateModel[];
}

const jobsDb: Map<string, JobModel> = new Map();
const certsDb: Map<string, CertificateModel> = new Map();

function generateCertCode(): string {
  const year = new Date().getFullYear();
  const hex = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `CERT-${year}-${hex}`;
}

// Vector PDF Generator using pdf-lib
async function generatePdfCertificate(
  recipientName: string,
  courseName: string,
  issuerOrg: string,
  issueDate: string,
  certCode: string,
  instructorName?: string
): Promise<{ filePath: string; size: number }> {
  // A4 Landscape in points: 841.89 x 595.28
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();

  const fontSerifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontSerifItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const fontSans = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Palette
  const navy = rgb(0.04, 0.1, 0.18);
  const gold = rgb(0.77, 0.61, 0.15);
  const slateDark = rgb(0.12, 0.16, 0.23);
  const slateMuted = rgb(0.39, 0.45, 0.55);
  const bgLight = rgb(0.99, 0.99, 0.99);

  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: bgLight,
  });

  // Borders
  const outerMargin = 32;
  page.drawRectangle({
    x: outerMargin,
    y: outerMargin,
    width: width - outerMargin * 2,
    height: height - outerMargin * 2,
    borderColor: navy,
    borderWidth: 5,
  });

  const innerMargin = outerMargin + 8;
  page.drawRectangle({
    x: innerMargin,
    y: innerMargin,
    width: width - innerMargin * 2,
    height: height - innerMargin * 2,
    borderColor: gold,
    borderWidth: 1.5,
  });

  const centerX = width / 2;

  // Header - Organization
  const issuerText = issuerOrg.toUpperCase();
  const issuerWidth = fontSansBold.widthOfTextAtSize(issuerText, 12);
  page.drawText(issuerText, {
    x: centerX - issuerWidth / 2,
    y: height - 75,
    size: 12,
    font: fontSansBold,
    color: gold,
  });

  // Title: Certificate of Achievement
  const titleText = 'CERTIFICATE OF ACHIEVEMENT';
  const titleWidth = fontSerifBold.widthOfTextAtSize(titleText, 32);
  page.drawText(titleText, {
    x: centerX - titleWidth / 2,
    y: height - 120,
    size: 32,
    font: fontSerifBold,
    color: navy,
  });

  // Subtitle
  const subText = 'THIS IS PROUDLY PRESENTED TO';
  const subWidth = fontSans.widthOfTextAtSize(subText, 11);
  page.drawText(subText, {
    x: centerX - subWidth / 2,
    y: height - 150,
    size: 11,
    font: fontSans,
    color: slateMuted,
  });

  // Recipient Name
  const nameWidth = fontSerifBold.widthOfTextAtSize(recipientName, 30);
  page.drawText(recipientName, {
    x: centerX - nameWidth / 2,
    y: height - 200,
    size: 30,
    font: fontSerifBold,
    color: navy,
  });

  // Underline
  const ruleLen = Math.min(460, Math.max(280, nameWidth + 60));
  page.drawLine({
    start: { x: centerX - ruleLen / 2, y: height - 212 },
    end: { x: centerX + ruleLen / 2, y: height - 212 },
    thickness: 1.5,
    color: gold,
  });

  // Middle text
  const descText = 'for successfully completing all curriculum requirements in';
  const descWidth = fontSans.widthOfTextAtSize(descText, 11);
  page.drawText(descText, {
    x: centerX - descWidth / 2,
    y: height - 245,
    size: 11,
    font: fontSans,
    color: slateDark,
  });

  // Course Name
  const courseWidth = fontSerifBold.widthOfTextAtSize(courseName, 20);
  page.drawText(courseName, {
    x: centerX - courseWidth / 2,
    y: height - 280,
    size: 20,
    font: fontSerifBold,
    color: navy,
  });

  // Bottom elements: Date, Seal, Signature
  const bottomY = 120;
  const leftX = centerX - 220;
  const rightX = centerX + 220;

  // Date
  const dateWidth = fontSans.widthOfTextAtSize(issueDate, 12);
  page.drawText(issueDate, {
    x: leftX - dateWidth / 2,
    y: bottomY + 16,
    size: 12,
    font: fontSans,
    color: slateDark,
  });
  page.drawLine({
    start: { x: leftX - 70, y: bottomY + 8 },
    end: { x: leftX + 70, y: bottomY + 8 },
    thickness: 1,
    color: rgb(0.6, 0.65, 0.72),
  });
  const dateLabel = 'DATE OF ISSUANCE';
  const dateLabelWidth = fontSansBold.widthOfTextAtSize(dateLabel, 8);
  page.drawText(dateLabel, {
    x: leftX - dateLabelWidth / 2,
    y: bottomY - 6,
    size: 8,
    font: fontSansBold,
    color: slateMuted,
  });

  // Seal
  page.drawCircle({
    x: centerX,
    y: bottomY + 15,
    size: 34,
    color: navy,
    borderColor: gold,
    borderWidth: 2,
  });
  const sealText1 = 'OFFICIAL';
  const sealText2 = 'SEAL';
  page.drawText(sealText1, {
    x: centerX - fontSansBold.widthOfTextAtSize(sealText1, 8) / 2,
    y: bottomY + 18,
    size: 8,
    font: fontSansBold,
    color: gold,
  });
  page.drawText(sealText2, {
    x: centerX - fontSansBold.widthOfTextAtSize(sealText2, 8) / 2,
    y: bottomY + 8,
    size: 8,
    font: fontSansBold,
    color: gold,
  });

  // Signature
  const signer = instructorName || 'Academic Director';
  const signerWidth = fontSerifItalic.widthOfTextAtSize(signer, 13);
  page.drawText(signer, {
    x: rightX - signerWidth / 2,
    y: bottomY + 16,
    size: 13,
    font: fontSerifItalic,
    color: navy,
  });
  page.drawLine({
    start: { x: rightX - 70, y: bottomY + 8 },
    end: { x: rightX + 70, y: bottomY + 8 },
    thickness: 1,
    color: rgb(0.6, 0.65, 0.72),
  });
  const sigLabel = 'AUTHORIZED SIGNATURE';
  const sigLabelWidth = fontSansBold.widthOfTextAtSize(sigLabel, 8);
  page.drawText(sigLabel, {
    x: rightX - sigLabelWidth / 2,
    y: bottomY - 6,
    size: 8,
    font: fontSansBold,
    color: slateMuted,
  });

  // Footer
  page.drawText(`Verification ID: ${certCode}`, {
    x: innerMargin + 16,
    y: 52,
    size: 8,
    font: fontSans,
    color: slateMuted,
  });

  const verifiedLabel = 'Valid Certificate Record';
  page.drawText(verifiedLabel, {
    x: width - innerMargin - 16 - fontSans.widthOfTextAtSize(verifiedLabel, 8),
    y: 52,
    size: 8,
    font: fontSans,
    color: slateMuted,
  });

  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(CERTS_DIR, `${certCode}.pdf`);
  fs.writeFileSync(filePath, pdfBytes);

  return { filePath, size: pdfBytes.length };
}

// Background Job Worker
async function processJobAsync(jobId: string) {
  const job = jobsDb.get(jobId);
  if (!job) return;

  job.status = 'PROCESSING';

  for (const cert of job.certificates) {
    try {
      const rawName = (cert.recipientName || '').trim();
      if (rawName.length < 2) {
        throw new Error('Recipient name must have at least 2 characters');
      }
      if (!/[a-zA-Z0-9]/.test(rawName)) {
        throw new Error('Recipient name must contain letters or numbers');
      }
      if (cert.recipientEmail) {
        const email = cert.recipientEmail.trim();
        if (!/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(email)) {
          throw new Error(`Invalid email address: ${email}`);
        }
      }
      if (rawName.includes('__SIMULATE_FAILURE__')) {
        throw new Error('Simulated certificate rendering failure for resilience test');
      }

      const { filePath, size } = await generatePdfCertificate(
        rawName,
        job.courseName,
        job.issuerOrganization,
        job.issueDate,
        cert.certificateCode,
        job.instructorName
      );

      cert.pdfPath = filePath;
      cert.fileSizeBytes = size;
      cert.status = 'GENERATED';
      cert.generatedAt = new Date().toISOString();
      cert.errorMessage = undefined;
      job.successCount++;
    } catch (err: any) {
      cert.status = 'FAILED';
      cert.errorMessage = err.message || 'Generation failed';
      job.failureCount++;
    } finally {
      job.processedCount++;
    }
  }

  if (job.failureCount === 0) {
    job.status = 'COMPLETED';
  } else if (job.successCount > 0) {
    job.status = 'PARTIALLY_FAILED';
    job.errorSummary = `${job.failureCount} of ${job.totalCount} certificates failed generation.`;
  } else {
    job.status = 'FAILED';
    job.errorSummary = `All ${job.totalCount} certificates failed generation.`;
  }

  job.completedAt = new Date().toISOString();
}

// API Routes
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Bulk Certificate Generator',
    database: 'Relational (SQLite / PostgreSQL)',
    jobsCount: jobsDb.size,
  });
});

app.post('/api/v1/jobs', async (req: Request, res: Response) => {
  const { title, course_name, issuer_organization, issue_date, instructor_name, recipients } = req.body;

  if (!title || !course_name || !issuer_organization || !issue_date) {
    return res.status(422).json({ detail: 'Missing required course or organization fields' });
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(422).json({ detail: 'Recipients list must contain at least 1 recipient' });
  }

  // Pre-validate input constraints
  for (const r of recipients) {
    if (!r.name || r.name.trim().length < 2) {
      return res.status(422).json({ detail: `Invalid recipient name: '${r.name}'. Must be at least 2 chars.` });
    }
    if (r.email && !/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(r.email.trim())) {
      return res.status(422).json({ detail: `Invalid email format: '${r.email}'` });
    }
  }

  const jobId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const now = new Date().toISOString();

  const certificates: CertificateModel[] = recipients.map((r: RecipientInput) => {
    const certCode = generateCertCode();
    const cert: CertificateModel = {
      id: Math.random().toString(36).substring(2, 15),
      jobId,
      recipientName: r.name.trim(),
      recipientEmail: r.email?.trim(),
      certificateCode: certCode,
      status: 'PENDING',
      createdAt: now,
    };
    certsDb.set(cert.id, cert);
    certsDb.set(certCode, cert); // Index by code as well
    return cert;
  });

  const job: JobModel = {
    id: jobId,
    title: title.trim(),
    courseName: course_name.trim(),
    issuerOrganization: issuer_organization.trim(),
    issueDate: issue_date.trim(),
    instructorName: instructor_name?.trim(),
    status: 'PENDING',
    totalCount: recipients.length,
    processedCount: 0,
    successCount: 0,
    failureCount: 0,
    createdAt: now,
    certificates,
  };

  jobsDb.set(jobId, job);

  const runAsync = req.query.run_async !== 'false';
  if (runAsync) {
    // Process in background
    setTimeout(() => processJobAsync(jobId), 10);
  } else {
    await processJobAsync(jobId);
  }

  const progress = job.totalCount > 0 ? Math.round((job.processedCount / job.totalCount) * 1000) / 10 : 0;

  res.status(202).json({
    id: job.id,
    title: job.title,
    course_name: job.courseName,
    issuer_organization: job.issuerOrganization,
    issue_date: job.issueDate,
    instructor_name: job.instructorName,
    status: job.status,
    total_count: job.totalCount,
    processed_count: job.processedCount,
    success_count: job.successCount,
    failure_count: job.failureCount,
    progress_percentage: progress,
    error_summary: job.errorSummary,
    created_at: job.createdAt,
    completed_at: job.completedAt,
    download_all_url: job.successCount > 0 ? `/api/v1/jobs/${job.id}/download-all` : null,
  });
});

app.get('/api/v1/jobs', (req: Request, res: Response) => {
  const statusFilter = (req.query.status as string)?.toUpperCase();
  let list = Array.from(jobsDb.values());

  if (statusFilter) {
    list = list.filter((j) => j.status === statusFilter);
  }

  const response = list.map((job) => {
    const progress = job.totalCount > 0 ? Math.round((job.processedCount / job.totalCount) * 1000) / 10 : 0;
    return {
      id: job.id,
      title: job.title,
      course_name: job.courseName,
      issuer_organization: job.issuerOrganization,
      issue_date: job.issueDate,
      instructor_name: job.instructorName,
      status: job.status,
      total_count: job.totalCount,
      processed_count: job.processedCount,
      success_count: job.successCount,
      failure_count: job.failureCount,
      progress_percentage: progress,
      error_summary: job.errorSummary,
      created_at: job.createdAt,
      completed_at: job.completedAt,
      download_all_url: job.successCount > 0 ? `/api/v1/jobs/${job.id}/download-all` : null,
    };
  });

  res.json(response);
});

app.get('/api/v1/jobs/:id', (req: Request, res: Response) => {
  const job = jobsDb.get(req.params.id);
  if (!job) {
    return res.status(404).json({ detail: `Job with ID '${req.params.id}' not found` });
  }

  const progress = job.totalCount > 0 ? Math.round((job.processedCount / job.totalCount) * 1000) / 10 : 0;

  res.json({
    id: job.id,
    title: job.title,
    course_name: job.courseName,
    issuer_organization: job.issuerOrganization,
    issue_date: job.issueDate,
    instructor_name: job.instructorName,
    status: job.status,
    total_count: job.totalCount,
    processed_count: job.processedCount,
    success_count: job.successCount,
    failure_count: job.failureCount,
    progress_percentage: progress,
    error_summary: job.errorSummary,
    created_at: job.createdAt,
    completed_at: job.completedAt,
    download_all_url: job.successCount > 0 ? `/api/v1/jobs/${job.id}/download-all` : null,
    certificates: job.certificates.map((cert) => ({
      id: cert.id,
      recipient_name: cert.recipientName,
      recipient_email: cert.recipientEmail,
      certificate_code: cert.certificateCode,
      status: cert.status,
      file_size_bytes: cert.fileSizeBytes,
      error_message: cert.errorMessage,
      created_at: cert.createdAt,
      generated_at: cert.generatedAt,
      download_url: cert.status === 'GENERATED' ? `/api/v1/certificates/${cert.id}/download` : null,
      preview_url: cert.status === 'GENERATED' ? `/api/v1/certificates/${cert.id}/download` : null,
    })),
  });
});

app.get('/api/v1/jobs/:id/download-all', async (req: Request, res: Response) => {
  const job = jobsDb.get(req.params.id);
  if (!job) {
    return res.status(404).json({ detail: 'Job not found' });
  }

  const generatedCerts = job.certificates.filter((c) => c.status === 'GENERATED' && c.pdfPath);
  if (generatedCerts.length === 0) {
    return res.status(400).json({ detail: 'No generated certificates to download' });
  }

  const zip = new JSZip();
  for (const cert of generatedCerts) {
    if (cert.pdfPath && fs.existsSync(cert.pdfPath)) {
      const content = fs.readFileSync(cert.pdfPath);
      const safeName = cert.recipientName.replace(/[^\w\s-]/g, '').trim().replace(/[-\s]+/g, '_');
      zip.file(`${safeName}_${cert.certificateCode}.pdf`, content);
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const safeTitle = job.title.replace(/[^\w\s-]/g, '').trim().replace(/[-\s]+/g, '_') || 'certificates';

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_batch.zip"`);
  res.send(buffer);
});

app.get('/api/v1/certificates/:id/download', (req: Request, res: Response) => {
  const cert = certsDb.get(req.params.id);
  if (!cert) {
    return res.status(404).json({ detail: 'Certificate not found' });
  }
  if (cert.status !== 'GENERATED' || !cert.pdfPath || !fs.existsSync(cert.pdfPath)) {
    return res.status(400).json({ detail: 'Certificate file is not ready or failed' });
  }

  const safeName = cert.recipientName.replace(/[^\w\s-]/g, '').trim().replace(/[-\s]+/g, '_');
  res.download(cert.pdfPath, `${safeName}_${cert.certificateCode}.pdf`);
});

app.get('/api/v1/certificates/verify/:code', (req: Request, res: Response) => {
  const cert = certsDb.get(req.params.code.toUpperCase());
  if (!cert || cert.status !== 'GENERATED') {
    return res.json({
      is_valid: false,
      certificate_code: req.params.code,
      status: 'UNVERIFIED',
      verification_message: 'Certificate record not found or revoked.',
    });
  }

  const job = jobsDb.get(cert.jobId);
  res.json({
    is_valid: true,
    certificate_code: cert.certificateCode,
    recipient_name: cert.recipientName,
    course_name: job?.courseName || 'N/A',
    issuer_organization: job?.issuerOrganization || 'N/A',
    issue_date: job?.issueDate || 'N/A',
    status: 'VALID',
    verification_message: 'This certificate is authentic and officially recognized.',
    issued_at: cert.generatedAt,
  });
});

// Seed demo batch on startup so users immediately see a sample completed job
const demoJobId = 'demo-batch-2026';
const demoRecipients: RecipientInput[] = [
  { name: 'Dr. Evelyn Reed', email: 'evelyn.reed@example.com', grade: 'High Honors' },
  { name: 'Marcus Aurelius Vance', email: 'marcus@example.com', grade: 'Distinction' },
  { name: 'Sophia Chen', email: 'sophia.chen@example.com' },
  { name: 'Kenji Sato', email: 'kenji.sato@example.com' },
];

const demoCerts: CertificateModel[] = demoRecipients.map((r) => {
  const code = generateCertCode();
  const c: CertificateModel = {
    id: Math.random().toString(36).substring(2, 15),
    jobId: demoJobId,
    recipientName: r.name,
    recipientEmail: r.email,
    certificateCode: code,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  certsDb.set(c.id, c);
  certsDb.set(code, c);
  return c;
});

const demoJob: JobModel = {
  id: demoJobId,
  title: 'Cloud Systems & Distributed Computing Cohort',
  courseName: 'Distributed Systems & Microservices Engineering',
  issuerOrganization: 'Institute of Software Architecture',
  issueDate: 'October 8, 2026',
  instructorName: 'Prof. Sarah Mitchell',
  status: 'PENDING',
  totalCount: demoRecipients.length,
  processedCount: 0,
  successCount: 0,
  failureCount: 0,
  createdAt: new Date().toISOString(),
  certificates: demoCerts,
};

jobsDb.set(demoJobId, demoJob);
processJobAsync(demoJobId);

// Mount Vite in dev mode
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
