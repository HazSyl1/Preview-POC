using Aspose.Words;
using SlidesSaveFormat = Aspose.Slides.Export.SaveFormat;

namespace Preview.Api;

public static class DemoSamples
{
    public static void EnsureCreated(string root)
    {
        Directory.CreateDirectory(root);

        var wordPath = Path.Combine(root, "sample-word.docx");
        var regenerateWord = !File.Exists(wordPath);
        if (!regenerateWord)
        {
            try { regenerateWord = new Document(wordPath).GetText().Contains("first-five-pages preview limit.", StringComparison.Ordinal); }
            catch { /* Leave user-edited sample files untouched. */ }
        }
        if (regenerateWord)
        {
            var document = new Document();
            var builder = new DocumentBuilder(document);
            for (var page = 1; page <= 7; page++)
            {
                builder.Writeln($"Word sample — page {page}");
                builder.Writeln("This document checks that every page is available in the preview.");
                if (page < 7) builder.InsertBreak(BreakType.PageBreak);
            }
            document.Save(wordPath, Aspose.Words.SaveFormat.Docx);
        }

        var pdfPath = Path.Combine(root, "sample-pdf.pdf");
        if (!File.Exists(pdfPath))
        {
            var document = new Document();
            new DocumentBuilder(document).Writeln("PDF sample — direct streaming path");
            document.Save(pdfPath, Aspose.Words.SaveFormat.Pdf);
        }

        var excelPath = Path.Combine(root, "sample-excel.xlsx");
        var regenerateExcel = !File.Exists(excelPath);
        if (!regenerateExcel)
        {
            try
            {
                using var existing = new Aspose.Cells.Workbook(excelPath);
                regenerateExcel = existing.Worksheets.Count > 1 &&
                    existing.Worksheets[1].Cells["A1"].StringValue == "This second sheet should not appear.";
            }
            catch { /* Leave user-edited sample files untouched. */ }
        }
        if (regenerateExcel)
        {
            using var workbook = new Aspose.Cells.Workbook();
            workbook.Worksheets[0].Name = "First sheet";
            workbook.Worksheets[0].Cells["A1"].PutValue("Excel sample — first sheet");
            workbook.Worksheets[0].Cells["A2"].PutValue("All sheets should appear in the preview.");
            workbook.Worksheets.Add("Second sheet").Cells["A1"].PutValue("This second sheet is included in the preview.");
            workbook.Save(excelPath, Aspose.Cells.SaveFormat.Xlsx);
        }

        var slidesPath = Path.Combine(root, "sample-slides.pptx");
        if (!File.Exists(slidesPath))
        {
            using var presentation = new Aspose.Slides.Presentation();
            for (var index = 0; index < 7; index++)
            {
                var slide = index == 0 ? presentation.Slides[0] : presentation.Slides.AddEmptySlide(presentation.LayoutSlides[0]);
                slide.Shapes.AddAutoShape(Aspose.Slides.ShapeType.Rectangle, 50, 90, 500, 120)
                    .TextFrame.Text = $"PowerPoint sample — slide {index + 1}";
            }
            presentation.Save(slidesPath, SlidesSaveFormat.Pptx);
        }

        var textPath = Path.Combine(root, "sample-notes.txt");
        if (!File.Exists(textPath)) File.WriteAllText(textPath, "Text sample — streamed as plain text.\nNo PDF conversion is needed.");

        var imagePath = Path.Combine(root, "sample-image.png");
        if (!File.Exists(imagePath))
            File.WriteAllBytes(imagePath, Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5JkAAAAASUVORK5CYII="));
    }
}
