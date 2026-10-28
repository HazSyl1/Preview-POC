using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace Preview.Api;

public sealed record FileInfoRecord(string Name, long Length, string Version);

public interface IFileSource
{
    Task<FileInfoRecord?> GetInfoAsync(string name, CancellationToken cancellationToken);
    Task<Stream> OpenReadAsync(FileInfoRecord file, CancellationToken cancellationToken);
}

public sealed class AzureBlobFileSource(string connectionString, string containerName) : IFileSource
{
    private readonly BlobContainerClient _container = new(connectionString, containerName);

    public async Task<FileInfoRecord?> GetInfoAsync(string name, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Missing file name", nameof(name));
        var blob = _container.GetBlobClient(name);
        var properties = await blob.GetPropertiesAsync(cancellationToken: cancellationToken);
        return new FileInfoRecord(name, properties.Value.ContentLength, properties.Value.ETag.ToString());
    }

    public async Task<Stream> OpenReadAsync(FileInfoRecord file, CancellationToken cancellationToken)
    {
        var blob = _container.GetBlobClient(file.Name);
        return await blob.OpenReadAsync(new BlobOpenReadOptions(false), cancellationToken);
    }
}

public sealed class LocalFileSource(string root) : IFileSource
{
    private readonly string _root = Path.GetFullPath(root);

    private string Resolve(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || Path.IsPathRooted(name) || name.Contains('\\'))
            throw new ArgumentException("Invalid file name", nameof(name));
        var path = Path.GetFullPath(Path.Combine(_root, name.Replace('/', Path.DirectorySeparatorChar)));
        if (!path.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Invalid file name", nameof(name));
        return path;
    }

    public Task<FileInfoRecord?> GetInfoAsync(string name, CancellationToken cancellationToken)
    {
        var path = Resolve(name);
        var info = new FileInfo(path);
        return Task.FromResult<FileInfoRecord?>(info.Exists
            ? new FileInfoRecord(name, info.Length, $"{info.LastWriteTimeUtc.Ticks}:{info.Length}")
            : null);
    }

    public Task<Stream> OpenReadAsync(FileInfoRecord file, CancellationToken cancellationToken)
    {
        Stream stream = new FileStream(Resolve(file.Name), FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024,
            FileOptions.Asynchronous | FileOptions.SequentialScan);
        return Task.FromResult(stream);
    }

    public Task<IReadOnlyList<string>> ListAsync(CancellationToken cancellationToken)
    {
        if (!Directory.Exists(_root)) return Task.FromResult<IReadOnlyList<string>>([]);
        IReadOnlyList<string> names = Directory.EnumerateFiles(_root, "*", SearchOption.AllDirectories)
            .Select(path => Path.GetRelativePath(_root, path).Replace('\\', '/'))
            .Where(name => PreviewTypes.TryGet(name, out _, out _))
            .OrderBy(name => name, StringComparer.OrdinalIgnoreCase).ToArray();
        return Task.FromResult(names);
    }

    public async Task<string> SaveAsync(string submittedName, Stream input, CancellationToken cancellationToken)
    {
        var baseName = Path.GetFileName(submittedName.Replace('\\', '/'));
        if (string.IsNullOrWhiteSpace(baseName) || !PreviewTypes.TryGet(baseName, out _, out _))
            throw new ArgumentException("Unsupported file type", nameof(submittedName));
        var safeName = $"{Path.GetFileNameWithoutExtension(baseName)}-{Guid.NewGuid():N}{Path.GetExtension(baseName)}";
        Directory.CreateDirectory(_root);
        await using var output = new FileStream(Resolve(safeName), FileMode.CreateNew, FileAccess.Write, FileShare.None, 64 * 1024, FileOptions.Asynchronous);
        await input.CopyToAsync(output, cancellationToken);
        return safeName;
    }
}
