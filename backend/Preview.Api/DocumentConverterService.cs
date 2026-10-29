using Aspose.Cells.Rendering;
using System.Text;
using SlidesSaveFormat = Aspose.Slides.Export.SaveFormat;

namespace Preview.Api;

public sealed class HtmlPreviewTooLargeException(long bytes)
    : Exception($"The full HTML export is {bytes:N0} bytes, too large for this JSON preview. Use the PDF view for this file.");

public sealed class DocumentConverterService(EmailPreviewService email)
{
    public HtmlConversion ConvertToHtmlPreview(Stream input, string extension, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        using var output = new MemoryStream();
        (int processed, int total) counts = extension.ToLowerInvariant() switch
        {
            ".doc" or ".docx" => ConvertWordToHtml(input, output),
            ".xls" or ".xlsx" => ConvertExcelToHtml(input, output),
            ".ppt" or ".pptx" => ConvertSlidesToHtml(input, output),
            ".eml" or ".msg" => email.ConvertToHtml(input, output, extension),
            _ => throw new NotSupportedException($"Unsupported extension: {extension}")
        };
        cancellationToken.ThrowIfCancellationRequested();
        if (output.Length > 100 * 1024 * 1024) throw new HtmlPreviewTooLargeException(output.Length);
        return new HtmlConversion(Encoding.UTF8.GetString(output.GetBuffer(), 0, checked((int)output.Length)),
            output.Length, counts.processed, counts.total);
    }

    private static (int processed, int total) ConvertWordToHtml(Stream input, Stream output)
    {
        var document = new Aspose.Words.Document(input);
        var total = document.PageCount;
        var options = new Aspose.Words.Saving.HtmlFixedSaveOptions
        {
            ExportEmbeddedImages = true,
            ExportEmbeddedCss = true,
            ExportEmbeddedFonts = true,
            ExportEmbeddedSvg = true,
            RemoveJavaScriptFromLinks = true
        };
        document.Save(output, options);
        return (total, total);
    }

    private static (int processed, int total) ConvertExcelToHtml(Stream input, Stream output)
    {
        using var workbook = new Aspose.Cells.Workbook(input);
        var total = workbook.Worksheets.Count;
        foreach (var worksheet in workbook.Worksheets)
        {
            // Aspose writes Excel's display value to HTML. A narrow date/number
            // column can therefore become literal "#####" before the browser
            // receives it. Fit first, then cap very wide columns for preview.
            worksheet.AutoFitColumns();
            for (var columnIndex = 0; columnIndex <= worksheet.Cells.MaxColumn; columnIndex++)
            {
                var column = worksheet.Cells.Columns[columnIndex];
                if (column.Width > 35) column.Width = 35;
            }
        }
        workbook.Save(output, new Aspose.Cells.HtmlSaveOptions
        {
            SheetSet = SheetSet.All,
            ShowAllSheets = true,
            ExportImagesAsBase64 = true,
            SaveAsSingleFile = true,
            // Single-file HTML hides worksheets behind JavaScript tabs. The
            // preview iframe blocks scripts, so show every sheet as static HTML.
            CssStyles = "div[id^='table_'][sheetName] { display: block !important; margin-bottom: 24px; } " +
                "div[id^='table_'][sheetName]::before { content: attr(sheetName); display: block; " +
                "font: bold 16px Arial, sans-serif; padding: 8px 0; } " +
                "#footer { display: none !important; } " +
                "body { margin: 0; overflow: auto !important; } " +
                "#section { overflow: auto !important; width: 100% !important; } " +
                "table { max-width: none !important; table-layout: auto !important; } " +
                "td, th { white-space: normal !important; overflow-wrap: anywhere !important; " +
                "word-break: break-word !important; vertical-align: top !important; }"
        });
        return (total, total);
    }

    private static (int processed, int total) ConvertSlidesToHtml(Stream input, Stream output)
    {
        using var presentation = new Aspose.Slides.Presentation(input);
        var total = presentation.Slides.Count;
        presentation.Save(output, SlidesSaveFormat.Html, new Aspose.Slides.Export.HtmlOptions
        {
            ShowHiddenSlides = true
        });
        return (total, total);
    }

    public Task ConvertToPdfPreviewAsync(Stream input, Stream output, string extension, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        // Aspose's conversion methods are synchronous. The caller limits concurrent conversions.
        switch (extension.ToLowerInvariant())
        {
            case ".doc":
            case ".docx":
                ConvertWordPreview(input, output);
                break;
            case ".xls":
            case ".xlsx":
                ConvertExcelPreview(input, output);
                break;
            case ".ppt":
            case ".pptx":
                ConvertSlidesPreview(input, output);
                break;
            case ".eml":
            case ".msg":
                email.ConvertToPdf(input, output, extension);
                break;
            default:
                throw new NotSupportedException($"Unsupported extension: {extension}");
        }
        return Task.CompletedTask;
    }

    private static void ConvertWordPreview(Stream input, Stream output)
    {
        var document = new Aspose.Words.Document(input);
        document.Save(output, new Aspose.Words.Saving.PdfSaveOptions());
    }

    private static void ConvertExcelPreview(Stream input, Stream output)
    {
        using var workbook = new Aspose.Cells.Workbook(input);
        var options = new Aspose.Cells.PdfSaveOptions
        {
            SheetSet = SheetSet.All
        };
        workbook.Save(output, options);
    }

    private static void ConvertSlidesPreview(Stream input, Stream output)
    {
        using var presentation = new Aspose.Slides.Presentation(input);
        presentation.Save(output, SlidesSaveFormat.Pdf, new Aspose.Slides.Export.PdfOptions { ShowHiddenSlides = true });
    }
}
