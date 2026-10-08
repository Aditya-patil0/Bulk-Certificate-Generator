import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';

export interface Recipient {
  name: string;
  email?: string;
  grade?: string;
}

export interface CertificateItem {
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

export interface Job {
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

@Component({
  selector: 'app-certificate-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './certificate-generator.component.html',
  styleUrls: ['./certificate-generator.component.css']
})
export class CertificateGeneratorComponent implements OnInit, OnDestroy {
  activeTab: 'create' | 'jobs' | 'verify' = 'create';
  apiUrl = '/api/v1';

  title = 'Fall 2026 Engineering Cohort';
  isTitleTouched = false;
  courseName = 'Distributed Systems & Cloud Architecture';
  issuerOrganization = 'Institute of Software Engineering';
  issueDate = 'October 8, 2026';
  instructorName = 'Prof. Sarah Mitchell';
  recipients: Recipient[] = [
    { name: 'Dr. Evelyn Reed', email: 'evelyn@example.com', grade: 'High Honors' },
    { name: 'Marcus Aurelius Vance', email: 'marcus@example.com', grade: 'Distinction' },
    { name: 'Sophia Chen', email: 'sophia@example.com' },
    { name: 'Kenji Sato', email: 'kenji@example.com' }
  ];

  jobs: Job[] = [];
  selectedJob: Job | null = null;
  isSubmitting = false;
  pollSub?: Subscription;
  csvMessage: string | null = null;

  verifyCode = '';
  verifyResult: any = null;
  isVerifying = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchJobs();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  fetchJobs(): void {
    this.http.get<Job[]>(`${this.apiUrl}/jobs`).subscribe({
      next: (data) => {
        this.jobs = data;
        if (data.length > 0 && !this.selectedJob) {
          this.selectJob(data[0].id);
        }
      },
      error: (err) => console.error('Failed to fetch jobs', err)
    });
  }

  selectJob(jobId: string): void {
    this.http.get<Job>(`${this.apiUrl}/jobs/${jobId}`).subscribe({
      next: (job) => {
        this.selectedJob = job;
        if (job.status === 'PROCESSING' || job.status === 'PENDING') {
          this.startPolling(job.id);
        } else {
          this.stopPolling();
        }
      }
    });
  }

  startPolling(jobId: string): void {
    this.stopPolling();
    this.pollSub = interval(1500).subscribe(() => {
      this.http.get<Job>(`${this.apiUrl}/jobs/${jobId}`).subscribe({
        next: (job) => {
          this.selectedJob = job;
          if (job.status !== 'PROCESSING' && job.status !== 'PENDING') {
            this.stopPolling();
            this.fetchJobs();
          }
        }
      });
    });
  }

  stopPolling(): void {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = undefined;
    }
  }

  addRecipient(): void {
    this.recipients.push({ name: '', email: '' });
  }

  removeRecipient(index: number): void {
    this.recipients.splice(index, 1);
  }

  handleCsvFile(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) return;

      const firstCols = lines[0].split(',').map(c => c.trim().toLowerCase());
      const hasHeader = firstCols.some(c => c.includes('name') || c.includes('email'));
      let startIndex = hasHeader ? 1 : 0;
      let nameIdx = hasHeader ? firstCols.findIndex(c => c.includes('name')) : 0;
      if (nameIdx === -1) nameIdx = 0;
      let emailIdx = hasHeader ? firstCols.findIndex(c => c.includes('email')) : 1;
      let gradeIdx = hasHeader ? firstCols.findIndex(c => c.includes('grade') || c.includes('honor')) : 2;

      const parsed: Recipient[] = [];
      for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const nameVal = cols[nameIdx] || '';
        const emailVal = emailIdx !== -1 && cols[emailIdx] ? cols[emailIdx] : '';
        const gradeVal = gradeIdx !== -1 && cols[gradeIdx] ? cols[gradeIdx] : undefined;

        if (nameVal.length > 0) {
          parsed.push({ name: nameVal, email: emailVal, grade: gradeVal });
        }
      }

      if (parsed.length > 0) {
        this.recipients = parsed;
        this.csvMessage = `Loaded ${parsed.length} recipients from CSV.`;
      }
    };
    reader.readAsText(file);
  }

  downloadSampleCsv(): void {
    const csvContent = "name,email,grade\nAlice Walker,alice.walker@example.com,Distinction\nBob Henderson,bob.henderson@example.com,High Honors\nCatherine Wu,catherine.wu@example.com,Excellence\nDavid Miller,david.miller@example.com,";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_recipients.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  submitJob(): void {
    this.isTitleTouched = true;
    if (this.title.trim().length < 3) return;

    const valid = this.recipients.filter(r => r.name.trim().length >= 2);
    if (valid.length === 0) return;

    this.isSubmitting = true;
    const payload = {
      title: this.title.trim(),
      course_name: this.courseName.trim(),
      issuer_organization: this.issuerOrganization.trim(),
      issue_date: this.issueDate.trim(),
      instructor_name: this.instructorName.trim() || undefined,
      recipients: valid
    };

    this.http.post<Job>(`${this.apiUrl}/jobs?run_async=true`, payload).subscribe({
      next: (job) => {
        this.isSubmitting = false;
        this.fetchJobs();
        this.selectJob(job.id);
        this.activeTab = 'jobs';
      },
      error: (err) => {
        this.isSubmitting = false;
        alert(`Error: ${err.error?.detail || 'Failed to submit batch'}`);
      }
    });
  }

  verify(): void {
    if (!this.verifyCode.trim()) return;
    this.isVerifying = true;
    this.http.get(`${this.apiUrl}/certificates/verify/${encodeURIComponent(this.verifyCode.trim().toUpperCase())}`)
      .subscribe({
        next: (res) => {
          this.verifyResult = res;
          this.isVerifying = false;
        },
        error: () => {
          this.verifyResult = { is_valid: false, verification_message: 'Request failed' };
          this.isVerifying = false;
        }
      });
  }
}
