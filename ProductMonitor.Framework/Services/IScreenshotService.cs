﻿namespace ProductMonitor.Framework.Services
{
    public interface IScreenshotService
    {
        void TakeScreenshot(string tab, string saveLocation);
    }
}