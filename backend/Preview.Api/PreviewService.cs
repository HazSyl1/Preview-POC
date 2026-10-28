using System.Diagnostics;
using Microsoft.Extensions.Caching.Memory;

namespace Preview.Api;

public sealed record ConvertedPreview(byte[]? Bytes, string? TemporaryPath, bool CacheHit, long ConversionTimeMs, long SizeBytes);
public sealed record CachedPreview(byte[]? Bytes, string? TemporaryPath, long ConversionTimeMs, long SizeBytes);

public sealed class PreviewService(IMemoryCache cache, DocumentConverterService converter, ILogger<PreviewService> logger)
{
    private const long MaxCachedBytes = 16 * 1024 * 1024;
    // Aspose loads the workbook in memory. Large conversions must not overlap.
    private readonly SemaphoreSlim _conversionSlots = new(1);

    public async Task<ConvertedPreview> GetPreviewAsync(FileInfoRecord file, IFileSource source, CancellationToken cancellationToken)
    {
        var key = $"preview:{file.Name}:{file.Version}";
        if (cache.TryGetValue<CachedPreview>(key, out var cached) && cached is not null)
            return new ConvertedPreview(cached.Bytes, cached.TemporaryPath, true, cached.ConversionTimeMs, cached.SizeBytes);

        await _conversionSlots.WaitAsync(cancellationToken);
        var inputPath = Path.Combine(Path.GetTempPath(), $"preview-input-{Guid.NewGuid():N}");
        var outputPath = Path.Combine(Path.GetTempPath(), $"preview-output-{Guid.NewGuid():N}.pdf");
        var returnOutputFile = false;
        try
        {
            if (cache.TryGetValue<CachedPreview>(key, out cached) && cached is not null)
                return new ConvertedPreview(cached.Bytes, cached.TemporaryPath, true, cached.ConversionTimeMs, cached.SizeBytes);

            var stopwatch = Stopwatch.StartNew();
            await using (var sourceStream = await source.OpenReadAsync(file, cancellationToken))
            await using (var inputFile = new FileStream(inputPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 64 * 1024, FileOptions.Asynchronous))
                await sourceStream.CopyToAsync(inputFile, cancellationToken);

            await using (var inputFile = new FileStream(inputPath, FileMode.Open, FileAccess.Read, FileShare.Read))
            await using (var outputFile = new FileStream(outputPath, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None))
                await converter.ConvertToPdfPreviewAsync(inputFile, outputFile, Path.GetExtension(file.Name), cancellationToken);

            var length = new FileInfo(outputPath).Length;
            stopwatch.Stop();
            var conversionTimeMs = stopwatch.ElapsedMilliseconds;
            if (length <= MaxCachedBytes)
            {
                var bytes = await File.ReadAllBytesAsync(outputPath, cancellationToken);
                cache.Set(key, new CachedPreview(bytes, null, conversionTimeMs, length), new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10),
                    Size = bytes.LongLength
                });
                return new ConvertedPreview(bytes, null, false, conversionTimeMs, length);
            }

            logger.LogInformation("Converted {Name} to {Length} bytes; streaming output from disk", file.Name, length);
            cache.Set(key, new CachedPreview(null, outputPath, conversionTimeMs, length), new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10),
                Size = 1,
                PostEvictionCallbacks =
                {
                    new PostEvictionCallbackRegistration
                    {
                        EvictionCallback = static (_, value, _, _) =>
                        {
                            if (value is CachedPreview { TemporaryPath: { } path })
                            {
                                try { File.Delete(path); }
                                catch (IOException) { /* An open response may still be reading it. */ }
                            }
                        }
                    }
                }
            });
            returnOutputFile = true;
            return new ConvertedPreview(null, outputPath, false, conversionTimeMs, length);
        }
        finally
        {
            _conversionSlots.Release();
            File.Delete(inputPath);
            if (!returnOutputFile) File.Delete(outputPath);
        }
    }
}
