# Minimalist Angular Client - Bulk Certificate Generator

This directory contains the standalone Angular 17+ client component designed to interface with the Bulk Certificate Generator REST API (`/api/v1`).

## Architecture & Integration

- **Standalone Component**: `CertificateGeneratorComponent` (`standalone: true`).
- **Reactive Polling**: Uses RxJS `interval` to monitor generation batch progress while in `PROCESSING` state.
- **Minimal Footprint**: Clean layout with zero bloated dependencies.

## Usage in an Angular Workspace

1. Copy `src/app/certificate-generator/` to your Angular project's `src/app/` folder.
2. Ensure `provideHttpClient()` is configured in `app.config.ts`.
3. Include `<app-certificate-generator></app-certificate-generator>` in your template or router configuration.
