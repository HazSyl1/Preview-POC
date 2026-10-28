using System.Diagnostics;
using Microsoft.Extensions.Caching.Memory;

namespace Preview.Api;

public sealed record HtmlConversion(string Content, long ConvertedSizeBytes, int PagesProcessed, int TotalPages);

public sealed record HtmlPreviewStats(
    long OriginalFileSizeBytes,
    long ConvertedSizeBytes,
    long ConversionTimeMs,
    bool CacheHit,
    int PagesProcessed,
    int TotalPages);

public sealed record HtmlPreviewResponse(string Type, string? Content, HtmlPreviewStats Stats, string? Message = null);

public sealed class HtmlPreviewService(IMemoryCache cache, DocumentConverterService converter)
{
    private const long MaxCachedBytes = 16 * 1024 * 1024;
    private readonly SemaphoreSlim _conversionSlots = new(1);

    public async Task<HtmlPreviewResponse> GetAsync(FileInfoRecord file, IFileSource source, CancellationToken cancellationToken)
    {
        var key = $"preview-html:{file.Name}:{file.Version}";
        if (cache.TryGetValue<HtmlPreviewResponse>(key, out var cached) && cached is not null)
            return cached with { Stats = cached.Stats with { CacheHit = true } };

        await _conversionSlots.WaitAsync(cancellationToken);
        try
        {
            if (cache.TryGetValue<HtmlPreviewResponse>(key, out cached) && cached is not null)
                return cached with { Stats = cached.Stats with { CacheHit = true } };

            var stopwatch = Stopwatch.StartNew();
            await using var input = await source.OpenReadAsync(file, cancellationToken);
            // Aspose reads from the source stream. Only the resulting HTML is materialized
            // because the endpoint returns it as a JSON string and may cache it.
            var converted = converter.ConvertToHtmlPreview(input, Path.GetExtension(file.Name), cancellationToken);
            stopwatch.Stop();

            var stats = new HtmlPreviewStats(file.Length, converted.ConvertedSizeBytes,
                stopwatch.ElapsedMilliseconds, false, converted.PagesProcessed, converted.TotalPages);
            var response = new HtmlPreviewResponse("html", converted.Content, stats);
            if (converted.ConvertedSizeBytes <= MaxCachedBytes)
            {
                cache.Set(key, response, new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10),
                    Size = converted.ConvertedSizeBytes
                });
            }
            return response;
        }
        finally
        {
            _conversionSlots.Release();
        }
    }

    public static HtmlPreviewResponse PdfNote(FileInfoRecord file) => new("pdf", null,
        new HtmlPreviewStats(file.Length, 0, 0, false, 0, 0),
        "This file is already a PDF. Use /api/file/preview/{blobName} to stream it.");
}
