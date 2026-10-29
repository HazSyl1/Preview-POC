using Azure;
using Microsoft.Extensions.Caching.Memory;
using Preview.Api;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 200 * 1024 * 1024);
builder.Services.AddMemoryCache(options => options.SizeLimit = 64 * 1024 * 1024);
builder.Services.AddSingleton<DocumentConverterService>();
builder.Services.AddSingleton<PreviewService>();
builder.Services.AddSingleton<HtmlPreviewService>();
builder.Services.AddSingleton<EmailPreviewService>();
builder.Services.AddSingleton<TextPreviewService>();

var licensePath = builder.Configuration["Aspose:LicensePath"];
if (!string.IsNullOrWhiteSpace(licensePath)) AsposeLicenses.Apply(licensePath);

var connectionString = builder.Configuration["AzureStorage:ConnectionString"];
var containerName = builder.Configuration["AzureStorage:ContainerName"];
if (!string.IsNullOrWhiteSpace(connectionString) && !string.IsNullOrWhiteSpace(containerName))
{
    builder.Services.AddSingleton<IFileSource>(_ => new AzureBlobFileSource(connectionString, containerName));
}
else
{
    var sampleRoot = Path.Combine(builder.Environment.ContentRootPath, "samples");
    DemoSamples.EnsureCreated(sampleRoot);
    builder.Services.AddSingleton<IFileSource>(_ => new LocalFileSource(sampleRoot));
}

var app = builder.Build();
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Cache-Control"] = "private, no-store";
    context.Response.Headers["Content-Security-Policy"] = "frame-ancestors 'self'";
    await next();
});

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", source = string.IsNullOrWhiteSpace(connectionString) ? "local" : "azure" }));

app.MapGet("/api/files", async (IFileSource source, CancellationToken cancellationToken) =>
{
    if (source is not LocalFileSource local) return Results.NotFound();
    return Results.Ok(await local.ListAsync(cancellationToken));
});

app.MapPost("/api/files", async (IFileSource source, HttpContext http) =>
{
    if (source is not LocalFileSource local) return Results.NotFound();
    var encodedName = http.Request.Headers["X-File-Name"].ToString();
    if (string.IsNullOrWhiteSpace(encodedName)) return Results.BadRequest(new { error = "Missing file name" });
    if (http.Request.ContentLength is > 200 * 1024 * 1024) return Results.Problem("The local demo accepts files up to 200 MB.", statusCode: 413);
    try
    {
        var name = await local.SaveAsync(Uri.UnescapeDataString(encodedName), http.Request.Body, http.RequestAborted);
        return Results.Ok(new { name });
    }
    catch (ArgumentException) { return Results.BadRequest(new { error = "Unsupported file type" }); }
});

app.MapGet("/api/file/info/{**blobName}", async (string blobName, IFileSource source, CancellationToken cancellationToken) =>
{
    try
    {
        var file = await source.GetInfoAsync(blobName, cancellationToken);
        if (file is null) return Results.NotFound(new { error = "File not found" });
        if (!PreviewTypes.TryGet(file.Name, out var kind, out var contentType)) return Results.BadRequest(new { error = "Unsupported file type" });
        return Results.Ok(new { file.Name, file.Length, kind, contentType });
    }
    catch (ArgumentException) { return Results.BadRequest(new { error = "Invalid file name" }); }
    catch (RequestFailedException ex) when (ex.Status == 404) { return Results.NotFound(new { error = "File not found" }); }
});

