namespace Preview.Api;

public static class AsposeLicenses
{
    public static void Apply(string path)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("Aspose license file was not found", path);
        new Aspose.Words.License().SetLicense(path);
        new Aspose.Cells.License().SetLicense(path);
        new Aspose.Slides.License().SetLicense(path);
    }
}
