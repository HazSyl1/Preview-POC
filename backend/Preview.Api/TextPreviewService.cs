using System.Text;
using System.Xml;
using System.Xml.Linq;

namespace Preview.Api;

public sealed record TextPreviewResult(string Type, string Content, long OriginalFileSizeBytes, string? ParseWarning);

public sealed class TextPreviewService
{
    public async Task<TextPreviewResult> GetAsync(FileInfoRecord file, IFileSource source, string kind, CancellationToken cancellationToken)
    {
        await using var stream = await source.OpenReadAsync(file, cancellationToken);
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var content = await reader.ReadToEndAsync(cancellationToken);
        if (kind != "xml") return new TextPreviewResult(kind, content, file.Length, null);

        try
        {
            var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, IgnoreWhitespace = true };
            using var xmlReader = XmlReader.Create(new StringReader(content), settings);
            var document = XDocument.Load(xmlReader);
            var declaration = document.Declaration is null ? "" : document.Declaration + Environment.NewLine;
            return new TextPreviewResult(kind, declaration + document, file.Length, null);
        }
        catch (XmlException ex)
        {
            return new TextPreviewResult(kind, content, file.Length, $"XML could not be formatted: {ex.Message}");
        }
    }
}
