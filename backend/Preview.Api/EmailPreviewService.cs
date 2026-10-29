using System.Text.RegularExpressions;
using AngleSharp.Html.Parser;
using Ganss.Xss;
using MimeKit;
using MsgReader.Outlook;

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
            return Path.GetExtension(file.Name).ToLowerInvariant() == ".eml"
                ? await ReadEmlAsync(stream, file.Length, cancellationToken)
                : ReadMsg(stream, file.Length);
        }
        catch (Exception ex) when (ex is not OperationCanceledException and not OutOfMemoryException)
        {
            throw new InvalidDataException("The email could not be parsed", ex);
        }
    }

    private static async Task<EmailPreviewResult> ReadEmlAsync(Stream stream, long length, CancellationToken cancellationToken)
    {
        var message = await MimeMessage.LoadAsync(stream, cancellationToken);
        var inlineImages = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrEmpty(message.HtmlBody))
        {
            foreach (var part in message.BodyParts.OfType<MimePart>())
            {
                if (string.IsNullOrWhiteSpace(part.ContentId) || part.Content is null || !IsInlineImage(part.ContentType.MimeType)) continue;
                if (!message.HtmlBody!.Contains("cid:" + part.ContentId.Trim('<', '>'), StringComparison.OrdinalIgnoreCase)) continue;
                using var image = new MemoryStream();
                await part.Content.DecodeToAsync(image, cancellationToken);
                inlineImages[part.ContentId.Trim('<', '>')] = $"data:{part.ContentType.MimeType};base64,{Convert.ToBase64String(image.ToArray())}";
            }
        }
        var attachments = message.Attachments.Select(part => part is MimePart mimePart
            ? mimePart.FileName ?? "Unnamed attachment"
            : part.ContentDisposition?.FileName ?? "Unnamed attachment").ToArray();
        return new EmailPreviewResult("email", message.Subject ?? "", message.From.ToString(), message.To.ToString(),
            message.Cc.ToString(), message.Date == default ? null : message.Date.ToString("O"),
            CleanHtml(message.HtmlBody, inlineImages), message.TextBody, attachments, length);
    }

    private static EmailPreviewResult ReadMsg(Stream stream, long length)
    {
        using var message = new Storage.Message(stream);
        var inlineImages = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var attachment in message.Attachments.OfType<Storage.Attachment>())
        {
            var contentId = attachment.ContentId?.Trim('<', '>');
            if (string.IsNullOrWhiteSpace(contentId) || message.BodyHtml?.Contains("cid:" + contentId, StringComparison.OrdinalIgnoreCase) != true) continue;
            var mime = GetImageMime(attachment.FileName);
            if (mime is null || attachment.IsExternalReference || attachment.Data is null) continue;
            inlineImages[contentId] = $"data:{mime};base64,{Convert.ToBase64String(attachment.Data)}";
        }
        var names = message.Attachments.Select(attachment => attachment is Storage.Attachment file
            ? file.FileName ?? "Unnamed attachment" : "Embedded message").ToArray();
        var sender = message.Sender is null ? "" : $"{message.Sender.DisplayName} <{message.Sender.Email}>";
        return new EmailPreviewResult("email", message.Subject ?? "", sender,
            message.GetEmailRecipients(RecipientType.To, false, false),
            message.GetEmailRecipients(RecipientType.Cc, false, false),
            message.SentOn?.ToString("O"), CleanHtml(message.BodyHtml, inlineImages), message.BodyText, names, length);
    }

    private static bool IsInlineImage(string mime) => mime is "image/png" or "image/jpeg" or "image/gif" or "image/webp";
    private static string? GetImageMime(string? fileName) => Path.GetExtension(fileName ?? "").ToLowerInvariant() switch
    {
        ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".gif" => "image/gif", ".webp" => "image/webp", _ => null
    };

    private static string? CleanHtml(string? html, IReadOnlyDictionary<string, string> inlineImages)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;
        html = Regex.Replace(html, "cid:([^\\s\"'<>]+)", match => inlineImages.TryGetValue(Uri.UnescapeDataString(match.Groups[1].Value.Trim('<', '>')), out var image) ? image : "", RegexOptions.IgnoreCase);
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
        return document.Body?.InnerHtml;
    }
}