app.MapGet("/api/file/preview-html/{**blobName}", async (string blobName, IFileSource source, HtmlPreviewService previews, HttpContext http) =>
{
    try
    {
        var file = await source.GetInfoAsync(blobName, http.RequestAborted);
        if (file is null) return Results.NotFound(new { error = "File not found" });
        var extension = Path.GetExtension(file.Name).ToLowerInvariant();
        if (extension == ".pdf") return Results.Ok(HtmlPreviewService.PdfNote(file));
        if (extension is not (".doc" or ".docx" or ".xls" or ".xlsx" or ".ppt" or ".pptx"))
            return Results.BadRequest(new { error = "Unsupported file type for HTML preview" });

        var converted = await previews.GetAsync(file, source, http.RequestAborted);
        if (http.Request.Query.ContainsKey("open"))
        {
            http.Response.Headers["Content-Security-Policy"] =
                "frame-ancestors 'self'; sandbox; default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline' data:";
            return Results.Content(converted.Content, "text/html; charset=utf-8");
        }
        return Results.Ok(converted);
    }
    catch (ArgumentException) { return Results.BadRequest(new { error = "Invalid file name or document" }); }
    catch (RequestFailedException ex) when (ex.Status == 404) { return Results.NotFound(new { error = "File not found" }); }
    catch (HtmlPreviewTooLargeException ex) { return Results.Json(new { error = ex.Message }, statusCode: 413); }
    catch (NotSupportedException) { return Results.BadRequest(new { error = "Unsupported file type for HTML preview" }); }
});

app.MapGet("/api/file/preview-email/{**blobName}", async (string blobName, IFileSource source, EmailPreviewService previews, HttpContext http) =>
{
    try
    {
        var file = await source.GetInfoAsync(blobName, http.RequestAborted);
        if (file is null) return Results.NotFound(new { error = "File not found" });
        if (!PreviewTypes.TryGet(file.Name, out var kind, out _) || kind != "email")
            return Results.BadRequest(new { error = "Unsupported file type for email preview" });
        return Results.Ok(await previews.GetAsync(file, source, http.RequestAborted));
    }
    catch (ArgumentException) { return Results.BadRequest(new { error = "Invalid file name or email" }); }
    catch (InvalidDataException) { return Results.BadRequest(new { error = "The email could not be parsed" }); }
    catch (RequestFailedException ex) when (ex.Status == 404) { return Results.NotFound(new { error = "File not found" }); }
});

app.MapGet("/api/file/preview-text/{**blobName}", async (string blobName, IFileSource source, TextPreviewService previews, HttpContext http) =>
{
    try
    {
        var file = await source.GetInfoAsync(blobName, http.RequestAborted);
        if (file is null) return Results.NotFound(new { error = "File not found" });
        if (!PreviewTypes.TryGet(file.Name, out var kind, out _) || kind is not ("text" or "markdown" or "xml"))
            return Results.BadRequest(new { error = "Unsupported file type for text preview" });
        return Results.Ok(await previews.GetAsync(file, source, kind, http.RequestAborted));
    }
    catch (ArgumentException) { return Results.BadRequest(new { error = "Invalid file name" }); }
    catch (RequestFailedException ex) when (ex.Status == 404) { return Results.NotFound(new { error = "File not found" }); }
});

app.MapGet("/api/file/preview/{**blobName}", async (string blobName, IFileSource source, PreviewService previews, HttpContext http) =>
{
    try
    {
        var file = await source.GetInfoAsync(blobName, http.RequestAborted);
        if (file is null) return Results.NotFound();
        if (!PreviewTypes.TryGet(file.Name, out var kind, out var contentType)) return Results.BadRequest(new { error = "Unsupported file type" });

        http.Response.Headers.ContentDisposition = kind == "email" ? "attachment" : "inline";
        if (kind != "office")
        {
            var stream = await source.OpenReadAsync(file, http.RequestAborted);
            return Results.File(stream, contentType, enableRangeProcessing: stream.CanSeek);
        }

        var converted = await previews.GetPreviewAsync(file, source, http.RequestAborted);
        http.Response.Headers["X-Preview-Cache"] = converted.CacheHit ? "HIT" : "MISS";
        http.Response.Headers["X-Preview-Conversion-Time-Ms"] = converted.ConversionTimeMs.ToString();
        http.Response.Headers["X-Preview-Size-Bytes"] = converted.SizeBytes.ToString();
        if (converted.Bytes is not null)
            return Results.File(converted.Bytes, "application/pdf", enableRangeProcessing: true);

        var output = new FileStream(converted.TemporaryPath!, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete, 64 * 1024,
            FileOptions.Asynchronous);
        return Results.File(output, "application/pdf", enableRangeProcessing: true);
    }
    catch (ArgumentException) { return Results.BadRequest(new { error = "Invalid file name" }); }
    catch (RequestFailedException ex) when (ex.Status == 404) { return Results.NotFound(); }
});

app.Run();
