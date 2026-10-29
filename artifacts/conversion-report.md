# File conversion comparison

Measured: 2026-10-29T10:37:58.492Z

HTML and PDF conversions cover the complete source document or email body. Email attachment names are included; attachment contents are not rendered. The values are a snapshot of the endpoints at measurement time.

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

## EML

### sample-email.eml

Original: **1,240 bytes (1.2 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 1,446 bytes (1.4 KiB) | 54 ms | 58 ms | Aspose.Email evaluation mode |
| PDF | 100,477 bytes (98.1 KiB) | 313 ms | 321 ms | Aspose.Email evaluation mode |

### Shape the Future_ Become a Facilitator for the eKids AI for Good Eduthon.eml

Original: **48,002 bytes (46.9 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 7,678 bytes (7.5 KiB) | 55 ms | 62 ms | Aspose.Email evaluation mode |
| PDF | 147,516 bytes (144.1 KiB) | 965 ms | 973 ms | Aspose.Email evaluation mode |

### Weekly Threat Intelligence Digest.eml

Original: **70,846 bytes (69.2 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 18,427 bytes (18.0 KiB) | 88 ms | 94 ms | Aspose.Email evaluation mode |
| PDF | 182,291 bytes (178.0 KiB) | 1,181 ms | 1,220 ms | Aspose.Email evaluation mode |

### [Action required] Migrate your legacy user API keys.eml

Original: **17,255 bytes (16.9 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 6,207 bytes (6.1 KiB) | 34 ms | 41 ms | Aspose.Email evaluation mode |
| PDF | 127,314 bytes (124.3 KiB) | 809 ms | 821 ms | Aspose.Email evaluation mode |

## MSG

### sample-outlook.msg

Original: **209,408 bytes (204.5 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 2,230 bytes (2.2 KiB) | 49 ms | 55 ms | Aspose.Email evaluation mode |
| PDF | 126,458 bytes (123.5 KiB) | 529 ms | 539 ms | Aspose.Email evaluation mode |

### Did you fill_.msg

Original: **242,688 bytes (237.0 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 152,702 bytes (149.1 KiB) | 1,873 ms | 1,957 ms | Aspose.Email evaluation mode |
| PDF | 180,414 bytes (176.2 KiB) | 4,207 ms | 4,241 ms | Aspose.Email evaluation mode |

### EPAM Daily Digest.msg

Original: **317,440 bytes (310.0 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 30,181 bytes (29.5 KiB) | 329 ms | 334 ms | Aspose.Email evaluation mode |
| PDF | 191,525 bytes (187.0 KiB) | 1,598 ms | 1,638 ms | Aspose.Email evaluation mode |

### EPAM Premier League - Men _ Congratulations Champions - Mighty Mavericks 🏆.msg

Original: **26,146,816 bytes (24.94 MiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 2,191,249 bytes (2.09 MiB) | 1,671 ms | 1,729 ms | Aspose.Email evaluation mode |
| PDF | 170,294 bytes (166.3 KiB) | 4,191 ms | 4,213 ms | Aspose.Email evaluation mode |

### Prudent Wellness Friday_ Festive Ready_ Let’s Get You There!.msg

Original: **114,688 bytes (112.0 KiB)**

| Format | Output | Conversion | Request | Result |
| --- | ---: | ---: | ---: | --- |
| HTML | 3,823 bytes (3.7 KiB) | 111 ms | 116 ms | Aspose.Email evaluation mode |
| PDF | 140,347 bytes (137.1 KiB) | 522 ms | 545 ms | Aspose.Email evaluation mode |

**Timing:** Conversion is the server-recorded export time; request is the measured time to receive the response.

**Large PDFs:** For inputs from 10 to 30 MiB, the script requests only the first PDF byte. This still triggers full server conversion and reports the complete output size and conversion time, while avoiding a large download.
