# Office conversion comparison

Measured: 2026-10-28T10:15:46.668Z

HTML and PDF conversions export the complete source document. The values are a snapshot of the endpoints at measurement time.

## Large Excel files

| File | Original | HTML output | HTML conversion | PDF output | PDF conversion |
| --- | ---: | ---: | ---: | ---: | ---: |
| 20mb.xlsx | 19.74 MiB | 82.54 MiB | 22,066 ms | 151.19 MiB | 145,878 ms |
| 40mb.xlsx | 41.37 MiB | 173.34 MiB generated; HTTP 413 | — | Not measured | — |

The 40 MB HTML output exceeded the endpoint’s 100 MiB JSON limit and was not served. Its full PDF conversion was attempted but the request failed after API working memory exceeded 7 GB.

## DOCX

### sample-word.docx

Original: **18,147 bytes (17.7 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 245,831 bytes (240.1 KiB) | 1,296 ms | 1,370 ms | Complete |
| PDF | 69,435 bytes (67.8 KiB) | 404 ms | 423 ms | Complete |

### React Boilerplate Walkthrough & Agent Overview.docx

Original: **1,727,782 bytes (1.65 MiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 2,964,459 bytes (2.83 MiB) | 1,760 ms | 1,798 ms | Complete |
| PDF | 172,498 bytes (168.5 KiB) | 940 ms | 948 ms | Complete |

## XLSX

### sample-excel.xlsx

Original: **8,877 bytes (8.7 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 7,656 bytes (7.5 KiB) | 800 ms | 804 ms | Complete |
| PDF | 46,680 bytes (45.6 KiB) | 196 ms | 203 ms | Complete |

### Excel-sample1.xlsx

Original: **41,409 bytes (40.4 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 138,236 bytes (135.0 KiB) | 480 ms | 488 ms | Complete |
| PDF | 125,582 bytes (122.6 KiB) | 318 ms | 325 ms | Complete |

### Excel-sample2.xlsx

Original: **38,724 bytes (37.8 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 72,801 bytes (71.1 KiB) | 682 ms | 686 ms | Complete |
| PDF | 66,532 bytes (65.0 KiB) | 112 ms | 117 ms | Complete |

### 20mb.xlsx

Original: **20,698,416 bytes (19.74 MiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 86,547,197 bytes (82.54 MiB) | 22,066 ms | 22,939 ms | Complete |
| PDF | 158,533,347 bytes (151.19 MiB) | 145,878 ms | 145,898 ms | Complete |

### 40mb.xlsx

Original: **43,380,153 bytes (41.37 MiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 181,758,392 bytes (173.34 MiB) (not served) | — | 38,886 ms | HTTP 413: response too large |
| PDF | — | — | — | Not measured |

## PPTX

### sample-slides.pptx

Original: **44,049 bytes (43.0 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 167,339 bytes (163.4 KiB) | 1,607 ms | 1,614 ms | Complete |
| PDF | 71,753 bytes (70.1 KiB) | 423 ms | 429 ms | Complete |

### AI-Hackathon-Proposal-Template-EPAM.pptx

Original: **4,493,071 bytes (4.28 MiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 509,795 bytes (497.8 KiB) | 1,778 ms | 1,787 ms | Complete |
| PDF | 375,413 bytes (366.6 KiB) | 1,312 ms | 1,359 ms | Complete |

**Timing:** Conversion is the server-recorded export time; request is the measured time to receive the response.

**Large PDFs:** For inputs from 10 to 30 MiB, the script requests only the first PDF byte. This still triggers full server conversion and reports the complete output size and conversion time, while avoiding a large download.
