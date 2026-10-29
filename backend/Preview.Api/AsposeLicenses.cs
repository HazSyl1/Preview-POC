namespace Preview.Api;

public static class AsposeLicenses
{
    public static bool EmailLicensed { get; private set; }

    public static void Apply(string path)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("Aspose license file was not found", path);
        new Aspose.Words.License().SetLicense(path);
        new Aspose.Cells.License().SetLicense(path);
        new Aspose.Slides.License().SetLicense(path);
        try { ApplyEmail(path); }
        catch (Exception ex) { Console.Error.WriteLine($"Aspose.Email license could not be applied; email previews will run in evaluation mode: {ex.Message}"); }
    }

    public static void ApplyEmail(string path)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("Aspose.Email license file was not found", path);
        new Aspose.Email.License().SetLicense(path);
        EmailLicensed = true;
    }
}
