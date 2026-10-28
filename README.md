# File Preview POC

React + ASP.NET Core proof of concept for previewing files stored in Azure Blob Storage. Office documents can be rendered as complete HTML or PDF previews using Aspose.

Supported formats:

- Word: `.doc`, `.docx`
- Excel: `.xls`, `.xlsx`
- PowerPoint: `.ppt`, `.pptx`
- PDF, common images, and text files

## How it works

Office files are loaded as streams by the ASP.NET backend and converted with the matching Aspose library. The HTML endpoint returns JSON containing generated HTML and conversion statistics. React renders the HTML in a sandboxed `iframe` using `srcDoc`. The PDF view uses the separate PDF streaming/conversion endpoint and `react-pdf`.

The HTML conversion exports the complete document: all Word pages, Excel worksheets, and PowerPoint slides. Large HTML responses are held in memory because the POC returns HTML inside JSON; outputs over 100 MiB return HTTP 413.

## Prerequisites

- .NET SDK 9
- Node.js 22.13 or newer
- A current browser
- An Aspose license for production-quality output

## Run with local samples

The default configuration uses files in `backend/Preview.Api/samples`. No Azure account is required for the local demo.

Terminal 1:

```powershell
cd backend/Preview.Api
dotnet restore
dotnet run --urls http://localhost:5050
```

Terminal 2, from the repository root:

```powershell
npm install
npm run dev -- --host 127.0.0.1
```

Open <http://127.0.0.1:5175> and select a sample file, enter a file name, or upload a local test file.

## Aspose license

Without a license, Aspose adds evaluation watermarks. Set the license path before starting the backend:

```powershell
$env:Aspose__LicensePath="C:\path\to\Aspose.Total.lic"
dotnet run --urls http://localhost:5050
```

Do not commit the license file.

## Azure Blob Storage

Set both values before starting the backend:

```powershell
$env:AzureStorage__ConnectionString="your-azure-blob-connection-string"
$env:AzureStorage__ContainerName="your-container-name"
$env:Aspose__LicensePath="C:\path\to\Aspose.Total.lic"
dotnet run --urls http://localhost:5050
```

When Azure settings are present, the backend uses Azure Blob Storage instead of local samples. The local file list and upload endpoints are disabled in Azure mode.

## API endpoints

```text
GET  /api/health
GET  /api/files
POST /api/files
GET  /api/file/info/{blobName}
GET  /api/file/preview-html/{blobName}
GET  /api/file/preview/{blobName}
```

`/api/file/preview-html/{blobName}` returns JSON containing `type`, `content`, and `stats`. Statistics include original size, converted size, conversion time, cache status, and processed versus total pages, sheets, or slides.

For an existing PDF, the HTML endpoint returns a note pointing to `/api/file/preview/{blobName}`. Unsupported file types return HTTP 400 and missing files return HTTP 404.

## Project layout

```text
backend/Preview.Api/         ASP.NET Core API and Aspose services
backend/Preview.Api/samples/ Local test files included with the POC
src/                         React application and preview components
scripts/                     Smoke tests and conversion comparison tools
artifacts/                   Saved conversion evaluation report and JSON data
```

Important backend files:

- `Program.cs`: service registration and API routes
- `FileSources.cs`: Azure Blob and local file stream implementations
- `DocumentConverterService.cs`: Aspose HTML and PDF conversion
- `HtmlPreviewService.cs`: HTML response, timing, and in-memory cache
- `PreviewService.cs`: PDF conversion and streaming

## Tests and evaluation

With the backend running:

```powershell
npm run smoke
```

With both the backend and Vite running:

```powershell
npm run smoke:browser
```

Build the React frontend:

```powershell
npm run build
```

Measure the bundled Office samples, including the 20 MB and 40 MB workbooks:

```powershell
npm run compare
```

The comparison writes `artifacts/conversion-report.md` and `artifacts/conversion-comparison.json`. Rebuild the Markdown report from saved measurements without running conversions again:

```powershell
npm run compare -- --format-only
```

## Repository notes

The bundled samples and conversion evaluation files are intentionally included for this POC. Generated dependency/build folders and secrets are ignored, including `node_modules/`, `dist/`, `bin/`, `obj/`, environment files, and license files.

This is a POC and does not yet include authorization, background conversion jobs, persistent caching, or production upload validation.
