using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using AngleSharp.Html.Parser;
using Aspose.Email;
using Aspose.Words.Loading;
using Ganss.Xss;

namespace Preview.Api;

public sealed record EmailPreviewResult(
    string Type, string Subject, string From, string To, string Cc, string? Date,
    string? BodyHtml, string? BodyText, IReadOnlyList<string> AttachmentNames, long OriginalFileSizeBytes);

public sealed class EmailPreviewService
{
    public async Task<EmailPreviewResult> GetAsync(FileInfoRecord file, IFileSource source, CancellationToken cancellationToken)
    {
        await using var stream = await source.OpenReadAsync(file, cancellationToken);
        try
        {
            using var message = Load(stream, Path.GetExtension(file.Name));
            return new EmailPreviewResult("email", message.Subject ?? "", message.From?.ToString() ?? "",
                message.To?.ToString() ?? "", message.CC?.ToString() ?? "",
                message.Date == default ? null : message.Date.ToString("O"),
                RenderBody(message), message.Body, AttachmentNames(message), file.Length);
        }
        catch (Exception ex) when (ex is not OperationCanceledException and not OutOfMemoryException)
        {
            throw new InvalidDataException("The email could not be parsed", ex);
        }
    }

    public (int processed, int total) ConvertToHtml(Stream input, Stream output, string extension)
    {
        try
        {
            using var message = Load(input, extension);
            var body = RenderBody(message);
            var attachments = AttachmentNames(message);
            var header = new StringBuilder("<section class=\"mail-header\"><h1>")
                .Append(Encode(message.Subject ?? "(No subject)"))
                .Append("</h1><dl>");
            AddHeader(header, "From", message.From?.ToString());
            AddHeader(header, "To", message.To?.ToString());
            AddHeader(header, "Cc", message.CC?.ToString());
            if (message.Date != default) AddHeader(header, "Date", message.Date.ToString("f"));
            header.Append("</dl></section>");
            var footer = new StringBuilder("<section class=\"mail-attachments\"><h2>Attachments (")
                .Append(attachments.Count).Append(")</h2>");
            if (attachments.Count > 0)
            {
                footer.Append("<ul>");
                foreach (var name in attachments) footer.Append("<li>").Append(Encode(name)).Append("</li>");
                footer.Append("</ul>");
            }
            footer.Append("</section>");
            var html = "<!doctype html><html><head><meta charset=\"utf-8\"><style>" +
                "body{font:14px/1.55 Arial,sans-serif;color:#243329;margin:24px;overflow-wrap:anywhere}" +
                ".mail-header,.mail-attachments{border-bottom:1px solid #ddd;padding-bottom:16px;margin-bottom:20px}" +
                ".mail-header h1{font-size:20px}.mail-header dl{display:grid;grid-template-columns:60px 1fr;gap:6px}" +
                ".mail-header dt{color:#777}.mail-header dd{margin:0}.mail-attachments{border-top:1px solid #ddd;padding-top:16px}" +
                "img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>" +
                header + "<main>" + body + "</main>" + footer + "</body></html>";
            var bytes = Encoding.UTF8.GetBytes(html);
            output.Write(bytes);
            return (1, 1);
        }
        catch (Exception ex) when (ex is not OperationCanceledException and not OutOfMemoryException)
        {
            throw new InvalidDataException("The email could not be converted to HTML", ex);
        }
    }

    public void ConvertToPdf(Stream input, Stream output, string extension)
    {
        try
        {
            using var message = Load(input, extension);
            using var mhtml = new MemoryStream();
            message.Save(mhtml, new MhtSaveOptions
            {
                MhtFormatOptions = MhtFormatOptions.WriteHeader | MhtFormatOptions.WriteOutlineAttachments,
                SkipInlineImages = false,
                SaveAttachments = false
            });
            mhtml.Position = 0;
            var loadOptions = new Aspose.Words.Loading.LoadOptions
            {
                LoadFormat = Aspose.Words.LoadFormat.Mhtml,
                ResourceLoadingCallback = new SkipExternalResources()
            };
            var document = new Aspose.Words.Document(mhtml, loadOptions);
            document.Save(output, new Aspose.Words.Saving.PdfSaveOptions());
        }
        catch (Exception ex) when (ex is not OperationCanceledException and not OutOfMemoryException)
        {
            throw new InvalidDataException("The email could not be converted to PDF", ex);
        }
    }

    private static MailMessage Load(Stream input, string extension) => extension.ToLowerInvariant() switch
    {
        ".eml" => MailMessage.Load(input, new EmlLoadOptions()),
        ".msg" => MailMessage.Load(input, new MsgLoadOptions { DeferAttachmentContent = true }),
        _ => throw new NotSupportedException($"Unsupported email extension: {extension}")
    };

    private static IReadOnlyList<string> AttachmentNames(MailMessage message) =>
        message.Attachments.Select(attachment => attachment.Name ?? "Unnamed attachment").ToArray();

    private static string Encode(string value) => WebUtility.HtmlEncode(value);

    private static void AddHeader(StringBuilder html, string label, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value)) html.Append("<dt>").Append(label).Append("</dt><dd>").Append(Encode(value)).Append("</dd>");
    }

    private static string RenderBody(MailMessage message)
    {
        using var output = new MemoryStream();
        message.Save(output, new HtmlSaveOptions { ResourceRenderingMode = ResourceRenderingMode.EmbedIntoHtml });
        var html = Encoding.UTF8.GetString(output.ToArray());
        var sanitizer = new HtmlSanitizer();
        sanitizer.AllowedAttributes.Clear();
        foreach (var attribute in new[] { "href", "src", "alt", "title", "width", "height", "colspan", "rowspan" }) sanitizer.AllowedAttributes.Add(attribute);
        sanitizer.AllowedTags.Remove("form");
        sanitizer.AllowedTags.Remove("input");
        sanitizer.AllowedTags.Remove("button");
        sanitizer.AllowedCssProperties.Clear();
        sanitizer.AllowedAtRules.Clear();
        sanitizer.AllowedSchemes.Add("data");
        sanitizer.AllowedSchemes.Add("mailto");
        var document = new HtmlParser().ParseDocument(sanitizer.Sanitize(html));
        foreach (var element in document.All)
        {
            if (element.HasAttribute("src"))
            {
                var src = element.GetAttribute("src") ?? "";
                if (element.LocalName != "img" || !Regex.IsMatch(src, "^data:image/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$", RegexOptions.IgnoreCase))
                    element.RemoveAttribute("src");
            }
            if (element.HasAttribute("href"))
            {
                var href = element.GetAttribute("href") ?? "";
                if (element.LocalName != "a" || !Uri.TryCreate(href, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https" or "mailto"))
                    element.RemoveAttribute("href");
            }
        }
        return document.Body?.InnerHtml ?? "";
    }

    private sealed class SkipExternalResources : IResourceLoadingCallback
    {
        public ResourceLoadingAction ResourceLoading(ResourceLoadingArgs args) => ResourceLoadingAction.Skip;
    }
}
