namespace Preview.Api;

public static class PreviewTypes
{
    public static bool TryGet(string name, out string kind, out string contentType)
    {
        var extension = Path.GetExtension(name).ToLowerInvariant();
        (kind, contentType) = extension switch
        {
            ".pdf" => ("pdf", "application/pdf"),
            ".doc" or ".docx" or ".xls" or ".xlsx" or ".ppt" or ".pptx" => ("office", "application/pdf"),
            ".png" => ("image", "image/png"),
            ".jpg" or ".jpeg" => ("image", "image/jpeg"),
            ".gif" => ("image", "image/gif"),
            ".webp" => ("image", "image/webp"),
            ".txt" => ("text", "text/plain; charset=utf-8"),
            ".md" => ("markdown", "text/plain; charset=utf-8"),
            ".xml" => ("xml", "text/plain; charset=utf-8"),
            ".eml" or ".msg" => ("email", "application/pdf"),
            _ => ("", "")
        };
        return kind.Length > 0;
    }
}
