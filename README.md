# File Preview POC

React + ASP.NET Core proof of concept for previewing files stored in Azure Blob Storage. Office documents and email messages can be rendered as HTML or PDF previews using Aspose.

Supported formats:

- Word: `.doc`, `.docx`
- Excel: `.xls`, `.xlsx`
- PowerPoint: `.ppt`, `.pptx`
- PDF: `.pdf`
- Email: `.eml`, `.msg`
- Text: `.txt`, `.md`, `.xml`
- Images: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`

## How it works

Office files are loaded as streams by the ASP.NET backend and converted with the matching Aspose library. The HTML endpoint returns JSON containing generated HTML and conversion statistics. React renders the HTML in a sandboxed `iframe` using `srcDoc`. The PDF view uses the separate PDF streaming/conversion endpoint and `react-pdf`.

The HTML conversion exports the complete document: all Word pages, Excel worksheets, and PowerPoint slides. Large HTML responses are held in memory because the POC returns HTML inside JSON; outputs over 100 MiB return HTTP 413.

EML and MSG are loaded with Aspose.Email. Its HTML export embeds inline images; external HTTP/HTTPS image URLs are preserved and loaded directly by the sandboxed React iframe. Scripts and interactive email controls remain blocked. Browsers may block HTTP images when the app is served over HTTPS. For PDF, Aspose.Email creates MHTML in memory and Aspose.Words renders that stream as PDF. Email headers and attachment names are included; attachment contents are not rendered. Both modes report original/output size and conversion time through the same preview endpoints as Office files. Markdown is rendered with raw HTML disabled and remote images blocked. TXT and XML display as text; XML is indented when valid, or shown unchanged with a warning when parsing fails. These previews show the full accepted file content without an extra preview cutoff.

## Prerequisites

- .NET SDK 9
- Node.js 22.13 or newer
- A current browser
- Aspose.Words, Aspose.Cells, Aspose.Slides, and Aspose.Email licenses for unrestricted output

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

Place the license file in `backend/Preview.Api/` using this name:

```text
Aspose.Total.NET.lic
```

The paths are already configured in `backend/Preview.Api/appsettings.json`. Without a license, Aspose adds evaluation watermarks. Do not commit the `.lic` files.

```powershell
$env:Aspose__LicensePath="C:\path\to\Aspose.Total.NET.lic"
$env:Aspose__EmailLicensePath="C:\path\to\Aspose.Total.NET.lic"
dotnet run --urls http://localhost:5050
```

Without an Aspose.Email license, email conversion runs in evaluation mode. In that mode, [Aspose.Email extracts only three attachments or inline images from an MSG file](https://docs.aspose.com/email/net/licensing-and-limitations/), so image-heavy MSG previews will have missing images. The UI and comparison report identify evaluation results.

If the license predates the installed Aspose package versions, startup logs a license-version warning and continues in evaluation mode. Renew the license or pin the Aspose packages to versions released before the license subscription end date for licensed output.

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
GET  /api/file/preview-email/{blobName}
GET  /api/file/preview-text/{blobName}
GET  /api/file/preview/{blobName}
```

`/api/file/preview-html/{blobName}` returns JSON containing `type`, `content`, and `stats`. Statistics include original size, converted size, conversion time, cache status, and processed versus total pages, sheets, slides, or email messages.

For an existing PDF, the HTML endpoint returns a note pointing to `/api/file/preview/{blobName}`. Unsupported file types return HTTP 400 and missing files return HTTP 404.

`/api/file/preview-email/{blobName}` returns Aspose.Email metadata, sanitized `bodyHtml`, `bodyText`, `attachmentNames`, and `originalFileSizeBytes`. `/api/file/preview-html/{blobName}` converts Office and email files to HTML with conversion stats. `/api/file/preview/{blobName}` converts Office and email files to PDF with size and timing headers. `/api/file/preview-text/{blobName}` returns `type`, full `content`, `originalFileSizeBytes`, and an optional `parseWarning`.

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
- `EmailPreviewService.cs`: Aspose.Email loading and HTML/MHTML conversion

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

Measure the bundled Office and email samples, including the 20 MB and 40 MB workbooks:

```powershell
npm run compare
```

The comparison writes `artifacts/conversion-report.md` and `artifacts/conversion-comparison.json`. Rebuild the Markdown report from saved measurements without running conversions again:

```powershell
npm run compare -- --format-only
```

To measure all email files currently in the local samples folder and update their rows while retaining earlier Office results:

```powershell
npm run compare -- --emails
```

## Repository notes

The bundled samples and conversion evaluation files are intentionally included for this POC. Generated dependency/build folders and secrets are ignored, including `node_modules/`, `dist/`, `bin/`, `obj/`, environment files, and license files.

`sample-outlook.msg` comes from [MSGReader's public test samples](https://github.com/Sicos1977/MSGReader/blob/master/MsgReaderTests/SampleFiles/HtmlSampleEmailWithAttachment.msg) (MIT license). It is included to exercise the MSG parser with a real Outlook file.

This is a POC and does not yet include authorization, background conversion jobs, persistent caching, or production upload validation.
