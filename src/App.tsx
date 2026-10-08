import React, { useState, useEffect, useRef } from 'react';
import {
  Award,
  CheckCircle2,
  AlertCircle,
  Download,
  FileArchive,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  ShieldCheck,
  Eye,
  X,
  Upload,
  FileSpreadsheet
} from 'lucide-react';

interface Recipient {
  name: string;
  email: string;
  grade?: string;
}

interface CertificateItem {
  id: string;
  recipient_name: string;
  recipient_email?: string;
  certificate_code: string;
  status: 'PENDING' | 'GENERATED' | 'FAILED';
  file_size_bytes?: number;
  error_message?: string;
  created_at: string;
  generated_at?: string;
  download_url?: string;
  preview_url?: string;
}

interface Job {
  id: string;
  title: string;
  course_name: string;
  issuer_organization: string;
  issue_date: string;
  instructor_name?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIALLY_FAILED' | 'FAILED';
  total_count: number;
  processed_count: number;
  success_count: number;
  failure_count: number;
  progress_percentage: number;
  error_summary?: string;
  created_at: string;
  completed_at?: string;
  download_all_url?: string;
  certificates?: CertificateItem[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'create' | 'jobs' | 'verify'>('create');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [title, setTitle] = useState('Fall 2026 Engineering Cohort');
  const [isTitleTouched, setIsTitleTouched] = useState(false);
  const [courseName, setCourseName] = useState('Distributed Systems & Cloud Architecture');
  const [issuerOrg, setIssuerOrg] = useState('Institute of Software Engineering');
  const [issueDate, setIssueDate] = useState('October 8, 2026');
  const [instructorName, setInstructorName] = useState('Prof. Sarah Mitchell');
  const [recipients, setRecipients] = useState<Recipient[]>([
    { name: 'Dr. Evelyn Reed', email: 'evelyn.reed@example.com', grade: 'High Honors' },
    { name: 'Marcus Aurelius Vance', email: 'marcus@example.com', grade: 'Distinction' },
    { name: 'Sophia Chen', email: 'sophia.chen@example.com' },
    { name: 'Kenji Sato', email: 'kenji.sato@example.com' },
  ]);

  // Validation
  const isTitleInvalid = (isTitleTouched || title.length > 0) && title.trim().length < 3;

  // Verification State
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Preview Modal
  const [previewCert, setPreviewCert] = useState<CertificateItem | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/v1/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
        if (data.length > 0 && !selectedJob) {
          fetchJobDetail(data[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching jobs:', e);
    }
  };

  const fetchJobDetail = async (jobId: string) => {
    try {
      const res = await fetch(`/api/v1/jobs/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedJob(data);
      }
    } catch (e) {
      console.error('Error fetching job detail:', e);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (!selectedJob) return;
    if (selectedJob.status === 'PROCESSING' || selectedJob.status === 'PENDING') {
      setIsPolling(true);
      const timer = setInterval(() => {
        fetchJobDetail(selectedJob.id);
        fetchJobs();
      }, 1500);
      return () => {
        clearInterval(timer);
        setIsPolling(false);
      };
    } else {
      setIsPolling(false);
    }
  }, [selectedJob?.status]);

  // CSV Parsing
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length === 0) {
        setCsvMessage('The uploaded file is empty.');
        return;
      }

      // Check header row
      const firstLineCols = lines[0].split(',').map(c => c.trim().replace(/^["']|["']$/g, '').toLowerCase());
      const hasHeader = firstLineCols.some(c => c.includes('name') || c.includes('email') || c.includes('grade'));

      let nameIdx = 0;
      let emailIdx = 1;
      let gradeIdx = 2;

      let startIndex = 0;
      if (hasHeader) {
        startIndex = 1;
        nameIdx = firstLineCols.findIndex(c => c.includes('name'));
        if (nameIdx === -1) nameIdx = 0;
        emailIdx = firstLineCols.findIndex(c => c.includes('email'));
        gradeIdx = firstLineCols.findIndex(c => c.includes('grade') || c.includes('honor') || c.includes('score'));
      }

      const parsed: Recipient[] = [];
      for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const nameVal = cols[nameIdx] || '';
        const emailVal = emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx] : '';
        const gradeVal = gradeIdx !== -1 && cols[gradeIdx] ? cols[gradeIdx] : undefined;

        if (nameVal.trim().length > 0) {
          parsed.push({
            name: nameVal.trim(),
            email: emailVal.trim(),
            grade: gradeVal ? gradeVal.trim() : undefined,
          });
        }
      }

      if (parsed.length > 0) {
        setRecipients(parsed);
        setCsvMessage(`Successfully loaded ${parsed.length} recipients from CSV.`);
      } else {
        setCsvMessage('Could not find valid recipient rows in the CSV file.');
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const downloadSampleCsv = () => {
    const csvContent = "name,email,grade\nAlice Walker,alice.walker@example.com,Distinction\nBob Henderson,bob.henderson@example.com,High Honors\nCatherine Wu,catherine.wu@example.com,Excellence\nDavid Miller,david.miller@example.com,\nElena Rostova,elena.rostova@example.com,Honors";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_recipients.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addRecipientRow = () => {
    setRecipients([...recipients, { name: '', email: '' }]);
  };

  const removeRecipientRow = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, field: keyof Recipient, val: string) => {
    const updated = [...recipients];
    updated[index] = { ...updated[index], [field]: val };
    setRecipients(updated);
  };

  // Submit Job
  const handleSubmitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTitleTouched(true);

    if (title.trim().length < 3) {
      return;
    }

    const validRecipients = recipients.filter(r => r.name.trim().length >= 2);
    if (validRecipients.length === 0) {
      alert('Please add at least one recipient with a valid name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/jobs?run_async=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          course_name: courseName.trim(),
          issuer_organization: issuerOrg.trim(),
          issue_date: issueDate.trim(),
          instructor_name: instructorName.trim() || undefined,
          recipients: validRecipients,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Validation Error: ${err.detail || 'Could not create job'}`);
        return;
      }

      const created = await res.json();
      await fetchJobs();
      await fetchJobDetail(created.id);
      setActiveTab('jobs');
    } catch (e: any) {
      alert(`Submission error: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify Certificate
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;

    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/v1/certificates/verify/${encodeURIComponent(verifyCode.trim().toUpperCase())}`);
      const data = await res.json();
      setVerifyResult(data);
    } catch (e: any) {
      setVerifyResult({ is_valid: false, verification_message: 'Verification request failed' });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Colorful Accent Line */}
      <div className="h-1.5 bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500" />

      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 shadow-sm flex items-center justify-center text-white">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                Bulk Certificate Generator
              </h1>
            </div>
          </div>

          <nav className="flex items-center space-x-1.5">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'create'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              New Batch
            </button>

            <button
              onClick={() => {
                setActiveTab('jobs');
                fetchJobs();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === 'jobs'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Batches
              {jobs.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'jobs' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {jobs.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('verify')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'verify'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Verify
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {/* TAB 1: CREATE BATCH */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200/80 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Create Batch</h2>
              </div>

              {/* Upload CSV Actions */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleCsvUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-900 border border-amber-300/80 shadow-2xs flex items-center gap-1.5 transition"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-600" />
                  Bulk Upload CSV
                </button>

                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                  Sample CSV
                </button>
              </div>
            </div>

            {csvMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{csvMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCsvMessage(null)}
                  className="text-emerald-600 hover:text-emerald-900 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleSubmitJob} className="space-y-6">
              {/* Event / Certificate Information */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Batch Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Batch Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onBlur={() => setIsTitleTouched(true)}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (!isTitleTouched) setIsTitleTouched(true);
                      }}
                      placeholder="e.g. 2026 Developer Certification"
                      className={`w-full rounded-xl px-3.5 py-2 text-sm transition focus:outline-none ${
                        isTitleInvalid
                          ? 'border-2 border-rose-500 bg-rose-50/40 text-rose-950 focus:border-rose-600 focus:ring-2 focus:ring-rose-200'
                          : 'border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
                      }`}
                    />
                    {isTitleInvalid && (
                      <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1.5 animate-in fade-in duration-150">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        Batch title must contain at least 3 characters.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Course or Event Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="e.g. Advanced System Architecture"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Issuing Organization <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={issuerOrg}
                      onChange={(e) => setIssuerOrg(e.target.value)}
                      placeholder="e.g. Academy of Cloud Engineering"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Issue Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        placeholder="October 8, 2026"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Signatory / Instructor
                      </label>
                      <input
                        type="text"
                        value={instructorName}
                        onChange={(e) => setInstructorName(e.target.value)}
                        placeholder="Prof. Sarah Mitchell"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Recipient Roster */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Recipients ({recipients.length})
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={addRecipientRow}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Row
                  </button>
                </div>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {recipients.map((r, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/70 border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition"
                    >
                      <span className="text-xs font-mono font-bold text-slate-400 w-6 text-center">
                        {idx + 1}
                      </span>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <input
                          type="text"
                          required
                          value={r.name}
                          onChange={(e) => updateRecipient(idx, 'name', e.target.value)}
                          placeholder="Recipient Full Name *"
                          className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                        />

                        <input
                          type="email"
                          value={r.email}
                          onChange={(e) => updateRecipient(idx, 'email', e.target.value)}
                          placeholder="Email (optional)"
                          className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                        />

                        <input
                          type="text"
                          value={r.grade || ''}
                          onChange={(e) => updateRecipient(idx, 'grade', e.target.value)}
                          placeholder="Honors / Grade (optional)"
                          className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeRecipientRow(idx)}
                        disabled={recipients.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 transition rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting || isTitleInvalid}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold text-xs tracking-wide transition shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Submitting Batch...
                    </>
                  ) : (
                    <>
                      Generate Certificates ({recipients.length})
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: BATCH HISTORY & ACTIVE JOB */}
        {activeTab === 'jobs' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Batches</h2>

              <button
                onClick={() => {
                  fetchJobs();
                  if (selectedJob) fetchJobDetail(selectedJob.id);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 flex items-center gap-1.5 transition shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
                Refresh
              </button>
            </div>

            {/* Job Selector Chips */}
            {jobs.length > 0 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                {jobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  return (
                    <button
                      key={job.id}
                      onClick={() => fetchJobDetail(job.id)}
                      className={`px-3.5 py-2.5 rounded-xl text-left border text-xs whitespace-nowrap transition flex items-center gap-2.5 ${
                        isSelected
                          ? 'bg-white border-indigo-500 ring-2 ring-indigo-100 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          job.status === 'COMPLETED'
                            ? 'bg-emerald-500 ring-2 ring-emerald-100'
                            : job.status === 'PARTIALLY_FAILED'
                            ? 'bg-amber-500 ring-2 ring-amber-100'
                            : job.status === 'PROCESSING'
                            ? 'bg-sky-500 animate-pulse ring-2 ring-sky-100'
                            : 'bg-rose-500 ring-2 ring-rose-100'
                        }`}
                      />
                      <div>
                        <div className="font-semibold text-slate-900 truncate max-w-[160px]">{job.title}</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {job.success_count}/{job.total_count} generated
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active Job Detail */}
            {selectedJob ? (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            selectedJob.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : selectedJob.status === 'PARTIALLY_FAILED'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : selectedJob.status === 'PROCESSING'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {selectedJob.status}
                        </span>

                        <span className="text-xs text-slate-400 font-mono">ID: {selectedJob.id}</span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900">{selectedJob.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Course: <span className="text-slate-800 font-medium">{selectedJob.course_name}</span> &bull; {selectedJob.issuer_organization} &bull; {selectedJob.issue_date}
                      </p>
                    </div>

                    {/* Download All ZIP */}
                    {selectedJob.success_count > 0 && (
                      <a
                        href={selectedJob.download_all_url || `/api/v1/jobs/${selectedJob.id}/download-all`}
                        download
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold transition flex items-center gap-1.5 self-start shadow-sm"
                      >
                        <FileArchive className="w-4 h-4" />
                        Download All (ZIP)
                      </a>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 font-medium">Generation Progress</span>
                      <span className="font-mono font-bold text-indigo-700">
                        {selectedJob.progress_percentage}% ({selectedJob.processed_count}/{selectedJob.total_count})
                      </span>
                    </div>

                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-300"
                        style={{ width: `${selectedJob.progress_percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Stat Counter Grid with Colored Accents */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-1">
                    <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 border-t-3 border-t-indigo-500">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total</div>
                      <div className="text-xl font-bold text-slate-900 mt-0.5">{selectedJob.total_count}</div>
                    </div>

                    <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 border-t-3 border-t-sky-500">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Processed</div>
                      <div className="text-xl font-bold text-sky-700 mt-0.5">{selectedJob.processed_count}</div>
                    </div>

                    <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 border-t-3 border-t-emerald-500">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Succeeded</div>
                      <div className="text-xl font-bold text-emerald-700 mt-0.5">{selectedJob.success_count}</div>
                    </div>

                    <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 border-t-3 border-t-rose-500">
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Failed</div>
                      <div className="text-xl font-bold text-rose-700 mt-0.5">{selectedJob.failure_count}</div>
                    </div>
                  </div>

                  {selectedJob.error_summary && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2 shadow-2xs">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>{selectedJob.error_summary}</span>
                    </div>
                  )}
                </div>

                {/* Recipient Results Table */}
                <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
                  <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Certificates ({selectedJob.certificates?.length || 0})
                    </h4>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-5 font-semibold">Recipient</th>
                          <th className="py-3 px-5 font-semibold">Code</th>
                          <th className="py-3 px-5 font-semibold">Status</th>
                          <th className="py-3 px-5 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {selectedJob.certificates?.map((cert) => (
                          <tr key={cert.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-5">
                              <div className="font-semibold text-slate-900">{cert.recipient_name}</div>
                              {cert.recipient_email && (
                                <div className="text-[11px] text-slate-500">{cert.recipient_email}</div>
                              )}
                            </td>

                            <td className="py-3.5 px-5 font-mono text-slate-600 font-medium">
                              {cert.certificate_code}
                            </td>

                            <td className="py-3.5 px-5">
                              {cert.status === 'GENERATED' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Generated
                                </span>
                              )}
                              {cert.status === 'FAILED' && (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <AlertCircle className="w-3 h-3 text-rose-600" />
                                    Failed
                                  </span>
                                  {cert.error_message && (
                                    <p className="text-[10px] text-rose-600 mt-1 max-w-xs truncate">
                                      {cert.error_message}
                                    </p>
                                  )}
                                </div>
                              )}
                              {cert.status === 'PENDING' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                  Pending
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-5 text-right">
                              {cert.status === 'GENERATED' && (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setPreviewCert(cert)}
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-medium transition flex items-center gap-1"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    Preview
                                  </button>

                                  <a
                                    href={cert.download_url || `/api/v1/certificates/${cert.id}/download`}
                                    download
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition flex items-center gap-1"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    PDF
                                  </a>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
                <FileArchive className="w-9 h-9 text-slate-400 mx-auto mb-2.5" />
                <p className="text-sm text-slate-500 font-medium">No batches created yet.</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-3.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
                >
                  Create First Batch
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: VERIFICATION */}
        {activeTab === 'verify' && (
          <div className="max-w-lg mx-auto space-y-6 pt-4">
            <div className="text-center space-y-1">
              <h2 className="text-lg font-bold text-slate-900">Certificate Verification</h2>
            </div>

            <form onSubmit={handleVerify} className="bg-white border border-slate-200/90 rounded-2xl p-6 space-y-4 shadow-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Certificate ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="e.g. CERT-2026-F9A1B2C3"
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-mono uppercase focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Search className="w-3.5 h-3.5" />
                    Verify
                  </button>
                </div>
              </div>
            </form>

            {verifyResult && (
              <div
                className={`p-6 rounded-2xl border space-y-3 transition shadow-xs ${
                  verifyResult.is_valid
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50/70 border-rose-300 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {verifyResult.is_valid ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                  )}
                  <span className="font-bold text-sm">
                    {verifyResult.is_valid ? 'Valid Certificate Record' : 'Unverified Code'}
                  </span>
                </div>

                <p className="text-xs opacity-90">{verifyResult.verification_message}</p>

                {verifyResult.is_valid && (
                  <div className="pt-3 border-t border-emerald-200 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-emerald-800 font-medium">Recipient:</span>
                      <span className="font-bold text-slate-900">{verifyResult.recipient_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-800 font-medium">Course:</span>
                      <span className="font-bold text-slate-900">{verifyResult.course_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-800 font-medium">Issuer:</span>
                      <span className="font-bold text-slate-900">{verifyResult.issuer_organization}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-800 font-medium">Issue Date:</span>
                      <span className="font-bold text-slate-900">{verifyResult.issue_date}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Certificate Preview Modal */}
      {previewCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Certificate Preview</h3>
                <p className="text-xs text-slate-500 font-mono font-medium">{previewCert.certificate_code}</p>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewCert.download_url || `/api/v1/certificates/${previewCert.id}/download`}
                  download
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </a>
                <button
                  onClick={() => setPreviewCert(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Certificate Frame Preview */}
            <div className="relative aspect-[1.414/1] bg-white rounded-xl p-6 border-4 border-slate-900 shadow-inner flex flex-col justify-between text-slate-900 select-none">
              <div className="absolute inset-2 border-2 border-amber-600/60 pointer-events-none" />
              <div className="absolute inset-3 border border-slate-200 pointer-events-none" />

              {/* Header */}
              <div className="text-center pt-2">
                <div className="text-[10px] tracking-widest font-bold text-amber-700 uppercase">
                  {selectedJob?.issuer_organization || 'INSTITUTE OF SOFTWARE ARCHITECTURE'}
                </div>
                <div className="text-lg sm:text-2xl font-serif font-bold text-slate-900 mt-1">
                  CERTIFICATE OF ACHIEVEMENT
                </div>
                <div className="text-[9px] uppercase tracking-wider text-slate-500 mt-1">
                  THIS IS PROUDLY PRESENTED TO
                </div>
              </div>

              {/* Name */}
              <div className="text-center my-auto py-2">
                <div className="text-xl sm:text-3xl font-serif font-bold text-slate-900 tracking-tight">
                  {previewCert.recipient_name}
                </div>
                <div className="w-36 sm:w-48 h-0.5 bg-amber-600 mx-auto mt-2" />
                <div className="text-[9px] text-slate-600 mt-3 max-w-sm mx-auto">
                  for successfully completing all curriculum requirements in
                </div>
                <div className="text-sm sm:text-base font-serif font-bold text-slate-800 mt-1">
                  {selectedJob?.course_name || 'Distributed Systems & Cloud Architecture'}
                </div>
              </div>

              {/* Bottom Footer */}
              <div className="flex items-end justify-between px-4 pb-2 text-[8px] text-slate-600">
                <div className="text-center w-24">
                  <div className="font-semibold text-slate-800">{selectedJob?.issue_date || 'October 8, 2026'}</div>
                  <div className="border-t border-slate-400 mt-1 pt-0.5 uppercase tracking-wider text-[7px]">
                    DATE OF ISSUANCE
                  </div>
                </div>

                <div className="w-12 h-12 rounded-full border-2 border-amber-600 bg-slate-900 text-amber-300 flex flex-col items-center justify-center font-bold text-[6px] tracking-wider">
                  <span>OFFICIAL</span>
                  <span>SEAL</span>
                </div>

                <div className="text-center w-24">
                  <div className="font-serif italic font-semibold text-slate-800">
                    {selectedJob?.instructor_name || 'Prof. Sarah Mitchell'}
                  </div>
                  <div className="border-t border-slate-400 mt-1 pt-0.5 uppercase tracking-wider text-[7px]">
                    AUTHORIZED SIGNATURE
                  </div>
                </div>
              </div>

              <div className="absolute bottom-1 left-4 right-4 flex justify-between text-[7px] text-slate-400 font-mono">
                <span>Verification ID: {previewCert.certificate_code}</span>
                <span>Authentic Record</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
